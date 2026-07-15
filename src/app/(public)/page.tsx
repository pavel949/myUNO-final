import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'myUNO | Serviced Living in Phuket',
  description: 'Invest with confidence. Live worry-free. One platform for owners, guests, and providers.',
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-small mb-16">Serviced living in Phuket</p>
          <h1 className="text-heading-1 font-bold mb-16">Your place.</h1>
          <p className="text-body text-surface-ivory/90 mb-32">
            Stop managing. Start living. One portal for all your needs.
          </p>
          <button className="bg-surface-ivory text-brand-andaman px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90">
            Find your stay
          </button>
        </div>
      </section>

      {/* Promise Pillars */}
      <section className="max-w-6xl mx-auto py-64 px-24">
        <div className="grid grid-cols-3 gap-40">
          <div>
            <h3 className="text-heading-2 font-bold text-text-ink mb-16">Stay</h3>
            <p className="text-body text-text-secondary">
              Find home, book in one click, pay in cash. No card fees here.
            </p>
          </div>
          <div>
            <h3 className="text-heading-2 font-bold text-text-ink mb-16">Live</h3>
            <p className="text-body text-text-secondary">
              Order a service, tell your neighbours, decide together. Living becomes simpler.
            </p>
          </div>
          <div>
            <h3 className="text-heading-2 font-bold text-text-ink mb-16">Own</h3>
            <p className="text-body text-text-secondary">
              Earn income. See every guest, every payment, every request. Management is fact-based.
            </p>
          </div>
        </div>
      </section>

      {/* Audience Doors */}
      <section className="bg-surface-background py-64 px-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-heading-1 font-bold text-text-ink mb-40 text-center">Who are you?</h2>
          <div className="grid grid-cols-2 gap-32">
            <a href="/owners" className="bg-white border border-border-line rounded-lg p-32 hover:shadow-lg transition">
              <h3 className="text-heading-2 font-bold text-text-ink mb-12">For Owners</h3>
              <p className="text-body text-text-secondary mb-24">
                Invest with confidence. See results. Sleep soundly.
              </p>
              <span className="text-brand-andaman font-semibold">Entrust your unit →</span>
            </a>
            <a href="/guests" className="bg-white border border-border-line rounded-lg p-32 hover:shadow-lg transition">
              <h3 className="text-heading-2 font-bold text-text-ink mb-12">For Guests</h3>
              <p className="text-body text-text-secondary mb-24">
                Hotels unnecessary. Here: home, safety, support.
              </p>
              <span className="text-brand-andaman font-semibold">Search stays →</span>
            </a>
            <a href="/developers" className="bg-white border border-border-line rounded-lg p-32 hover:shadow-lg transition">
              <h3 className="text-heading-2 font-bold text-text-ink mb-12">For Developers</h3>
              <p className="text-body text-text-secondary mb-24">
                Uplift your project class. Managed platform, integrated ops.
              </p>
              <span className="text-brand-andaman font-semibold">Talk to us →</span>
            </a>
            <a href="/buyers" className="bg-white border border-border-line rounded-lg p-32 hover:shadow-lg transition">
              <h3 className="text-heading-2 font-bold text-text-ink mb-12">For Buyers</h3>
              <p className="text-body text-text-secondary mb-24">
                Purchase already underway? Our team eases the handoff.
              </p>
              <span className="text-brand-andaman font-semibold">Start the conversation →</span>
            </a>
            <a href="/management-companies" className="bg-white border border-border-line rounded-lg p-32 hover:shadow-lg transition">
              <h3 className="text-heading-2 font-bold text-text-ink mb-12">For Management Companies</h3>
              <p className="text-body text-text-secondary mb-24">
                Demanded ops. Single platform. More income.
              </p>
              <span className="text-brand-andaman font-semibold">Learn more →</span>
            </a>
            <a href="/providers" className="bg-white border border-border-line rounded-lg p-32 hover:shadow-lg transition">
              <h3 className="text-heading-2 font-bold text-text-ink mb-12">For Providers</h3>
              <p className="text-body text-text-secondary mb-24">
                Steady order flow. Direct comms. Fair pay.
              </p>
              <span className="text-brand-andaman font-semibold">Apply →</span>
            </a>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="max-w-6xl mx-auto py-64 px-24">
        <h2 className="text-heading-1 font-bold text-text-ink mb-40 text-center">Trust, made visible</h2>
        <div className="grid grid-cols-3 gap-40 mb-40">
          <div className="text-center">
            <div className="text-heading-2 mb-16">✓</div>
            <h3 className="text-heading-2 font-bold text-text-ink mb-12">Guests verified</h3>
            <p className="text-body text-text-secondary">Passports, backgrounds, proof of funds.</p>
          </div>
          <div className="text-center">
            <div className="text-heading-2 mb-16">✓</div>
            <h3 className="text-heading-2 font-bold text-text-ink mb-12">Compliance handled</h3>
            <p className="text-body text-text-secondary">TM30, taxes, PDPA — we file it all.</p>
          </div>
          <div className="text-center">
            <div className="text-heading-2 mb-16">✓</div>
            <h3 className="text-heading-2 font-bold text-text-ink mb-12">Data protected</h3>
            <p className="text-body text-text-secondary">Encrypted fields, access logs, retention policies.</p>
          </div>
        </div>
        <div className="text-center">
          <a href="/trust" className="text-brand-andaman font-semibold hover:underline">
            Learn how →
          </a>
        </div>
      </section>

      {/* Services Section */}
      <section className="bg-surface-background py-64 px-24">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-heading-1 font-bold text-text-ink mb-32">Everything around the stay</h2>
          <p className="text-body text-text-secondary mb-40">
            Cleaning, repairs, deliveries — every service vetted and led.
          </p>
          <button className="bg-brand-andaman text-surface-ivory px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90">
            Browse services
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-text-ink text-surface-ivory py-40 px-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-4 gap-40 mb-40">
            <div>
              <p className="font-bold mb-12">myUNO</p>
              <ul className="space-y-8 text-small">
                <li><a href="/" className="hover:underline">Home</a></li>
                <li><a href="/trust" className="hover:underline">Trust</a></li>
              </ul>
            </div>
            <div>
              <p className="font-bold mb-12">For Everyone</p>
              <ul className="space-y-8 text-small">
                <li><a href="/owners" className="hover:underline">Owners</a></li>
                <li><a href="/guests" className="hover:underline">Guests</a></li>
                <li><a href="/providers" className="hover:underline">Providers</a></li>
              </ul>
            </div>
            <div>
              <p className="font-bold mb-12">Developers</p>
              <ul className="space-y-8 text-small">
                <li><a href="/developers" className="hover:underline">Developers</a></li>
                <li><a href="/buyers" className="hover:underline">Buyers</a></li>
                <li><a href="/management-companies" className="hover:underline">Management</a></li>
              </ul>
            </div>
            <div>
              <p className="font-bold mb-12">Legal</p>
              <ul className="space-y-8 text-small">
                <li><a href="/legal/terms" className="hover:underline">Terms</a></li>
                <li><a href="/legal/privacy" className="hover:underline">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-surface-ivory/20 pt-32">
            <p className="text-small text-surface-ivory/60 mb-12">
              Ignatev Estate Co., Ltd · DBD 083-5-56602358-7 · Pavel Ignatev · pavel@ignatevestate.com
            </p>
            <p className="text-small text-surface-ivory/60">
              © 2026 myUNO. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
