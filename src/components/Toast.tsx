'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'info' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface ToastContextType {
  toast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ type, title, message, action, duration = 4000 }: Omit<ToastMessage, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = { id, type, title, message, action, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <div
        className="fixed z-50 bottom-16 left-16 right-16 sm:left-auto sm:right-24 sm:bottom-24 flex flex-col gap-8 max-w-md pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg p-16 shadow-float border flex items-start gap-12 transition-all duration-structural ${
              t.type === 'success'
                ? 'bg-state-success-soft text-state-success border-state-success/20'
                : t.type === 'error'
                  ? 'bg-state-error-soft text-state-error border-state-error/20'
                  : 'bg-surface-paper text-text-ink border-border-line'
            }`}
          >
            <div className="flex-1 min-w-0">
              {t.title && <p className="font-display font-semibold text-subtitle mb-4">{t.title}</p>}
              <p className="text-body text-current">{t.message}</p>
            </div>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  removeToast(t.id);
                }}
                className="font-display font-medium text-small underline shrink-0 hover:opacity-80"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-text-stone hover:text-text-ink text-small font-bold shrink-0 ml-4"
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
