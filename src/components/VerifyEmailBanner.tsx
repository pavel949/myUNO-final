'use client';

import React, { useState } from 'react';

interface VerifyEmailBannerProps {
  email: string;
  onResend?: () => Promise<void>;
  labels?: Record<string, string>;
}

export const VerifyEmailBanner: React.FC<VerifyEmailBannerProps> = ({
  email,
  onResend,
  labels = {},
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleResend = async () => {
    if (!onResend) return;

    setIsLoading(true);
    try {
      await onResend();
      setMessage(labels['ui.verify_email.success_message'] || 'Verification email sent. Check your inbox.');
    } catch (error) {
      setMessage(labels['ui.verify_email.error_message'] || 'Failed to resend email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-state-info-soft border-l-4 border-state-info px-16 py-12 flex items-center justify-between">
      <div className="flex-1">
        <p className="text-body text-state-info font-medium">
          {labels['ui.verify_email.title'] || 'Verify your email to complete your account'}
        </p>
        <p className="text-small text-state-info mt-4">
          {labels['ui.verify_email.sent_to_intro'] || 'We sent a link to'} <span className="font-medium">{email}</span>
        </p>
        {message && <p className="text-small text-state-info mt-4">{message}</p>}
      </div>
      <button
        onClick={handleResend}
        disabled={isLoading}
        className="ml-16 px-24 py-8 bg-state-info text-white rounded-md text-subtitle font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {isLoading ? (labels['ui.verify_email.sending_button'] || 'Sending...') : (labels['ui.verify_email.resend_button'] || 'Resend')}
      </button>
    </div>
  );
};
