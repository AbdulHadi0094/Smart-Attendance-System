import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary';
}

export function StatCard({ label, value, subtext, icon: Icon, tone = 'default' }: StatCardProps) {
  const toneValueClass = {
    default: 'text-[#0F1E36]',
    primary: 'text-[#0284C7]',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-red-700',
  }[tone];

  return (
    <div className="rounded-lg border border-[#DDE6EE] bg-white px-4 py-3.5 transition-colors hover:border-[#BFD3E2]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#5B6B80] truncate">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-[#5B6B80] shrink-0" />}
      </div>
      <div className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${toneValueClass}`}>
        {value}
      </div>
      {subtext && <p className="mt-1 text-xs text-[#5B6B80] truncate">{subtext}</p>}
    </div>
  );
}
