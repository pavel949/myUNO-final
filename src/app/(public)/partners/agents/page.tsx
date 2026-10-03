import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { AGENT_LABELS } from '@/modules/agents/labels';
export default async function AgentPartnersPage() {
  const labels=await getLabels(AGENT_LABELS);
  return <main className="mx-auto max-w-4xl px-20 py-64">
    <h1 className="font-display text-heading-1">{labels['agent.partnersTitle']}</h1>
    <p className="my-24 text-body text-text-stone">{labels['agent.partnersBody']}</p>
    <div className="flex flex-wrap gap-20"><Link href="/agent" className="text-brand-andaman">{labels['agent.goPortal']}</Link>
      <Link href="/register" className="text-brand-andaman">{labels['agent.register']}</Link>
      <Link href="/help" className="text-brand-andaman">{labels['agent.help']}</Link></div>
  </main>;
}
