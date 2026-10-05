import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('optional public presentation layers', () => {
  it('cannot take the canonical homepage down when placements storage is unavailable', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/home/public-homepage.service.ts'),
      'utf8',
    );
    const placementRead = source.slice(source.indexOf('prisma.homepagePlacement.findMany'));
    expect(placementRead).toContain('.catch((error) =>');
    expect(placementRead).toContain('return [];');
  });

  it('cannot take a project portal down when nearby-place storage is unavailable', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/projects/public.service.ts'),
      'utf8',
    );
    const nearbyRead = source.slice(source.indexOf('listProjectNearbyPlaces('));
    expect(nearbyRead).toContain('.catch((error) =>');
    expect(nearbyRead).toContain('return [];');
  });
});
