'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import React from 'react';
import ProjectAmenitiesSection, { type PublicProjectAmenity } from '@/components/projects/ProjectAmenitiesSection';
import { ProcessStepper, RecordPageHeader, StatusChip } from '@/components/premium/PremiumPrimitives';
import {
  StayCard,
  QuickActionsRow,
  ActiveOrdersList,
  AnnouncementsSection,
  ServicesRail,
  ExtendStayPanel,
  RoleContextBanner,
  Button,
  type RailService,
} from '@/components';

const DONE_STATUS_TONE = 'done' as const;

interface Unit {
  id: string;
  name: string;
  projectId: string;
  project: {
    id: string;
    name: string;
    slug: string;
  };
}

interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  checkedInAt: string | null;
  unit: Unit;
  guest: {
    id: string;
    nationality: string | null;
  } | null;
  adults: number;
  children: number;
  balanceDueThb: number;
}

interface ActiveOrder {
  id: string;
  serviceId: string;
  serviceName: string;
  status: string;
  totalThb: number;
  scheduledStart: string;
  scheduledEnd: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  postedAs: string;
}

interface InStayHomeSpaceClientProps {
  booking: Booking;
  tm30Filed: boolean;
  guestFirstName?: string;
  activeOrders: ActiveOrder[];
  announcements: Announcement[];
  services: RailService[];
  secondaryRoles: string[];
  conciergeWhatsappUrl?: string | null;
  shuttleText?: string;
  projectAmenities: PublicProjectAmenity[];
  labels: Record<string, string>;
}

function nightsBetween(startIso: string, endIso: string): number {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export const InStayHomeSpaceClient: React.FC<InStayHomeSpaceClientProps> = ({
  booking,
  tm30Filed,
  guestFirstName,
  activeOrders,
  announcements,
  services,
  secondaryRoles,
  conciergeWhatsappUrl,
  shuttleText,
  projectAmenities,
  labels,
}) => {
  const router = useRouter();
  const [extendOpen, setExtendOpen] = React.useState(false);
  const [extendBusy, setExtendBusy] = React.useState(false);
  const [extendError, setExtendError] = React.useState<string | null>(null);

  const inStay = booking.status === 'checked_in';
  const paidInFull =
    booking.balanceDueThb === 0 &&
    (booking.status === 'confirmed' || booking.status === 'checked_in');

  const handleMessageHost = async () => {
    const response = await fetch('/api/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextType: 'booking',
        contextId: booking.id,
        body: `[${booking.unit.name}]`,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      router.push(`/messages/${data.threadId}`);
    } else {
      router.push(`/messages?projectId=${booking.unit.project.id}&bookingId=${booking.id}`);
    }
  };

  const handleOrderService = () => {
    const context = new URLSearchParams({
      bookingId: booking.id,
      projectId: booking.unit.project.id,
      unitId: booking.unit.id,
    });
    router.push(`/services?${context.toString()}`);
  };

  const handleRaiseIssue = () => {
    router.push(
      `/tickets/new?projectId=${booking.unit.project.id}&unitId=${booking.unit.id}&bookingId=${booking.id}`
    );
  };

  const handleExtendStay = () => {
    if (inStay) {
      setExtendOpen((open) => !open);
      return;
    }
    router.push(`/trips/${booking.id}`);
  };

  const submitExtension = async (newEndDate: string) => {
    setExtendBusy(true);
    setExtendError(null);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: newEndDate }),
      });
      const data = await response.json();

      if (!response.ok) {
        setExtendError(data?.error || labels['home.extend.error_generic']);
        return;
      }

      if (data?.pricing?.checkoutUrl) {
        router.push(data.pricing.checkoutUrl);
        return;
      }
      router.refresh();
    } catch {
      setExtendError(labels['home.extend.error_generic']);
    } finally {
      setExtendBusy(false);
    }
  };

  const welcomeLine = guestFirstName
    ? (labels['home.welcome_back'] ?? '').replace('{name}', guestFirstName)
    : labels['home.welcome'];

  const conciergeCard = conciergeWhatsappUrl ? (
    <div className="bg-brand-deep rounded-lg p-24 mb-24">
      <p className="font-display text-subtitle font-semibold text-on-dark-text m-0 mb-16">
        {labels['home.concierge.kicker']}
      </p>
      <a
        href={conciergeWhatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center bg-brand-sun text-brand-deep rounded-md py-16 font-semibold hover:opacity-90 transition"
      >
        {labels['home.concierge_whatsapp']}
      </a>
    </div>
  ) : null;

  const ordersBlock =
    activeOrders.length > 0 ? (
      <div className="mb-24">
        <p className="font-display text-kicker uppercase text-brand-sun m-0 mb-12 lg:font-display lg:text-subtitle lg:normal-case lg:tracking-normal lg:text-text-ink">
          {labels['home.active_orders']}
        </p>
        <ActiveOrdersList orders={activeOrders} labels={labels} />
      </div>
    ) : null;

  const handbookBlock = (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
      <h2 className="font-display text-title font-semibold text-text-ink m-0 mb-12">
        {labels['home.handbook.title']}
      </h2>
      <p className="text-body text-text-stone mb-20">
        {labels['home.handbook.description']}
      </p>
      <Link href={`/bookings/${booking.id}/home-space/handbook`}>
        <Button variant="secondary" size="sm">
          {labels['home.handbook.view_button']}
        </Button>
      </Link>
    </div>
  );

  const stepState = (step: 'booked' | 'prepare' | 'arrival' | 'stay' | 'checkout') => {
    const order = ['booked', 'prepare', 'arrival', 'stay', 'checkout'] as const;
    const current =
      booking.status === 'checked_out' || booking.status === 'completed'
        ? 4
        : booking.status === 'checked_in'
          ? 3
          : booking.status === 'confirmed'
            ? 1
            : 0;
    const index = order.indexOf(step);
    if (index < current) return 'done' as const;
    if (index === current) return 'active' as const;
    return 'neutral' as const;
  };

  return (
    <div className="min-h-screen bg-surface-ivory">
      <RecordPageHeader
        eyebrow={welcomeLine}
        title={booking.unit.project.name}
        subtitle={booking.unit.name}
        chips={
          <>
            <StatusChip tone={inStay ? 'active' : booking.status === 'checked_out' ? 'done' : 'neutral'}>
              {labels[`home.stay_status.${booking.status}`] ?? booking.status}
            </StatusChip>
            {paidInFull ? <StatusChip tone={DONE_STATUS_TONE}>{labels['home.stay.paid_in_full']}</StatusChip> : null}
            {tm30Filed ? <StatusChip tone="done">{labels['home.stay.tm30_filed']}</StatusChip> : null}
          </>
        }
        actions={
          <Link
            href={`/trips/${booking.id}`}
            className="inline-flex min-h-44 items-center rounded-lg border border-border-line bg-surface-paper px-16 text-small font-semibold text-text-ink hover:border-border-line-2"
          >
            {labels['home.pass.title']}
          </Link>
        }
      />

      <div className="mx-auto max-w-content px-16 py-24 lg:px-32">
        <section className="mb-24 rounded-xl border border-border-line bg-surface-paper p-20">
          <ProcessStepper
            steps={[
              { label: labels['home.pass.booked'], state: stepState('booked') },
              { label: labels['home.pass.prepare'], state: stepState('prepare') },
              { label: labels['home.pass.arrival'], state: stepState('arrival') },
              { label: labels['home.pass.stay'], state: stepState('stay') },
              { label: labels['home.pass.checkout'], state: stepState('checkout') },
            ]}
          />
        </section>
        {secondaryRoles.length > 0 ? (
          <RoleContextBanner
            message={(labels['home.role_context'] ?? '')
              .replace('{role}', labels[`home.role.${secondaryRoles[0]}`] ?? secondaryRoles[0])
              .replace('{unit}', booking.unit.name)}
            action={
              secondaryRoles.includes('owner')
                ? { label: labels['home.role_context.owner_link'], href: '/owner' }
                : undefined
            }
          />
        ) : null}

        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-32 lg:items-start">
          <div>
            <StayCard
              projectName={booking.unit.project.name}
              unitName={booking.unit.name}
              startDate={booking.startDate}
              endDate={booking.endDate}
              status={booking.status}
              checkedInAt={booking.checkedInAt}
              guestNationality={booking.guest?.nationality ?? undefined}
              nights={nightsBetween(booking.startDate, booking.endDate)}
              guestCount={booking.adults + booking.children}
              tm30Filed={tm30Filed}
              paidInFull={paidInFull}
              labels={labels}
            />

            <QuickActionsRow
              labels={labels}
              onMessageHost={handleMessageHost}
              onOrderService={handleOrderService}
              onRaiseIssue={handleRaiseIssue}
              onExtendStay={handleExtendStay}
            />

            {inStay && extendOpen ? (
              <ExtendStayPanel
                currentEndDate={booking.endDate}
                isLoading={extendBusy}
                error={extendError}
                labels={labels}
                onExtend={submitExtension}
              />
            ) : null}

            <ServicesRail
              services={services}
              labels={labels}
              hrefForService={(serviceId) => `/services/${serviceId}?${new URLSearchParams({
                bookingId: booking.id,
                projectId: booking.unit.project.id,
                unitId: booking.unit.id,
              }).toString()}`}
            />

            <ProjectAmenitiesSection
              projectSlug={booking.unit.project.slug}
              amenities={projectAmenities}
              title={labels['home.amenities.title']}
              viewAllLabel={labels['home.amenities.view_all']}
              viewAllHref={`/projects/${booking.unit.project.slug}/amenities`}
              detailHrefFor={(amenity) => `/projects/${booking.unit.project.slug}/amenities/${amenity.slug}?bookingId=${encodeURIComponent(booking.id)}`}
              bookingId={booking.id}
              labels={{
                kicker: labels['home.amenities.kicker'],
                included: labels['home.amenities.included'],
                free: labels['home.amenities.free'],
                bookingRequired: labels['home.amenities.booking_required'],
              }}
            />

            <div className="lg:hidden">{conciergeCard}</div>

            {shuttleText ? (
              <div className="bg-surface-paper border border-border-line rounded-md p-24 mb-24">
                <h2 className="font-display text-title font-semibold text-text-ink m-0 mb-12">
                  {labels['home.shuttle.title']}
                </h2>
                <p className="text-body text-text-stone whitespace-pre-line m-0">{shuttleText}</p>
              </div>
            ) : null}

            <AnnouncementsSection announcements={announcements} labels={labels} />

            <div className="lg:hidden">
              {ordersBlock}
              {handbookBlock}
            </div>
          </div>

          <aside className="hidden lg:block">
            {ordersBlock}
            {handbookBlock}
            {conciergeCard}
          </aside>
        </div>

        <div className="text-center py-32">
          <p className="text-body text-text-stone m-0">{labels['home.help_text']}</p>
        </div>
      </div>
    </div>
  );
};
