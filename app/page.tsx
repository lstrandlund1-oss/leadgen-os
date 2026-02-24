"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import type { Lead, Language, SearchRecord, SocialPresence } from "@/lib/types";

const STORAGE_KEY = "leadgen_os_state_v1";

// ---------------------
// UI-only enrichment
// ---------------------
type OpportunitySignal = {
  type: string;
  message: string;
  strength: "high" | "medium" | "low";
};

type FitUI = {
  fitScore: number; // 0-100
  matchedNeeds: string[];
  missingNeeds: string[];
  reasons: string[];
};

type LeadUI = Lead & {
  // Legacy (still tolerated while DB/UI migrates)
  opportunitySignals?: OpportunitySignal[] | null;
  primaryInsight?: OpportunitySignal | null;

  // ✅ NEW
  fit?: FitUI;

  // New (preferred when present)
  primaryWorkTypeInsight?: {
    code: string;
    message: string;
    strength: "high" | "medium" | "low";
  } | null;
  primaryResistanceInsight?: {
    code: string;
    message: string;
    strength: "high" | "medium" | "low";
  } | null;
};

type LeadOutcomeUI = {
  run_id: number;
  lead_id: string;
  contacted: boolean;
  replied: boolean;
  booked_call: boolean;
  closed: boolean;
  revenue: number | null;
  notes: string | null;
};

const OUTCOME_KEYS = [
  ["contacted", "Contacted"],
  ["replied", "Replied"],
  ["booked_call", "Booked"],
  ["closed", "Closed"],
] as const;

type OutcomeKey = (typeof OUTCOME_KEYS)[number][0];

function buildOutcomePatch(key: OutcomeKey, value: boolean) {
  const patch: Partial<
    Pick<LeadOutcomeUI, "contacted" | "replied" | "booked_call" | "closed">
  > = {};
  patch[key] = value;
  return patch;
}

function leadLocation(lead: Lead): string {
  const parts = [lead.company.city, lead.company.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown";
}

function bandLabel(language: Language, n: number): string {
  const v = Math.max(0, Math.min(100, Math.round(n)));
  const level = v >= 70 ? "high" : v >= 45 ? "medium" : "low";

  if (language === "sv") {
    if (level === "high") return "Hög";
    if (level === "medium") return "Medium";
    return "Låg";
  }
  return level === "high" ? "High" : level === "medium" ? "Medium" : "Low";
}

// ---------------------
// Insight selection + localization
// ---------------------

function localizeOpportunityMessage(
  insight: OpportunitySignal | null | undefined,
  language: Language,
): string | null {
  if (!insight) return null;

  const sv: Record<string, string> = {
    conversion_gap:
      "Starka recensioner men ingen webbplats — tydlig konverteringspotential.",
    trust_gap: "Ingen webbplats — konverteringsfriktion och tappat förtroende.",
    untapped_attention:
      "Hög efterfrågan men svag närvaro — tydlig content-lucka.",
    underexposed_quality: "Hög kvalitet men låg synlighet — tillväxtmöjlighet.",
    scaling_ready:
      "Stabil grund men det skalar inte — redo för ett tillväxtsystem.",
  };

  const en: Record<string, string> = {
    conversion_gap: "Strong reputation but no website — high conversion upside.",
    trust_gap: "No website — conversion + trust friction.",
    untapped_attention: "High demand but weak social presence — content gap.",
    underexposed_quality:
      "High quality service but low visibility — growth opportunity.",
    scaling_ready: "Stable base but not scaling — ready for a growth system.",
  };

  const dict = language === "sv" ? sv : en;
  return dict[insight.type] ?? insight.message ?? null;
}

function normalizeLegacyOrNewOpportunityInsight(
  lead: LeadUI,
): OpportunitySignal | null {
  // Prefer new structured insight if present
  if (lead.primaryWorkTypeInsight?.message) {
    return {
      type: lead.primaryWorkTypeInsight.code,
      message: lead.primaryWorkTypeInsight.message,
      strength: lead.primaryWorkTypeInsight.strength,
    };
  }

  // Fallback to legacy
  if (lead.primaryInsight) return lead.primaryInsight;

  const sigs = Array.isArray(lead.opportunitySignals)
    ? lead.opportunitySignals
    : [];
  if (!sigs.length) return null;

  const priority = { high: 3, medium: 2, low: 1 } as const;
  return sigs
    .slice()
    .sort((a, b) => priority[b.strength] - priority[a.strength])[0];
}

function getLocalizedOpportunityInsight(
  lead: LeadUI,
  language: Language,
): OpportunitySignal | null {
  const base = normalizeLegacyOrNewOpportunityInsight(lead);
  if (!base) return null;

  const msg = localizeOpportunityMessage(base, language);
  if (!msg) return null;

  return { ...base, message: msg };
}

function riskTitleFromProfile(
  language: Language,
  p: Lead["score"]["riskProfile"] | null | undefined,
): string {
  if (language === "sv") {
    if (p === "unstable_business") return "Hög risk: saknar grunder";
    if (p === "mature_competitor") return "Hög risk: redan väloptimerad";
    return "Risk";
  }
  if (p === "unstable_business") return "High risk: missing fundamentals";
  if (p === "mature_competitor") return "High risk: already well-served";
  return "Risk";
}

function riskMessage(language: Language, lead: Lead): string {
  const rp = lead.score.riskProfile;
  const risk = lead.score.risk ?? 0;

  if (language === "sv") {
    if (rp === "unstable_business") {
      return "Låg mognad + låg proof. Ofta svårt att få momentum utan att fixa grunderna först.";
    }
    if (rp === "mature_competitor") {
      return "Stark närvaro + starkt proof. Svårare att vinna — kräver tydlig differentiering och systemvinkel.";
    }
    if (risk >= 70)
      return "Hög risk. Kräver tydlig vinkel och starkare erbjudande för att vinna.";
    if (risk >= 45)
      return "Mellanrisk. Går att vinna med rätt angle och tydlig payoff.";
    return "Låg risk. Relativt lätt att få respons om erbjudandet är skarpt.";
  }

  if (rp === "unstable_business") {
    return "Low maturity + weak proof. Usually hard to convert unless fundamentals are fixed first.";
  }
  if (rp === "mature_competitor") {
    return "Strong presence + strong proof. Harder to displace — requires differentiation and a system angle.";
  }
  if (risk >= 70)
    return "High risk. Needs a sharp angle and stronger offer to win.";
  if (risk >= 45)
    return "Medium risk. Winnable with the right angle and clear payoff.";
  return "Low risk. Easier to get a response if your offer is sharp.";
}

// ---------------------
// Score explanation
// ---------------------
function getScoreReason(lead: Lead, language: Language): string {
  const reasons: string[] = [];

  const score = lead.score.value ?? 0;
  const opportunity = lead.score.opportunity ?? 0;
  const readiness = lead.score.readiness ?? 0;
  const risk = lead.score.risk ?? 0;

  const industry = lead.classification.primaryIndustry.replaceAll("_", " ");
  const confidence = lead.classification.confidence ?? 0;

  const rc = lead.metrics.reviewCount;
  const rating = lead.metrics.rating;

  if (language === "en") {
    reasons.push(
      `Opportunity: ${opportunity}/100. Risk: ${risk}/100. Readiness: ${readiness}/100.`,
    );
    reasons.push(`Classification: ${industry} (${confidence}/100).`);

    if (typeof rc === "number") reasons.push(`Reviews: ${rc}.`);
    if (typeof rating === "number") reasons.push(`Rating: ${rating}.`);

    if (score >= 80)
      reasons.push("Top-tier composite score for direct outreach.");
    else if (score >= 60)
      reasons.push("Good candidate for value-first outreach.");
    else reasons.push("Lower composite score — use for volume / testing hooks.");
  } else {
    reasons.push(
      `Opportunity: ${opportunity}/100. Risk: ${risk}/100. Readiness: ${readiness}/100.`,
    );
    reasons.push(`Klassning: ${industry} (${confidence}/100).`);

    if (typeof rc === "number") reasons.push(`Recensioner: ${rc}.`);
    if (typeof rating === "number") reasons.push(`Betyg: ${rating}.`);

    if (score >= 80) reasons.push("Toppscore för direkt outreach.");
    else if (score >= 60) reasons.push("Bra kandidat för värde-först outreach.");
    else reasons.push("Lägre score — använd för volym / testa hooks.");
  }

  return reasons.join(" ");
}

// ---------------------
// Outreach upgrades
// ---------------------
function getOutreachAngle(lead: LeadUI, language: Language): string {
  const parts: string[] = [];
  const industry = lead.classification.primaryIndustry.replaceAll("_", " ");
  const loc = leadLocation(lead);

  const oppInsight = getLocalizedOpportunityInsight(lead, language);

  const opportunity = lead.score.opportunity ?? 0;
  const risk = lead.score.risk ?? 0;
  const rp = lead.score.riskProfile;

  if (language === "en") {
    if (oppInsight?.message) parts.push(`Opportunity: ${oppInsight.message}`);
    parts.push(`Context: I’m reviewing ${industry} businesses in ${loc}.`);

    if (rp === "mature_competitor") {
      parts.push(
        "Angle: You’re already strong — this is a conversion/system upgrade, not ‘more followers’.",
      );
    } else if (rp === "unstable_business") {
      parts.push(
        "Angle: Quick fundamentals upgrade (trust + capture) before scaling.",
      );
    } else if (opportunity >= 70 && risk <= 45) {
      parts.push("Angle: Clear upside with manageable risk — direct growth system.");
    } else {
      parts.push(
        "Angle: Value-first teardown + one change that improves bookings/leads.",
      );
    }

    parts.push(
      "Offer: 10–15 min teardown + a simple plan you can implement immediately.",
    );
    return parts.join(" ");
  }

  if (oppInsight?.message) parts.push(`Opportunity: ${oppInsight.message}`);
  parts.push(`Kontext: Jag går igenom ${industry} i ${loc}.`);

  if (rp === "mature_competitor") {
    parts.push(
      "Vinkel: Ni är redan starka — detta är en system/konverteringsuppgradering, inte ‘mer följare’.",
    );
  } else if (rp === "unstable_business") {
    parts.push(
      "Vinkel: Snabb fix av grunder (förtroende + lead-capture) innan man skalar.",
    );
  } else if (opportunity >= 70 && risk <= 45) {
    parts.push("Vinkel: Tydlig uppsida med hanterbar risk — direkt tillväxtsystem.");
  } else {
    parts.push(
      "Vinkel: Värde-först teardown + en konkret förbättring som ökar bokningar/leads.",
    );
  }

  parts.push(
    "Erbjudande: 10–15 min teardown + enkel plan ni kan implementera direkt.",
  );
  return parts.join(" ");
}

function buildOutreachScript(lead: LeadUI, language: Language): string {
  const name = lead.company.name;
  const industry = lead.classification.primaryIndustry.replaceAll("_", " ");
  const loc = leadLocation(lead);
  const oppInsight = getLocalizedOpportunityInsight(lead, language);

  const hasWebsite = !!lead.company.website;

  const fitScore = lead.fit?.fitScore ?? 50;
  const fitBand = fitScore >= 75 ? "high" : fitScore >= 45 ? "medium" : "low";

  const credibilityLineSv =
    fitBand === "high"
      ? "Det här ligger helt inom mitt expertområde — det går att förbättra snabbt."
      : fitBand === "medium"
        ? "Det finns tydlig potential här — det kräver strukturerad implementation."
        : "Det kan krävas mer grundarbete innan det går att skala.";

  const credibilityLineEn =
    fitBand === "high"
      ? "This is directly in my execution zone — I can improve this fast."
      : fitBand === "medium"
        ? "There’s strong potential here — this likely needs structured execution."
        : "This may require broader foundational work before scaling.";

  const insightLineEn = oppInsight?.message
    ? `Quick observation: ${oppInsight.message}.`
    : "";
  const insightLineSv = oppInsight?.message ? `Observation: ${oppInsight.message}` : "";

  const proofPointSv = hasWebsite
    ? "Jag skulle främst justera hur ni fångar intresse och leder det till ett tydligt nästa steg."
    : "Utan en tydlig webbplats/landningsyta tappar man ofta förtroende och bokningar.";

  const proofPointEn = hasWebsite
    ? "I’d adjust how you capture attention and turn it into bookings/leads."
    : "Without a simple landing page/website you’re likely losing trust and bookings.";

  const ctaEn =
    fitBand === "high"
      ? "If you're open, I can send 2–3 concrete improvements I’d implement immediately."
      : fitBand === "medium"
        ? "If you're open, I can outline what I’d prioritize first."
        : "If you're open, I can share a quick diagnostic overview of what would need fixing first.";

  const ctaSv =
    fitBand === "high"
      ? "Vill du att jag skickar 2–3 konkreta saker jag hade implementerat direkt?"
      : fitBand === "medium"
        ? "Vill du att jag visar vad jag hade prioriterat först?"
        : "Vill du att jag ger en snabb genomgång av vad som behöver fixas först?";

  if (language === "en") {
    return [
      `Hi ${name},`,
      "",
      `I’m reviewing ${industry} businesses in ${loc} and you stood out.`,
      insightLineEn,
      credibilityLineEn,
      proofPointEn,
      "",
      "I help businesses install a simple content + funnel system that turns attention into inquiries—without turning you into influencers.",
      "",
      ctaEn,
      "",
      "Best regards,",
      "[Your name]",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Hej ${name},`,
    "",
    `Jag går igenom ${industry} i ${loc} och ni stack ut.`,
    insightLineSv,
    credibilityLineSv,
    proofPointSv,
    "",
    "Jag hjälper företag att sätta ett enkelt content + funnel-system som gör uppmärksamhet till förfrågningar—utan att ni behöver bli ‘influencers’.",
    "",
    ctaSv,
    "",
    "Vänliga hälsningar,",
    "[Ditt namn]",
  ]
    .filter(Boolean)
    .join("\n");
}

type ProviderSearchResponse = {
  runId?: number;
};

type RunLeadsResponse = {
  leads?: unknown;
};

async function runProviderSearchAndFetchLeads(args: {
  niche: string;
  location: string;
  socialPresence: SocialPresence;
}): Promise<LeadUI[] | null> {
  const niche = args.niche.trim();
  if (!niche) return [];

  const location = args.location.trim();
  const socialPresence = args.socialPresence ?? "";

  const searchRes = await fetch("/api/providers/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "mock",
      query: niche,
      country: "Sweden",
      location: location || undefined,
      socialPresence: socialPresence,
      limit: 25,
    }),
  }).catch(() => null);

  if (!searchRes?.ok) return null;

  const searchData = (await searchRes
    .json()
    .catch(() => ({}))) as ProviderSearchResponse;
  const runId = typeof searchData.runId === "number" ? searchData.runId : null;
  if (!runId) return null;

  const leadsRes = await fetch(`/api/providers/runs/${runId}/leads`).catch(
    () => null,
  );
  if (!leadsRes?.ok) return null;

  const leadsData = (await leadsRes
    .json()
    .catch(() => ({}))) as RunLeadsResponse;
  const incoming = (leadsData?.leads ?? null) as unknown;

  return Array.isArray(incoming) ? (incoming as LeadUI[]) : [];
}

export default function Home() {
  // =====================
  // STATE
  // =====================

  const [language, setLanguage] = useState<Language>("en");
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [socialPresence, setSocialPresence] = useState<SocialPresence>("");

  const [leads, setLeads] = useState<LeadUI[]>([]);
  const [sortBy, setSortBy] = useState<
    "score" | "opportunity" | "risk" | "confidence" | "fit"
  >("score");
  const [minScore, setMinScore] = useState(0);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [recentSearches, setRecentSearches] = useState<SearchRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [selectedLead, setSelectedLead] = useState<LeadUI | null>(null);
  const [outreachScript, setOutreachScript] = useState<string>("");

  const [outcomesByLeadId, setOutcomesByLeadId] = useState<
    Record<string, LeadOutcomeUI>
  >({});
  const [isSavingOutcome, setIsSavingOutcome] = useState(false);

  async function saveOutcome(args: {
    runId: number;
    leadId: string;
    patch: Partial<
      Pick<LeadOutcomeUI, "contacted" | "replied" | "booked_call" | "closed">
    >;
  }) {
    const { runId, leadId, patch } = args;

    // optimistic update
    setOutcomesByLeadId((prev) => {
      const existing = prev[leadId];
      const next: LeadOutcomeUI = {
        run_id: runId,
        lead_id: leadId,
        contacted: existing?.contacted ?? false,
        replied: existing?.replied ?? false,
        booked_call: existing?.booked_call ?? false,
        closed: existing?.closed ?? false,
        revenue: existing?.revenue ?? null,
        notes: existing?.notes ?? null,
        ...patch,
      };
      return { ...prev, [leadId]: next };
    });

    setIsSavingOutcome(true);

    try {
      const body = {
        runId,
        leadId,
        contacted: patch.contacted,
        replied: patch.replied,
        bookedCall: patch.booked_call,
        closed: patch.closed,
      };

      const res = await fetch("/api/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        outcome?: LeadOutcomeUI;
      };

      if (res.ok && data.outcome) {
        setOutcomesByLeadId((prev) => ({ ...prev, [leadId]: data.outcome }));
      }
    } finally {
      setIsSavingOutcome(false);
    }
  }

  // =====================
  // DERIVED
  // =====================

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if ((l.score.value ?? 0) < minScore) return false;

      const q = query.trim().toLowerCase();
      if (q) {
        const hay =
          `${l.company.name} ${l.classification.primaryIndustry} ${leadLocation(l)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [leads, minScore, query]);

  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];

    arr.sort((a, b) => {
      if (sortBy === "confidence") {
        return (
          (b.classification.confidence ?? 0) -
          (a.classification.confidence ?? 0)
        );
      }
      if (sortBy === "opportunity") {
        return (b.score.opportunity ?? 0) - (a.score.opportunity ?? 0);
      }
      if (sortBy === "risk") {
        // lower risk first (more attractive)
        return (a.score.risk ?? 0) - (b.score.risk ?? 0);
      }
      if (sortBy === "fit") {
        return (b.fit?.fitScore ?? 0) - (a.fit?.fitScore ?? 0);
      }
      return (b.score.value ?? 0) - (a.score.value ?? 0);
    });

    // Secondary sort = stronger opportunity insight (quiet leverage)
    const priority = { high: 3, medium: 2, low: 1 } as const;
    arr.sort((a, b) => {
      const ai = normalizeLegacyOrNewOpportunityInsight(a);
      const bi = normalizeLegacyOrNewOpportunityInsight(b);
      const av = priority[ai?.strength ?? "low"];
      const bv = priority[bi?.strength ?? "low"];
      if (bv !== av) return bv - av;
      return 0;
    });

    return arr;
  }, [filteredLeads, sortBy]);

  const activeRunId = useMemo(() => {
    const v = Number(sortedLeads?.[0]?.metadata?.runId ?? 0);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [sortedLeads]);

  const selectedOutcome = useMemo(() => {
    if (!selectedLead) return null;
    return outcomesByLeadId[selectedLead.id] ?? null;
  }, [outcomesByLeadId, selectedLead]);

  // =====================
  // EFFECTS
  // =====================

  useEffect(() => {
    const runId = activeRunId;
    if (!runId) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/outcomes?runId=${runId}`);
        if (!res.ok) return;

        const data = (await res.json().catch(() => ({}))) as {
          outcomes?: LeadOutcomeUI[];
        };

        const map: Record<string, LeadOutcomeUI> = {};
        for (const o of data.outcomes ?? []) map[o.lead_id] = o;
        setOutcomesByLeadId(map);
      } catch {
        // fail soft
      }
    };

    load();
  }, [activeRunId]);

  useEffect(() => {
    if (!selectedLead) return;
    setOutreachScript(buildOutreachScript(selectedLead, language));
  }, [selectedLead, language]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        language?: Language;
        niche?: string;
        location?: string;
        socialPresence?: string;
      };

      if (parsed.language === "en" || parsed.language === "sv")
        setLanguage(parsed.language);
      if (typeof parsed.niche === "string") setNiche(parsed.niche);
      if (typeof parsed.location === "string") setLocation(parsed.location);

      if (
        parsed.socialPresence === "low" ||
        parsed.socialPresence === "medium" ||
        parsed.socialPresence === "high" ||
        parsed.socialPresence === ""
      ) {
        setSocialPresence(parsed.socialPresence as SocialPresence);
      }
    } catch (e) {
      console.error("Failed to load state from localStorage:", e);
    }
  }, []);

  useEffect(() => {
    const fetchRecentSearches = async () => {
      try {
        setIsLoadingHistory(true);
        const res = await fetch("/api/searches");
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as {
          searches?: SearchRecord[];
        };
        setRecentSearches(Array.isArray(data.searches) ? data.searches : []);
      } catch (e) {
        console.error("Error loading recent searches:", e);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchRecentSearches();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          language,
          niche,
          location,
          socialPresence,
        }),
      );
    } catch (e) {
      console.error("Failed to save state to localStorage:", e);
    }
  }, [language, niche, location, socialPresence]);

  // =====================
  // HANDLERS
  // =====================

  const downloadCsv = () => {
    if (sortedLeads.length === 0) return;

    const header = [
      "Company",
      "Industry",
      "Location",
      "Score",
      "Opportunity",
      "Risk",
      "Readiness",
      "Risk Profile",
      "Confidence",
      "Rating",
      "Review Count",
      "Website",
      "Primary Opportunity Insight",
    ];

    const rows = sortedLeads.map((lead) => {
      const insight = getLocalizedOpportunityInsight(lead, language);
      return [
        lead.company.name,
        lead.classification.primaryIndustry,
        leadLocation(lead),
        String(lead.score.value ?? 0),
        String(lead.score.opportunity ?? 0),
        String(lead.score.risk ?? 0),
        String(lead.score.readiness ?? 0),
        lead.score.riskProfile ?? "",
        String(lead.classification.confidence ?? 0),
        lead.metrics.rating ?? "",
        lead.metrics.reviewCount ?? "",
        lead.company.website ?? "",
        insight?.message ?? "",
      ];
    });

    const csvContent = [header, ...rows]
      .map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "leads_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const providerLeads = await runProviderSearchAndFetchLeads({
        niche,
        location,
        socialPresence,
      });

      if (providerLeads !== null) {
        setLeads(providerLeads);
        setSelectedLead(null);
        return;
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      setLeads([]);
      setSelectedLead(null);
    } finally {
      setIsLoading(false);
    }
  };

  // =====================
  // RENDER
  // =====================

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl space-y-8">
        <header className="space-y-3 md:flex md:items-center md:justify-between md:space-y-0">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">
              LeadGen OS – Lead Finder
            </h1>
            <p className="text-slate-300 text-sm md:text-base">
              Provider runs. Deterministic scoring. Explainable Opportunity vs Risk.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Language</span>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={
                "px-2 py-1 rounded-md border text-[11px] " +
                (language === "en"
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-slate-700 bg-slate-900 text-slate-200")
              }
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("sv")}
              className={
                "px-2 py-1 rounded-md border text-[11px] " +
                (language === "sv"
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-slate-700 bg-slate-900 text-slate-200")
              }
            >
              SV
            </button>
          </div>
        </header>

        {recentSearches.length > 0 && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Recent searches
              </h2>
              {isLoadingHistory && (
                <span className="text-[11px] text-slate-400">Updating…</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setNiche(s.niche || "");
                    setLocation(s.location || "");
                    setSocialPresence(
                      (s.social_presence === "low" ||
                      s.social_presence === "medium" ||
                      s.social_presence === "high"
                        ? s.social_presence
                        : "") as SocialPresence,
                    );
                  }}
                  className="text-[11px] md:text-xs px-2.5 py-1.5 rounded-full border border-slate-700 bg-slate-950/70 hover:bg-slate-900/80 text-slate-200 flex items-center gap-2"
                >
                  <span className="font-medium">{s.niche || "N/A"}</span>
                  <span className="text-slate-400">
                    · {s.location || "Unknown"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Filter Form */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-lg space-y-6">
          <h2 className="text-xl font-semibold">Lead Filters</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  Niche / Industry
                </label>
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="e.g. real estate, tattoo studio"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Stockholm"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  Social Media Presence
                </label>
                <select
                  value={socialPresence}
                  onChange={(e) =>
                    setSocialPresence(e.target.value as SocialPresence)
                  }
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Any</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 px-4 py-2 text-sm font-semibold transition"
            >
              {isLoading ? "Generating leads..." : "Generate Leads"}
            </button>
          </form>
        </section>

        {/* Results */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-lg space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Results</h2>
              <p className="text-xs text-slate-400">
                Showing {sortedLeads.length} lead(s)
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  Min score:
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                  />
                  <span className="w-8 text-right">{minScore}</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300">
                  Sort:
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as
                          | "score"
                          | "opportunity"
                          | "risk"
                          | "confidence"
                          | "fit",
                      )
                    }
                    className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1"
                  >
                    <option value="score">Score</option>
                    <option value="opportunity">Opportunity</option>
                    <option value="risk">Risk (low first)</option>
                    <option value="confidence">Confidence</option>
                    <option value="fit">Fit</option>
                  </select>
                </label>

                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name / industry / location..."
                  className="flex-1 min-w-[180px] rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={downloadCsv}
              disabled={sortedLeads.length === 0}
              className="text-xs border border-slate-600 rounded-lg px-3 py-1 bg-slate-900/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
            >
              Download CSV
            </button>
          </div>

          {sortedLeads.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No leads yet. Fill filters and click{" "}
              <span className="font-semibold text-slate-100">
                &quot;Generate Leads&quot;
              </span>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800">
                    <th className="text-left py-2 px-3">Company</th>
                    <th className="text-left py-2 px-3">Industry</th>
                    <th className="text-left py-2 px-3">Location</th>
                    <th className="text-left py-2 px-3">Score</th>
                    <th className="text-left py-2 px-3">Opportunity</th>
                    <th className="text-left py-2 px-3">Risk</th>
                    <th className="text-left py-2 px-3">Insight</th>
                    <th className="text-left py-2 px-3">Website</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeads.map((lead) => {
                    const insight = getLocalizedOpportunityInsight(
                      lead,
                      language,
                    );

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={
                          "border-b border-slate-800 hover:bg-slate-900/70 cursor-pointer " +
                          (selectedLead?.id === lead.id
                            ? "bg-slate-900/90"
                            : "")
                        }
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {lead.company.name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/70 text-slate-200">
                              {lead.classification.primaryIndustry.replaceAll(
                                "_",
                                " ",
                              )}
                            </span>
                          </div>
                        </td>

                        <td className="py-2 px-3">
                          {lead.classification.primaryIndustry.replaceAll(
                            "_",
                            " ",
                          )}
                        </td>
                        <td className="py-2 px-3">{leadLocation(lead)}</td>

                        <td className="py-2 px-3">
                          <div className="text-xs font-medium mb-1">
                            {lead.score.value ?? 0}
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={
                                "h-1.5 rounded-full " +
                                ((lead.score.value ?? 0) >= 80
                                  ? "bg-emerald-400"
                                  : (lead.score.value ?? 0) >= 60
                                    ? "bg-amber-400"
                                    : "bg-slate-500")
                              }
                              style={{ width: `${lead.score.value ?? 0}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-2 px-3">
                          <span className="text-slate-200 font-semibold">
                            {lead.score.opportunity ?? 0}
                          </span>
                          <p className="mt-1 text-[11px] leading-snug text-slate-400">
                            {language === "sv" ? "Uppsida" : "Upside"}
                          </p>
                        </td>

                        <td className="py-2 px-3">
                          <span
                            className={
                              (lead.score.risk ?? 0) >= 70
                                ? "text-rose-300 font-semibold"
                                : (lead.score.risk ?? 0) >= 45
                                  ? "text-amber-300 font-semibold"
                                  : "text-emerald-300 font-semibold"
                            }
                          >
                            {lead.score.risk ?? 0}
                          </span>
                          <p className="mt-1 text-[11px] leading-snug text-slate-400">
                            {lead.score.riskProfile
                              ? lead.score.riskProfile.replaceAll("_", " ")
                              : "—"}
                          </p>
                        </td>

                        <td className="py-2 px-3">
                          {insight?.message ? (
                            <div className="text-[11px] leading-snug">
                              <div className="text-orange-300 font-semibold flex items-center gap-2">
                                <span>⚡</span>
                                <span>
                                  Opportunity:{" "}
                                  <span className="text-slate-200 font-semibold">
                                    {lead.score.opportunity ?? 0}/100
                                  </span>{" "}
                                  <span className="text-slate-400">
                                    (
                                    {bandLabel(
                                      language,
                                      lead.score.opportunity ?? 0,
                                    )}
                                    )
                                  </span>
                                </span>
                              </div>
                              <div className="text-slate-200">
                                {insight.message}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">
                              —
                            </span>
                          )}
                        </td>

                        <td className="py-2 px-3">
                          {lead.company.website ? (
                            <a
                              href={lead.company.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-400 hover:underline"
                            >
                              Visit
                            </a>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {selectedLead &&
            (() => {
              const oppInsight = getLocalizedOpportunityInsight(
                selectedLead,
                language,
              );
              const runIdNum = Number(selectedLead.metadata?.runId ?? 0);
              const outcome = selectedOutcome;

              return (
                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 md:p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        Lead focus: {selectedLead.company.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {selectedLead.classification.primaryIndustry.replaceAll(
                          "_",
                          " ",
                        )}{" "}
                        · {leadLocation(selectedLead)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLead(null)}
                      className="text-[11px] px-2 py-1 rounded-md border border-slate-700 bg-slate-900/70 hover:bg-slate-800"
                    >
                      Clear
                    </button>
                  </div>

                  {oppInsight?.message && (
                    <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-orange-200/80 mb-1">
                        Opportunity insight
                      </p>
                      <p className="text-sm font-semibold text-orange-200">
                        ⚡ {oppInsight.message}
                      </p>
                      <p className="mt-1 text-[11px] text-orange-200/70">
                        Opportunity:{" "}
                        <span className="text-orange-100 font-semibold">
                          {selectedLead.score.opportunity ?? 0}/100
                        </span>{" "}
                        <span className="text-orange-200/60">
                          (
                          {bandLabel(
                            language,
                            selectedLead.score.opportunity ?? 0,
                          )}
                          )
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-rose-200/80 mb-1">
                      Risk
                    </p>
                    <p className="text-sm font-semibold text-rose-100">
                      {riskTitleFromProfile(
                        language,
                        selectedLead.score.riskProfile,
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-rose-200/70">
                      {riskMessage(language, selectedLead)}
                    </p>
                  </div>

                  {/* Outcome tracking */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-300/80 mb-2">
                      Outcome tracking {isSavingOutcome ? "— saving…" : ""}
                    </p>

                    <div className="flex flex-wrap gap-4 text-xs text-slate-200">
                      {OUTCOME_KEYS.map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!outcome?.[key]}
                            onChange={(e) => {
                              if (!Number.isFinite(runIdNum) || runIdNum <= 0)
                                return;

                              saveOutcome({
                                runId: runIdNum,
                                leadId: selectedLead.id,
                                patch: buildOutcomePatch(key, e.target.checked),
                              });
                            }}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1">
                      <p className="text-slate-400">Score</p>
                      <p className="text-lg font-semibold">
                        {selectedLead.score.value ?? 0}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {getScoreReason(selectedLead, language)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-slate-400">Opportunity</p>
                      <p className="text-sm font-semibold">
                        {selectedLead.score.opportunity ?? 0}/100
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Readiness: {selectedLead.score.readiness ?? 0}/100
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-slate-400">Risk</p>
                      <p className="text-sm font-semibold">
                        {selectedLead.score.risk ?? 0}/100
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {selectedLead.score.riskProfile
                          ? selectedLead.score.riskProfile.replaceAll("_", " ")
                          : "—"}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-slate-400">Website</p>
                      {selectedLead.company.website ? (
                        <a
                          href={selectedLead.company.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-400 hover:underline break-all"
                        >
                          {selectedLead.company.website}
                        </a>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          No website available.
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                    Suggested outreach angle
                  </p>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {getOutreachAngle(selectedLead, language)}
                  </p>

                  <div className="pt-3 border-t border-slate-800 mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Outreach script (draft)
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(outreachScript);
                          } catch (e) {
                            console.error(
                              "Failed to copy outreach script:",
                              e,
                            );
                          }
                        }}
                        disabled={!outreachScript}
                        className="text-[11px] px-2 py-1 rounded-md border border-slate-700 bg-slate-900/70 hover:bg-slate-800 disabled:opacity-50"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 max-h-56 overflow-auto">
                      <pre className="whitespace-pre-wrap break-words text-[11px] text-slate-200">
                        {outreachScript ||
                          "Click a lead to generate a tailored outreach script."}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })()}
        </section>
      </div>
    </main>
  );
}
