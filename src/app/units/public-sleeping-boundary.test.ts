import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(path, 'utf8');
it('renders the scoped server projection in inquiry and bookable detail without a new public fetch', () => {
  const page = source('src/app/units/[id]/page.tsx');
  expect(page.match(/<PublicSleepingSummary spaces=\{unit.sleepingSpaces\} labels=\{labels\} \/>/g)).toHaveLength(2);
  expect(page).toContain('sleepingSummary={<PublicSleepingSummary');
  const client = source('src/app/units/[id]/unit-client.tsx');
  expect(client).toContain('sleepingSummary?: ReactNode');
  expect(client).toContain('{sleepingSummary}');
});
describe('strict public reader retains existing gates', () => {
  it('adds only sleeping selection/projection inside the strict reader', () => {
    const reader = source('src/modules/projects/public.service.ts').split('export async function getPublicUnitById')[1].split('export async function listPublicUnitIds')[0];
    expect(reader).toContain('publicStayUnitWhere(excludedIds)');
    expect(reader).toContain("unit.status !== 'live'");
    expect(reader).toContain('if (!media.ready) return null');
    expect(reader).toContain('sleepingSpaces: PUBLIC_SLEEPING_SPACES_QUERY');
    expect(reader).toContain('sleepingSpaces: publicSleepingSpaces(unit.sleepingSpaces)');
  });
});
