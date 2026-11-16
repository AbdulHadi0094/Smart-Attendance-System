import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg border border-[#DDE6EE] bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-[#DDE6EE] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className={`h-5 w-5 ${danger ? 'text-red-600' : 'text-amber-600'}`} />
            <h3 className="text-base font-semibold text-[#0F1E36]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded p-1 text-[#5B6B80] hover:bg-slate-100 hover:text-[#0F1E36]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[#5B6B80] leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2.5 border-t border-[#DDE6EE] bg-[#F8FAFC] px-5 py-3 rounded-b-lg">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-[#DDE6EE] bg-white px-4 py-2 text-xs font-medium text-[#0F1E36] hover:bg-slate-50 whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-md px-4 py-2 text-xs font-semibold text-white whitespace-nowrap transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                : 'bg-[#0F1E36] hover:bg-slate-800 disabled:bg-slate-400'
            }`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
