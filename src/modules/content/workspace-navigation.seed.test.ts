import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { WORKSPACE_NAVIGATION_KEYS, WORKSPACE_NAVIGATION_LABELS, WORKSPACE_NAVIGATION_DRAFTS } from './workspace-navigation.seed';
import { WORKSPACE_NAVIGATION_LABEL_KEYS } from '@/lib/workspace-navigation';
describe('registered workspace navigation copy', () => {
  it('registers unique reviewable keys with every supported locale draft', () => {
    expect(new Set(WORKSPACE_NAVIGATION_KEYS.map(row => row.key)).size).toBe(WORKSPACE_NAVIGATION_KEYS.length);
    for (const row of WORKSPACE_NAVIGATION_KEYS) {
      expect(row.namespace).toBe('workspace'); expect(row.status).toBe('needs_review');
      for (const locale of ['en', 'ru', 'th', 'zh'] as const) expect(WORKSPACE_NAVIGATION_DRAFTS[row.key][locale].trim()).not.toBe('');
    }
    for (const key of WORKSPACE_NAVIGATION_LABEL_KEYS) expect(WORKSPACE_NAVIGATION_LABELS[key]).toBeTruthy();
    expect(readFileSync('src/modules/content/seed.ts', 'utf8')).toContain('...WORKSPACE_NAVIGATION_KEYS');
  });
  it('uses verified navigation context for both switcher and existing navbar destinations', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8');
    expect(layout).toContain('getWorkspaceNavigationContext(user)');
    expect(layout).toContain('workspaceContext.personalLinks');
    expect(layout).toContain('workspaceContext.propertyOptions');
    expect(layout).toContain('<WorkspaceNavigationProvider');
    expect(layout).not.toContain('availableSurfaces(');
    expect(layout).not.toContain('<MobileTabBar');
  });
});
