import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecordCostClient, { parseBahtToSatang } from './record-cost-client';

const labels: Record<string, string> = {
  'ops.costs.unit': 'Unit',
  'ops.costs.type': 'Type',
  'ops.costs.amount': 'Amount (฿)',
  'ops.costs.date': 'Date incurred',
  'ops.costs.description': 'What it was for',
  'ops.costs.submit': 'Record cost',
  'ops.costs.saving': 'Recording…',
  'ops.costs.error': 'Could not record that cost.',
  'ops.costs.recent': 'Recorded by you',
  'ops.costs.none': 'You have not recorded any costs yet.',
  'ops.costs.no_units': 'There are no units you can record costs on.',
  'ops.costs.correction_note': 'A recorded cost cannot be edited or deleted.',
  'ops.costs.receipt': 'Receipt (optional)',
  'ops.costs.receipt_hint': 'PDF, JPEG, PNG or WebP, up to 4 MB.',
  'ops.costs.receipt_attach': 'Attach receipt',
  'ops.costs.receipt_view': 'View receipt',
  'ops.costs.receipt_uploading': 'Uploading receipt…',
  'ops.costs.receipt_saved': 'Receipt attached.',
  'ops.costs.receipt_retry': 'Retry upload',
  'ops.costs.receipt_pending': 'The cost is recorded, but its receipt did not upload.',
  'ops.costs.receipt_error.unsupported_type': 'Only PDF, JPEG, PNG and WebP files are accepted.',
  'ops.costs.receipt_error.too_large': 'The file is larger than 4 MB.',
  'ops.costs.receipt_error.empty': 'The file is empty.',
  'ops.costs.receipt_error.generic': 'Could not upload the receipt. Try again.',
  'ops.costs.receipt_error.locked': 'This cost is on an issued owner report.',
  'ops.costs.impact.no_statement': 'Recorded. It will be counted when the owner report for this period is prepared.',
  'ops.costs.impact.draft_stale': 'Recorded. The draft report for {start} – {end} does not include it yet.',
  'ops.costs.impact.issued': 'Recorded. The report for {start} – {end} is already issued and does not include this cost. It will be carried into the next owner report prepared for this unit.',
  'ops.costs.replayed': 'This cost was already recorded; nothing was added twice.',
  'ops.costs.error.conflict': 'This attempt was already used for a different cost.',
  'ops.costs.error.network': 'No connection. Your entry is kept.',
  'ops.costs.error.forbidden': 'You are not allowed to record costs on this unit.',
  'ops.costs.error.invalid_amount': 'Enter an amount greater than zero.',
  'catalog.ledger_entry_types.cleaning_cost.label': 'Cleaning',
  'catalog.ledger_entry_types.maintenance_cost.label': 'Maintenance',
  'catalog.ledger_entry_types.consumables_cost.label': 'Consumables',
  'catalog.ledger_entry_types.utilities_cost.label': 'Utilities',
  'catalog.ledger_entry_types.adjustment.label': 'Adjustment',
};

const units = [
  { id: 'unit-a', name: 'Villa A', projectName: 'Project A' },
  { id: 'unit-b', name: 'Villa B', projectName: 'Project A' },
];

let counter = 0;
const fetchMock = vi.fn();

beforeEach(() => {
  counter = 0;
  vi.stubGlobal('crypto', {
    ...globalThis.crypto,
    randomUUID: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  });
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T05:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ok = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

const saved = (over: Record<string, unknown> = {}) => ({
  id: 'entry-1', entryType: 'cleaning_cost', amountThb: 125050, unitId: 'unit-a', occurredOn: '2026-10-10',
  description: 'Deep clean', createdAt: '2026-10-10T05:00:00Z', replayed: false,
  reportImpact: { state: 'no_statement_yet', period: null, statementId: null }, ...over,
});

function fill(user: ReturnType<typeof userEvent.setup>) {
  return async (amount = '1250.50', description = 'Deep clean') => {
    await user.type(screen.getByLabelText('Amount (฿)'), amount);
    await user.type(screen.getByLabelText('What it was for'), description);
  };
}

const lastCall = (n = 0) => fetchMock.mock.calls[fetchMock.mock.calls.length - 1 - n];

const setup = (props: Partial<React.ComponentProps<typeof RecordCostClient>> = {}) => {
  const user = userEvent.setup({ advanceTimers: () => undefined });
  render(<RecordCostClient units={units} recent={[]} labels={labels} {...props} />);
  return { user, type: fill(user) };
};

describe('parseBahtToSatang', () => {
  it.each([
    ['1250.50', 125050],
    ['1250,5', 125050],
    ['0.07', 7],
    ['10', 1000],
    [' 5.00 ', 500],
  ])('reads %s as %i satang without float arithmetic', (input, satang) => {
    expect(parseBahtToSatang(input)).toBe(satang);
  });

  it.each(['', '0', '0.00', '-5', '1e3', '1.234', 'abc', '1 000', '123456789'])('rejects %j', (input) => {
    expect(parseBahtToSatang(input)).toBeNull();
  });
});

describe('RecordCostClient', () => {
  it('offers the four cost types and never an adjustment', () => {
    setup();
    const options = Array.from(screen.getByLabelText('Type').querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['Cleaning', 'Maintenance', 'Consumables', 'Utilities']);
  });

  it('shows an empty state instead of a form when there is no unit to record on', () => {
    setup({ units: [] });
    expect(screen.getByText('There are no units you can record costs on.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record cost' })).toBeNull();
  });

  it('sends the amount in satang, the business date, and an Idempotency-Key', async () => {
    fetchMock.mockReturnValueOnce(ok(201, saved()));
    const { user, type } = setup();
    await type();
    await user.click(screen.getByRole('button', { name: 'Record cost' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = lastCall();
    expect(url).toBe('/api/ledger/record-cost');
    expect(init.headers['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000001');
    expect(JSON.parse(init.body)).toEqual({
      unitId: 'unit-a', entryType: 'cleaning_cost', amountThb: 125050, occurredOn: '2026-10-10', description: 'Deep clean',
    });
  });

  it('says nothing is saved until the server answers, then reports only what the server said', async () => {
    let answer!: (v: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const { user, type } = setup();
    await type();
    await user.click(screen.getByRole('button', { name: 'Record cost' }));

    expect(screen.getByRole('button', { name: /Recording/ })).toBeDisabled();
    expect(screen.queryByText(/Recorded\./)).toBeNull();
    expect(screen.queryByText('Deep clean', { selector: 'td' })).toBeNull();

    answer(await ok(201, saved()));
    expect(await screen.findByRole('status')).toHaveTextContent('It will be counted when the owner report for this period is prepared.');
    expect(screen.getByText('Deep clean', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (฿)')).toHaveValue('');
  });

  it.each([
    ['a draft report that cannot include it yet', { state: 'draft_regeneration_required', period: { start: '2026-10-01', end: '2026-10-31' }, statementId: 's' }, 'does not include it yet', 'will be counted'],
    ['an already issued report', { state: 'period_already_issued', period: { start: '2026-10-01', end: '2026-10-31' }, statementId: 's' }, 'carried into the next owner report', 'will be counted when'],
  ])('does not promise inclusion for %s', async (_what, reportImpact, shown, notShown) => {
    fetchMock.mockReturnValueOnce(ok(201, saved({ reportImpact })));
    const { user, type } = setup();
    await type();
    await user.click(screen.getByRole('button', { name: 'Record cost' }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(shown);
    expect(status).toHaveTextContent('2026-10-01 – 2026-10-31');
    expect(status.textContent).not.toContain(notShown);
  });

  it('recognises a replay and does not list the cost twice', async () => {
    fetchMock.mockReturnValueOnce(ok(201, saved())).mockReturnValueOnce(ok(200, saved({ replayed: true })));
    const { user, type } = setup();
    await type();
    await user.click(screen.getByRole('button', { name: 'Record cost' }));
    await screen.findByRole('status');
    await type();
    await user.click(screen.getByRole('button', { name: 'Record cost' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('nothing was added twice'));
    expect(screen.getAllByText('Deep clean', { selector: 'td' })).toHaveLength(1);
  });

  it('keeps every field and the SAME key when the connection drops, so the retry is the same attempt', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('network'))).mockReturnValueOnce(ok(201, saved()));
    const { user, type } = setup();
    await type();
    await user.click(screen.getByRole('button', { name: 'Record cost' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No connection. Your entry is kept.');
    expect(screen.getByLabelText('Amount (฿)')).toHaveValue('1250.50');
    expect(screen.getByLabelText('What it was for')).toHaveValue('Deep clean');

    await user.click(screen.getByRole('button', { name: 'Record cost' }));
    await screen.findByRole('status');
    const keys = fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key']);
    expect(keys[0]).toBe(keys[1]);
  });

  it('keeps the key after a validation or permission failure that wrote nothing, and keeps the fields', async () => {
    fetchMock.mockReturnValueOnce(ok(403, { error: 'Forbidden', code: 'forbidden' }));
    const { user, type } = setup();
    await type();
    await user.click(screen.getByRole('button', { name: 'Record cost' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You are not allowed to record costs on this unit.');
    expect(screen.getByLabelText('What it was for')).toHaveValue('Deep clean');
  });

  it('starts a new attempt after the server says the key was used for different content', async () => {
    fetchMock
      .mockReturnValueOnce(ok(409, { error: 'x', code: 'idempotency_conflict' }))
      .mockReturnValueOnce(ok(201, saved()));
    const { user, type } = setup();
    await type();
    await user.click(screen.getByRole('button', { name: 'Record cost' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already used for a different cost');
    await user.click(screen.getByRole('button', { name: 'Record cost' }));
    await screen.findByRole('status');
    const keys = fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key']);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('refuses a bad amount before any request', async () => {
    const { user, type } = setup();
    await type('12.345');
    await user.click(screen.getByRole('button', { name: 'Record cost' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter an amount greater than zero.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits from the keyboard (Enter in a field)', async () => {
    fetchMock.mockReturnValueOnce(ok(201, saved()));
    const { user, type } = setup();
    await type('500', 'Quick job');
    await user.type(screen.getByLabelText('What it was for'), '{Enter}');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('does not send a second request while one is in flight', async () => {
    fetchMock.mockReturnValueOnce(new Promise(() => undefined));
    const { user, type } = setup();
    await type();
    await user.click(screen.getByRole('button', { name: 'Record cost' }));
    fireEvent.submit(screen.getByLabelText('What it was for').closest('form')!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe('receipts', () => {
    const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'r.pdf', { type: 'application/pdf' });

    it('uploads the chosen file after the cost exists, under its own key, and then links it', async () => {
      fetchMock
        .mockReturnValueOnce(ok(201, saved()))
        .mockReturnValueOnce(ok(201, { receipt: { id: 'receipt-1' }, replayed: false }));
      const { user, type } = setup();
      await type();
      await user.upload(screen.getByLabelText('Receipt (optional)'), pdf());
      await user.click(screen.getByRole('button', { name: 'Record cost' }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      const [url, init] = lastCall();
      expect(url).toBe('/api/ledger/receipts');
      expect(init.body.get('ledgerEntryId')).toBe('entry-1');
      expect(init.body.get('file').name).toBe('r.pdf');
      expect(init.headers['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000002');
      expect(await screen.findByRole('link', { name: 'View receipt' })).toHaveAttribute('href', '/api/ledger/receipts/receipt-1');
    });

    it('keeps the file and retries the upload with the same key when it fails — without a second cost', async () => {
      fetchMock
        .mockReturnValueOnce(ok(201, saved()))
        .mockImplementationOnce(() => Promise.reject(new TypeError('offline')))
        .mockReturnValueOnce(ok(201, { receipt: { id: 'receipt-1' }, replayed: false }));
      const { user, type } = setup();
      await type();
      await user.upload(screen.getByLabelText('Receipt (optional)'), pdf());
      await user.click(screen.getByRole('button', { name: 'Record cost' }));

      expect(await screen.findByText('The cost is recorded, but its receipt did not upload.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Retry upload' }));
      expect(await screen.findByRole('link', { name: 'View receipt' })).toBeInTheDocument();

      const calls = fetchMock.mock.calls;
      expect(calls.filter(([url]) => url === '/api/ledger/record-cost')).toHaveLength(1);
      const uploadKeys = calls.filter(([url]) => url === '/api/ledger/receipts').map(([, init]) => init.headers['Idempotency-Key']);
      expect(uploadKeys).toHaveLength(2);
      expect(uploadKeys[0]).toBe(uploadKeys[1]);
    });

    it.each([
      ['an unsupported type', new File(['<svg/>'], 'r.svg', { type: 'image/svg+xml' }), 'Only PDF, JPEG, PNG and WebP files are accepted.'],
      ['an empty file', new File([], 'r.png', { type: 'image/png' }), 'The file is empty.'],
    ])('stops %s before anything is recorded', async (_what, file, message) => {
      const { user, type } = setup();
      await type();
      // The input filters by `accept`; bypass it the way a drag-and-drop would.
      fireEvent.change(screen.getByLabelText('Receipt (optional)'), { target: { files: [file] } });
      await user.click(screen.getByRole('button', { name: 'Record cost' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('lets a recorded cost without a receipt get one later, from its row', async () => {
      fetchMock.mockReturnValueOnce(ok(201, { receipt: { id: 'receipt-9' }, replayed: false }));
      setup({
        recent: [{ id: 'old-1', entryType: 'utilities_cost', amountThb: 50000, occurredOn: '2026-10-01', description: 'Power', unitName: 'Villa A', receiptId: null }],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Attach receipt' }));
      fireEvent.change(screen.getByTestId('row-receipt-input'), { target: { files: [pdf()] } });
      await waitFor(() => expect(screen.getByRole('link', { name: 'View receipt' })).toHaveAttribute('href', '/api/ledger/receipts/receipt-9'));
      expect(lastCall()[1].body.get('ledgerEntryId')).toBe('old-1');
    });

    it('shows the existing receipt as a link and a cost without one as attachable', () => {
      setup({
        recent: [
          { id: 'a', entryType: 'cleaning_cost', amountThb: 100, occurredOn: '2026-10-01', description: 'Has one', unitName: 'Villa A', receiptId: 'r-a' },
          { id: 'b', entryType: 'cleaning_cost', amountThb: 100, occurredOn: '2026-10-01', description: 'Has none', unitName: 'Villa A', receiptId: null },
        ],
      });
      expect(screen.getAllByRole('link', { name: 'View receipt' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Attach receipt' })).toHaveLength(1);
    });
  });

  it('shows stored (negative) amounts as a magnitude', () => {
    setup({ recent: [{ id: 'x', entryType: 'cleaning_cost', amountThb: 125050, occurredOn: '2026-10-01', description: 'Shown', unitName: 'Villa A' }] });
    expect(screen.getByText(/฿1,?250/)).toBeInTheDocument();
  });
});
