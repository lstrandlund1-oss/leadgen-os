"use client";

import { useState } from "react";

type OpenPanel =
  | null
  | "extend"
  | "ceiling"
  | "testimonial"
  | "allowance:outreach"
  | "allowance:followup"
  | "allowance:ai_deep_search";

export default function TesterActions({
  membershipId,
  userId,
  runAction,
}: {
  membershipId: string;
  userId: string;
  runAction: (action: string, payload: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState<OpenPanel>(null);

  // Form field state — reset whenever a panel opens/closes
  const [extendDays, setExtendDays] = useState("7");
  const [ceilingUsd, setCeilingUsd] = useState("");
  const [allowanceDaily, setAllowanceDaily] = useState("");
  const [allowanceTotal, setAllowanceTotal] = useState("");
  const [testimonialQuote, setTestimonialQuote] = useState("");
  const [testimonialName, setTestimonialName] = useState("");
  const [testimonialRole, setTestimonialRole] = useState("");
  const [testimonialCompany, setTestimonialCompany] = useState("");
  const [logoPermission, setLogoPermission] = useState(false);
  const [photoPermission, setPhotoPermission] = useState(false);

  function toggle(panel: OpenPanel) {
    setOpen(open === panel ? null : panel);
  }

  const inputClass =
    "w-full bg-[#080808] border border-[#252525] rounded-lg px-3 py-2 text-[12px] text-[#f5f0e8] placeholder-[#444] focus:outline-none focus:border-[rgba(201,168,76,0.4)]";
  const smallButtonClass =
    "text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#999] hover:border-[#3a3a3a] transition-colors";
  const goldButtonClass =
    "text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.25)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.06)] transition-colors";

  return (
    <div className="space-y-3">
      {/* Simple, single-click actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => toggle("extend")} className={goldButtonClass}>
          Extend
        </button>
        <button
          onClick={() => confirm("Expire this membership now?") && runAction("expire_membership", { membershipId })}
          className={smallButtonClass}>
          Expire
        </button>
        <button
          onClick={() =>
            confirm("Revoke this membership? This is more permanent than expiring.") &&
            runAction("revoke_membership", { membershipId })
          }
          className="text-[11px] px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/5 transition-colors">
          Revoke
        </button>
        <button
          onClick={() => runAction("mark_interview_completed", { membershipId, userId })}
          className={smallButtonClass}>
          Mark interview done
        </button>
        <button
          onClick={() => runAction("mark_required_feedback_completed", { membershipId, userId })}
          className={smallButtonClass}>
          Mark feedback done
        </button>
        <button
          onClick={() => runAction("award_discount_manually", { membershipId, userId })}
          className={smallButtonClass}>
          Award discount
        </button>
        <button
          onClick={() =>
            confirm("Mark this account as converted to a paid plan?") &&
            runAction("mark_converted", { membershipId, userId })
          }
          className={smallButtonClass}>
          Mark converted
        </button>
        <button onClick={() => toggle("ceiling")} className={smallButtonClass}>
          Set ceiling
        </button>
        <button onClick={() => toggle("allowance:outreach")} className={smallButtonClass}>
          Outreach limit
        </button>
        <button onClick={() => toggle("allowance:followup")} className={smallButtonClass}>
          Follow-up limit
        </button>
        <button onClick={() => toggle("allowance:ai_deep_search")} className={smallButtonClass}>
          Deep search limit
        </button>
        <button onClick={() => toggle("testimonial")} className={smallButtonClass}>
          Approve testimonial
        </button>
      </div>

      {/* Extend days */}
      {open === "extend" && (
        <div className="rounded-lg border border-[#1a1a1a] bg-[#080808] p-3 flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[10px] text-[#666] mb-1">Extension days</label>
            <input
              type="number"
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            onClick={() => {
              const days = Number(extendDays);
              if (days > 0) {
                runAction("grant_extension", { membershipId, days });
                setOpen(null);
              }
            }}
            className="px-4 py-2 rounded-lg bg-[#c9a84c] text-[#080808] text-[12px] font-semibold">
            Apply
          </button>
        </div>
      )}

      {/* Monetary ceiling */}
      {open === "ceiling" && (
        <div className="rounded-lg border border-[#1a1a1a] bg-[#080808] p-3 flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[10px] text-[#666] mb-1">Ceiling in USD (blank = use default)</label>
            <input
              type="number"
              step="0.01"
              value={ceilingUsd}
              onChange={(e) => setCeilingUsd(e.target.value)}
              placeholder="e.g. 15.00"
              className={inputClass}
            />
          </div>
          <button
            onClick={() => {
              const micro = ceilingUsd.trim() === "" ? null : Math.round(Number(ceilingUsd) * 1_000_000);
              runAction("set_monetary_ceiling", { membershipId, ceilingMicroUsd: micro });
              setOpen(null);
              setCeilingUsd("");
            }}
            className="px-4 py-2 rounded-lg bg-[#c9a84c] text-[#080808] text-[12px] font-semibold">
            Apply
          </button>
        </div>
      )}

      {/* Per-feature allowance override */}
      {(open === "allowance:outreach" || open === "allowance:followup" || open === "allowance:ai_deep_search") && (
        <div className="rounded-lg border border-[#1a1a1a] bg-[#080808] p-3">
          <p className="text-[10px] text-[#666] mb-2">
            {open.split(":")[1]} allowance override — leave blank to use the global default
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-[#666] mb-1">Daily limit</label>
              <input
                type="number"
                value={allowanceDaily}
                onChange={(e) => setAllowanceDaily(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-[#666] mb-1">Total limit</label>
              <input
                type="number"
                value={allowanceTotal}
                onChange={(e) => setAllowanceTotal(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              onClick={() => {
                const feature = open.split(":")[1];
                runAction("set_allowance_override", {
                  membershipId,
                  feature,
                  dailyLimit: allowanceDaily.trim() === "" ? null : Number(allowanceDaily),
                  totalLimit: allowanceTotal.trim() === "" ? null : Number(allowanceTotal),
                });
                setOpen(null);
                setAllowanceDaily("");
                setAllowanceTotal("");
              }}
              className="px-4 py-2 rounded-lg bg-[#c9a84c] text-[#080808] text-[12px] font-semibold">
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Testimonial approval */}
      {open === "testimonial" && (
        <div className="rounded-lg border border-[#1a1a1a] bg-[#080808] p-3 space-y-2">
          <div>
            <label className="block text-[10px] text-[#666] mb-1">Approved quote (exact wording)</label>
            <textarea
              value={testimonialQuote}
              onChange={(e) => setTestimonialQuote(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-[#666] mb-1">Name</label>
              <input
                value={testimonialName}
                onChange={(e) => setTestimonialName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#666] mb-1">Role</label>
              <input
                value={testimonialRole}
                onChange={(e) => setTestimonialRole(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#666] mb-1">Company</label>
              <input
                value={testimonialCompany}
                onChange={(e) => setTestimonialCompany(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-[11px] text-[#999]">
              <input type="checkbox" checked={logoPermission} onChange={(e) => setLogoPermission(e.target.checked)} />
              Logo permission
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-[#999]">
              <input type="checkbox" checked={photoPermission} onChange={(e) => setPhotoPermission(e.target.checked)} />
              Photo permission
            </label>
          </div>
          <button
            onClick={() => {
              if (!testimonialQuote.trim()) return;
              runAction("approve_testimonial", {
                membershipId,
                userId,
                quote: testimonialQuote,
                name: testimonialName || null,
                role: testimonialRole || null,
                company: testimonialCompany || null,
                logoPermission,
                photoPermission,
                channels: ["landing_page"],
              });
              setOpen(null);
              setTestimonialQuote("");
              setTestimonialName("");
              setTestimonialRole("");
              setTestimonialCompany("");
              setLogoPermission(false);
              setPhotoPermission(false);
            }}
            className="px-4 py-2 rounded-lg bg-[#c9a84c] text-[#080808] text-[12px] font-semibold">
            Approve
          </button>
        </div>
      )}
    </div>
  );
}
