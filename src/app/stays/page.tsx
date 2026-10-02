import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function StaysPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === 'string') {
      params.set(key, value);
    }
  }
  const query = params.toString();
  redirect(query ? `/search?${query}` : '/search');
}
