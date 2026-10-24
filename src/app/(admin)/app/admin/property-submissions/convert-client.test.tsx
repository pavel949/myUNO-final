import { fireEvent, render as renderUi, screen, waitFor } from '@testing-library/react';
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

const employee = { kind: 'unit' as const, spaceId: 'space-a', organizationId: 'org-a', scopeProjectId: 'project' };
const reviewOptions = { units: [{ id: 'existing-unit', name: 'Existing eligible unit', projectId: 'project' }], projects: [{ id: 'existing-project', name: 'Existing complex', address: 'Verified address' }] };
const employeeLabels = {
  rights: 'I checked the creator’s identity and current creation permission for this organization and workspace.',
  duplicates: 'I checked duplicates and the selected new-draft or existing-record outcome.',
  media: 'I checked the submitted descriptive facts and photos for the requested scope.',
};
function verifyEmployee() { for (const label of Object.values(employeeLabels)) fireEvent.click(screen.getByRole('checkbox', { name: label })); }

describe('employee creation review', () => {
  it('keeps the parent complex fixed and never exposes owner, engagement or merge controls', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ projectId: 'project', unitId: 'new-unit', createdProjectId: null, createdUnitId: 'new-unit', matchedExisting: false }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ConvertPropertySubmission {...props} descriptionLocale="en" employeeCreation={employee} employeeReviewOptions={reviewOptions} />);
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getByRole('combobox')).toHaveAccessibleName('Existing unit match');
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.queryByRole('checkbox', { name: /unit owner/ })).not.toBeInTheDocument();
    verifyEmployee(); fireEvent.click(screen.getByRole('button', { name: 'Create canonical draft', exact: true }));
    await screen.findByText('Canonical draft created');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ descriptionLocale: 'en', projectId: 'project', existingUnitId: null, verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true, verifiedOwner: false, organizationId: null });
    expect(screen.getByRole('link', { name: 'Open new unit draft' })).toHaveAttribute('href', '/app/admin/units/new-unit');
    expect(screen.queryByRole('link', { name: /project onboarding/i })).not.toBeInTheDocument();
  });
  it('creates a complex without matching an existing project or choosing an owner', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ projectId: 'new-project', unitId: null, createdProjectId: 'new-project', createdUnitId: null, matchedExisting: false }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ConvertPropertySubmission {...props} descriptionLocale="en" employeeCreation={{ ...employee, kind: 'complex', scopeProjectId: null }} employeeReviewOptions={reviewOptions} />);
    verifyEmployee(); fireEvent.click(screen.getByRole('button', { name: 'Create canonical draft', exact: true }));
    await screen.findByText('Canonical draft created');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).projectId).toBeNull();
    expect(screen.getByRole('link', { name: 'Open new complex draft' })).toHaveAttribute('href', '/app/admin/properties/new-project/onboarding');
  });
  it('disables the whole review during conversion and requires refresh after response loss', async () => {
    let reject!: (error: Error) => void;
    const fetchMock = vi.fn(() => new Promise((_resolve, fail) => { reject = fail; }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ConvertPropertySubmission {...props} descriptionLocale="en" employeeCreation={employee} employeeReviewOptions={reviewOptions} />);
    verifyEmployee(); fireEvent.click(screen.getByRole('button', { name: 'Create canonical draft', exact: true }));
    expect(screen.getByRole('checkbox', { name: employeeLabels.rights })).toBeDisabled();
    reject(new Error('Lost response'));
    await screen.findByRole('button', { name: 'Refresh review' });
    expect(screen.getByRole('button', { name: 'Create canonical draft', exact: true })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});


it('lets an administrator match only the provided eligible unit and reports no new draft', async () => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ projectId: 'project', unitId: 'existing-unit', createdProjectId: null, createdUnitId: null, matchedExisting: true }) }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ConvertPropertySubmission {...props} descriptionLocale="en" employeeCreation={employee} employeeReviewOptions={reviewOptions} />);
  fireEvent.change(screen.getByLabelText('Existing unit match'), { target: { value: 'existing-unit' } });
  verifyEmployee(); fireEvent.click(screen.getByRole('button', { name: 'Confirm existing match' }));
  await screen.findByText('Matched to the reviewed existing record. No new draft or content access was created.');
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ projectId: 'project', existingUnitId: 'existing-unit', verifiedOwner: false, organizationId: null });
  expect(screen.queryByRole('link', { name: 'Open new unit draft' })).not.toBeInTheDocument();
});

it('requires duplicate review again after changing the selected complex outcome', () => {
  render(<ConvertPropertySubmission {...props} descriptionLocale="en" employeeCreation={{ ...employee, kind: 'complex', scopeProjectId: null }} employeeReviewOptions={reviewOptions} />);
  verifyEmployee(); expect(screen.getByRole('button', { name: 'Create canonical draft', exact: true })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Existing complex match'), { target: { value: 'existing-project' } });
  expect(screen.getByRole('checkbox', { name: employeeLabels.duplicates })).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Confirm existing match' })).toBeDisabled();
});

it('does not offer conversion when current scoped match options cannot be loaded', () => {
  render(<ConvertPropertySubmission {...props} descriptionLocale="en" employeeCreation={employee} employeeReviewOptions={null} />);
  expect(screen.getByRole('combobox', { name: 'Existing unit match' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Create canonical draft', exact: true })).toBeDisabled();
  expect(screen.getByText('Review options are unavailable. Refresh this page or check the creator’s current workspace permission.')).toBeInTheDocument();
});

it('sends an explicit existing-complex match without unit or ownership actions', async () => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ projectId: 'existing-project', unitId: null, createdProjectId: null, createdUnitId: null, matchedExisting: true }) }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ConvertPropertySubmission {...props} descriptionLocale="en" employeeCreation={{ ...employee, kind: 'complex', scopeProjectId: null }} employeeReviewOptions={reviewOptions} />);
  fireEvent.change(screen.getByLabelText('Existing complex match'), { target: { value: 'existing-project' } });
  verifyEmployee(); fireEvent.click(screen.getByRole('button', { name: 'Confirm existing match' }));
  await screen.findByText('Matched to the reviewed existing record. No new draft or content access was created.');
  const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(body).toMatchObject({ projectId: 'existing-project', verifiedOwner: false, organizationId: null });
  expect(body).not.toHaveProperty('existingUnitId');
  expect(screen.queryByRole('link', { name: 'Open new complex draft' })).not.toBeInTheDocument();
});

// Behavioral fixtures exercise English explicitly; locale rendering has separate coverage.
import { LocaleProvider } from '@/components/LocaleProvider';
const render = (ui: React.ReactNode) => renderUi(<LocaleProvider locale="en">{ui}</LocaleProvider>);
