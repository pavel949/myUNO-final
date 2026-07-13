'use client';

import React, { useState } from 'react';

interface VerifyEmailBannerProps {
  email: string;
  onResend?: () => Promise<void>;
}

export const VerifyEmailBanner: React.FC<VerifyEmailBannerProps> = ({ email, onResend }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleResend = async () => {
    if (!onResend) return;

    setIsLoading(true);
    try {
      await onResend();
      setMessage('Verification email sent. Check your inbox.');
    } catch (error) {
      setMessage('Failed to resend email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-state-info-soft border-l-4 border-state-info px-16 py-12 flex items-center justify-between">
      <div className="flex-1">
        <p className="text-body text-state-info font-medium">
          Verify your email to complete your account
        </p>
        <p className="text-small text-state-info mt-4">
          We sent a link to <span className="font-medium">{email}</span>
        </p>
        {message && <p className="text-small text-state-info mt-4">{message}</p>}
      </div>
      <button
        onClick={handleResend}
        disabled={isLoading}
        className="ml-16 px-24 py-8 bg-state-info text-white rounded-md text-subtitle font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {isLoading ? 'Sending...' : 'Resend'}
      </button>
    </div>
  );
};
