import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { TimetableGrid } from '../../components/ui/TimetableGrid';
import { useToast } from '../../contexts/ToastContext';
import { getISTParts, PERIOD_TIMINGS, WORKING_DAYS } from '../../constants/timetable';
import {
  correctAttendanceStatus,
  markManualAttendanceBatch,
} from '../../services/attendanceService';
import {
  cancelSubstitution,
  createSubstitution,
} from '../../services/substitutionService';
import {
  deleteTimetableEntry,
  saveTimetableEntry,
} from '../../services/timetableService';
import {
  AcademicClass,
  AttendanceRecord,
  AttendanceStatus,
  BatchType,
  DayOfWeek,
  Faculty,
  Student,
  Subject,
  Substitution,
  TimetableEntry,
  TimetableSlot,
} from '../../types/erp';

interface TimetableAttendanceProps {
  actor: { uid: string; name: string; email: string };
  classes: AcademicClass[];
  subjects: Subject[];
  facultyList: Faculty[];
  students: Student[];
  timetable: TimetableEntry[];
  substitutions: Substitution[];
  attendance: AttendanceRecord[];
  onRefresh: () => Promise<void>;
}

export function AdminTimetableTab({
  actor,
  classes,
  subjects,
  facultyList,
  timetable,
  substitutions,
  onRefresh,
}: TimetableAttendanceProps) {
  const { showToast } = useToast();
  const istNow = useMemo(() => getISTParts(new Date()), []);
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState(istNow.dateStr);

  // Master timetable edit modal
  const [editingEntry, setEditingEntry] = useState<Partial<TimetableEntry> | null>(null);
  const [savingMaster, setSavingMaster] = useState(false);

  // Temporary substitution modal
  const [subEntry, setSubEntry] = useState<TimetableEntry | null>(null);
  const [subBatch, setSubBatch] = useState<BatchType>('ALL');
  const [subActualSubId, setSubActualSubId] = useState('');
  const [subActualFacId, setSubActualFacId] = useState('');
  const [subRoom, setSubRoom] = useState('LH-E-303');
  const [subReason, setSubReason] = useState('');
  const [savingSub, setSavingSub] = useState(false);

  const activeClassId = selectedClassId || classes[0]?.id || '';
  const classTimetable = useMemo(
    () => timetable.filter((t) => t.classId === activeClassId),
    [activeClassId, timetable]
  );
  const classSubjects = useMemo(
    () => subjects.filter((s) => s.classId === activeClassId),
    [activeClassId, subjects]
  );
  const flaggedBlocks = useMemo(
    () => classTimetable.filter((t) => t.slots.some((s) => s.needsConfirmation)),
    [classTimetable]
  );

  const openNewMaster = () => {
    const defSub = classSubjects[0] || subjects[0];
    setEditingEntry({
      classId: activeClassId,
      dayOfWeek: 'Monday',
      periodNumber: 1,
      endPeriodNumber: 1,
      startTime: PERIOD_TIMINGS[0].startTime,
      endTime: PERIOD_TIMINGS[0].endTime,
      slots: [
        {
          batch: 'ALL',
          subjectId: defSub?.id || '',
          subjectShortName: defSub?.shortName || '',
          subjectName: defSub?.name || '',
          facultyId: defSub?.facultyIds[0] || '',
          facultyName: defSub?.facultyNames[0] || '',
          classroom: 'LH-E-303',
          needsConfirmation: false,
        },
      ],
      status: 'active',
    });
  };

  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !editingEntry.classId || !editingEntry.slots?.length) return;
    setSavingMaster(true);
    try {
      const pStart = PERIOD_TIMINGS.find((p) => p.period === Number(editingEntry.periodNumber));
      const pEnd = PERIOD_TIMINGS.find((p) => p.period === Number(editingEntry.endPeriodNumber));
      await saveTimetableEntry(
        {
          id: editingEntry.id,
          classId: editingEntry.classId,
          dayOfWeek: (editingEntry.dayOfWeek || 'Monday') as DayOfWeek,
          periodNumber: Number(editingEntry.periodNumber || 1),
          endPeriodNumber: Number(editingEntry.endPeriodNumber || editingEntry.periodNumber || 1),
          startTime: pStart?.startTime || editingEntry.startTime || '09:15',
          endTime: pEnd?.endTime || editingEntry.endTime || '10:15',
          isMerged: Number(editingEntry.endPeriodNumber) > Number(editingEntry.periodNumber),
          isBatchSplit: editingEntry.slots.length > 1 || editingEntry.slots.some((s) => s.batch !== 'ALL'),
          slots: editingEntry.slots,
          status: 'active',
        },
        actor
      );
      showToast('Master Timetable Updated', 'Saved period schedule to Firestore.', 'success');
      setEditingEntry(null);
      await onRefresh();
    } catch (err) {
      showToast('Save Failed', err instanceof Error ? err.message : 'Unable to save timetable.', 'error');
    } finally {
      setSavingMaster(false);
    }
  };

  const handleSaveSubstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEntry) return;
    const orig = subEntry.slots.find((s) => s.batch === subBatch) || subEntry.slots[0];
    const actSub = subjects.find((s) => s.id === subActualSubId);
    const actFac = facultyList.find((f) => f.id === subActualFacId);
    if (!actSub || !actFac) return;
    setSavingSub(true);
    try {
      await createSubstitution(
        {
          date: selectedDate,
          classId: subEntry.classId,
          periodNumber: subEntry.periodNumber,
          endPeriodNumber: subEntry.endPeriodNumber,
          batch: subBatch,
          originalSubjectId: orig.subjectId,
          originalSubjectName: orig.subjectShortName,
          originalFacultyId: orig.facultyId,
          originalFacultyName: orig.facultyName,
          actualSubjectId: actSub.id,
          actualSubjectName: actSub.shortName,
          actualFacultyId: actFac.id,
          actualFacultyName: actFac.name,
          classroom: subRoom,
          reason: subReason,
          changedByUid: actor.uid,
          changedByName: actor.name,
          changedByRole: 'admin',
        },
        { ...actor, role: 'admin' }
      );
      showToast('Substitution Active', `${selectedDate} updated without altering master timetable.`, 'success');
      setSubEntry(null);
      await onRefresh();
    } finally {
      setSavingSub(false);
    }
  };

  const updateSlotField = (idx: number, patch: Partial<TimetableSlot>) => {
    if (!editingEntry || !editingEntry.slots) return;
    const next = [...editingEntry.slots];
    next[idx] = { ...next[idx], ...patch };
    setEditingEntry({ ...editingEntry, slots: next });
  };

  return (
    <div className="space-y-5">
      {flaggedBlocks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Confirmation Required:</strong> {flaggedBlocks.length} timetable block(s) (Tuesday Periods III–IV SAC/OS batch mapping) are flagged for Admin confirmation because the original timetable image was not attached. Click &ldquo;Master&rdquo; on the cell to confirm exact B-I / B-II subjects and rooms.
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DDE6EE] bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={activeClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-medium"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#5B6B80]">Substitution Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs font-mono-data"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={openNewMaster}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#03CAFC] px-3.5 py-2 text-xs font-semibold text-[#0F1E36]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Timetable Block</span>
        </button>
      </div>

      <TimetableGrid
        entries={classTimetable}
        substitutions={substitutions}
        selectedDate={selectedDate}
        canEditMaster
        canSubstitute
        onEditEntry={(entry) => setEditingEntry(entry)}
        onSubstituteEntry={(entry) => {
          setSubEntry(entry);
          setSubBatch(entry.slots[0]?.batch || 'ALL');
          setSubActualSubId(entry.slots[0]?.subjectId || '');
          setSubActualFacId(entry.slots[0]?.facultyId || facultyList[0]?.id || '');
          setSubRoom(entry.slots[0]?.classroom || 'LH-E-303');
          setSubReason('');
        }}
      />

      {/* Substitution History */}
      <div className="rounded-lg border border-[#DDE6EE] bg-white overflow-x-auto">
        <div className="border-b border-[#DDE6EE] px-4 py-3">
          <h3 className="text-sm font-bold text-[#0F1E36] font-display">
            Substitution History ({substitutions.length})
          </h3>
        </div>
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
              <th className="px-4 py-2 font-semibold">Date &amp; Period</th>
              <th className="px-4 py-2 font-semibold">Original Subject &amp; Faculty</th>
              <th className="px-4 py-2 font-semibold">Actual Substituted Subject &amp; Faculty</th>
              <th className="px-4 py-2 font-semibold">Authorized By</th>
              <th className="px-4 py-2 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF3F7]">
            {substitutions.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-mono-data">
                  {s.date} · P{s.periodNumber}{s.endPeriodNumber > s.periodNumber ? `-${s.endPeriodNumber}` : ''} ({s.batch})
                </td>
                <td className="px-4 py-2 text-[#5B6B80]">
                  {s.originalSubjectName} ({s.originalFacultyName || 'Regular'})
                </td>
                <td className="px-4 py-2 font-semibold text-[#0F1E36]">
                  {s.actualSubjectName} ({s.actualFacultyName}) · Room {s.classroom}
                </td>
                <td className="px-4 py-2 text-[#5B6B80]">{s.changedByName}</td>
                <td className="px-4 py-2 text-right">
                  {s.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() =>
                        cancelSubstitution(s, { ...actor, role: 'admin' }).then(onRefresh)
                      }
                      className="rounded border border-red-200 px-2 py-0.5 text-[11px] text-red-700"
                    >
                      Revert
                    </button>
                  ) : (
                    <span className="font-mono-data text-[11px] text-[#5B6B80]">CANCELLED</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Master Timetable Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleSaveMaster} className="w-full max-w-2xl rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-4 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DDE6EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F1E36]">
                {editingEntry.id ? 'Edit Master Timetable Block' : 'Add Master Timetable Block'}
              </h3>
              <button type="button" onClick={() => setEditingEntry(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Day</label>
                <select
                  value={editingEntry.dayOfWeek || 'Monday'}
                  onChange={(e) => setEditingEntry({ ...editingEntry, dayOfWeek: e.target.value as DayOfWeek })}
                  className="w-full rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs"
                >
                  {WORKING_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Start Period</label>
                <select
                  value={editingEntry.periodNumber || 1}
                  onChange={(e) => setEditingEntry({ ...editingEntry, periodNumber: Number(e.target.value) })}
                  className="w-full rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs"
                >
                  {PERIOD_TIMINGS.map((p) => <option key={p.period} value={p.period}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">End Period</label>
                <select
                  value={editingEntry.endPeriodNumber || editingEntry.periodNumber || 1}
                  onChange={(e) => setEditingEntry({ ...editingEntry, endPeriodNumber: Number(e.target.value) })}
                  className="w-full rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs"
                >
                  {PERIOD_TIMINGS.map((p) => <option key={p.period} value={p.period}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#0F1E36]">Batch / Period Slots</span>
                <button
                  type="button"
                  onClick={() =>
                    setEditingEntry({
                      ...editingEntry,
                      slots: [
                        ...(editingEntry.slots || []),
                        {
                          batch: 'B-II',
                          subjectId: classSubjects[0]?.id || '',
                          subjectShortName: classSubjects[0]?.shortName || '',
                          subjectName: classSubjects[0]?.name || '',
                          facultyId: '',
                          facultyName: '',
                          classroom: 'LH-E-303',
                          needsConfirmation: false,
                        },
                      ],
                    })
                  }
                  className="text-xs font-semibold text-[#0284C7]"
                >
                  + Add Batch Split Slot
                </button>
              </div>
              {(editingEntry.slots || []).map((slot, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-md border border-[#DDE6EE] bg-[#F8FAFC] p-3">
                  <div>
                    <label className="block text-[10px] text-[#5B6B80] mb-1">Batch</label>
                    <select
                      value={slot.batch}
                      onChange={(e) => updateSlotField(idx, { batch: e.target.value as BatchType })}
                      className="w-full rounded border border-[#DDE6EE] bg-white px-2 py-1 text-xs"
                    >
                      <option value="ALL">ALL</option>
                      <option value="B-I">B-I</option>
                      <option value="B-II">B-II</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#5B6B80] mb-1">Subject</label>
                    <select
                      value={slot.subjectId}
                      onChange={(e) => {
                        const s = subjects.find((x) => x.id === e.target.value);
                        if (s) {
                          updateSlotField(idx, {
                            subjectId: s.id,
                            subjectShortName: s.shortName,
                            subjectName: s.name,
                            facultyId: s.facultyIds[0] || slot.facultyId,
                            facultyName: s.facultyNames.join(' / ') || slot.facultyName,
                            needsConfirmation: false,
                          });
                        }
                      }}
                      className="w-full rounded border border-[#DDE6EE] bg-white px-2 py-1 text-xs"
                    >
                      {subjects.map((s) => <option key={s.id} value={s.id}>{s.shortName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#5B6B80] mb-1">Classroom</label>
                    <input
                      type="text"
                      value={slot.classroom}
                      onChange={(e) => updateSlotField(idx, { classroom: e.target.value, needsConfirmation: false })}
                      className="w-full rounded border border-[#DDE6EE] bg-white px-2 py-1 text-xs font-mono-data"
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <label className="flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={!slot.needsConfirmation}
                        onChange={(e) => updateSlotField(idx, { needsConfirmation: !e.target.checked })}
                      />
                      <span>Confirmed</span>
                    </label>
                    {(editingEntry.slots?.length || 0) > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingEntry({
                            ...editingEntry,
                            slots: editingEntry.slots?.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-red-600 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#EEF3F7]">
              {editingEntry.id ? (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteTimetableEntry(editingEntry as TimetableEntry, actor);
                    setEditingEntry(null);
                    await onRefresh();
                  }}
                  className="text-xs font-medium text-red-700 hover:underline"
                >
                  Delete Block
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingEntry(null)} className="rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs">Cancel</button>
                <button type="submit" disabled={savingMaster} className="rounded-md bg-[#03CAFC] px-4 py-1.5 text-xs font-semibold text-[#0F1E36]">
                  {savingMaster ? 'Saving...' : 'Save Timetable'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Substitution Modal */}
      {subEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleSaveSubstitution} className="w-full max-w-lg rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#DDE6EE] pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-[#0284C7]" />
                <h3 className="text-sm font-bold text-[#0F1E36]">
                  Temporary Subject &amp; Faculty Substitution ({subEntry.dayOfWeek} P{subEntry.periodNumber})
                </h3>
              </div>
              <button type="button" onClick={() => setSubEntry(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Date</label>
                <input type="date" required value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data" />
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Batch</label>
                <select value={subBatch} onChange={(e) => setSubBatch(e.target.value as BatchType)} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs">
                  <option value="ALL">ALL</option>
                  <option value="B-I">B-I</option>
                  <option value="B-II">B-II</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Actual Subject</label>
                <select value={subActualSubId} onChange={(e) => setSubActualSubId(e.target.value)} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs">
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.shortName} · {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Actual Faculty</label>
                <select value={subActualFacId} onChange={(e) => setSubActualFacId(e.target.value)} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs">
                  {facultyList.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Classroom</label>
                <input type="text" required value={subRoom} onChange={(e) => setSubRoom(e.target.value)} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data" />
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Reason</label>
                <input type="text" value={subReason} onChange={(e) => setSubReason(e.target.value)} placeholder="Optional reason" className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setSubEntry(null)} className="rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs">Cancel</button>
              <button type="submit" disabled={savingSub} className="rounded-md bg-[#03CAFC] px-4 py-1.5 text-xs font-semibold text-[#0F1E36]">
                {savingSub ? 'Saving...' : 'Save Substitution'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function AdminAttendanceTab({
  actor,
  classes,
  subjects,
  students,
  attendance,
  onRefresh,
}: TimetableAttendanceProps) {
  const { showToast } = useToast();
  const istNow = useMemo(() => getISTParts(new Date()), []);

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'rfid' | 'manual'>('all');

  // Manual attendance drawer
  const [showManual, setShowManual] = useState(false);
  const [mClassId, setMClassId] = useState(classes[0]?.id || '');
  const [mDate, setMDate] = useState(istNow.dateStr);
  const [mPeriod, setMPeriod] = useState(1);
  const [mSubjectId, setMSubjectId] = useState(subjects[0]?.id || '');
  const [mMarks, setMMarks] = useState<Record<string, AttendanceStatus>>({});

  // Correction modal
  const [correcting, setCorrecting] = useState<AttendanceRecord | null>(null);
  const [cStatus, setCStatus] = useState<AttendanceStatus>('present');
  const [cReason, setCReason] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attendance.filter((r) => {
      if (dateFilter && r.date !== dateFilter) return false;
      if (subjectFilter !== 'ALL' && r.subjectId !== subjectFilter) return false;
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.rollNumber.toLowerCase().includes(q) ||
        r.subjectShortName.toLowerCase().includes(q)
      );
    });
  }, [attendance, dateFilter, search, sourceFilter, subjectFilter]);

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === (mClassId || classes[0]?.id) && s.status === 'active'),
    [classes, mClassId, students]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DDE6EE] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#5B6B80]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter student, roll no, subject..."
              className="w-full rounded-md border border-[#DDE6EE] pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs font-mono-data"
          />
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs"
          >
            <option value="ALL">All Subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.shortName}</option>)}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'all' | 'rfid' | 'manual')}
            className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs"
          >
            <option value="all">RFID + Manual</option>
            <option value="rfid">RFID Only</option>
            <option value="manual">Manual Only</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#03CAFC] px-3.5 py-2 text-xs font-semibold text-[#0F1E36]"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{showManual ? 'Hide Manual Roster' : 'Mark Manual Attendance'}</span>
        </button>
      </div>

      {showManual && (
        <div className="rounded-lg border border-[#BBE9FA] bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select value={mClassId || classes[0]?.id || ''} onChange={(e) => setMClassId(e.target.value)} className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs font-mono-data" />
            <select value={mPeriod} onChange={(e) => setMPeriod(Number(e.target.value))} className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs">
              {PERIOD_TIMINGS.map((p) => <option key={p.period} value={p.period}>{p.label}</option>)}
            </select>
            <select value={mSubjectId || subjects[0]?.id || ''} onChange={(e) => setMSubjectId(e.target.value)} className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs">
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.shortName}</option>)}
            </select>
          </div>
          <div className="max-h-56 overflow-y-auto border border-[#DDE6EE] rounded-md divide-y divide-[#EEF3F7]">
            {classStudents.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <span><strong className="font-mono-data">{s.rollNumber}</strong> · {s.name} ({s.batch})</span>
                <div className="flex gap-1">
                  {(['present', 'absent', 'late'] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setMMarks((p) => ({ ...p, [s.id]: st }))}
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${
                        (mMarks[s.id] || 'present') === st ? 'bg-[#0F1E36] text-white' : 'bg-[#F5F8FA] text-[#5B6B80]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                const sub = subjects.find((s) => s.id === (mSubjectId || subjects[0]?.id));
                if (!sub || classStudents.length === 0) return;
                const res = await markManualAttendanceBatch({
                  date: mDate,
                  period: mPeriod,
                  classroom: 'LH-E-303',
                  subject: sub,
                  entries: classStudents.map((s) => ({ student: s, status: mMarks[s.id] || 'present' })),
                  actor: { ...actor, role: 'admin' },
                });
                showToast('Manual Attendance Saved', `Created ${res.createdCount}, skipped ${res.skippedDuplicates} duplicates.`, 'success');
                setShowManual(false);
                await onRefresh();
              }}
              className="rounded-md bg-[#03CAFC] px-4 py-1.5 text-xs font-semibold text-[#0F1E36]"
            >
              Submit Roster
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[#DDE6EE] bg-white overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
              <th className="px-4 py-2.5 font-semibold">Date &amp; Period</th>
              <th className="px-4 py-2.5 font-semibold">Roll No &amp; Student</th>
              <th className="px-4 py-2.5 font-semibold">Subject</th>
              <th className="px-4 py-2.5 font-semibold">Source / Device</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold text-right">Correction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF3F7]">
            {filtered.slice(0, 150).map((r) => (
              <tr key={r.id} className="hover:bg-[#FAFCFE]">
                <td className="px-4 py-2 font-mono-data">{r.date} · P{r.period}</td>
                <td className="px-4 py-2">
                  <span className="font-mono-data font-bold">{r.rollNumber}</span> · {r.studentName}
                </td>
                <td className="px-4 py-2 font-medium">{r.subjectShortName}</td>
                <td className="px-4 py-2 font-mono-data text-[11px] text-[#5B6B80] uppercase">
                  {r.source}{r.deviceId ? ` (${r.deviceId})` : ''}
                </td>
                <td className="px-4 py-2 font-mono-data font-semibold">
                  <span className={r.status === 'present' ? 'text-emerald-700' : r.status === 'late' ? 'text-amber-700' : 'text-red-700'}>
                    {r.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setCorrecting(r);
                      setCStatus(r.status);
                      setCReason('');
                    }}
                    className="rounded border border-[#DDE6EE] px-2 py-0.5 text-[11px] font-medium hover:border-[#03CAFC]"
                  >
                    Correct
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {correcting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await correctAttendanceStatus({
                record: correcting,
                newStatus: cStatus,
                reason: cReason,
                actor: { ...actor, role: 'admin' },
              });
              setCorrecting(null);
              showToast('Attendance Corrected', 'Audit log recorded.', 'success');
              await onRefresh();
            }}
            className="w-full max-w-md rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-[#DDE6EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F1E36]">Admin Attendance Correction</h3>
              <button type="button" onClick={() => setCorrecting(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="text-xs text-[#5B6B80]">
              {correcting.rollNumber} · {correcting.studentName} · {correcting.subjectShortName} ({correcting.date} P-{correcting.period})
            </div>
            <select value={cStatus} onChange={(e) => setCStatus(e.target.value as AttendanceStatus)} className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs">
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>
            <input type="text" required value={cReason} onChange={(e) => setCReason(e.target.value)} placeholder="Authorization reason..." className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCorrecting(null)} className="rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs">Cancel</button>
              <button type="submit" className="rounded-md bg-[#03CAFC] px-4 py-1.5 text-xs font-semibold text-[#0F1E36]">Update Status</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
