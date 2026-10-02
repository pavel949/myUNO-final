import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function OwnersSubmitPage() {
  redirect('/rent-out');
}
