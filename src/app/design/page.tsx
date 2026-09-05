'use client';

import React, { useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';
import { Textarea } from '@/components/Textarea';
import { Select } from '@/components/Select';
import { Chip } from '@/components/Chip';
import { StatusChip } from '@/components/StatusChip';
import { Counter } from '@/components/Counter';
import { Avatar } from '@/components/Avatar';
import { Badge, VerifiedBadge } from '@/components/Badge';
import { EmptyState, LoadingState, ErrorState } from '@/components/StateComponents';
import { Skeleton } from '@/components/Skeleton';
import { PriceBreakdown } from '@/components/PriceBreakdown';
import { StatusTimeline } from '@/components/StatusTimeline';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function DesignPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [guestCount, setGuestCount] = useState(2);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [strengthPreview, setStrengthPreview] = useState('correct-horse-battery');

  return (
    <div className="bg-surface-ivory min-h-screen py-40 px-16 md:px-24">
      <div className="max-w-content mx-auto">
        <h1 className="text-display-xl text-text-ink mb-56">Design System</h1>

        {/* Colors Section */}
        <Section title="Color Tokens">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-16">
            <ColorBox name="brand.andaman" color="#0E4F4B" />
            <ColorBox name="brand.deep" color="#0A3733" />
            <ColorBox name="brand.sun" color="#D69A3A" />
            <ColorBox name="brand.sun-soft" color="#E7C079" />
            <ColorBox name="surface.ivory" color="#F5EFE4" />
            <ColorBox name="surface.paper" color="#FBF8F1" />
            <ColorBox name="text.ink" color="#16211F" />
            <ColorBox name="text.stone" color="#7E8C88" />
            <ColorBox name="state.success" color="#2F7A57" />
            <ColorBox name="state.warning" color="#B97F1F" />
            <ColorBox name="state.error" color="#AE4E38" />
          </div>
        </Section>

        {/* Buttons Section */}
        <Section title="Buttons">
          <SubSection title="Variants">
            <div className="flex flex-wrap gap-16">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="sun">Sun (Dark Only)</Button>
            </div>
          </SubSection>

          <SubSection title="Sizes">
            <div className="flex flex-wrap gap-16 items-center">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </SubSection>

          <SubSection title="States">
            <div className="flex flex-wrap gap-16">
              <Button>Default</Button>
              <Button disabled>Disabled</Button>
              <Button isLoading>Loading</Button>
              <Button fullWidth>Full Width</Button>
            </div>
          </SubSection>
        </Section>

        {/* Input Section */}
        <Section title="Input Fields">
          <SubSection title="Default States">
            <div className="max-w-md space-y-24">
              <Input label="Email" placeholder="Enter email" />
              <Input label="Password" type="password" placeholder="Enter password" />
              <Input label="Optional field" />
            </div>
          </SubSection>

          <SubSection title="Error State">
            <div className="max-w-md">
              <Input
                label="Invalid field"
                error="This field is required"
                placeholder="Enter value"
              />
            </div>
          </SubSection>

          <SubSection title="Help Text">
            <div className="max-w-md">
              <Input
                label="Email"
                placeholder="Enter email"
                helpText="We'll never share your email"
              />
            </div>
          </SubSection>

          <SubSection title="Disabled State">
            <div className="max-w-md">
              <Input
                label="Disabled field"
                placeholder="Cannot edit"
                disabled
              />
            </div>
          </SubSection>

          <SubSection title="Textarea">
            <div className="max-w-md">
              <Textarea label="Note to provider" defaultValue="Gate code 4417. Dog on site." />
            </div>
          </SubSection>

          <SubSection title="Select">
            <div className="max-w-md">
              <Select label="Language" defaultValue="en">
                <option value="en">English</option>
                <option value="ru">Русский</option>
                <option value="th">ไทย</option>
              </Select>
            </div>
          </SubSection>

          <SubSection title="Password — 44px reveal toggle, re-hides after 15s">
            <div className="max-w-md flex flex-col gap-8">
              <PasswordInput
                label="Password"
                value={strengthPreview}
                onChange={(e) => setStrengthPreview(e.target.value)}
              />
              <PasswordStrengthMeter password={strengthPreview} />
            </div>
          </SubSection>
        </Section>

        {/* Counter Section */}
        <Section title="Counter">
          <SubSection title="Guests, quantity — 44px targets">
            <div className="max-w-xs">
              <Counter label="Guests" value={guestCount} min={1} max={8} onChange={setGuestCount} />
            </div>
          </SubSection>
        </Section>

        {/* Chips Section */}
        <Section title="Chips">
          <SubSection title="Filter Chips">
            <div className="flex flex-wrap gap-12">
              <Chip
                variant="filter"
                isSelectable
                isActive={activeFilter === 'all'}
                onClick={() => setActiveFilter('all')}
              >
                All
              </Chip>
              <Chip
                variant="filter"
                isSelectable
                isActive={activeFilter === 'recent'}
                onClick={() => setActiveFilter('recent')}
              >
                Recent
              </Chip>
              <Chip
                variant="filter"
                isSelectable
                isActive={activeFilter === 'popular'}
                onClick={() => setActiveFilter('popular')}
              >
                Popular
              </Chip>
            </div>
          </SubSection>

          <SubSection title="Status Chips">
            <div className="flex flex-wrap gap-12">
              <Chip variant="status" status="confirmed">
                Confirmed
              </Chip>
              <Chip variant="status" status="pending_payment">
                Pending Payment
              </Chip>
              <Chip variant="status" status="requested">
                Requested
              </Chip>
              <Chip variant="status" status="declined">
                Declined
              </Chip>
              <Chip variant="status" status="cancelled">
                Cancelled
              </Chip>
            </div>
          </SubSection>

          <SubSection title="StatusChip — single §3.4 mapping">
            <div className="flex flex-wrap gap-12">
              <StatusChip status="confirmed" label="Confirmed" />
              <StatusChip status="pending_payment" label="Pending payment" />
              <StatusChip status="cancelled" label="Cancelled" />
              <StatusChip status="draft" label="Draft" />
              <StatusChip status="checked_in" label="Checked in" />
            </div>
          </SubSection>
        </Section>

        {/* Avatar Section */}
        <Section title="Avatars">
          <div className="flex flex-wrap gap-24 items-center">
            <Avatar size="xs" initials="AB" />
            <Avatar size="sm" initials="CD" />
            <Avatar size="md" initials="EF" />
            <Avatar size="lg" initials="GH" />
            <Avatar size="xl" initials="IJ" />
          </div>
        </Section>

        {/* Badges Section */}
        <Section title="Badges">
          <SubSection title="Regular Badges">
            <div className="flex flex-wrap gap-12">
              <Badge>Default Badge</Badge>
              <Badge variant="verified">Verified Badge</Badge>
            </div>
          </SubSection>

          <SubSection title="Verified Badge Component">
            <div className="flex flex-wrap gap-12">
              <VerifiedBadge label="Verified Owner" />
              <VerifiedBadge label="Vetted Provider" />
            </div>
          </SubSection>
        </Section>

        {/* State Components Section */}
        <Section title="State Components">
          <SubSection title="Empty State">
            <div className="bg-surface-paper rounded-lg border border-border-line p-24">
              <EmptyState
                title="No results found"
                description="Try adjusting your search criteria"
                action={{
                  label: 'Clear filters',
                  onClick: () => alert('Filters cleared'),
                }}
              />
            </div>
          </SubSection>

          <SubSection title="Loading State">
            <div className="bg-surface-paper rounded-lg border border-border-line">
              <LoadingState message="Loading data..." />
            </div>
          </SubSection>

          <SubSection title="Error State">
            <div className="bg-surface-paper rounded-lg border border-border-line p-24">
              <ErrorState
                title="Something went wrong"
                description="We encountered an error. Please try again."
                onRetry={() => alert('Retry clicked')}
              />
            </div>
          </SubSection>
        </Section>

        {/* Data & State Surfaces Section */}
        <Section title="Data & State Surfaces">
          <SubSection title="Skeleton">
            <div className="flex flex-col gap-12 max-w-md">
              <Skeleton shape="line" width="60%" />
              <Skeleton shape="card" />
              <Skeleton shape="line" width="80%" />
              <div className="flex items-center gap-12">
                <Skeleton shape="avatar" />
                <Skeleton shape="line" width="40%" />
              </div>
            </div>
          </SubSection>

          <SubSection title="PriceBreakdown">
            <div className="max-w-md">
              <PriceBreakdown
                items={[
                  { label: '8 nights × ฿4,500', amountSatang: 3_600_000, attribution: 'high season · rule RS-2026-HI' },
                  { label: 'Cleaning fee', amountSatang: 180_000 },
                  { label: 'Direct-booking credit', amountSatang: -120_000 },
                ]}
                totalLabel="Total"
                totalSatang={3_660_000}
              />
            </div>
          </SubSection>

          <SubSection title="StatusTimeline — the reporter sees what staff see">
            <div className="max-w-md">
              <StatusTimeline
                events={[
                  { title: 'Resolved', meta: '12 Jan 14:20 · Somchai P.', dotVariant: 'success' },
                  { title: 'In progress', meta: '12 Jan 09:05 · assigned to maintenance', dotVariant: 'active' },
                  { title: 'Raised by guest', meta: '11 Jan 21:40 · aircon in bedroom 2', dotVariant: 'pending' },
                ]}
              />
            </div>
          </SubSection>

          <SubSection title="DataTable — collapses to key-value cards below md">
            <DataTable
              rowKey={(row) => row.id}
              columns={[
                { key: 'unit', header: 'Unit', render: (row) => row.unit },
                { key: 'guest', header: 'Guest', render: (row) => row.guest },
                { key: 'checkIn', header: 'Check-in', render: (row) => row.checkIn },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => <StatusChip status={row.status} label={row.statusLabel} />,
                },
              ]}
              rows={[
                { id: '1', unit: 'B-707 · Layan', guest: 'A. Sokolova', checkIn: '04 Jan 2026', status: 'confirmed', statusLabel: 'Confirmed' },
                { id: '2', unit: 'A-204 · Bang Tao', guest: 'M. Chen', checkIn: '07 Jan 2026', status: 'pending_payment', statusLabel: 'Pending payment' },
                { id: '3', unit: 'Villa Kata 3 · Kata', guest: 'J. Weber', checkIn: '11 Jan 2026', status: 'checked_in', statusLabel: 'Checked in' },
              ]}
            />
          </SubSection>

          <SubSection title="ConfirmDialog — friction scaled to stakes">
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              Cancel booking B-707
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              title="Cancel booking B-707 · Jan 4–12?"
              consequencesHeading="What happens:"
              consequences={[
                'The unit is released to availability immediately.',
                '฿36,600 is refunded under policy flex-7 — ฿32,940 after the 10% window fee.',
                'The guest is notified and the TM30 filing is withdrawn.',
              ]}
              confirmLabel="Cancel booking"
              cancelLabel="Keep booking"
              confirmVariant="destructive"
              onConfirm={() => setConfirmOpen(false)}
              onCancel={() => setConfirmOpen(false)}
            />
          </SubSection>
        </Section>

        {/* Typography Section */}
        <Section title="Typography">
          <div className="space-y-24">
            <div>
              <p className="text-small text-text-stone mb-8">Display XL</p>
              <h1 className="text-display-xl text-text-ink">The quick brown fox</h1>
            </div>
            <div>
              <p className="text-small text-text-stone mb-8">Display</p>
              <h2 className="text-display text-text-ink">The quick brown fox</h2>
            </div>
            <div>
              <p className="text-small text-text-stone mb-8">Title</p>
              <h3 className="text-title text-text-ink">The quick brown fox</h3>
            </div>
            <div>
              <p className="text-small text-text-stone mb-8">Subtitle</p>
              <h4 className="text-subtitle text-text-ink">The quick brown fox</h4>
            </div>
            <div>
              <p className="text-small text-text-stone mb-8">Body</p>
              <p className="text-body text-text-ink">The quick brown fox jumps over the lazy dog</p>
            </div>
            <div>
              <p className="text-small text-text-stone mb-8">Small</p>
              <p className="text-small text-text-ink">The quick brown fox jumps over the lazy dog</p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-80">
      <h2 className="text-display text-text-ink mb-32">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-40">
      <h3 className="text-subtitle text-text-ink mb-16">{title}</h3>
      <div className="bg-surface-paper rounded-lg border border-border-line p-24">
        {children}
      </div>
    </div>
  );
}

function ColorBox({ name, color }: { name: string; color: string }) {
  return (
    <div className="text-center">
      <div
        className="w-full h-80 rounded-md mb-12 border border-border-line"
        style={{ backgroundColor: color }}
      />
      <p className="text-small font-medium text-text-ink">{name}</p>
      <p className="text-small text-text-stone">{color}</p>
    </div>
  );
}
