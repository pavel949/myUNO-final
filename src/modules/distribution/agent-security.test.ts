import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Agent Distribution security boundaries', () => {
  const migration = readFileSync(
    'prisma/migrations/20261003073000_agent_distribution_foundation/migration.sql',
    'utf8',
  );
  const clientRoute = readFileSync('src/app/api/agent/clients/route.ts', 'utf8');
  const quoteRoute = readFileSync('src/app/api/agent/quotes/route.ts', 'utf8');
  const shortlistRoute = readFileSync('src/app/api/agent/shortlists/route.ts', 'utf8');
  const shareRoute = readFileSync('src/app/api/agent/share-links/route.ts', 'utf8');
  const publicShare = readFileSync('src/app/a/[token]/page.tsx', 'utf8');
  const service = readFileSync('src/modules/distribution/agent.service.ts', 'utf8');

  it('keeps agent commercial tables closed to Data API roles', () => {
    for (const table of [
      'agent_client_protection',
      'agent_shortlist',
      'agent_shortlist_item',
      'agent_quote',
      'agent_quote_item',
      'agent_commission',
      'agent_shared_link',
    ]) {
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL ON TABLE "${table}" FROM PUBLIC, anon, authenticated`);
    }
  });

  it('scopes private agent reads and mutations through the authenticated agent identity', () => {
    for (const route of [clientRoute, quoteRoute, shortlistRoute, shareRoute]) {
      expect(route).toContain('getCurrentUser');
      expect(route).toContain('getAgentContext');
    }
    expect(clientRoute).toContain('agentIdentityId: agent.identityId');
    expect(quoteRoute).toContain('agentIdentityId: agent.identityId');
    expect(shortlistRoute).toContain('agentIdentityId: agent.identityId');
    expect(service).toContain('agentIdentityId: context.identityId');
  });

  it('does not allow public agent inputs to control commission or discount authority', () => {
    expect(quoteRoute).not.toContain('commissionPct');
    expect(quoteRoute).not.toContain('discountThb');
    expect(service).toContain('const commissionRateBps = distribution.defaultAgentCommissionBps');
    expect(service).toContain('discountSatang: 0');
  });

  it('validates ownership before issuing a public share token and enforces expiry on read', () => {
    expect(service).toContain("where: { id: input.shortlistId, agentIdentityId: context.identityId }");
    expect(service).toContain("where: { id: input.quoteId, agentIdentityId: context.identityId }");
    expect(publicShare).toContain('if(link.expiresAt&&link.expiresAt<=new Date())notFound()');
  });
});
