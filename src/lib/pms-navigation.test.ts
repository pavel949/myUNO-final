import { describe, expect, it } from 'vitest';
import { pmsNavigationHref, pmsWorkspaceSelectionHref } from './pms-navigation';

describe('PMS navigation scope', () => {
  it('asks for workspace selection before opening space-only work queues', () => {
    expect(pmsNavigationHref('/ops/housekeeping', {})).toBe('/ops/spaces?view=housekeeping');
    expect(pmsWorkspaceSelectionHref('housekeeping', 'resort/a')).toBe('/ops/housekeeping?spaceId=resort%2Fa');
    expect(pmsWorkspaceSelectionHref('https://evil.example', 's')).toBe('/ops/spaces/s');
  });
  it('keeps selected space and project on compatible screens without pretending project-only screens support space', () => {
    const context = { spaceId: 's', projectId: 'p' };
    expect(pmsNavigationHref('/ops', context)).toBe('/ops/spaces/s');
    expect(pmsNavigationHref('/ops/maintenance', context)).toBe('/ops/maintenance?spaceId=s');
    expect(pmsNavigationHref('/ops/stays', context)).toBe('/ops/stays?spaceId=s&projectId=p');
    expect(pmsNavigationHref('/ops/requests', context)).toBe('/ops/requests?projectId=p');
    expect(pmsNavigationHref('/ops/spaces', context)).toBe('/ops/spaces');
    expect(pmsNavigationHref('/app/admin/ledger', context)).toBe('/app/admin/ledger');
  });
});
