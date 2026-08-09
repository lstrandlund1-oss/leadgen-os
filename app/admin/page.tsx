import { isAdminRequest } from "@/lib/beta/adminAuth";
import { getAllTesterOverviews } from "@/lib/beta/adminOverview";
import { computeCommandCenterSummary } from "@/lib/beta/commandCenterSummary";
import { formatPrice } from "@/lib/pricing";
import Link from "next/link";

// Scoped deliberately to this one app (Vantio the lead-intelligence
// platform) — usage, outcomes, AI cost, and revenue scenarios for
// Vantio specifically, not a generic cross-product admin tool. If the
// Vantio brand expands to additional apps later (Vantio Market, Vantio
// Finance, etc.), each would get its own equivalent page like this one,
// and a separate, external "Vantio Revenue" app could aggregate across
// all of them at that point — this page doesn't need to anticipate that
// now, just not preclude it. "Vantio Revenue" is reserved for that
// future master dashboard, not this page's name.
export default async function AdminCommandCenterPage() {
  const { isAdmin } = await isAdminRequest();

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex items-center justify-center px-6">
        <p className="text-sm text-[#888]">Not authorized.</p>
      </div>
    );
  }

  const testers = await getAllTesterOverviews();
  const s = computeCommandCenterSummary(testers);

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[24px] font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              Command Center
            </h1>
            <p className="text-[13px] text-[#666] mt-1">
              Usage and revenue scenarios for Vantio, across all beta testers
            </p>
          </div>
          <Link href="/admin/beta" className="text-[12px] text-[#c9a84c] hover:text-[#e8c97a]">
            Per-tester management →
          </Link>
        </div>

        {/* Membership status */}
        <section className="mb-8">
          <h2 className="text-[11px] uppercase tracking-widest text-[#666] mb-3">Membership</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total testers", value: s.totalTesters },
              { label: "Active", value: s.activeTesters, color: "#4ade80" },
              { label: "Expired", value: s.expiredTesters, color: "#888" },
              { label: "Revoked", value: s.revokedTesters, color: "#f87171" },
              { label: "Converted", value: s.convertedTesters, color: "#c9a84c" },
            ].map((m) => (
              <div key={m.label} className="bg-[#111111] border border-[#252525] rounded-xl p-4">
                <p className="text-[10px] text-[#666] uppercase tracking-wide">{m.label}</p>
                <p className="text-[22px] font-semibold mt-1" style={{ color: m.color ?? "#f5f0e8" }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Usage */}
        <section className="mb-8">
          <h2 className="text-[11px] uppercase tracking-widest text-[#666] mb-3">Usage</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-[#111111] border border-[#252525] rounded-xl p-4">
              <p className="text-[10px] text-[#666] uppercase tracking-wide">Searches completed</p>
              <p className="text-[22px] font-semibold mt-1">{s.totalSearches}</p>
            </div>
            <div className="bg-[#111111] border border-[#252525] rounded-xl p-4">
              <p className="text-[10px] text-[#666] uppercase tracking-wide">Deep searches</p>
              <p className="text-[22px] font-semibold mt-1">{s.totalDeepSearches}</p>
            </div>
            <div className="bg-[#111111] border border-[#252525] rounded-xl p-4">
              <p className="text-[10px] text-[#666] uppercase tracking-wide">Lead detail views</p>
              <p className="text-[22px] font-semibold mt-1">{s.totalLeadDetailViews}</p>
            </div>
          </div>
        </section>

        {/* Outcomes */}
        <section className="mb-8">
          <h2 className="text-[11px] uppercase tracking-widest text-[#666] mb-3">Outcomes across all testers</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Contacted", value: s.totalContacted },
              { label: "Replied", value: s.totalReplied },
              { label: "Booked calls", value: s.totalBookedCalls },
              { label: "Closed", value: s.totalClosed, color: "#4ade80" },
            ].map((m) => (
              <div key={m.label} className="bg-[#111111] border border-[#252525] rounded-xl p-4">
                <p className="text-[10px] text-[#666] uppercase tracking-wide">{m.label}</p>
                <p className="text-[22px] font-semibold mt-1" style={{ color: m.color ?? "#f5f0e8" }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* AI cost */}
        <section className="mb-8">
          <h2 className="text-[11px] uppercase tracking-widest text-[#666] mb-3">AI cost</h2>
          <div className="bg-[#111111] border border-[#252525] rounded-xl p-4">
            <p className="text-[10px] text-[#666] uppercase tracking-wide">Total spent across all testers</p>
            <p className="text-[24px] font-semibold text-[#c9a84c] mt-1">
              ${(s.totalAiCostMicroUsd / 1_000_000).toFixed(2)}
            </p>
            {Object.keys(s.aiCostByFeature).length > 0 && (
              <div className="mt-4 space-y-2">
                {Object.entries(s.aiCostByFeature).map(([feature, usage]) => (
                  <div key={feature} className="flex items-center justify-between text-[12px]">
                    <span className="text-[#999]">{feature}</span>
                    <span className="text-[#f5f0e8] tabular-nums">
                      {usage.count} calls · ${(usage.costMicroUsd / 1_000_000).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Revenue scenarios */}
        <section>
          <h2 className="text-[11px] uppercase tracking-widest text-[#666] mb-1">Revenue scenarios</h2>
          <p className="text-[11px] text-[#555] mb-3">
            Not a prediction — monthly revenue IF all {s.testersEarnedDiscount + s.testersRedeemedDiscount} tester
            {s.testersEarnedDiscount + s.testersRedeemedDiscount === 1 ? "" : "s"} who earned a discount convert to this
            plan, at their own actual granted discount
            {s.averageDiscountPercent !== null && ` (avg ${s.averageDiscountPercent}% off)`}. No one has converted to a
            paid plan yet — this is a scenario, not a forecast.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["scout", "operator", "agency"] as const).map((plan) => (
              <div key={plan} className="bg-[#111111] border border-[#252525] rounded-xl p-4">
                <p className="text-[10px] text-[#666] uppercase tracking-wide capitalize">{plan}</p>
                <p className="text-[22px] font-semibold text-[#4ade80] mt-1">
                  {formatPrice(Math.round(s.revenueScenarios[plan]), "eur")}
                  <span className="text-[12px] text-[#666] font-normal"> /mo</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
