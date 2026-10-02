import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function OwnersClaimPage() {
  redirect('/auth/claim');
}
