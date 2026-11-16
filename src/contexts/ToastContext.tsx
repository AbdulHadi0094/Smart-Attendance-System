import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (title: string, message?: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, message?: string, variant: ToastVariant = 'info') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, message, variant }]);
      window.setTimeout(() => {
        dismiss(id);
      }, 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          const iconMap = {
            success: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />,
            warning: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />,
            error: <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />,
            info: <Info className="h-4 w-4 text-[#0284C7] shrink-0 mt-0.5" />,
          };
          const borderMap = {
            success: 'border-emerald-200 bg-white',
            warning: 'border-amber-200 bg-white',
            error: 'border-red-200 bg-white',
            info: 'border-[#BBE9FA] bg-white',
          };
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-md transition-all ${borderMap[toast.variant]}`}
            >
              {iconMap[toast.variant]}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0F1E36]">{toast.title}</p>
                {toast.message && (
                  <p className="mt-0.5 text-xs text-[#5B6B80] leading-relaxed">{toast.message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-0.5 text-[#5B6B80] hover:bg-slate-100 hover:text-[#0F1E36]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
