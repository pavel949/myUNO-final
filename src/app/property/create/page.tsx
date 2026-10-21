import PropertyWorkspaceNav from '@/app/property/workspace-nav';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { EMPLOYEE_CREATION_DRAFTS, EMPLOYEE_CREATION_LABELS } from '@/modules/content/employee-creation.seed';
import CreationClient from './creation-client';

export const dynamic = 'force-dynamic';
const CURRENT_WORKSPACE = 'create' as const;

export default async function EmployeeCreationPage(
  props: { searchParams?: Promise<{ id?: string; kind?: string; from?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();
  if (typeof searchParams?.id === 'string') params.set('id', searchParams.id);
  if (searchParams?.kind === 'unit' || searchParams?.kind === 'complex') params.set('kind', searchParams.kind);
  if (searchParams?.from === 'operations') params.set('from', 'operations');
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/property/create${params.size ? `?${params}` : ''}`)}`);
  const locale = getRequestLocale();
  const [labels, areas] = await Promise.all([
    getLabels(EMPLOYEE_CREATION_LABELS, locale, EMPLOYEE_CREATION_DRAFTS),
    prisma.area.findMany({ where: { status: 'live' }, select: { id: true, slug: true, nameKey: true }, orderBy: { sort: 'asc' } }),
  ]);
  const areaLabels = await getLabels(Object.fromEntries(areas.map(area => [area.nameKey, area.slug])), locale);
  return <><PropertyWorkspaceNav identityId={user.identityId} current={CURRENT_WORKSPACE} /><CreationClient labels={labels} initialId={searchParams?.id} initialKind={searchParams?.kind === 'unit' || searchParams?.kind === 'complex' ? searchParams.kind : undefined} fromOperations={searchParams?.from === 'operations'} areas={areas.map(area => ({ id: area.id, name: areaLabels[area.nameKey] || area.slug }))} /></>;
}
