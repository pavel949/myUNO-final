'use client';

import React, { useState } from 'react';
import { Button } from '@/components';

interface ServiceOrderRatingModalProps {
  orderId: string;
  onClose: () => void;
  onSuccess?: () => void;
  labels?: Record<string, string>;
}

export const ServiceOrderRatingModal: React.FC<ServiceOrderRatingModalProps> = ({
  orderId,
  onClose,
  onSuccess,
  labels = {},
}) => {
  // Default labels for service order rating modal
  const text = {
    title: labels['services.rating.title'] ?? 'Rate this service',
    question: labels['services.rating.question'] ?? 'How would you rate this service?',
    commentLabel: labels['services.rating.comment_label'] ?? 'Tell us more (optional)',
    commentPlaceholder: labels['services.rating.comment_placeholder'] ?? 'Share your feedback...',
    errorSelectRating: labels['services.rating.error_select'] ?? 'Please select a rating',
    errorSubmit: labels['services.rating.error_submit'] ?? 'Failed to submit rating',
    errorGeneric: labels['services.rating.error_generic'] ?? 'An error occurred',
    buttonCancel: labels['services.rating.button_cancel'] ?? 'Cancel',
    buttonSubmit: labels['services.rating.button_submit'] ?? 'Submit Rating',
    buttonSubmitting: labels['services.rating.button_submitting'] ?? 'Submitting...',
  };
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rating === 0) {
      setError(text.errorSelectRating);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/service-orders/${orderId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data?.error || text.errorSubmit);
        return;
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : text.errorGeneric);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-16 z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface-paper rounded-lg shadow-lg max-w-md w-full p-32"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
          {text.title}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-20">
          {/* Star rating */}
          <div>
            <label className="block text-small font-medium text-text-ink mb-12">
              {text.question}
            </label>
            <div className="flex gap-8 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-32 transition ${
                    star <= rating ? 'text-brand-sun' : 'text-text-secondary'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-small font-medium text-text-ink mb-8">
              {text.commentLabel}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={text.commentPlaceholder}
              className="w-full p-12 border border-border-line rounded-md text-body resize-none focus:outline-none focus:ring-2 focus:ring-brand-sun focus:border-transparent"
              rows={4}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-12 bg-red-50 border border-red-200 rounded-md">
              <p className="text-small text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-12 pt-12">
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
              {text.buttonCancel}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || rating === 0}
              className="flex-1"
            >
              {isLoading ? text.buttonSubmitting : text.buttonSubmit}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
