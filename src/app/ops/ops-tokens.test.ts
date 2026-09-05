import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const board = readFileSync(join(process.cwd(), 'src/app/ops/page.tsx'), 'utf8');
const client = readFileSync(join(process.cwd(), 'src/app/ops/ops-client.tsx'), 'utf8');
const tm30 = readFileSync(join(process.cwd(), 'src/app/ops/tm30/page.tsx'), 'utf8');
const claims = readFileSync(join(process.cwd(), 'src/app/ops/claims/file-claim-client.tsx'), 'utf8');

describe('ops tokens (Claude Design board 09)', () => {
  it('sits the board on ivory with a display title and live counts', () => {
    expect(board).toContain('bg-surface-ivory');
    expect(board).toContain('text-display-xl');
    expect(board).toContain('staff.ops.subtitle');
    expect(board).toContain('StatTile');
  });

  it('keeps check-in gated on payment and cash gated on a receipt', () => {
    expect(client).toContain('disabled={!booking.paid}');
    expect(client).toContain("disabled={!(receipts[booking.id] || '').trim()}");
    expect(client).toContain('staff.ops.confirm_cash');
  });

  it('does not invent a project name in the heading', () => {
    expect(board).not.toContain('Layan operations');
  });

  it('uses chips for paid, passport, ticket, and TM30 status', () => {
    expect(client).toContain('Chip');
    expect(client).toContain('paidChip');
    expect(tm30).toContain('bg-surface-ivory');
    expect(tm30).toContain('staff.tm30.subtitle');
  });

  it('does not use machine date format on claims', () => {
    expect(claims).toContain('toLocaleDateString');
    expect(claims).not.toContain('sv-SE');
  });
});
