import React from 'react';
import { DailyTrendPoint } from '../../services/reportService';
import { SubjectAttendanceSummary } from '../../types/erp';

export function DailyAttendanceTrendChart({ data }: { data: DailyTrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-[#DDE6EE] bg-[#F8FAFC] text-xs text-[#5B6B80]">
        No recorded attendance sessions yet to chart daily trends.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex h-44 items-end gap-2 border-b border-[#DDE6EE] pb-2 pt-4">
        {data.map((point) => {
          const heightPct = Math.max(4, Math.min(100, point.percentage));
          const barColor =
            point.percentage >= 75
              ? 'bg-[#03CAFC]'
              : point.percentage >= 60
              ? 'bg-amber-500'
              : 'bg-red-500';
          return (
            <div key={point.date} className="group flex flex-1 flex-col items-center justify-end h-full min-w-0">
              <span className="mb-1 text-[10px] font-medium text-[#5B6B80] tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                {point.percentage}%
              </span>
              <div className="flex w-full max-w-[34px] flex-col justify-end rounded-t bg-[#F1F5F9] h-32 overflow-hidden">
                <div
                  className={`w-full rounded-t transition-all ${barColor}`}
                  style={{ height: `${heightPct}%` }}
                  title={`${point.date}: ${point.present}/${point.total} (${point.percentage}%)`}
                />
              </div>
              <span className="mt-1.5 w-full truncate text-center text-[10px] text-[#5B6B80] font-mono-data">
                {point.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-[#5B6B80]">
        <span>Showing last {data.length} recorded days</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#03CAFC]" />
            <span>≥ 75%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />
            <span>60–74%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
            <span>&lt; 60%</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function SubjectDistributionBars({
  summaries,
  threshold = 75,
}: {
  summaries: SubjectAttendanceSummary[];
  threshold?: number;
}) {
  if (summaries.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-md border border-dashed border-[#DDE6EE] bg-[#F8FAFC] text-xs text-[#5B6B80]">
        No subject attendance records available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {summaries.map((item) => {
        const isLow = item.total > 0 && item.percentage < threshold;
        const barColor =
          item.total === 0
            ? 'bg-slate-200'
            : isLow
            ? 'bg-red-500'
            : 'bg-[#03CAFC]';
        return (
          <div key={item.subjectId} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-[#0F1E36] truncate" title={item.subjectName}>
                {item.subjectShortName} · <span className="text-[#5B6B80] font-normal">{item.subjectName}</span>
              </span>
              <span
                className={`shrink-0 font-mono-data font-semibold ${
                  isLow ? 'text-red-700' : 'text-[#0F1E36]'
                }`}
              >
                {item.total > 0 ? `${item.percentage}%` : '—'} ({item.present + item.late}/{item.total})
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-sm bg-[#EEF3F7]">
              <div
                className={`h-full transition-all ${barColor}`}
                style={{ width: `${item.total > 0 ? Math.min(100, item.percentage) : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
