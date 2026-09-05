import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const review = readFileSync(join(process.cwd(), 'src/app/book/review/review-client.tsx'), 'utf8');
const unit = readFileSync(join(process.cwd(), 'src/app/units/[id]/unit-client.tsx'), 'utf8');
const search = readFileSync(join(process.cwd(), 'src/app/search/search-results.tsx'), 'utf8');
const bookings = readFileSync(join(process.cwd(), 'src/app/api/bookings/route.ts'), 'utf8');
const footer = readFileSync(join(process.cwd(), 'src/components/Footer.tsx'), 'utf8');
const navbar = readFileSync(join(process.cwd(), 'src/components/Navbar.tsx'), 'utf8');
const owners = readFileSync(join(process.cwd(), 'src/app/(public)/owners/page.tsx'), 'utf8');
const tickets = readFileSync(join(process.cwd(), 'src/app/tickets/tickets-list-client.tsx'), 'utf8');
const ticketDetail = readFileSync(join(process.cwd(), 'src/app/tickets/[id]/page.tsx'), 'utf8');
const handbook = readFileSync(
  join(process.cwd(), 'src/app/bookings/[bookingId]/home-space/handbook/page.tsx'),
  'utf8'
);

describe('specified surfaces wired to existing rails', () => {
  it('ships the S5 review page and routes reserve through it', () => {
    expect(existsSync(join(process.cwd(), 'src/app/book/review/page.tsx'))).toBe(true);
    expect(review).toContain('policyConsent');
    expect(review).toContain('/api/bookings');
    expect(unit).toContain('/book/review');
    expect(unit).not.toContain("fetch('/api/bookings'");
  });

  it('accepts bank transfer at booking time', () => {
    expect(bookings).toContain('bank_transfer');
    expect(review).toContain('payTransfer');
  });

  it('exposes search type and price filters already supported by the API', () => {
    expect(search).toContain('unitTypes');
    expect(search).toContain('minPrice');
    expect(search).toContain('/book/review');
    expect(search).not.toContain('MapView');
  });

  it('links header, footer, owners CTA, tickets, and handbook', () => {
    expect(navbar).toContain('/owners');
    expect(navbar).toContain('/about');
    expect(footer).toContain('/trust/ombudsman');
    expect(footer).toContain('/legal');
    expect(footer).toContain('LocaleSwitcher');
    expect(owners).toContain('#lead-form');
    expect(tickets).toContain('filter_all');
    expect(ticketDetail).toContain('/messages/');
    expect(handbook).toContain('/home-space');
  });
});
