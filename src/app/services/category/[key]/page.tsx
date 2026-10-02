import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ServiceCategoryAliasPage({ params }: { params: { key: string } }) {
  redirect(`/services?category=${encodeURIComponent(params.key)}`);
}
