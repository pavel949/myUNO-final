import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConvertPropertySubmission from './convert-client';

afterEach(() => vi.unstubAllGlobals());
const props = { id: 'application', status: 'submitted', existingProjectId: 'project', projects: [{ id: 'project', name: 'Complex' }], organizations: [], areas: [], proposedAddress: '', proposedAreaId: null, proposedLatitude: null, proposedLongitude: null, applicantKind: 'home', operatingModel: null, requestedManagementCompanyName: '', hasDescription: true, descriptionLocale: null };
function verifyReview() {
  for (const name of ["I checked the applicant's identity, mandate or ownership evidence.", 'I checked project and unit duplicates and selected the correct canonical complex.', 'I checked submitted project and unit photos are appropriate for their distinct scopes.']) {
    fireEvent.click(screen.getByRole('checkbox', { name }));
  }
}

describe('description language at administrative conversion', () => {
  it('requires an explicit language for older submitted prose and leaves ownership unchecked', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ projectId: 'project', unitId: 'unit' }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ConvertPropertySubmission {...props} />);
    verifyReview();
    const button = screen.getByRole('button', { name: 'Create canonical draft →' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Description language' }), { target: { value: 'ru' } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ descriptionLocale: 'ru', verifiedOwner: false });
    await screen.findByText('Created canonical draft records. Existing activation checks still apply.');
  });

  it('shows the submitted locale without letting a different reviewer UI relabel it', () => {
    render(<ConvertPropertySubmission {...props} descriptionLocale="th" />);
    const picker = screen.getByRole('combobox', { name: 'Description language' });
    expect(picker).toHaveValue('th');
    expect(picker).toBeDisabled();
    verifyReview();
    expect(screen.getByRole('button', { name: 'Create canonical draft →' })).toBeEnabled();
  });

  it('does not demand language for an application with no description', () => {
    render(<ConvertPropertySubmission {...props} hasDescription={false} />);
    expect(screen.queryByRole('combobox', { name: 'Description language' })).not.toBeInTheDocument();
    verifyReview();
    expect(screen.getByRole('button', { name: 'Create canonical draft →' })).toBeEnabled();
  });
});

it('keeps every reviewer select discoverable by its exact label when populated', () => {
  render(<ConvertPropertySubmission {...props} existingProjectId={null} descriptionLocale="ru" applicantKind="management" requestedManagementCompanyName="Synthetic company" organizations={[{ id: 'org', name: 'Verified company', projectId: null }]} areas={[{ id: 'area', slug: 'Synthetic area' }]} />);
  expect(screen.getByLabelText('Description language', { exact: true })).toHaveValue('ru');
  const area = screen.getByLabelText('Canonical area', { exact: true });
  fireEvent.change(area, { target: { value: 'area' } });
  expect(screen.getByLabelText('Canonical area', { exact: true })).toHaveValue('area');
  const companyLabel = 'Verified management company (requested: Synthetic company)';
  fireEvent.change(screen.getByLabelText(companyLabel, { exact: true }), { target: { value: 'org' } });
  expect(screen.getByLabelText(companyLabel, { exact: true })).toHaveValue('org');
  const projectLabel = 'Match this submission to an existing complex, or leave blank to create a new draft project.';
  fireEvent.change(screen.getByLabelText(projectLabel, { exact: true }), { target: { value: 'project' } });
  expect(screen.getByLabelText(projectLabel, { exact: true })).toHaveValue('project');
});
