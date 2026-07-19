import { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'audience.owners.title': 'For Owners',
    'audience.owners.hero_lede':
      'myUNO runs your unit to hotel standard and shows you everything from wherever you live: nights sold, money in and out, who entered, what it cost.',
  });
  return {
    title: `${labels['audience.owners.title']} | myUNO`,
    description: labels['audience.owners.hero_lede'],
  };
}

export default async function OwnersPage() {
  const labels = await getLabels({
    'audience.owners.hero_title': 'Every booking. Every baht. Every key. On the record — yours.',
    'audience.owners.hero_lede':
      'myUNO runs your unit to hotel standard and shows you everything from wherever you live: nights sold, money in and out, who entered, what it cost.',
    'audience.owners.cta': 'Entrust your unit',
    'audience.owners.problem.title': "You can't manage what you can't see.",
    'audience.owners.problem.lede':
      'Ask the simple questions about your own property, and watch how long the answers take — if they come at all.',
    'audience.owners.problem.q1': 'How many nights was it booked last month?',
    'audience.owners.problem.q2': 'What did you actually earn, after every fee?',
    'audience.owners.problem.q3': 'Who has been inside — and who holds a key?',
    'audience.owners.problem.q4': 'What condition is your asset in, today?',
    'audience.owners.problem.close':
      'The information exists. It’s just spread across people who each hold one piece — and none of them work for you. That gap is where trust wears thin, and where returns quietly slip away.',
    'audience.owners.see.title': 'See your asset the way you see your bank account.',
    'audience.owners.see.lede': 'One login. Your unit. The truth, whenever you want to look.',
    'audience.owners.see.point1':
      'Real numbers, not a summary you take on faith. Every booking, every fee, every payout — for your own unit, in plain view.',
    'audience.owners.see.point2':
      'Know who has access and what shape it’s in — without booking a flight to check for yourself.',
    'audience.owners.see.point3':
      'When you sell one day, you hand the buyer a clean, provable history. That’s worth real money across the table.',
    'audience.owners.record.title': 'One record. Three ways it pays.',
    'audience.owners.record.item1_title': 'It answers to you.',
    'audience.owners.record.item1_body':
      'Management companies come and go. The record stays — and it works for the owner, not for whoever runs the unit this year. Change managers; keep the history.',
    'audience.owners.record.item2_title': 'It makes your unit worth more.',
    'audience.owners.record.item2_body':
      'A service book for property: every stay, expense and repair, on file. When you sell, the buyer sees proof instead of promises — and a documented asset argues its own price.',
    'audience.owners.record.item3_title': 'Your next buyer may have already stayed.',
    'audience.owners.record.item3_body':
      'Guests who love a unit ask about buying — it happens more than you’d think. When you decide to sell, the record knows who stayed, who came back, and who asked. You start with a shortlist, not a listing.',
    'audience.owners.faq.title': 'The questions owners actually ask.',
    'audience.owners.faq.q1_title': 'Who holds the money, and when do I get paid?',
    'audience.owners.faq.q1_body':
      'Every booking and every payout is visible in your record, and every rate is agreed before anything happens. Payouts follow the schedule we fix with you up front. Deposits are held, moved and returned by agreed rules — with every movement logged.',
    'audience.owners.faq.q2_title': 'What does it cost?',
    'audience.owners.faq.q2_body':
      'Single services are priced per job — you see the rate before you confirm. Full management is a share of what your unit earns, agreed up front: we’re paid when you are. You see every rate and every term before anything starts.',
    'audience.owners.faq.q3_title': 'I already have a management company.',
    'audience.owners.faq.q3_body':
      'Nothing has to break. Start with single services alongside your current arrangement, or we plan a clean handover together. Your record starts either way.',
    'audience.owners.faq.q4_title': 'Is daily rental even legal for my unit?',
    'audience.owners.faq.q4_body':
      'It depends on your building — some are licensed for it, some aren’t, and pretending otherwise is how owners get burned. Tell us your building and we’ll tell you plainly what your unit can and can’t do, before anything else.',
    'audience.owners.faq.q5_title': 'Who are you?',
    'audience.owners.faq.q5_body':
      'Ignatev Estate — nine years on the ground in Phuket, hundreds of rentals closed and guests hosted, four hundred–plus selected units in inventory. myUNO is that operation, put on the record. And you’ll deal with Pavel directly.',
    'audience.owners.faq.q6_title': 'Is this live, or a waitlist?',
    'audience.owners.faq.q6_body':
      'The operation is live — it has been for nine years. The record is rolling out building by building, starting with our flagship at The Title, Bang Tao. You can order a service today; your record starts with the first job.',
    'audience.owners.faq.q7_title': 'Who gets into my unit?',
    'audience.owners.faq.q7_body':
      'Every entry is logged — housekeeping, maintenance, check-ins — and the log is yours to see. You always know who was inside, when, and why.',
    'audience.owners.faq.q8_title': 'What if I want to leave?',
    'audience.owners.faq.q8_body':
      'Your record exports with you — in full, any time. If we’re not earning our place, you take everything and go. That’s the point of it being yours.',
  });

  const questions = ([1, 2, 3, 4] as const).map((n) => ({
    n,
    text: labels[`audience.owners.problem.q${n}`],
  }));
  const points = ([1, 2, 3] as const).map((n) => labels[`audience.owners.see.point${n}`]);
  const record = ([1, 2, 3] as const).map((n) => ({
    title: labels[`audience.owners.record.item${n}_title`],
    body: labels[`audience.owners.record.item${n}_body`],
  }));
  const faqs = ([1, 2, 3, 4, 5, 6, 7, 8] as const).map((n) => ({
    q: labels[`audience.owners.faq.q${n}_title`],
    a: labels[`audience.owners.faq.q${n}_body`],
  }));

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-heading-1 font-bold mb-24">
            {labels['audience.owners.hero_title']}
          </h1>
          <p className="text-body text-surface-ivory/90 mb-32">
            {labels['audience.owners.hero_lede']}
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center bg-surface-ivory text-brand-andaman px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90"
          >
            {labels['audience.owners.cta']} →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-64 px-24">
        <h2 className="text-heading-2 font-bold text-text-ink mb-16">
          {labels['audience.owners.problem.title']}
        </h2>
        <p className="text-body text-text-secondary mb-40">
          {labels['audience.owners.problem.lede']}
        </p>
        <div className="space-y-24 mb-40">
          {questions.map((q) => (
            <div key={q.n} className="flex gap-32">
              <div className="text-heading-2 font-bold text-brand-andaman min-w-16">Q{q.n}</div>
              <p className="text-body text-text-ink self-center">{q.text}</p>
            </div>
          ))}
        </div>
        <p className="text-body text-text-secondary">
          {labels['audience.owners.problem.close']}
        </p>
      </section>

      <section className="bg-surface-background py-64 px-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-heading-2 font-bold text-text-ink mb-16">
            {labels['audience.owners.see.title']}
          </h2>
          <p className="text-body text-text-secondary mb-40">
            {labels['audience.owners.see.lede']}
          </p>
          <ul className="space-y-16 text-body">
            {points.map((point) => (
              <li key={point} className="flex gap-20">
                <span className="text-brand-andaman font-bold">✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-64 px-24">
        <h2 className="text-heading-2 font-bold text-text-ink mb-40">
          {labels['audience.owners.record.title']}
        </h2>
        <div className="space-y-24">
          {record.map((item) => (
            <div key={item.title}>
              <h3 className="text-heading-3 font-bold text-text-ink mb-12">{item.title}</h3>
              <p className="text-body text-text-secondary">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface-background py-64 px-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-heading-2 font-bold text-text-ink mb-40">
            {labels['audience.owners.faq.title']}
          </h2>
          <div className="space-y-24">
            {faqs.map((faq) => (
              <div key={faq.q}>
                <h3 className="text-heading-3 font-bold text-text-ink mb-12">{faq.q}</h3>
                <p className="text-body text-text-secondary">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
