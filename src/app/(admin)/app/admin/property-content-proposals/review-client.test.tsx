import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContentProposalReview from './review-client';
import { CONTENT_PROPOSAL_EDITOR_KEYS } from '@/modules/content/content-proposal-editor.seed';
import { CONTENT_PROPOSAL_REVIEW_KEYS, CONTENT_PROPOSAL_REVIEW_DRAFTS } from '@/modules/content/content-proposal-review.seed';
const labels = Object.fromEntries([...CONTENT_PROPOSAL_REVIEW_KEYS, ...CONTENT_PROPOSAL_EDITOR_KEYS].map(row => [row.key, row.en]));
const facts = { name: 'A201', bedrooms: 1, bathrooms: 1, maxGuests: 2, sizeSqm: null, grossAreaSqm: null, floor: null, addressSupplement: '', amenityKeys: [] };
const row = { id: 'proposal-1', scope: 'unit', targetId: 'unit-1', projectId: 'project-1', targetName: 'A201', status: 'submitted', revision: 4, updatedAt: '', reviewNote: null };
const detail = { ...row, baseline: { facts, descriptions: { ru: 'Старое описание', en: 'Unchanged English' }, gallery: { mediaIds: [], coverMediaId: null, media: [] } }, proposal: { facts: { ...facts, name: 'A201 revised' }, description: { locale: 'ru', value: 'Новое описание' }, gallery: { mediaIds: [], coverMediaId: null } }, author: { id: 'employee-1', name: 'Synthetic Employee' } };
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
afterEach(() => { vi.unstubAllGlobals(); });
async function ready(fetchMock: (url: string, init?: RequestInit) => Promise<unknown>) {
  vi.stubGlobal('fetch', fetchMock);
  render(<ContentProposalReview labels={labels} />);
  fireEvent.click(await screen.findByRole('button', { name: 'A201 One home · Awaiting review' }));
  await screen.findByRole('heading', { name: 'A201 revised' });
}
describe('administrator review applies only an explicitly reviewed revision', () => {
  it('shows before/after and author; sends only review action and expected revision after confirmation', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ok(init?.method === 'POST' ? { ...detail, status: 'approved', revision: 5 } : url.endsWith('proposal-1') ? detail : { items: [row] }));
    await ready(fetchMock);
    expect(screen.getByText('Старое описание')).toBeVisible();
    expect(screen.getByText('Новое описание')).toBeVisible();
    expect(screen.getByText(/Synthetic Employee/)).toBeVisible();
    expect(screen.getByText(/visitors can see the new content immediately/)).toBeVisible();
    const approve = screen.getByRole('button', { name: 'Approve and apply content' });
    expect(approve).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(approve);
    await screen.findByText('The reviewed content was applied. Ownership, prices and publication status are unchanged.');
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe('/api/admin/property-content-proposals/proposal-1/review');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ action: 'approve', expectedRevision: 4 });
    expect(screen.queryByRole('button', { name: 'Approve and apply content' })).not.toBeInTheDocument();
  });
  it('requires a note for return and preserves exact label after text is entered', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ok(init?.method === 'POST' ? { ...detail, status: 'returned', revision: 5, reviewNote: 'Correct the bedroom count.' } : url.endsWith('proposal-1') ? detail : { items: [row] }));
    await ready(fetchMock);
    const returnButton = screen.getByRole('button', { name: 'Return for changes' });
    expect(returnButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Review note (required when returning)', { exact: true }), { target: { value: ' Correct the bedroom count. ' } });
    expect(screen.getByLabelText('Review note (required when returning)', { exact: true })).toHaveValue(' Correct the bedroom count. ');
    fireEvent.click(returnButton);
    await screen.findByText('Returned to the author with your note.');
    expect(JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body))).toEqual({ action: 'return', expectedRevision: 4, note: 'Correct the bedroom count.' });
  });
  it('reports a stale approval without false success and requires renewed confirmation', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => init?.method === 'POST' ? { ok: false, status: 409, json: async () => ({ error: 'stale' }) } : ok(url.endsWith('proposal-1') ? detail : { items: [row] }));
    await ready(fetchMock);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve and apply content' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was applied');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Approve and apply content' })).toBeDisabled();
    expect(screen.queryByText('The reviewed content was applied. Ownership, prices and publication status are unchanged.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh queue' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'A201 revised' })).not.toBeInTheDocument());
  });
  it('retries a failed initial load and does not permit review of a draft', async () => {
    let first = true;
    const fetchMock = vi.fn(async (url: string) => { if (first) { first = false; throw new Error('offline'); } return ok(url.endsWith('proposal-1') ? { ...detail, status: 'draft' } : { items: [{ ...row, status: 'draft' }] }); });
    vi.stubGlobal('fetch', fetchMock); render(<ContentProposalReview labels={labels} />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh queue' }));
    fireEvent.change(screen.getByLabelText('Proposal status', { exact: true }), { target: { value: 'draft' } });
    fireEvent.click(await screen.findByRole('button', { name: 'A201 One home · Draft' }));
    await screen.findByRole('heading', { name: 'A201 revised' });
    expect(screen.queryByRole('button', { name: 'Approve and apply content' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Proposal status', { exact: true })).toHaveValue('draft');
  });
});


const projectFacts = { name: 'Synthetic Complex', brand: null, address: 'Test address', city: null, district: null, projectType: 'resort', totalUnits: null };
const projectRow = { ...row, scope: 'project', targetId: 'project-1', targetName: 'Synthetic Complex' };
const poolBefore = {
  id: 'pool-1', name: 'Original pool', shortDescription: 'Original short text', description: 'Original full description',
  locationLabel: 'Original location', accessInstructions: 'Original access instructions',
  openingHours: { daily: [['08:00', '18:00']], timezone: 'Asia/Bangkok' }, rules: ['Original pool rule'],
};
const poolChange = {
  id: 'pool-1', locale: 'en', name: 'Renamed pool', shortDescription: 'Revised short text', description: 'Revised full description',
  locationLabel: 'Revised location', accessInstructions: 'Revised access instructions',
  openingHours: { mode: 'daily', open: '09:00', close: '20:00', timezone: 'Asia/Bangkok' }, rules: { mode: 'replace', lines: ['Revised pool rule'] },
};
const newFacility = {
  id: null, locale: 'en', name: 'New fitness room', shortDescription: 'Fitness summary', description: 'Fitness description',
  locationLabel: 'Building B', accessInstructions: 'Ask reception for access',
  openingHours: { mode: 'daily', open: '06:00', close: '22:00', timezone: null }, rules: { mode: 'replace', lines: ['Indoor shoes required'] },
};
const projectDetail = {
  ...projectRow,
  baseline: { facts: projectFacts, descriptions: {}, gallery: detail.baseline.gallery, amenities: [poolBefore, { ...poolBefore, id: 'untouched-1', name: 'Untouched tennis court' }] },
  proposal: { facts: projectFacts, description: null, gallery: detail.proposal.gallery, amenities: [poolChange, newFacility] },
};
async function openProject(value: unknown = projectDetail, localeLabels = labels) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ok(init?.method === 'POST'
    ? { ...projectDetail, status: 'approved', revision: 5 }
    : url.endsWith('proposal-1') ? value : { items: [projectRow] }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ContentProposalReview labels={localeLabels} />);
  fireEvent.click(await screen.findByRole('button', { name: /Synthetic Complex/ }));
  await screen.findByRole('heading', { name: 'Synthetic Complex' });
  return fetchMock;
}
describe('administrator review of sparse complex facility proposals', () => {
  it('compares every proposed text field, readable hours and rules without listing untouched facilities', async () => {
    const fetchMock = await openProject();
    const facilities = within(screen.getByRole('region', { name: 'Complex facilities' }));
    const before = within(facilities.getAllByRole('region', { name: 'Starting version' })[0]);
    const afterRegions = facilities.getAllByRole('region', { name: 'Proposed version' });
    const afterPool = within(afterRegions[0]);
    const afterNew = within(afterRegions[1]);
    for (const text of ['Original pool', 'Original short text', 'Original full description', 'Original location', 'Original access instructions', 'Original pool rule']) {
      expect(before.getByText(text)).toBeVisible();
    }
    for (const text of ['Renamed pool', 'Revised short text', 'Revised full description', 'Revised location', 'Revised access instructions', 'Revised pool rule']) {
      expect(afterPool.getByText(text)).toBeVisible();
    }
    for (const text of ['New fitness room', 'Fitness summary', 'Fitness description', 'Building B', 'Ask reception for access', 'Indoor shoes required']) {
      expect(afterNew.getByText(text)).toBeVisible();
    }
    expect(facilities.getByText(/08:00.*18:00/)).toBeVisible();
    expect(facilities.getByText(/09:00.*20:00/)).toBeVisible();
    expect(facilities.getByText(/06:00.*22:00/)).toBeVisible();
    expect(facilities.queryByText('Untouched tennis court')).not.toBeInTheDocument();
    expect(labels['property.content.amenities.new_badge']).toBeTruthy();
    expect(facilities.getByText(labels['property.content.amenities.new_badge'])).toBeVisible();
    expect(facilities.getByText(/New facilities stay unpublished and have no booking offer/)).toBeVisible();
    expect(facilities.getByText(/Publishing requires a separate action by an authorized user/)).toBeVisible();
    expect(facilities.getByText(/also updates the shared fallback; empty text may still display another existing translation/)).toBeVisible();
    expect(facilities.queryByRole('button')).not.toBeInTheDocument();
    expect(facilities.queryByRole('textbox')).not.toBeInTheDocument();
    expect(facilities.queryByText(/"daily"|"mode"|\[object Object\]/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve and apply content' }));
    await screen.findByText('The reviewed content was applied. Ownership, prices and publication status are unchanged.');
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ action: 'approve', expectedRevision: 4 });
  });

  it('preserves custom schedules and rules visibly when kept', async () => {
    const custom = { ...poolBefore, openingHours: { monday: [['07:00', '12:00']], staffContact: [['09:00', '11:00']] }, rules: { safety: ['Supervision required'] } };
    await openProject({ ...projectDetail,
      baseline: { ...projectDetail.baseline, amenities: [custom] },
      proposal: { ...projectDetail.proposal, amenities: [{ ...poolChange, openingHours: { mode: 'keep' }, rules: { mode: 'keep' } }] },
    });
    const facilities = within(screen.getByRole('region', { name: 'Complex facilities' }));
    expect(facilities.getAllByText(/07:00.*12:00/)).toHaveLength(2);
    expect(facilities.getAllByText(/09:00.*11:00/)).toHaveLength(2);
    expect(facilities.getAllByText(/Supervision required/)).toHaveLength(2);
    expect(facilities.getByText(`${labels['property.content.amenities.hours']} · ${labels['property.content.amenities.unchanged']}`)).toBeVisible();
    expect(facilities.getByText(`${labels['property.content.amenities.rules']} · ${labels['property.content.amenities.unchanged']}`)).toBeVisible();
    expect(facilities.queryByText(/"monday"|"safety"|\[object Object\]/)).not.toBeInTheDocument();
  });

  it.each(['Asia/Singapore', null])('retains weekly and staff schedules when replacing daily hours with timezone %s', async timezone => {
    const custom = { ...poolBefore, openingHours: { ...poolBefore.openingHours,
      weekly: { monday: [['07:00', '12:00']] }, staffContact: [['10:00', '11:00']],
    } };
    await openProject({ ...projectDetail,
      baseline: { ...projectDetail.baseline, amenities: [custom] },
      proposal: { ...projectDetail.proposal, amenities: [{ ...poolChange,
        openingHours: { ...poolChange.openingHours, timezone },
      }] },
    });
    const facilities = within(screen.getByRole('region', { name: 'Complex facilities' }));
    const after = within(facilities.getByRole('region', { name: labels['property.content.amenities.after'] }));
    expect(after.getByText(/09:00.*20:00/)).toBeVisible();
    expect(after.getByText(/monday.*07:00.*12:00/)).toBeVisible();
    expect(after.getByText(/10:00.*11:00/)).toBeVisible();
    expect(after.queryByText(/08:00.*18:00/)).not.toBeInTheDocument();
    expect(after.queryByText(/Asia\/Bangkok/)).not.toBeInTheDocument();
    if (timezone) expect(after.getByText(/Asia\/Singapore/)).toBeVisible();
    else expect(after.queryByText(new RegExp(labels['property.content.amenities.timezone']))).not.toBeInTheDocument();
  });

  it('shows intentional clearing of hours and rules without losing the starting version', async () => {
    await openProject({ ...projectDetail, proposal: { ...projectDetail.proposal, amenities: [{ ...poolChange,
      openingHours: { mode: 'clear' }, rules: { mode: 'replace', lines: [] },
    }] } });
    const facilities = within(screen.getByRole('region', { name: 'Complex facilities' }));
    expect(facilities.getByText(/08:00.*18:00/)).toBeVisible();
    expect(facilities.getByText('Original pool rule')).toBeVisible();
    const after = within(facilities.getByRole('region', { name: labels['property.content.amenities.after'] }));
    expect(after.getAllByText(labels['property.content.amenities.empty'])).toHaveLength(2);
    expect(after.queryByText(/08:00.*18:00|Original pool rule/)).not.toBeInTheDocument();
  });

  it.each([undefined, { mode: 'keep' }])('keeps staff-contact hours and timezone when clearing access hours (%s)', async staffHours => {
    const custom = { ...poolBefore, openingHours: { ...poolBefore.openingHours,
      weekly: { monday: [['07:00', '12:00']] }, staffContact: [['10:00', '11:00']],
    } };
    await openProject({ ...projectDetail,
      baseline: { ...projectDetail.baseline, amenities: [custom] },
      proposal: { ...projectDetail.proposal, amenities: [{ ...poolChange,
        openingHours: { mode: 'clear' }, ...(staffHours ? { staffHours } : {}), rules: { mode: 'keep' },
      }] },
    });
    const facilities = within(screen.getByRole('region', { name: 'Complex facilities' }));
    const before = within(facilities.getByRole('region', { name: 'Starting version' }));
    const after = within(facilities.getByRole('region', { name: 'Proposed version' }));
    expect(before.getByText(/08:00.*18:00/)).toBeVisible();
    expect(before.getByText(/monday.*07:00.*12:00/)).toBeVisible();
    expect(after.getByText(/10:00.*11:00/)).toBeVisible();
    expect(after.getByText(/Asia\/Bangkok/)).toBeVisible();
    expect(after.queryByText(/08:00.*18:00|monday.*07:00.*12:00/)).not.toBeInTheDocument();
    expect(after.getByText('Original pool rule')).toBeVisible();
    expect(after.queryByText(`${labels['property.content.amenities.hours']} · ${labels['property.content.amenities.unchanged']}`)).not.toBeInTheDocument();
  });

  it('clears staff-contact hours independently while preserving access schedules and timezone', async () => {
    const custom = { ...poolBefore, openingHours: { ...poolBefore.openingHours,
      weekly: { monday: [['07:00', '12:00']] }, staffContact: [['10:00', '11:00']],
    } };
    await openProject({ ...projectDetail,
      baseline: { ...projectDetail.baseline, amenities: [custom] },
      proposal: { ...projectDetail.proposal, amenities: [{ ...poolChange,
        openingHours: { mode: 'keep' }, staffHours: { mode: 'clear' }, rules: { mode: 'keep' },
      }] },
    });
    const facilities = within(screen.getByRole('region', { name: 'Complex facilities' }));
    const before = within(facilities.getByRole('region', { name: 'Starting version' }));
    const after = within(facilities.getByRole('region', { name: 'Proposed version' }));
    expect(before.getByText(/10:00.*11:00/)).toBeVisible();
    expect(after.getByText(/08:00.*18:00/)).toBeVisible();
    expect(after.getByText(/monday.*07:00.*12:00/)).toBeVisible();
    expect(after.getByText(/Asia\/Bangkok/)).toBeVisible();
    expect(after.queryByText(/10:00.*11:00/)).not.toBeInTheDocument();
    expect(after.getByText('Original pool rule')).toBeVisible();
    expect(after.queryByText(`${labels['property.content.amenities.hours']} · ${labels['property.content.amenities.unchanged']}`)).not.toBeInTheDocument();
  });

  it('compares the selected translation separately from shared fallback changes', async () => {
    await openProject({ ...projectDetail,
      baseline: { ...projectDetail.baseline, amenities: [{ ...poolBefore, translations: {
        ru: { name: 'Исходный бассейн', shortDescription: 'Краткое описание до', description: 'Полное описание до', accessInstructions: 'Инструкция до' },
        th: { name: 'ชื่อภาษาไทยเดิม' },
      } }] },
      proposal: { ...projectDetail.proposal, amenities: [{ ...poolChange, locale: 'ru', name: 'Новый бассейн' }] },
    });
    const facilities = within(screen.getByRole('region', { name: 'Complex facilities' }));
    const before = within(facilities.getByRole('region', { name: 'Starting version' }));
    const after = within(facilities.getByRole('region', { name: 'Proposed version' }));
    expect(before.getByText('Исходный бассейн')).toBeVisible();
    expect(before.getByText('Краткое описание до')).toBeVisible();
    expect(before.getByText('Полное описание до')).toBeVisible();
    expect(before.getByText('Инструкция до')).toBeVisible();
    expect(after.getByText('Новый бассейн')).toBeVisible();
    expect(before.queryByText('Original pool')).not.toBeInTheDocument();
    const canonical = within(facilities.getByRole('region', { name: 'Shared fallback changes' }));
    expect(canonical.getByText('Original pool')).toBeVisible();
    expect(canonical.getByText('Новый бассейн')).toBeVisible();
    expect(facilities.queryByText('ชื่อภาษาไทยเดิม')).not.toBeInTheDocument();
    expect(facilities.getByText(new RegExp(labels['property.content.locale.ru']))).toBeVisible();
  });

  it('shows a retained RU public fallback when EN text is cleared while keeping the raw proposed value empty', async () => {
    await openProject({ ...projectDetail,
      baseline: { ...projectDetail.baseline, amenities: [{ ...poolBefore, translations: {
        en: { shortDescription: 'English pool summary' },
        ru: { shortDescription: 'Русское резервное описание' },
      } }] },
      proposal: { ...projectDetail.proposal, amenities: [{ ...poolBefore, locale: 'en', shortDescription: null,
        openingHours: { mode: 'keep' }, rules: { mode: 'keep' },
      }] },
    });
    const facilities = within(screen.getByRole('region', { name: 'Complex facilities' }));
    const before = within(facilities.getByRole('region', { name: 'Starting version' }));
    const after = within(facilities.getByRole('region', { name: 'Proposed version' }));
    expect(before.getByText('English pool summary')).toBeVisible();
    expect(after.getByText(labels['property.content.amenities.empty'])).toBeVisible();
    expect(after.queryByText('English pool summary')).not.toBeInTheDocument();
    expect(after.queryByText('Русское резервное описание')).not.toBeInTheDocument();
    const preview = within(facilities.getByRole('region', { name: 'Public text preview (when published)' }));
    expect(preview.getByText('Русское резервное описание')).toBeVisible();
    expect(preview.queryByText('English pool summary')).not.toBeInTheDocument();
    const canonical = within(facilities.getByRole('region', { name: 'Shared fallback changes' }));
    expect(canonical.getByText('Original short text')).toBeVisible();
    expect(canonical.getByText(labels['property.content.amenities.empty'])).toBeVisible();
    expect(canonical.queryByText('Original pool')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it.each([undefined, []])('treats omitted or empty facility proposals as no removals (%s)', async amenities => {
    const { amenities: _baselineAmenities, ...legacyBaseline } = projectDetail.baseline;
    const { amenities: _proposalAmenities, ...legacyProposal } = projectDetail.proposal;
    await openProject({ ...projectDetail, baseline: legacyBaseline, proposal: { ...legacyProposal, ...(amenities === undefined ? {} : { amenities }) } });
    const facilities = within(screen.getByRole('region', { name: 'Complex facilities' }));
    expect(facilities.getByText('No facility changes proposed; all existing facilities are preserved.')).toBeVisible();
    expect(facilities.queryByText('Original pool')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve and apply content' })).toBeDisabled();
  });

  it('keeps facilities out of individual-home reviews', async () => {
    await ready(vi.fn(async (url: string) => ok(url.endsWith('proposal-1') ? detail : { items: [row] })));
    expect(screen.queryByRole('region', { name: 'Complex facilities' })).not.toBeInTheDocument();
    expect(screen.queryByText(labels['property.content.review.amenities_hint'])).not.toBeInTheDocument();
  });

  it('registers nonempty EN/RU/TH/ZH drafts for every new or changed reviewer label', () => {
    for (const suffix of ['intro', 'confirm', 'amenities', 'amenities_unchanged', 'amenities_hint']) {
      const key = `property.content.review.${suffix}`;
      const entry = CONTENT_PROPOSAL_REVIEW_KEYS.find(item => item.key === key);
      expect(entry?.status).toBe('needs_review');
      for (const locale of ['en', 'ru', 'th', 'zh'] as const) {
        expect(entry?.[locale]?.trim()).toBeTruthy();
        expect(CONTENT_PROPOSAL_REVIEW_DRAFTS[key][locale]).toBe(entry?.[locale]);
      }
      expect(entry?.th).toMatch(/[\u0E00-\u0E7F]/);
      expect(entry?.zh).toMatch(/[\u4E00-\u9FFF]/);
    }
  });

  it('registers meaningful EN/RU reviewer facility copy and renders Russian section labels', async () => {
    const ruLabels = Object.fromEntries([...CONTENT_PROPOSAL_REVIEW_KEYS, ...CONTENT_PROPOSAL_EDITOR_KEYS].map(row => [row.key, row.ru]));
    for (const suffix of ['amenities', 'amenities_unchanged', 'amenities_hint']) {
      const entry = CONTENT_PROPOSAL_REVIEW_KEYS.find(item => item.key === `property.content.review.${suffix}`);
      expect(entry?.en).toBeTruthy();
      expect(entry?.ru).toMatch(/[А-Яа-я]/);
      expect(entry?.ru).not.toBe(entry?.en);
    }
    await openProject(projectDetail, ruLabels);
    const facilities = within(screen.getByRole('region', { name: 'Инфраструктура комплекса' }));
    expect(facilities.getByText(/Новые объекты остаются неопубликованными/)).toBeVisible();
    expect(facilities.getByText(/Публикация требует отдельного действия сотрудника с соответствующими правами/)).toBeVisible();
    expect(facilities.getByText(/вместо пустого текста может отображаться другой существующий перевод/)).toBeVisible();
    expect(facilities.queryByText('Complex facilities')).not.toBeInTheDocument();
    expect(ruLabels['property.content.amenities.hours']).toMatch(/[А-Яа-я]/);
    expect(facilities.getAllByText(ruLabels['property.content.amenities.hours'])).toHaveLength(3);
    expect(facilities.getByText(ruLabels['property.content.amenities.new_badge'])).toBeVisible();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
