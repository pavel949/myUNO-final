import { afterEach, describe, expect, it } from 'vitest';
import { FOUNDER_EMAIL, emailFrom, emailReplyTo } from './emailAddresses';

const originalFrom = process.env.EMAIL_FROM;
const originalReply = process.env.EMAIL_REPLY_TO;

afterEach(() => {
  if (originalFrom === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = originalFrom;
  if (originalReply === undefined) delete process.env.EMAIL_REPLY_TO;
  else process.env.EMAIL_REPLY_TO = originalReply;
});

describe('emailAddresses', () => {
  it('defaults From and Reply-To to the founder inbox', () => {
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_REPLY_TO;
    expect(emailFrom()).toBe(FOUNDER_EMAIL);
    expect(emailReplyTo()).toBe(FOUNDER_EMAIL);
    expect(FOUNDER_EMAIL).toBe('pavel@ignatevestate.com');
  });

  it('honours EMAIL_FROM and EMAIL_REPLY_TO when set', () => {
    process.env.EMAIL_FROM = 'onboarding@resend.dev';
    process.env.EMAIL_REPLY_TO = '  pavel@ignatevestate.com  ';
    expect(emailFrom()).toBe('onboarding@resend.dev');
    expect(emailReplyTo()).toBe('pavel@ignatevestate.com');
  });
});
