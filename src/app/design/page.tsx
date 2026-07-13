'use client';

import React, { useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Chip } from '@/components/Chip';
import { Avatar } from '@/components/Avatar';
import { Badge, VerifiedBadge } from '@/components/Badge';
import { EmptyState, LoadingState, ErrorState } from '@/components/StateComponents';

export default function DesignPage() {
  const [activeFilter, setActiveFilter] = useState('all');

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
