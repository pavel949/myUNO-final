import Link from 'next/link';
import { getRequestLocale } from '@/lib/i18n';

export default function RelocationPage() {
  const ru = getRequestLocale() === 'ru';
  const steps = ru
    ? [
      { title: 'Выберите район', detail: 'Сравните районы и инфраструктуру', href: '/projects', action: 'Смотреть комплексы' },
      { title: 'Найдите жильё', detail: 'Посмотрите предложения долгосрочной аренды', href: '/homes?intent=rent', action: 'Найти жильё' },
      { title: 'Организуйте приезд', detail: 'Трансферы и местные услуги', href: '/services', action: 'Открыть услуги' },
      { title: 'Получите помощь', detail: 'Уточните школы, документы и другие вопросы с командой', href: '/help', action: 'Связаться' },
    ]
    : [
      { title: 'Choose an area', detail: 'Explore neighbourhoods and local infrastructure', href: '/projects', action: 'Explore projects' },
      { title: 'Find a home', detail: 'Browse long-term rental offers', href: '/homes?intent=rent', action: 'Find homes' },
      { title: 'Plan your arrival', detail: 'Transfers and local services', href: '/services', action: 'Browse services' },
      { title: 'Get guidance', detail: 'Ask the team about schools, paperwork and other needs', href: '/help', action: 'Contact the team' },
    ];
  return <main className="mx-auto max-w-content px-20 py-48 md:px-32">
    <p className="text-small font-semibold uppercase tracking-wider text-brand-andaman">{ru ? 'Переезд на Пхукет' : 'Relocating to Phuket'}</p>
    <h1 className="mt-12 max-w-3xl font-display text-display-hero font-semibold text-text-ink">{ru ? 'Переезд начинается с понятного плана' : 'A clear path to your new life in Phuket'}</h1>
    <p className="mt-16 max-w-2xl text-body text-text-secondary">{ru ? 'Район, жильё, приезд и повседневные услуги — выберите следующий шаг. Предложения и доступность уточняются на соответствующих страницах.' : 'Neighbourhoods, homes, arrival and everyday services — choose your next step. Offers and availability are confirmed on the relevant pages.'}</p>
    <div className="mt-32 grid gap-16 md:grid-cols-2">
      {steps.map((step, index) => <article key={step.href} className="rounded-xl border border-border-line bg-surface-paper p-24">
        <span className="text-small font-semibold text-brand-andaman">{String(index + 1).padStart(2, '0')}</span>
        <h2 className="mt-8 font-display text-title font-semibold text-text-ink">{step.title}</h2>
        <p className="mt-8 text-body text-text-secondary">{step.detail}</p>
        <Link className="mt-16 inline-block font-semibold text-brand-andaman hover:underline" href={step.href}>{step.action} →</Link>
      </article>)}
    </div>
  </main>;
}
