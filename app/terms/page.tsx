import Link from "next/link";

const LAST_UPDATED = "March 2025";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 md:px-12 py-4 border-b border-[#181818] bg-[#080808]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#c9a84c] text-lg">◈</span>
          <span className="font-display text-xl font-semibold tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
            LeadGen<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>OS</span>
          </span>
        </Link>
        <Link href="/privacy" className="text-[13px] text-[#555] hover:text-[#e8c97a] transition-colors tracking-wide">Privacy Policy</Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <div className="mb-12">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#555] mb-3">Legal</p>
          <h1 className="text-4xl font-light mb-4" style={{ fontFamily: "var(--font-display), serif" }}>Terms of Service</h1>
          <p className="text-[13px] text-[#444]">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 text-[14px] text-[#888] leading-relaxed">

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">1. Acceptance of terms</h2>
            <p>By creating an account or using the LeadGenOS service, you agree to these Terms of Service. If you do not agree, do not use the service. These terms apply to all users, including beta testers and early access members.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">2. Description of service</h2>
            <p>LeadGenOS is a lead intelligence platform that helps service providers discover, score, and prioritise local businesses as prospective clients. The service includes lead discovery, automated scoring, enrichment signals, outreach script generation, and pipeline tracking.</p>
            <p>The service is currently in beta. Features may change, be added, or be removed without notice during the beta period. We make no guarantee of uptime, data accuracy, or uninterrupted availability during beta.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">3. Eligibility</h2>
            <p>You must be at least 18 years old to use LeadGenOS. By using the service, you represent that you are a human (not a bot), have the legal capacity to enter into these terms, and are using the service for lawful business purposes.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">4. Acceptable use</h2>
            <p>You may use LeadGenOS to:</p>
            <ul className="space-y-2 pl-4 border-l border-[#1e1e1e]">
              <li>Discover and evaluate potential clients for your legitimate business services</li>
              <li>Generate and personalise outreach materials for your own use</li>
              <li>Track your own sales pipeline and client interactions</li>
            </ul>
            <p className="mt-3">You may not use LeadGenOS to:</p>
            <ul className="space-y-2 pl-4 border-l border-[#1e1e1e]">
              <li>Scrape, harvest, or bulk-export data for resale or redistribution</li>
              <li>Send spam, unsolicited bulk messages, or conduct automated outreach that violates applicable laws (including GDPR, CAN-SPAM, CASL)</li>
              <li>Harass, stalk, or target individuals for non-commercial purposes</li>
              <li>Reverse-engineer, copy, or create derivative works of the service</li>
              <li>Circumvent rate limits, access controls, or other technical restrictions</li>
              <li>Use the service for any illegal purpose</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">5. Your responsibility for outreach</h2>
            <p>LeadGenOS provides information and suggested outreach scripts as tools. You are solely responsible for how you use that information. This includes compliance with applicable cold outreach laws in your jurisdiction. We are not liable for any consequences arising from your outreach activities.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">6. Account security</h2>
            <p>You are responsible for maintaining the security of your account credentials. Do not share your password. Notify us immediately if you suspect unauthorised access. We are not liable for losses resulting from compromised credentials due to your actions or inactions.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">7. Intellectual property</h2>
            <p>LeadGenOS and its content — including the scoring engine, gap detection logic, UI design, and outreach frameworks — are owned by LeadGenOS and protected by applicable intellectual property laws. You may not copy, reproduce, or distribute any part of the service without written permission.</p>
            <p>Data you create (notes, pipeline entries, profile information) remains yours. We do not claim ownership over your content.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">8. Accuracy of lead data</h2>
            <p>Lead data is sourced from third-party APIs (including Google Maps) and enriched with automated signals. We make reasonable efforts to ensure accuracy, but we do not guarantee that any information about a specific business is current, complete, or accurate. You should independently verify important information before acting on it.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">9. Subscriptions and billing</h2>
            <p>The service is currently free during the beta period. When paid plans are introduced, pricing, billing terms, and refund policies will be clearly communicated before you are charged. Continued use after pricing changes constitutes acceptance of the new terms.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">10. Termination</h2>
            <p>You may terminate your account at any time by contacting us at <a href="mailto:hello@leadgenos.com" className="text-[#c9a84c] hover:text-[#e8c97a]">hello@leadgenos.com</a>. We reserve the right to suspend or terminate accounts that violate these terms, with or without notice.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">11. Disclaimer of warranties</h2>
            <p>The service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied. We do not warrant that the service will be uninterrupted, error-free, or that results obtained will meet your requirements. Use at your own risk.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">12. Limitation of liability</h2>
            <p>To the maximum extent permitted by law, LeadGenOS shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of the service. Our total liability for any claim shall not exceed the amount you paid us in the three months preceding the claim.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">13. Changes to terms</h2>
            <p>We may update these terms at any time. Material changes will be communicated via email or in-app notice at least 14 days before taking effect. Continued use after the effective date constitutes acceptance.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">14. Governing law</h2>
            <p>These terms are governed by the laws of Sweden, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Sweden, unless applicable consumer protection law in your jurisdiction provides otherwise.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">15. Contact</h2>
            <p>For questions about these terms: <a href="mailto:hello@leadgenos.com" className="text-[#c9a84c] hover:text-[#e8c97a]">hello@leadgenos.com</a></p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-[#1a1a1a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-[12px] text-[#333]">© {new Date().getFullYear()} LeadGenOS. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-[12px] text-[#444] hover:text-[#888] transition-colors">Privacy Policy</Link>
            <Link href="/contact" className="text-[12px] text-[#444] hover:text-[#888] transition-colors">Contact</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
