import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('homepage optional editorial layer', () => {
  it('cannot take the canonical homepage down when placements storage is unavailable', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/home/public-homepage.service.ts'),
      'utf8',
    );
    const placementRead = source.slice(source.indexOf('prisma.homepagePlacement.findMany'));
    expect(placementRead).toContain('.catch((error) =>');
    expect(placementRead).toContain('return [];');
  });
});
