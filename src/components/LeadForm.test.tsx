import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LeadForm, type LeadFormLabels } from './LeadForm';

const labels: LeadFormLabels = {
  title: 'Ask us',
  name: 'Your name',
  contact: 'Contact',
  contactHint: 'Email or phone',
  message: 'Message',
  consent: 'I agree',
  submit: 'Send',
  submitting: 'Sending',
  success: 'Received',
  error: 'Failed',
  consentRequired: 'Consent required',
  viewConversation: 'View conversation',
  contactFollowup: 'We will reply using your contact details.',
  selectedHome: 'Your enquiry',
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('project long-stay lead handoff', () => {
  it('sends the scoped rental intent through the canonical lead endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<LeadForm
      audience="renters"
      labels={labels}
      initialMessage="Long stays · Example Residence"
      projectId="project-1"
      sourceMedium="project_long_stay"
    />);

    fireEvent.change(screen.getByRole('textbox', { name: /Your name/ }), {
      target: { value: 'Guest Example' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Contact/ }), {
      target: { value: 'guest@example.com' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      audience: 'renters',
      projectId: 'project-1',
      sourceMedium: 'project_long_stay',
      message: 'Long stays · Example Residence',
      consent: true,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Received');
  });
});

function fillInquiry() {
  fireEvent.change(screen.getByRole('textbox', { name: /Your name/ }), { target: { value: 'Guest Example' } });
  fireEvent.change(screen.getByRole('textbox', { name: /Contact/ }), { target: { value: 'guest@example.test' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'I agree' }));
}

describe('public inquiry completion states', () => {
  it('shows the real selected villa and sends structured context, then opens only the returned authorized conversation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, threadId: 'thread-fixture' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<LeadForm audience="renters" labels={labels} projectId="project-fixture" unitId="unit-fixture" contextLabel="Villa One · Residence One" initialMessage="Can we arrive late?" />);
    expect(screen.getByText('Villa One · Residence One')).toBeInTheDocument();
    expect(screen.queryByText('unit-fixture')).not.toBeInTheDocument();
    fillInquiry();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('link', { name: 'View conversation' })).toHaveAttribute('href', '/messages/thread-fixture');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ projectId: 'project-fixture', unitId: 'unit-fixture', message: 'Can we arrive late?' });
    expect(screen.queryByText(labels.contactFollowup!)).not.toBeInTheDocument();
  });

  it('labels anonymous follow-up honestly and offers no private conversation link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    render(<LeadForm audience="renters" labels={labels} />);
    fillInquiry();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('status')).toHaveTextContent(labels.contactFollowup!);
    expect(screen.queryByRole('link', { name: 'View conversation' })).not.toBeInTheDocument();
  });

  it('preserves authored fields after a rejected response and never shows false success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<LeadForm audience="renters" labels={labels} initialMessage="My specific question" />);
    fillInquiry();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('My specific question');
    expect(screen.getByRole('textbox', { name: /Contact/ })).toHaveValue('guest@example.test');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not submit without consent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<LeadForm audience="renters" labels={labels} />);
    fireEvent.submit(screen.getByRole('button', { name: 'Send' }).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Consent required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends only once while an earlier submission is pending', async () => {
    let resolve!: (value: unknown) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetchMock);
    render(<LeadForm audience="renters" labels={labels} />);
    fillInquiry();
    const form = screen.getByRole('button', { name: 'Send' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Sending' })).toBeDisabled();
    resolve({ ok: true, json: async () => ({ ok: true }) });
    expect(await screen.findByRole('status')).toHaveTextContent('Received');
  });
});


describe('inquiry acknowledgement retries', () => {
  it('reuses the request ID after a lost response and preserves the question', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, threadId: 'recovered-thread' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<LeadForm audience="renters" labels={labels} initialMessage="Late arrival?" initialName="Known Guest" initialContact="known@example.test" />);
    expect(screen.getByRole('textbox', { name: /Your name/ })).toHaveValue('Known Guest');
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('link', { name: 'View conversation' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).requestId).toBe(JSON.parse(fetchMock.mock.calls[1][1].body).requestId);
  });
});
