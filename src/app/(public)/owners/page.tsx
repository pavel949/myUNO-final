import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'For Owners | myUNO',
  description: 'Invest with confidence. See results. Sleep soundly.',
};

export default function OwnersPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-heading-1 font-bold mb-24">For Owners</h1>
          <p className="text-body text-surface-ivory/90">
            Invest with confidence. See results. Sleep soundly.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-64 px-24">
        <h2 className="text-heading-2 font-bold text-text-ink mb-40">How it works</h2>
        <div className="space-y-24">
          <div className="flex gap-32">
            <div className="text-heading-2 font-bold text-brand-andaman min-w-16">1</div>
            <div>
              <h3 className="text-heading-2 font-bold text-text-ink mb-12">List your unit</h3>
              <p className="text-body text-text-secondary">Upload photos, set your rules, choose your engagement type.</p>
            </div>
          </div>
          <div className="flex gap-32">
            <div className="text-heading-2 font-bold text-brand-andaman min-w-16">2</div>
            <div>
              <h3 className="text-heading-2 font-bold text-text-ink mb-12">We verify guests</h3>
              <p className="text-body text-text-secondary">Passports, backgrounds, proof of funds — all confirmed before check-in.</p>
            </div>
          </div>
          <div className="flex gap-32">
            <div className="text-heading-2 font-bold text-brand-andaman min-w-16">3</div>
            <div>
              <h3 className="text-heading-2 font-bold text-text-ink mb-12">Track everything</h3>
              <p className="text-body text-text-secondary">See every booking, payment, and request in one dashboard. Monthly statements included.</p>
            </div>
          </div>
          <div className="flex gap-32">
            <div className="text-heading-2 font-bold text-brand-andaman min-w-16">4</div>
            <div>
              <h3 className="text-heading-2 font-bold text-text-ink mb-12">Get paid on time</h3>
              <p className="text-body text-text-secondary">Earnings calculated daily. Payouts to your account or card, your choice.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-background py-64 px-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-heading-2 font-bold text-text-ink mb-40">Why owners trust us</h2>
          <ul className="space-y-16 text-body">
            <li className="flex gap-20">
              <span className="text-brand-andaman font-bold">✓</span>
              <span>Peace of mind: verified guests and 24/7 support</span>
            </li>
            <li className="flex gap-20">
              <span className="text-brand-andaman font-bold">✓</span>
              <span>Transparency: see every guest, payment, and issue</span>
            </li>
            <li className="flex gap-20">
              <span className="text-brand-andaman font-bold">✓</span>
              <span>Compliance done: TM30, taxes, PDPA all handled</span>
            </li>
            <li className="flex gap-20">
              <span className="text-brand-andaman font-bold">✓</span>
              <span>NOI cap protection: earnings guaranteed to your terms</span>
            </li>
            <li className="flex gap-20">
              <span className="text-brand-andaman font-bold">✓</span>
              <span>Services at hand: cleaning, repairs, maintenance all vetted</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-64 px-24">
        <h2 className="text-heading-2 font-bold text-text-ink mb-40">Frequently asked</h2>
        <div className="space-y-24">
          <div>
            <h3 className="text-heading-3 font-bold text-text-ink mb-12">How much can I earn?</h3>
            <p className="text-body text-text-secondary">It depends on your unit, location, and engagement type. Our calculator shows realistic projections based on market data.</p>
          </div>
          <div>
            <h3 className="text-heading-3 font-bold text-text-ink mb-12">What if a guest damages the unit?</h3>
            <p className="text-body text-text-secondary">Pre-arrival verification and condition reports protect you. Deposits are held by our payment provider, not us. Damage claims are handled fairly and quickly.</p>
          </div>
          <div>
            <h3 className="text-heading-3 font-bold text-text-ink mb-12">Can I use this for my family?</h3>
            <p className="text-body text-text-secondary">Yes. Owner stays are zero-rent bookings tracked separately. You can block dates or stay whenever you like.</p>
          </div>
        </div>
      </section>

      <footer className="bg-text-ink text-surface-ivory py-40 px-24">
        <div className="max-w-6xl mx-auto">
          <div className="border-t border-surface-ivory/20 pt-32">
            <p className="text-small text-surface-ivory/60">
              © 2026 myUNO. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
