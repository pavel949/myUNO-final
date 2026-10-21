import { requireAdmin } from '@/app/libs/onboardingGuard';
import { PUT as applyScopedBookingMode } from '@/app/api/property-booking-mode/[unitId]/route';
export const dynamic = 'force-dynamic';
/** Compatibility URL uses the same reviewed, atomic canonical writer. */
export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  return applyScopedBookingMode(request, { params: Promise.resolve({ unitId: params.id }) });
}
