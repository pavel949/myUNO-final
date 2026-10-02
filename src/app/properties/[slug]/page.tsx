import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function PropertyAliasPage({ params }: { params: { slug: string } }) {
  redirect(`/projects/${params.slug}`);
}
