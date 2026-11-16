import React from 'react';
import { AlertTriangle, ArrowRightLeft, Edit2 } from 'lucide-react';
import { LUNCH_BREAK, PERIOD_TIMINGS, WORKING_DAYS } from '../../constants/timetable';
import { BatchType, DayOfWeek, Substitution, TimetableEntry } from '../../types/erp';

interface TimetableGridProps {
  entries: TimetableEntry[];
  substitutions?: Substitution[];
  selectedDate?: string;
  studentBatch?: BatchType;
  canEditMaster?: boolean;
  canSubstitute?: boolean;
  onEditEntry?: (entry: TimetableEntry) => void;
  onSubstituteEntry?: (entry: TimetableEntry) => void;
}

export function TimetableGrid({
  entries,
  substitutions = [],
  selectedDate,
  studentBatch,
  canEditMaster = false,
  canSubstitute = false,
  onEditEntry,
  onSubstituteEntry,
}: TimetableGridProps) {
  // Build quick lookup per day + period
  const getCellForDayPeriod = (day: DayOfWeek, period: number) => {
    const starting = entries.find(
      (e) => e.status === 'active' && e.dayOfWeek === day && e.periodNumber === period
    );
    if (starting) return { type: 'start' as const, entry: starting };

    const covered = entries.find(
      (e) =>
        e.status === 'active' &&
        e.dayOfWeek === day &&
        period > e.periodNumber &&
        period <= e.endPeriodNumber
    );
    if (covered) return { type: 'covered' as const, entry: covered };

    return { type: 'empty' as const };
  };

  const getActiveSubstitutions = (entry: TimetableEntry) => {
    if (!selectedDate) return [];
    const targetDayName = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
    }).format(new Date(`${selectedDate}T09:30:00+05:30`));

    if (targetDayName !== entry.dayOfWeek) return [];
    return substitutions.filter(
      (s) =>
        s.status === 'active' &&
        s.date === selectedDate &&
        s.classId === entry.classId &&
        entry.periodNumber >= s.periodNumber &&
        entry.periodNumber <= s.endPeriodNumber
    );
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-[#DDE6EE] bg-white">
      <table className="w-full min-w-[960px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#0F1E36]">
            <th className="w-28 border-r border-[#DDE6EE] px-3 py-2.5 font-semibold">Day</th>
            {PERIOD_TIMINGS.slice(0, 4).map((p) => (
              <th key={p.period} className="border-r border-[#DDE6EE] px-2.5 py-2.5 text-center font-semibold">
                <div>{p.roman}</div>
                <div className="mt-0.5 text-[10px] font-normal text-[#5B6B80] font-mono-data">
                  {p.display}
                </div>
              </th>
            ))}
            <th className="w-14 border-r border-[#DDE6EE] bg-[#F1F5F9] px-1.5 py-2.5 text-center text-[10px] font-semibold text-[#5B6B80]">
              <div>LUNCH</div>
              <div className="mt-0.5 font-normal font-mono-data">1:15–2:00</div>
            </th>
            {PERIOD_TIMINGS.slice(4, 6).map((p) => (
              <th key={p.period} className="border-r last:border-r-0 border-[#DDE6EE] px-2.5 py-2.5 text-center font-semibold">
                <div>{p.roman}</div>
                <div className="mt-0.5 text-[10px] font-normal text-[#5B6B80] font-mono-data">
                  {p.display}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#DDE6EE]">
          {WORKING_DAYS.map((day, dayIdx) => (
            <tr key={day} className="hover:bg-[#FAFCFE]">
              <td className="border-r border-[#DDE6EE] bg-[#F8FAFC] px-3 py-3 font-semibold text-[#0F1E36]">
                {day}
              </td>

              {/* Periods 1..4 */}
              {[1, 2, 3, 4].map((p) => {
                const cell = getCellForDayPeriod(day, p);
                if (cell.type === 'covered') return null;
                if (cell.type === 'empty') {
                  return (
                    <td key={p} className="border-r border-[#DDE6EE] px-2.5 py-3 text-center text-[#94A3B8]">
                      —
                    </td>
                  );
                }
                const entry = cell.entry;
                const colSpan = Math.min(4, entry.endPeriodNumber) - entry.periodNumber + 1;
                const activeSubs = getActiveSubstitutions(entry);
                const visibleSlots =
                  studentBatch && studentBatch !== 'ALL'
                    ? entry.slots.filter((s) => s.batch === 'ALL' || s.batch === studentBatch)
                    : entry.slots;

                return (
                  <td
                    key={p}
                    colSpan={colSpan}
                    className="border-r border-[#DDE6EE] px-2.5 py-2.5 align-top"
                  >
                    <div className="space-y-1.5">
                      {(visibleSlots.length > 0 ? visibleSlots : entry.slots).map((slot, sIdx) => {
                        const sub = activeSubs.find(
                          (x) => x.batch === 'ALL' || x.batch === slot.batch
                        );
                        return (
                          <div
                            key={`${slot.batch}_${sIdx}`}
                            className={`rounded border px-2 py-1.5 ${
                              sub
                                ? 'border-amber-300 bg-amber-50/70'
                                : slot.needsConfirmation
                                ? 'border-amber-300 bg-amber-50/40'
                                : 'border-[#E6EEF5] bg-[#F8FAFC]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {slot.batch !== 'ALL' && (
                                    <span className="font-mono-data text-[10px] font-bold text-[#0284C7]">
                                      {slot.batch}
                                    </span>
                                  )}
                                  <span className="font-semibold text-[#0F1E36]">
                                    {sub ? sub.actualSubjectName : slot.subjectShortName}
                                  </span>
                                  {sub && (
                                    <span className="text-[10px] font-semibold text-amber-800">
                                      (Substituted)
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 text-[11px] text-[#5B6B80] truncate">
                                  {sub ? sub.actualFacultyName : slot.facultyName || 'Faculty TBD'}
                                </div>
                                <div className="text-[10px] text-[#5B6B80] font-mono-data">
                                  Room {sub ? sub.classroom : slot.classroom}
                                </div>
                              </div>
                            </div>
                            {slot.needsConfirmation && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-800">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span>Confirm batch mapping</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {(canEditMaster || canSubstitute) && (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {canSubstitute && onSubstituteEntry && (
                            <button
                              type="button"
                              onClick={() => onSubstituteEntry(entry)}
                              className="inline-flex items-center gap-1 rounded border border-[#DDE6EE] bg-white px-2 py-0.5 text-[10px] font-medium text-[#0F1E36] hover:border-[#03CAFC] hover:bg-[#ECFAFE]"
                            >
                              <ArrowRightLeft className="h-2.5 w-2.5" />
                              <span>Edit Class</span>
                            </button>
                          )}
                          {canEditMaster && onEditEntry && (
                            <button
                              type="button"
                              onClick={() => onEditEntry(entry)}
                              className="inline-flex items-center gap-1 rounded border border-[#DDE6EE] bg-white px-2 py-0.5 text-[10px] font-medium text-[#5B6B80] hover:text-[#0F1E36] hover:bg-[#F5F8FA]"
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                              <span>Master</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}

              {/* Lunch column spans all 6 days */}
              {dayIdx === 0 && (
                <td
                  rowSpan={WORKING_DAYS.length}
                  className="border-r border-[#DDE6EE] bg-[#F8FAFC] px-1 py-4 text-center align-middle"
                >
                  <div className="[writing-mode:vertical-rl] rotate-180 mx-auto text-[11px] font-semibold tracking-widest text-[#5B6B80]">
                    {LUNCH_BREAK.label} · {LUNCH_BREAK.display}
                  </div>
                </td>
              )}

              {/* Periods 5..6 */}
              {[5, 6].map((p) => {
                const cell = getCellForDayPeriod(day, p);
                if (cell.type === 'covered') return null;
                if (cell.type === 'empty') {
                  return (
                    <td key={p} className="border-r last:border-r-0 border-[#DDE6EE] px-2.5 py-3 text-center text-[#94A3B8]">
                      —
                    </td>
                  );
                }
                const entry = cell.entry;
                const colSpan = entry.endPeriodNumber - entry.periodNumber + 1;
                const activeSubs = getActiveSubstitutions(entry);
                const visibleSlots =
                  studentBatch && studentBatch !== 'ALL'
                    ? entry.slots.filter((s) => s.batch === 'ALL' || s.batch === studentBatch)
                    : entry.slots;

                return (
                  <td
                    key={p}
                    colSpan={colSpan}
                    className="border-r last:border-r-0 border-[#DDE6EE] px-2.5 py-2.5 align-top"
                  >
                    <div className="space-y-1.5">
                      {(visibleSlots.length > 0 ? visibleSlots : entry.slots).map((slot, sIdx) => {
                        const sub = activeSubs.find(
                          (x) => x.batch === 'ALL' || x.batch === slot.batch
                        );
                        return (
                          <div
                            key={`${slot.batch}_${sIdx}`}
                            className={`rounded border px-2 py-1.5 ${
                              sub
                                ? 'border-amber-300 bg-amber-50/70'
                                : 'border-[#E6EEF5] bg-[#F8FAFC]'
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              {slot.batch !== 'ALL' && (
                                <span className="font-mono-data text-[10px] font-bold text-[#0284C7]">
                                  {slot.batch}
                                </span>
                              )}
                              <span className="font-semibold text-[#0F1E36]">
                                {sub ? sub.actualSubjectName : slot.subjectShortName}
                              </span>
                              {sub && (
                                <span className="text-[10px] font-semibold text-amber-800">
                                  (Substituted)
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#5B6B80] truncate">
                              {sub ? sub.actualFacultyName : slot.facultyName || 'Faculty TBD'}
                            </div>
                            <div className="text-[10px] text-[#5B6B80] font-mono-data">
                              Room {sub ? sub.classroom : slot.classroom}
                            </div>
                          </div>
                        );
                      })}
                      {(canEditMaster || canSubstitute) && (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {canSubstitute && onSubstituteEntry && (
                            <button
                              type="button"
                              onClick={() => onSubstituteEntry(entry)}
                              className="inline-flex items-center gap-1 rounded border border-[#DDE6EE] bg-white px-2 py-0.5 text-[10px] font-medium text-[#0F1E36] hover:border-[#03CAFC] hover:bg-[#ECFAFE]"
                            >
                              <ArrowRightLeft className="h-2.5 w-2.5" />
                              <span>Edit Class</span>
                            </button>
                          )}
                          {canEditMaster && onEditEntry && (
                            <button
                              type="button"
                              onClick={() => onEditEntry(entry)}
                              className="inline-flex items-center gap-1 rounded border border-[#DDE6EE] bg-white px-2 py-0.5 text-[10px] font-medium text-[#5B6B80] hover:text-[#0F1E36] hover:bg-[#F5F8FA]"
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                              <span>Master</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
