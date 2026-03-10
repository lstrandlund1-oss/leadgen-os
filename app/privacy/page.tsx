import Link from "next/link";

const LAST_UPDATED = "March 2025";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 md:px-12 py-4 border-b border-[#181818] bg-[#080808]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#c9a84c] text-lg">◈</span>
          <span className="font-display text-xl font-semibold tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
            LeadGen<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>OS</span>
          </span>
        </Link>
        <Link href="/terms" className="text-[13px] text-[#555] hover:text-[#e8c97a] transition-colors tracking-wide">Terms of Service</Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <div className="mb-12">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#555] mb-3">Legal</p>
          <h1 className="text-4xl font-light mb-4" style={{ fontFamily: "var(--font-display), serif" }}>Privacy Policy</h1>
          <p className="text-[13px] text-[#444]">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="prose-custom space-y-10 text-[14px] text-[#888] leading-relaxed">

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">1. Who we are</h2>
            <p>LeadGenOS is a lead intelligence platform built for freelancers, agencies, and service providers. We are operated by the LeadGenOS team. For questions about this policy, contact us at <a href="mailto:hello@leadgenos.com" className="text-[#c9a84c] hover:text-[#e8c97a]">hello@leadgenos.com</a>.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">2. What data we collect</h2>
            <p>We collect the following categories of information:</p>
            <ul className="space-y-2 pl-4 border-l border-[#1e1e1e]">
              <li><span className="text-[#c8c0b0] font-medium">Account information.</span> Your email address and password (stored securely via Supabase Auth with hashing).</li>
              <li><span className="text-[#c8c0b0] font-medium">Profile data.</span> Your business name, service type, profile type, target market, and location — provided by you to personalise lead scores.</li>
              <li><span className="text-[#c8c0b0] font-medium">Search activity.</span> The niche terms and locations you search for. We store these to show your search history and improve the product.</li>
              <li><span className="text-[#c8c0b0] font-medium">Outcome data.</span> Pipeline stages (contacted, replied, booked, closed), revenue entries, and notes you log against leads. This data is yours.</li>
              <li><span className="text-[#c8c0b0] font-medium">Usage data.</span> Standard server logs including IP addresses, browser type, and pages accessed. We use this to operate and secure the service.</li>
            </ul>
            <p>We do not collect payment information directly. When payment processing is introduced, it will be handled by a certified third-party processor (e.g. Stripe).</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">3. How we use your data</h2>
            <p>We use your data exclusively to:</p>
            <ul className="space-y-2 pl-4 border-l border-[#1e1e1e]">
              <li>Provide and personalise the LeadGenOS service</li>
              <li>Score and match leads to your profile</li>
              <li>Save and restore your search history</li>
              <li>Send transactional emails (account confirmation, password reset)</li>
              <li>Respond to support requests</li>
              <li>Improve the product through aggregate, anonymised analytics</li>
            </ul>
            <p>We do not sell your data. We do not use your data to train third-party AI models. We do not share your personal information with advertisers.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">4. Third-party services</h2>
            <p>We use the following sub-processors:</p>
            <ul className="space-y-2 pl-4 border-l border-[#1e1e1e]">
              <li><span className="text-[#c8c0b0] font-medium">Supabase</span> — database and authentication. Data is stored on servers within the EU by default.</li>
              <li><span className="text-[#c8c0b0] font-medium">Vercel</span> — hosting and infrastructure. Requests are processed through Vercel&apos;s global edge network.</li>
              <li><span className="text-[#c8c0b0] font-medium">Google Maps Platform</span> — used to retrieve business listings when you run a search. Your search queries (niche + location) are sent to Google&apos;s API. Google&apos;s privacy policy applies to this data.</li>
            </ul>
            <p>We may add additional processors as the service grows. This section will be updated accordingly.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">5. Data retention</h2>
            <p>We retain your account data for as long as your account is active. Search history, lead outcomes, and profile data are retained indefinitely to provide continuity of service, unless you request deletion.</p>
            <p>If you delete your account, all personally identifiable data is deleted within 30 days. Anonymised aggregate data may be retained for product analytics.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">6. Your rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="space-y-2 pl-4 border-l border-[#1e1e1e]">
              <li>Access a copy of the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data (&quot;right to be forgotten&quot;)</li>
              <li>Restrict or object to certain processing</li>
              <li>Data portability — receive your data in a machine-readable format</li>
            </ul>
            <p>To exercise any of these rights, email <a href="mailto:hello@leadgenos.com" className="text-[#c9a84c] hover:text-[#e8c97a]">hello@leadgenos.com</a> and we will respond within 30 days.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">7. Cookies</h2>
            <p>We use essential cookies to maintain your session (authentication). We do not use advertising cookies or third-party tracking cookies. A future analytics integration may use cookies; this policy will be updated before that happens.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">8. Security</h2>
            <p>We use industry-standard measures to protect your data: HTTPS everywhere, hashed passwords, row-level security in Supabase, and restricted API access. No security system is infallible; if you discover a vulnerability, please disclose it responsibly to <a href="mailto:hello@leadgenos.com" className="text-[#c9a84c] hover:text-[#e8c97a]">hello@leadgenos.com</a>.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">9. Changes to this policy</h2>
            <p>We may update this policy as the service evolves. Material changes will be communicated via email or an in-app notice. Continued use of the service after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#c8c0b0]">10. Contact</h2>
            <p>For privacy-related questions or requests: <a href="mailto:hello@leadgenos.com" className="text-[#c9a84c] hover:text-[#e8c97a]">hello@leadgenos.com</a></p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-[#1a1a1a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-[12px] text-[#333]">© {new Date().getFullYear()} LeadGenOS. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-[12px] text-[#444] hover:text-[#888] transition-colors">Terms of Service</Link>
            <Link href="/contact" className="text-[12px] text-[#444] hover:text-[#888] transition-colors">Contact</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
