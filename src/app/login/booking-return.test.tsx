import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';
import { RegisterForm } from '@/app/register/register-form';

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, useSearchParams: () => navigation.params }));
vi.mock('./google-login-button', () => ({ GoogleLoginButton: () => null }));
const loginLabels = { email: 'Email', password: 'Password', submit: 'Sign in', errorGeneric: 'Error',
  errorInvalidCredentials: 'Invalid', errorRateLimited: 'Wait', noAccount: 'New here', registerLink: 'Register',
  forgotPassword: 'Forgot', googleButton: 'Google', divider: 'Or' };
const registerLabels = { firstName: 'First name', lastName: 'Last name', email: 'Email', password: 'Password',
  passwordHelp: 'Help', submit: 'Create account', errorGeneric: 'Error', haveAccount: 'Already registered', loginLink: 'Sign in' };

describe('booking authentication continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.params = new URLSearchParams();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });
  it('preserves the safe review URL in the registration link and returns to it after registration', async () => {
    const next = '/book/review?unitId=unit-a&startDate=2027-03-01&bookingIntent=123';
    navigation.params.set('next', next);
    const login = render(<LoginForm labels={loginLabels} />);
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', `/register?next=${encodeURIComponent(next)}`);
    login.unmount();
    render(<RegisterForm labels={registerLabels} />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', `/login?next=${encodeURIComponent(next)}`);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Synthetic' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Guest' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'guest@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Synthetic-Only-1234' } });
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(next));
  });
  it.each(['//evil.example', 'https://evil.example', '/\\evil.example'])('does not carry or follow an unsafe return %s', async next => {
    navigation.params.set('next', next);
    const login = render(<LoginForm labels={loginLabels} />);
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/'));
    login.unmount();
    navigation.push.mockClear();
    render(<RegisterForm labels={registerLabels} />);
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/'));
  });
});
