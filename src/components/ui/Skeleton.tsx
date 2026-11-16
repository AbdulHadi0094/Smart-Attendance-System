import React from 'react';

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-[#DDE6EE] bg-white">
      <div className="border-b border-[#DDE6EE] bg-[#F8FAFC] px-4 py-3">
        <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="divide-y divide-[#EEF3F7]">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="grid gap-4 px-4 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((__, cIdx) => (
              <div key={cIdx} className="h-3.5 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="rounded-lg border border-[#DDE6EE] bg-white p-4">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-7 w-16 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-2.5 w-32 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
