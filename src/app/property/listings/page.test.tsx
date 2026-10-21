import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import SupplierListingsPage from './page';
const h = vi.hoisted(() => ({ drafts: vi.fn() }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => ({ identityId: 'creator-a', roles: [] }) }));
vi.mock('@/lib/prisma', () => ({ prisma: { crmOpportunity: { findMany: h.drafts }, unit: { findMany: async () => [] } } }));
vi.mock('@/lib/i18n', () => ({ getRequestLocale: () => 'en', getLabels: async (labels: Record<string, string>) => labels }));
vi.mock('@/components/premium/StitchPage', () => ({ StitchMain: ({ children }: { children: ReactNode }) => <main>{children}</main>, PageHeading: ({ title }: { title: string }) => <h1>{title}</h1>, LinkButton: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock('@/app/libs/supplierListingAccess', () => ({ hasSelfListingAccess: vi.fn() }));
vi.mock('@/app/libs/projectScope', () => ({ hasManagedUnitMcAccess: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
describe('creator application route continuity', () => {
  it('keeps public owner intake on its existing route and sends employee intake to the separate creation editor', async () => {
    h.drafts.mockResolvedValue([{ id: 'owner-draft', title: 'Owner draft', requirements: { status: 'draft' } }, { id: 'employee-draft', title: 'Employee draft', requirements: { status: 'submitted', employeeCreation: { version: 1 } } }]);
    render(await SupplierListingsPage());
    expect(screen.getByRole('link', { name: /Owner draft/ })).toHaveAttribute('href', '/property/onboard?submissionId=owner-draft');
    expect(screen.getByRole('link', { name: /Employee draft/ })).toHaveAttribute('href', '/property/create?id=employee-draft');
    expect(h.drafts).toHaveBeenCalledWith(expect.objectContaining({ where: { identityId: 'creator-a', source: 'myuno_property_submission_v1' } }));
  });
  it('does not fall back to public intake when the reserved employee receipt is malformed', async () => {
    h.drafts.mockResolvedValue([{ id: 'bad-receipt', title: 'Unverified draft', requirements: { status: 'draft', employeeCreation: null } }]);
    render(await SupplierListingsPage());
    expect(screen.getByRole('link', { name: /Unverified draft/ })).toHaveAttribute('href', '/property/create?id=bad-receipt');
  });
});
