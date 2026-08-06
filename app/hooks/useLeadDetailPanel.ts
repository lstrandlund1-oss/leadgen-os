// app/hooks/useLeadDetailPanel.ts
//
// All the state and handlers LeadDetailModal needs, extracted from
// Dashboard into a shared hook so Pipeline's "full breakdown" view can
// render the exact same component with exact same real behavior —
// saving outcomes, running deep scans, saving leads to Collections —
// rather than a second, disconnected implementation.
//
// runDeepScan needs to update the calling page's own displayed lead
// list so the rescored data shows immediately (Dashboard has a flat
// `leads` array it mutates in place; Pipeline doesn't have the same
// data shape at all). Rather than force both pages into the same
// structure, this hook takes an optional onLeadRescored callback —
// Dashboard updates its `leads` array, Pipeline can refetch its overview
// or simply omit the callback if immediate card-level feedback isn't
// needed there.

import { useEffect, useState } from "react";
import { rescoreWithLightSignals } from "@/lib/scoring/rescoreWithSignals";
import { useToast } from "@/app/components/ToastProvider";
import type { Language } from "@/lib/types";
import type { LeadUI, LeadOutcomeUI, OutreachVariant, DetailTabKey } from "@/app/dashboard/page";
import { getStructuredAngle } from "@/app/dashboard/page";

export type EnrichmentData = {
  reachable: boolean;
  detectedPlatforms: string[];
  signals: Record<
    string,
    {
      key: string;
      value: string | number | boolean | null;
      present: boolean;
      label: string;
      category: string;
      confidence?: number;
    }
  >;
} | null;

export type DeepEnrichmentData = {
  deepScore: number;
  pageReachable: boolean;
  scannedAt?: string;
  isFromCache?: boolean;
  website: { scores: Record<string, number>; summary: string };
  market: { scores: Record<string, number>; competitorSummary: string; recommendation: string };
  brand: { scores: Record<string, number>; brandGrade: string; weakestArea: string; strengthArea: string };
} | null;

export type SequenceStep = {
  id: number;
  step: number;
  day_offset: number;
  scheduled_date: string;
  channel: string;
  subject: string | null;
  message: string;
  objective: string;
  cta: string;
  status: string;
  cadence_type: string;
};

function deriveDeepSignals(data: { pageReachable: boolean; website: { scores: Record<string, number> } }) {
  return {
    websiteReachable: data.pageReachable,
    hasBookingCta: data.pageReachable ? (data.website.scores.ctaStrength ?? 0) >= 50 : null,
    hasClearOffer: data.pageReachable ? (data.website.scores.ctaStrength ?? 0) >= 40 : null,
    isMobileFriendly: data.pageReachable ? (data.website.scores.pageSpeed ?? 0) >= 50 : null,
  };
}

export function applyDeepScanToLead(
  lead: LeadUI,
  deepData: DeepEnrichmentData,
  derivedSignals: ReturnType<typeof deriveDeepSignals>,
): LeadUI {
  if (!deepData) return lead;
  try {
    const newScore = rescoreWithLightSignals({
      rating: lead.metrics.rating ?? 0,
      reviewCount: lead.metrics.reviewCount ?? 0,
      hasWebsite: !!lead.company.website,
      socialPresence: lead.metrics.socialPresence ?? "low",
      classificationConfidence: lead.classification.confidence ?? null,
      fitScore: lead.fit?.fitScore ?? 0,
      websiteReachable: derivedSignals.websiteReachable,
      hasContactPage: null,
      hasBookingCta: derivedSignals.hasBookingCta,
      hasClearOffer: derivedSignals.hasClearOffer,
      isMobileFriendly: derivedSignals.isMobileFriendly,
      socialPlatformCount: 0,
      ownerResponds: null,
    });

    const leadHasWebsite = !!lead.company.website;
    const deepAddendumParts: string[] = [];
    if (!leadHasWebsite) {
      deepAddendumParts.push("no website — full web analysis unavailable");
    } else {
      if (derivedSignals.hasBookingCta === false) deepAddendumParts.push("no booking CTA confirmed by deep enrichment");
      if (derivedSignals.isMobileFriendly === false) deepAddendumParts.push("site is not mobile-friendly");
      if (derivedSignals.hasClearOffer === false) deepAddendumParts.push("no clear service offer on site");
    }
    const deepAddendum = deepAddendumParts.length > 0 ? `\nDeep scan: ${deepAddendumParts.join(", ")}.` : "";

    const mergeDeepTooltips = (
      existingScore: LeadUI["score"],
      freshScore: LeadUI["score"],
    ): LeadUI["score"]["tooltips"] => {
      const existing = existingScore.tooltips;
      const fresh = freshScore.tooltips;
      if (!existing || !fresh) return fresh;
      const resolve = (key: keyof NonNullable<LeadUI["score"]["tooltips"]>, oldVal: number, newVal: number): string => {
        if (oldVal !== newVal) return fresh[key] ?? "";
        const base = existing[key] ?? "";
        return deepAddendum ? `${base}${deepAddendum}` : base;
      };
      return {
        value: resolve("value", existingScore.value ?? 0, freshScore.value ?? 0),
        opportunity: resolve("opportunity", existingScore.opportunity ?? 0, freshScore.opportunity ?? 0),
        fit: resolve("fit", existingScore.value ?? 0, freshScore.value ?? 0),
        risk: resolve("risk", existingScore.risk ?? 0, freshScore.risk ?? 0),
        readiness: resolve("readiness", existingScore.readiness ?? 0, freshScore.readiness ?? 0),
      };
    };

    return { ...lead, score: { ...newScore, tooltips: mergeDeepTooltips(lead.score, newScore) } };
  } catch {
    return lead;
  }
}

export function useLeadDetailPanel(opts: {
  language: Language;
  onLeadRescored?: (rescored: LeadUI) => void;
  onOutcomeSaved?: () => void;
}) {
  const { language, onLeadRescored, onOutcomeSaved } = opts;
  const { error: toastError } = useToast();

  const [selectedLead, setSelectedLead] = useState<LeadUI | null>(null);
  const [detailTab, setDetailTabInternal] = useState<DetailTabKey>("overview");
  const [activeTabUI, setActiveTabUI] = useState<DetailTabKey>("overview");
  // Real deferred transition would need useTransition from the calling
  // component's render — kept simple here as an immediate setter, since
  // the interruptible-transition polish is a Dashboard-specific nicety,
  // not core behavior the modal depends on.
  const isTabPending = false;
  function setDetailTab(tab: DetailTabKey) {
    setActiveTabUI(tab);
    setDetailTabInternal(tab);
  }

  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [sequenceGenerating, setSequenceGenerating] = useState(false);
  const [sequenceExpandedStep, setSequenceExpandedStep] = useState<number | null>(null);

  const [enrichmentData, setEnrichmentData] = useState<EnrichmentData>(null);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);
  const [deepEnrichmentLoading, setDeepScanLoading] = useState(false);
  const [deepEnrichmentData, setDeepScanData] = useState<DeepEnrichmentData>(null);
  const [outreachVariant, setOutreachVariant] = useState<OutreachVariant>("consultative");
  const [outcomesByLeadId, setOutcomesByLeadId] = useState<Record<string, LeadOutcomeUI>>({});
  const [isSavingOutcome, setIsSavingOutcome] = useState(false);

  const [savedLeadIds, setSavedLeadIds] = useState<Set<string>>(new Set());
  const [savedLeadItemIds, setSavedLeadItemIds] = useState<Map<string, string>>(new Map());

  async function runDeepScan(lead: LeadUI): Promise<void> {
    if (deepEnrichmentLoading) return;
    setDeepScanLoading(true);
    setDeepScanData(null);
    try {
      const res = await fetch("/api/enrich/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: lead.company.website ?? null,
          nearbyCompetitorCount: 8,
          nearbyWithWebsite: 4,
          nearbyHighRated: 3,
          nearbyHighReviewCount: 2,
          searchVolumeProxy: lead.score.opportunity >= 70 ? "high" : lead.score.opportunity >= 40 ? "medium" : "low",
        }),
      });
      if (!res.ok) {
        if (res.status === 429 || res.status === 403) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          toastError(errData.error ?? "Deep scan limit reached.");
        }
        return;
      }
      const data = await res.json();
      if (data.success) {
        const scanResult = {
          deepScore: data.deepScore,
          pageReachable: data.pageReachable,
          scannedAt: new Date().toISOString(),
          isFromCache: false,
          website: data.website,
          market: data.market,
          brand: data.brand,
        };
        const derivedSignals = deriveDeepSignals(scanResult);
        setDeepScanData(scanResult);

        const rescored = applyDeepScanToLead(lead, scanResult, derivedSignals);
        setSelectedLead(rescored);
        onLeadRescored?.(rescored);

        fetch("/api/deep-enrichment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId: lead.sourceId, leadId: lead.id, scanResult, derivedSignals }),
        }).catch(() => {});
      }
    } catch {
      // fail soft
    } finally {
      setDeepScanLoading(false);
    }
  }

  async function saveOutcome(args: {
    runId: number;
    leadId: string;
    patch: Partial<
      Pick<
        LeadOutcomeUI,
        | "contacted"
        | "replied"
        | "booked_call"
        | "closed"
        | "revenue"
        | "notes"
        | "followup_date"
        | "lost_reason"
        | "tonality"
        | "angle_type"
        | "score_at_outreach"
      >
    >;
  }) {
    const { runId, leadId, patch } = args;

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
        followup_date: existing?.followup_date ?? null,
        tonality: existing?.tonality ?? null,
        angle_type: existing?.angle_type ?? null,
        lost_reason: existing?.lost_reason ?? null,
        score_at_outreach: existing?.score_at_outreach ?? null,
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
        revenue: patch.revenue,
        notes: patch.notes,
        followupDate: patch.followup_date,
        tonality: patch.tonality !== undefined ? patch.tonality : outreachVariant,
        angleType:
          patch.angle_type !== undefined
            ? patch.angle_type
            : selectedLead
              ? getStructuredAngle(selectedLead as LeadUI, language).title
              : null,
        lostReason: patch.lost_reason,
        scoreAtOutreach: patch.score_at_outreach,
      };

      const res = await fetch("/api/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; outcome?: LeadOutcomeUI };
      const outcome = res.ok ? (data.outcome ?? null) : null;

      if (outcome) {
        setOutcomesByLeadId((prev) => ({ ...prev, [leadId]: outcome }));
        onOutcomeSaved?.();
      }
    } finally {
      setIsSavingOutcome(false);
    }
  }

  const toggleSaveLead = async (lead: LeadUI) => {
    const isSaved = savedLeadIds.has(lead.id);

    if (isSaved) {
      const itemId = savedLeadItemIds.get(lead.id);
      if (!itemId) return;
      const res = await fetch("/api/collections/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId }),
      });
      if (res.ok) {
        setSavedLeadIds((prev) => {
          const next = new Set(prev);
          next.delete(lead.id);
          return next;
        });
        setSavedLeadItemIds((prev) => {
          const next = new Map(prev);
          next.delete(lead.id);
          return next;
        });
      }
      return;
    }

    try {
      const collectionRes = await fetch("/api/collections/default");
      if (!collectionRes.ok) return;
      const { collectionId } = await collectionRes.json();
      const runIdForLead = Number(lead.metadata?.runId ?? 0) || null;
      const saveRes = await fetch("/api/collections/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_id: collectionId,
          lead_id: lead.id,
          run_id: runIdForLead,
          company_name: lead.company.name,
        }),
      });
      if (saveRes.ok) {
        const { item } = (await saveRes.json().catch(() => ({}))) as { item?: { id: string } };
        setSavedLeadIds((prev) => new Set(prev).add(lead.id));
        if (item?.id) setSavedLeadItemIds((prev) => new Map(prev).set(lead.id, item.id));
      }
    } catch {
      // leave state unchanged on failure
    }
  };

  // Load real saved leads on mount.
  useEffect(() => {
    (async () => {
      try {
        const collectionRes = await fetch("/api/collections/default");
        if (!collectionRes.ok) return;
        const { collectionId } = await collectionRes.json();
        const itemsRes = await fetch(`/api/collections/items?collection_id=${collectionId}`);
        if (!itemsRes.ok) return;
        const { items } = (await itemsRes.json()) as { items: { id: string; lead_id: string }[] };
        setSavedLeadIds(new Set(items.map((i) => i.lead_id)));
        setSavedLeadItemIds(new Map(items.map((i) => [i.lead_id, i.id])));
      } catch {
        // leave empty
      }
    })();
    // Runs once per hook instance (once per page mount) — intentionally
    // not re-run on any dependency change.
  }, []);

  return {
    selectedLead,
    setSelectedLead,
    detailTab,
    setDetailTab,
    activeTabUI,
    setActiveTabUI,
    isTabPending,
    snapshot,
    setSnapshot,
    snapshotLoading,
    setSnapshotLoading,
    sequenceSteps,
    setSequenceSteps,
    sequenceLoading,
    setSequenceLoading,
    sequenceGenerating,
    setSequenceGenerating,
    sequenceExpandedStep,
    setSequenceExpandedStep,
    saveOutcome,
    toggleSaveLead,
    deepEnrichmentData,
    setDeepScanData,
    deepEnrichmentLoading,
    setDeepScanLoading,
    enrichmentData,
    setEnrichmentData,
    enrichmentLoading,
    setEnrichmentLoading,
    isRescoring,
    setIsRescoring,
    isSavingOutcome,
    setIsSavingOutcome,
    savedLeadIds,
    setSavedLeadIds,
    runDeepScan,
    outreachVariant,
    setOutreachVariant,
    outcomesByLeadId,
    setOutcomesByLeadId,
  };
}
