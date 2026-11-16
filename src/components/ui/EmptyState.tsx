import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-[#DDE6EE] bg-white px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#DDE6EE] bg-[#F5F8FA] text-[#5B6B80]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-[#0F1E36]">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-[#5B6B80] leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36] hover:bg-[#02B3E0] transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
