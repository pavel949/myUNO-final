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
};

afterEach(() => vi.unstubAllGlobals());

describe('project long-stay lead handoff', () => {
  it('sends the scoped rental intent through the canonical lead endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
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
