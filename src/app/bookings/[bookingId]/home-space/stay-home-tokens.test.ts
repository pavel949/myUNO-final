import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const stayCard = readFileSync(join(process.cwd(), 'src/components/instay/StayCard.tsx'), 'utf8');
const home = readFileSync(
  join(process.cwd(), 'src/app/bookings/[bookingId]/home-space/client.tsx'),
  'utf8'
);
const actions = readFileSync(
  join(process.cwd(), 'src/components/instay/QuickActionsRow.tsx'),
  'utf8'
);

describe('in-stay home tokens (Claude Design board 06)', () => {
  it('sits on ivory and uses a two-column desktop feed', () => {
    expect(home).toContain('bg-surface-ivory');
    expect(home).toContain('lg:grid-cols-[1fr_320px]');
    expect(home).not.toContain('bg-surface-background');
  });

  it('does not invent a door code', () => {
    expect(home).not.toContain('4417');
    expect(stayCard).toContain('doorCode');
    expect(stayCard).toContain('Never invent');
  });

  it('renders the stay as a paper card with chips, not an andaman gradient', () => {
    expect(stayCard).toContain('bg-surface-paper');
    expect(stayCard).toContain('Chip');
    expect(stayCard).toContain('home.stay.kicker');
    expect(stayCard).not.toContain('bg-gradient-to-r');
    expect(stayCard).not.toContain('bg-green-100');
    expect(stayCard).not.toContain('bg-blue-100');
  });

  it('uses paper action tiles rather than a sun-filled extend button', () => {
    expect(actions).toContain('bg-surface-paper');
    expect(actions).not.toContain('variant="sun"');
  });
});
