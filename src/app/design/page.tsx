'use client';

import React, { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Badge, VerifiedBadge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Checkbox, Radio, Switch } from '@/components/ChoiceControls';
import { Chip } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Counter } from '@/components/Counter';
import { DataTable } from '@/components/DataTable';
import { Input } from '@/components/Input';
import { PriceBreakdown } from '@/components/PriceBreakdown';
import { Select } from '@/components/Select';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { SlaCountdown } from '@/components/SlaCountdown';
import { EmptyState, ErrorState } from '@/components/StateComponents';
import { StatTile } from '@/components/StatTile';
import { StatusTimeline } from '@/components/StatusTimeline';
import { Textarea } from '@/components/Textarea';
import { TrustMark } from '@/components/TrustMark';
import DeltaChip from '@/components/viz/DeltaChip';
import MonthHeatStrip from '@/components/viz/MonthHeatStrip';
import Sparkline from '@/components/viz/Sparkline';

const COLOR_TOKENS = [
  { name: 'brand.andaman', color: '#0E4F4B' },
  { name: 'brand.deep', color: '#0A3733' },
  { name: 'brand.sun', color: '#D69A3A' },
  { name: 'brand.sun-soft', color: '#E7C079' },
  { name: 'surface.ivory', color: '#F5EFE4' },
  { name: 'surface.paper', color: '#FBF8F1' },
  { name: 'text.ink', color: '#16211F' },
  { name: 'text.stone', color: '#7E8C88' },
  { name: 'text.stone-2', color: '#A7B2AE' },
  { name: 'border.line', color: '#E6DFD1' },
  { name: 'border.line-2', color: '#DAD1BF' },
  { name: 'on-dark.text', color: '#EAF2F0' },
] as const;

const STATE_TOKENS = [
  { name: 'success', fg: '#2F7A57', bg: '#E4EFE7' },
  { name: 'warning', fg: '#B97F1F', bg: '#F6ECD8' },
  { name: 'error', fg: '#AE4E38', bg: '#F5E4DF' },
  { name: 'info', fg: '#0E4F4B', bg: '#E3ECEA' },
] as const;

const TYPE_ROWS = [
  { token: 'type.display-xl · Outfit 600 · 40/44 · −1%', sample: 'Your place.', className: 'font-display text-display-xl font-semibold' },
  { token: 'type.display · Outfit 600 · 28/34', sample: 'Owner dashboard', className: 'font-display text-display font-semibold' },
  { token: 'type.title · Outfit 600 · 20/26', sample: 'Villa B-707 · Layan', className: 'font-display text-title' },
  { token: 'type.subtitle · Outfit 500 · 16/24', sample: 'Statement · January 2026', className: 'font-display text-subtitle' },
  { token: 'type.kicker · Outfit 500 · 12/16 · +24% · sun', sample: 'Serviced living in Phuket', className: 'font-display text-kicker uppercase text-brand-sun' },
  { token: 'type.body · Manrope 400 · 15/23', sample: 'Stop managing. Start living. Перестаньте управлять — начните жить.', className: 'text-body' },
  { token: 'type.body-strong · Manrope 600 · 15/23', sample: 'Passports received · TM30 filed', className: 'text-body-strong' },
  { token: 'type.small · Manrope 400 · 13/19', sample: 'B-707 · stay Jan 4–12 · 2 guests', className: 'text-small' },
  { token: 'type.num · Outfit 500 · tabular', sample: '฿1,284,500', className: 'font-display text-display font-medium tabular-nums' },
] as const;

const SPACE_STEPS = [4, 8, 12, 16, 20, 24, 32, 40, 56, 80] as const;

const TABLE_ROWS = [
  { id: '1', unit: 'B-707 · Layan', guest: 'A. Sokolova', checkIn: '04 Jan 2026', amount: '฿36,600', status: 'confirmed' as const },
  { id: '2', unit: 'A-204 · Bang Tao', guest: 'M. Chen', checkIn: '07 Jan 2026', amount: '฿18,400', status: 'pending_payment' as const },
  { id: '3', unit: 'Villa Kata 3 · Kata', guest: 'J. Weber', checkIn: '11 Jan 2026', amount: '฿92,000', status: 'checked_in' as const },
];

export default function DesignPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [guests, setGuests] = useState(2);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const now = Date.now();

  return (
    <div className="bg-surface-ivory min-h-screen py-40 px-16 md:px-24">
      <div className="max-w-[1400px] mx-auto">
        <p className="font-display text-kicker uppercase text-brand-sun mb-16">
          Ignatev Estate · myUNO operating standard
        </p>
        <h1 className="font-display text-display-xl text-text-ink mb-16">
          Design system, flows and screen catalogue
        </h1>
        <p className="text-body text-text-stone max-w-[720px] mb-32">
          Boards 01–06 from the Claude Design canvas, built on the tokens in
          docs/06 and the components in src/components. Product screens 07–21
          stay in later tasks.
        </p>

        <section className="mb-80">
          <p className="font-display text-kicker uppercase text-brand-sun mb-8">01</p>
          <h2 className="font-display text-display text-text-ink mb-32">Foundations</h2>

          <div className="flex flex-wrap gap-32 items-start">
            <Panel className="w-full max-w-[620px]">
              <h3 className="font-display text-title mb-4">Colour</h3>
              <p className="text-small text-text-stone mb-20">
                Raw hex appears only in the token file. Builders reference by name.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-16">
                {COLOR_TOKENS.map((token) => (
                  <ColorBox key={token.name} name={token.name} color={token.color} />
                ))}
              </div>
              <p className="font-display text-kicker uppercase text-brand-sun mt-28 mb-12">
                Functional states
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-16">
                {STATE_TOKENS.map((token) => (
                  <div key={token.name} className="rounded-md p-12" style={{ backgroundColor: token.bg }}>
                    <p className="text-small font-semibold m-0" style={{ color: token.fg }}>
                      {token.name}
                    </p>
                    <p className="text-small m-0" style={{ color: token.fg }}>
                      {token.fg}
                    </p>
                  </div>
                ))}
              </div>
              <p className="font-display text-kicker uppercase text-brand-sun mt-28 mb-12">
                Chart series · fixed order, never cycled
              </p>
              <div className="flex gap-8 mb-16">
                <div className="flex-1 h-40 rounded-sm bg-chart-1" />
                <div className="flex-1 h-40 rounded-sm bg-chart-2" />
                <div className="flex-1 h-40 rounded-sm bg-chart-3" />
                <div className="flex-1 h-40 rounded-sm bg-chart-4" />
              </div>
              <div className="flex gap-8">
                <div className="flex-1 h-24 rounded-sm bg-chart-seq-1" />
                <div className="flex-1 h-24 rounded-sm bg-chart-seq-2" />
                <div className="flex-1 h-24 rounded-sm bg-chart-seq-3" />
                <div className="flex-1 h-24 rounded-sm bg-chart-seq-4" />
                <div className="flex-1 h-24 rounded-sm bg-chart-seq-5" />
              </div>
              <p className="text-small text-text-stone mt-12 mb-0">
                Status colours are reserved — never series colours. Slot 2 (sun)
                sits at 2.32:1 on paper, so every chart using it ships direct
                labels and a table view.
              </p>
            </Panel>

            <Panel className="w-full max-w-[520px]">
              <h3 className="font-display text-title mb-4">Type</h3>
              <p className="text-small text-text-stone mb-24">
                Display Outfit, body Manrope. Outfit is Latin-only; Cyrillic
                display falls through to Manrope. Thai uses Noto Sans Thai.
              </p>
              <div className="flex flex-col gap-20">
                {TYPE_ROWS.map((row) => (
                  <div key={row.token}>
                    <p className="text-small text-text-stone mb-4">{row.token}</p>
                    <p className={`${row.className} m-0`}>{row.sample}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="w-full max-w-[460px]">
              <h3 className="font-display text-title mb-4">Spacing, radius, elevation, motion</h3>
              <p className="text-small text-text-stone mb-24">
                4-based scale. Gutter 16 mobile / 24 desktop. Card padding 16–24.
              </p>
              <div className="flex items-end gap-8 mb-8">
                {SPACE_STEPS.map((step) => (
                  <div
                    key={step}
                    className="bg-brand-andaman"
                    style={{ width: step, height: step }}
                  />
                ))}
              </div>
              <p className="text-small text-text-stone mb-28">
                4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 80
              </p>
              <div className="flex gap-16 mb-8">
                <div className="flex-1 h-64 bg-surface-ivory border border-border-line rounded-sm flex items-center justify-center text-small text-text-stone">
                  r.sm 8
                </div>
                <div className="flex-1 h-64 bg-surface-ivory border border-border-line rounded-md flex items-center justify-center text-small text-text-stone">
                  r.md 12
                </div>
                <div className="flex-1 h-64 bg-surface-ivory border border-border-line rounded-lg flex items-center justify-center text-small text-text-stone">
                  r.lg 16
                </div>
                <div className="flex-1 h-64 bg-surface-ivory border border-border-line rounded-full flex items-center justify-center text-small text-text-stone">
                  r.full
                </div>
              </div>
              <p className="text-small text-text-stone mb-28">
                Inputs and chips 8 · buttons 12 · cards and modals 16 · pills and
                avatars full.
              </p>
              <div className="flex gap-24">
                <div className="flex-1 h-72 bg-surface-paper border border-border-line rounded-lg shadow-card flex items-center justify-center text-small text-text-stone">
                  shadow.card
                </div>
                <div className="flex-1 h-72 bg-surface-paper border border-border-line rounded-lg shadow-float flex items-center justify-center text-small text-text-stone">
                  shadow.float
                </div>
              </div>
              <p className="text-small text-text-stone mt-8 mb-0">
                Flat by default. Motion 150ms ease-out micro, 250ms ease-in-out
                structural, skeletons pulse 1.2s. Nothing bounces.
              </p>
            </Panel>
          </div>
        </section>

        <section className="mb-80">
          <p className="font-display text-kicker uppercase text-brand-sun mb-8">02</p>
          <h2 className="font-display text-display text-text-ink mb-8">Component library</h2>
          <p className="text-body text-text-stone max-w-[720px] mb-32">
            Every component ships all its states: default, hover, focus-visible,
            disabled, loading, error — plus empty, loading and error patterns
            for every data surface.
          </p>

          <div className="flex flex-wrap gap-32 items-start">
            <Panel className="w-full max-w-[520px]">
              <h3 className="font-display text-title mb-20">Button</h3>
              <div className="flex flex-wrap gap-16 mb-24">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
              <div className="bg-brand-deep rounded-md p-20 mb-24 flex items-center gap-16">
                <Button variant="sun">Sun</Button>
                <p className="text-small text-on-dark-muted m-0">
                  Gold fill, deep text — dark surfaces and hero CTAs only.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-16 mb-24">
                <Button size="sm">sm 40</Button>
                <Button size="md">md 48</Button>
                <Button size="lg">lg 56</Button>
              </div>
              <div className="flex flex-wrap items-center gap-16">
                <Button disabled>Disabled</Button>
                <Button isLoading>Loading</Button>
                <Button fullWidth>Full width</Button>
              </div>
            </Panel>

            <Panel className="w-full max-w-[400px]">
              <h3 className="font-display text-title mb-20">Input · Textarea · Select</h3>
              <div className="flex flex-col gap-24">
                <Input label="Email" defaultValue="pavel@ignatevestate.com" />
                <Input
                  label="Passport number"
                  required
                  error="This field is required"
                  placeholder="Enter value"
                />
                <Input
                  label="Payout account"
                  placeholder="Bank account"
                  helpText="Used only for owner statements. Never shared."
                />
                <Input label="Disabled" placeholder="Cannot edit" disabled />
                <Textarea
                  label="Note to provider"
                  defaultValue="Gate code 4417. Dog on site."
                />
                <Select
                  label="Project"
                  defaultValue="layan"
                  options={[
                    { value: 'layan', label: 'Layan' },
                    { value: 'bangtao', label: 'Bang Tao' },
                  ]}
                />
              </div>
            </Panel>

            <Panel className="w-full max-w-[440px]">
              <h3 className="font-display text-title mb-20">Chip · Badge · Avatar · Counter</h3>
              <p className="text-small text-text-stone mb-12">Filter chips</p>
              <div className="flex flex-wrap gap-12 mb-24">
                {[
                  ['all', 'All'],
                  ['layan', 'Layan'],
                  ['beds', '2+ bedrooms'],
                  ['pool', 'Pool'],
                ].map(([id, label]) => (
                  <Chip
                    key={id}
                    variant="filter"
                    isSelectable
                    isActive={activeFilter === id}
                    onClick={() => setActiveFilter(id)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
              <p className="text-small text-text-stone mb-12">Status chips · single source mapping</p>
              <div className="flex flex-wrap gap-12 mb-24">
                <Chip variant="status" status="confirmed">Confirmed</Chip>
                <Chip variant="status" status="pending_payment">Pending payment</Chip>
                <Chip variant="status" status="requested">Requested</Chip>
                <Chip variant="status" status="declined">Declined</Chip>
                <Chip variant="status" status="cancelled">Cancelled</Chip>
                <Chip variant="status" status="closed">Closed</Chip>
                <Chip variant="status" status="checked_in">Checked in</Chip>
              </div>
              <p className="text-small text-text-stone mb-12">Verified badge — the trust signal</p>
              <div className="flex flex-wrap gap-12 mb-24">
                <VerifiedBadge label="Verified owner" />
                <VerifiedBadge label="Vetted provider" />
                <Badge>Managed by myUNO</Badge>
              </div>
              <p className="text-small text-text-stone mb-12">Avatar 24 / 32 / 40 / 64 · Counter</p>
              <div className="flex flex-wrap items-center gap-24">
                <div className="flex items-center gap-12">
                  <Avatar size="xs" initials="AB" />
                  <Avatar size="sm" initials="CD" />
                  <Avatar size="md" initials="EF" />
                  <Avatar size="lg" initials="GH" />
                </div>
                <Counter
                  value={guests}
                  onChange={setGuests}
                  min={1}
                  max={8}
                  decreaseLabel="Fewer guests"
                  increaseLabel="More guests"
                />
              </div>
            </Panel>

            <Panel className="w-full max-w-[700px]">
              <h3 className="font-display text-title mb-20">Choice controls</h3>
              <div className="flex flex-col gap-8">
                <Checkbox label="House rules accepted" defaultChecked />
                <Radio name="pay" label="Cash on arrival" defaultChecked />
                <Radio name="pay" label="Card via provider" />
                <Switch checked={switchOn} onCheckedChange={setSwitchOn} label="Notify on ticket update" />
              </div>
            </Panel>

            <Panel className="w-full max-w-[700px]">
              <h3 className="font-display text-title mb-20">Data surfaces</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-16 mb-24">
                <StatTile
                  label="Occupancy this month"
                  value="78%"
                  variant="occupancy"
                  delta={<DeltaChip currentValue={78} previousValue={72} vsLabel="vs last" newLabel="New" />}
                />
                <StatTile
                  label="Revenue to date"
                  value="฿384,200"
                  variant="revenue"
                  delta={<DeltaChip currentValue={97} previousValue={100} vsLabel="vs last" newLabel="New" />}
                />
                <StatTile
                  label="Next arrival"
                  value="Jan 14"
                  secondary="A. Sokolova · 2 guests"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                <div>
                  <p className="text-small text-text-stone mb-12">
                    StatusTimeline — the reporter sees what staff see
                  </p>
                  <StatusTimeline
                    events={[
                      { id: '1', title: 'Resolved', detail: '12 Jan 14:20 · Somchai P.', tone: 'success' },
                      { id: '2', title: 'In progress', detail: '12 Jan 09:05 · assigned to maintenance', tone: 'info' },
                      { id: '3', title: 'Raised by guest', detail: '11 Jan 21:40 · aircon in bedroom 2', tone: 'muted' },
                    ]}
                  />
                  <p className="text-small text-text-stone mt-24 mb-12">SlaCountdown</p>
                  <div className="flex flex-col gap-8">
                    <SlaCountdown
                      deadline={new Date(now + 9 * 3600_000 + 20 * 60_000).toISOString()}
                      leftTemplate="Respond within {time}"
                      overdueLabel="Response overdue"
                    />
                    <SlaCountdown
                      deadline={new Date(now + 48 * 60_000).toISOString()}
                      leftTemplate="Respond within {time}"
                      overdueLabel="Response overdue"
                    />
                    <SlaCountdown
                      deadline={new Date(now - 60_000).toISOString()}
                      leftTemplate="Respond within {time}"
                      overdueLabel="Response overdue"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-small text-text-stone mb-12">
                    PriceBreakdown — always the server&apos;s numbers
                  </p>
                  <PriceBreakdown
                    totalLabel="Total"
                    lines={[
                      { id: 'nights', label: '8 nights × ฿4,500', satang: 3_600_000, note: 'high season · rule RS-2026-HI' },
                      { id: 'clean', label: 'Cleaning fee', satang: 180_000 },
                      { id: 'credit', label: 'Direct-booking credit', satang: -120_000 },
                    ]}
                  />
                  <p className="text-small text-text-stone mt-24 mb-12">Sparkline · MonthHeatStrip</p>
                  <Sparkline
                    values={[4, 6, 5, 10, 8, 14, 12, 16, 11, 18, 14, 20]}
                    title="Occupancy trend"
                    width={220}
                    height={40}
                  />
                  <div className="mt-12">
                    <MonthHeatStrip
                      occupiedLabel="Occupied"
                      vacantLabel="Vacant"
                      noDataLabel="No data"
                      days={[
                        { date: '2026-01-01', occupied: false },
                        { date: '2026-01-02', occupied: false },
                        { date: '2026-01-03', occupied: true },
                        { date: '2026-01-04', occupied: true },
                        { date: '2026-01-05', occupied: true },
                        { date: '2026-01-06', occupied: false },
                        { date: '2026-01-07', occupied: false },
                        { date: '2026-01-08', occupied: true },
                        { date: '2026-01-09', occupied: true },
                        { date: '2026-01-10', occupied: true },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel className="w-full max-w-[700px]">
              <h3 className="font-display text-title mb-4">Empty, loading, error — never a blank screen</h3>
              <p className="text-small text-text-stone mb-20">
                A screen ships only with all three implemented.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                <div className="border border-border-line rounded-lg">
                  <EmptyState
                    title="No results found"
                    description="Try loosening the dates or the guest count."
                    action={{ label: 'Clear filters', onClick: () => setActiveFilter('all') }}
                  />
                </div>
                <div className="border border-border-line rounded-lg p-24">
                  <SkeletonBlock className="w-[60%] mb-12" />
                  <SkeletonBlock shape="card" className="mb-12" />
                  <SkeletonBlock className="w-[80%] mb-8" />
                  <SkeletonBlock className="w-[40%]" />
                  <p className="text-small text-text-stone mt-24 mb-0 text-center">
                    Skeletons hold still under reduced-motion.
                  </p>
                </div>
                <div className="border border-border-line rounded-lg">
                  <ErrorState
                    title="Something went wrong"
                    description="We could not load your statements. Nothing was changed."
                    onRetry={() => undefined}
                  />
                </div>
              </div>
            </Panel>

            <Panel className="w-full max-w-[460px]">
              <h3 className="font-display text-title mb-20">ConfirmDialog — friction scaled to stakes</h3>
              <Button variant="destructive" onClick={() => setDialogOpen(true)}>
                Open cancel dialog
              </Button>
              <ConfirmDialog
                open={dialogOpen}
                title="Cancel booking B-707 · Jan 4–12?"
                whatHappensLabel="What happens:"
                consequences={[
                  'The unit is released to availability immediately.',
                  '฿36,600 is refunded under policy flex-7 — ฿32,940 after the 10% window fee.',
                  'The guest is notified and the TM30 filing is withdrawn.',
                ]}
                cancelLabel="Keep booking"
                confirmLabel="Cancel booking"
                onCancel={() => setDialogOpen(false)}
                onConfirm={() => setDialogOpen(false)}
              />
              <p className="text-small text-text-stone mt-20 mb-0">
                Low stakes: one tap, optimistic. High stakes: consequences stated
                in numbers, destructive action on the right.
              </p>
            </Panel>

            <Panel className="w-full max-w-[700px]">
              <h3 className="font-display text-title mb-20">DataTable</h3>
              <DataTable
                rowKey={(row) => row.id}
                columns={[
                  { key: 'unit', header: 'Unit' },
                  { key: 'guest', header: 'Guest' },
                  { key: 'checkIn', header: 'Check-in', numeric: true },
                  { key: 'amount', header: 'Amount', numeric: true },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (row) => (
                      <Chip variant="status" status={row.status}>
                        {row.status === 'pending_payment'
                          ? 'Pending payment'
                          : row.status === 'checked_in'
                            ? 'Checked in'
                            : 'Confirmed'}
                      </Chip>
                    ),
                  },
                ]}
                rows={TABLE_ROWS}
              />
              <p className="text-small text-text-stone mt-20 mb-0">
                Paper card, line row rules, sortable headers, sticky header at md
                and up. Below md it collapses to key-value cards.
              </p>
            </Panel>
          </div>
        </section>

        <section className="mb-80">
          <p className="font-display text-kicker uppercase text-brand-sun mb-8">03 · 04</p>
          <h2 className="font-display text-display text-text-ink mb-8">App shell and public surface</h2>
          <p className="text-body text-text-stone max-w-[720px] mb-24">
            The header highlights the surface you are on. RoleContextBanner is
            the info band when a second hat is in play. The landing sits on
            ivory, uses the sun kicker, and the ring-and-point mark — not a
            check glyph.
          </p>
          <div className="bg-state-info-soft text-state-info px-16 py-12 mb-24 flex flex-wrap justify-between gap-8">
            <p className="text-small m-0">
              You are viewing as owner of B-707 · Layan Green Park. Actions here
              are recorded against that mandate.
            </p>
            <p className="text-small font-semibold m-0">Switch surface</p>
          </div>
          <div className="flex items-center gap-24 text-brand-andaman">
            <TrustMark size={48} filled />
            <p className="text-body text-text-stone m-0">
              Trust points on the landing use this mark at 48px.
            </p>
          </div>
        </section>

        <section className="mb-80">
          <p className="font-display text-kicker uppercase text-brand-sun mb-8">06</p>
          <h2 className="font-display text-display text-text-ink mb-8">Stay · the guest surface</h2>
          <p className="text-body text-text-stone max-w-[720px] mb-0">
            The in-stay home is a feed on ivory: paper stay card, sun kicker,
            status chips, paper action tiles. Door codes and TM30 chips appear
            only when those facts exist. Empty concierge, shuttle, and order
            blocks are not rendered.
          </p>
        </section>
      </div>
    </div>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-surface-paper border border-border-line rounded-lg p-24 ${className || ''}`}>
      {children}
    </div>
  );
}

function ColorBox({ name, color }: { name: string; color: string }) {
  return (
    <div>
      <div
        className="h-64 rounded-md border border-border-line"
        style={{ backgroundColor: color }}
      />
      <p className="text-small font-semibold text-text-ink mt-8 mb-0">{name}</p>
      <p className="text-small text-text-stone m-0">{color}</p>
    </div>
  );
}
