import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  CalendarClock,
  BarChart3,
  Megaphone,
  ArrowRightLeft,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { SidebarLayout, NavItem } from '../components/ui/SidebarLayout';
import { StatCard } from '../components/ui/StatCard';
import { CardGridSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { TimetableGrid } from '../components/ui/TimetableGrid';
import { SubjectDistributionBars } from '../components/ui/AttendanceCharts';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getISTParts, PERIOD_TIMINGS } from '../constants/timetable';
import { fetchClasses, fetchSubjects } from '../services/academicService';
import {
  calculateAttendanceMetrics,
  correctAttendanceStatus,
  fetchAttendanceRecords,
  markManualAttendanceBatch,
  summarizeBySubject,
} from '../services/attendanceService';
import { createNotice, fetchNotices } from '../services/auditNoticeService';
import { fetchFacultyList } from '../services/facultyService';
import { buildStudentWiseReport, downloadCsv } from '../services/reportService';
import { fetchStudents } from '../services/studentService';
import {
  cancelSubstitution,
  createSubstitution,
  fetchSubstitutions,
} from '../services/substitutionService';
import { fetchTimetable } from '../services/timetableService';
import {
  AcademicClass,
  AttendanceRecord,
  AttendanceStatus,
  BatchType,
  DayOfWeek,
  Faculty,
  Notice,
  Student,
  Subject,
  Substitution,
  TimetableEntry,
} from '../types/erp';

const FACULTY_NAV: NavItem[] = [
  { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
  { id: 'students', label: 'Assigned Students', icon: Users },
  { id: 'attendance', label: 'Manual & RFID Attendance', icon: ClipboardCheck },
  { id: 'timetable', label: 'Timetable & Substitutions', icon: CalendarClock },
  { id: 'reports', label: 'Subject & Class Reports', icon: BarChart3 },
  { id: 'notices', label: 'Academic Notices', icon: Megaphone },
];

export default function FacultyDashboard() {
  const { facultyProfile, firebaseUser, portalSettings } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [facultyRoster, setFacultyRoster] = useState<Faculty[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);

  const istNow = useMemo(() => getISTParts(new Date()), []);
  const [selectedClassId, setSelectedClassId] = useState('');

  // Manual attendance form state
  const [attDate, setAttDate] = useState(istNow.dateStr);
  const [attPeriod, setAttPeriod] = useState<number>(1);
  const [attSubjectId, setAttSubjectId] = useState('');
  const [attBatchFilter, setAttBatchFilter] = useState<BatchType>('ALL');
  const [attClassroom, setAttClassroom] = useState('LH-E-303');
  const [rosterMarks, setRosterMarks] = useState<Record<string, AttendanceStatus>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Attendance history filter & correction modal
  const [histDateFilter, setHistDateFilter] = useState('');
  const [histSourceFilter, setHistSourceFilter] = useState<'all' | 'rfid' | 'manual'>('all');
  const [correctingRecord, setCorrectingRecord] = useState<AttendanceRecord | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<AttendanceStatus>('present');
  const [correctionReason, setCorrectionReason] = useState('');

  // Substitution modal state
  const [subDate, setSubDate] = useState(istNow.dateStr);
  const [subModalEntry, setSubModalEntry] = useState<TimetableEntry | null>(null);
  const [subBatch, setSubBatch] = useState<BatchType>('ALL');
  const [subActualSubjectId, setSubActualSubjectId] = useState('');
  const [subActualFacultyId, setSubActualFacultyId] = useState('');
  const [subClassroom, setSubClassroom] = useState('LH-E-303');
  const [subReason, setSubReason] = useState('');
  const [savingSub, setSavingSub] = useState(false);

  // Faculty Notice form
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');

  const assignedClassIds = useMemo(
    () => facultyProfile?.assignedClassIds || [],
    [facultyProfile?.assignedClassIds]
  );

  const loadData = useCallback(async () => {
    if (!facultyProfile) return;
    setLoading(true);
    try {
      const [allClasses, allSubjects, allFaculty, noticeList] = await Promise.all([
        fetchClasses(),
        fetchSubjects(),
        fetchFacultyList(),
        fetchNotices('faculty'),
      ]);

      const scopedClasses = allClasses.filter((c) => assignedClassIds.includes(c.id));
      const activeClassId = selectedClassId || scopedClasses[0]?.id || assignedClassIds[0] || '';
      if (!selectedClassId && activeClassId) setSelectedClassId(activeClassId);

      setClasses(scopedClasses);
      setSubjects(allSubjects.filter((s) => assignedClassIds.includes(s.classId) && s.status === 'active'));
      setFacultyRoster(allFaculty.filter((f) => f.status === 'active'));
      setNotices(noticeList);

      if (activeClassId) {
        const [stuList, ttList, subsList, attList] = await Promise.all([
          fetchStudents(activeClassId),
          fetchTimetable(activeClassId),
          fetchSubstitutions({ classId: activeClassId }),
          fetchAttendanceRecords({ classId: activeClassId, maxResults: 1000 }),
        ]);
        setStudents(stuList.filter((s) => s.status === 'active'));
        setTimetable(ttList);
        setSubstitutions(subsList);
        setAttendance(attList);

        const defaultSub =
          allSubjects.find(
            (s) => s.classId === activeClassId && facultyProfile.assignedSubjectIds.includes(s.id)
          ) || allSubjects.find((s) => s.classId === activeClassId);
        if (defaultSub && !attSubjectId) setAttSubjectId(defaultSub.id);
      }
    } catch (err) {
      showToast(
        'Load Error',
        err instanceof Error ? err.message : 'Unable to load faculty workspace.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [assignedClassIds, attSubjectId, facultyProfile, selectedClassId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize roster marks whenever filtered students change
  const manualRosterStudents = useMemo(() => {
    return students.filter((s) => (attBatchFilter === 'ALL' ? true : s.batch === attBatchFilter));
  }, [attBatchFilter, students]);

  useEffect(() => {
    const next: Record<string, AttendanceStatus> = {};
    for (const s of manualRosterStudents) {
      next[s.id] = rosterMarks[s.id] || 'present';
    }
    setRosterMarks(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualRosterStudents.length, attBatchFilter]);

  const mySubjects = useMemo(
    () =>
      subjects.filter(
        (s) =>
          facultyProfile?.assignedSubjectIds.includes(s.id) ||
          s.facultyIds.includes(facultyProfile?.id || '')
      ),
    [facultyProfile?.assignedSubjectIds, facultyProfile?.id, subjects]
  );

  const todayBlocks = useMemo(() => {
    if (istNow.dayOfWeek === 'Sunday') return [];
    return timetable
      .filter((t) => t.status === 'active' && t.dayOfWeek === (istNow.dayOfWeek as DayOfWeek))
      .sort((a, b) => a.periodNumber - b.periodNumber);
  }, [istNow.dayOfWeek, timetable]);

  // Existing attendance duplicate warning check for manual entry
  const existingSessionRecords = useMemo(() => {
    return attendance.filter(
      (a) =>
        a.date === attDate &&
        a.classId === selectedClassId &&
        a.period === Number(attPeriod) &&
        a.subjectId === attSubjectId
    );
  }, [attDate, attPeriod, attSubjectId, attendance, selectedClassId]);

  const handleSubmitManualAttendance = async () => {
    if (!facultyProfile || !firebaseUser) return;
    const subject = subjects.find((s) => s.id === attSubjectId);
    if (!subject) {
      showToast('Validation Error', 'Please select a subject before saving attendance.', 'warning');
      return;
    }
    if (manualRosterStudents.length === 0) {
      showToast('Empty Roster', 'No active students found for the selected batch.', 'warning');
      return;
    }
    setSavingAttendance(true);
    try {
      const entries = manualRosterStudents.map((s) => ({
        student: s,
        status: rosterMarks[s.id] || 'present',
      }));
      const res = await markManualAttendanceBatch({
        date: attDate,
        period: Number(attPeriod),
        classroom: attClassroom,
        subject,
        entries,
        faculty: facultyProfile,
        actor: {
          uid: firebaseUser.uid,
          name: facultyProfile.name,
          email: facultyProfile.email,
          role: 'faculty',
        },
        allowOverwrite: false,
      });
      if (res.skippedDuplicates > 0) {
        showToast(
          'Attendance Saved (Duplicates Skipped)',
          `Saved ${res.createdCount} new record(s). Skipped ${res.skippedDuplicates} existing record(s) to prevent duplicates.`,
          'warning'
        );
      } else {
        showToast(
          'Manual Attendance Recorded',
          `Recorded ${res.createdCount} student(s) for ${subject.shortName} (Period ${attPeriod}).`,
          'success'
        );
      }
      await loadData();
    } catch (err) {
      showToast(
        'Save Failed',
        err instanceof Error ? err.message : 'Unable to save manual attendance.',
        'error'
      );
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord || !facultyProfile || !firebaseUser) return;
    if (!correctionReason.trim()) {
      showToast('Reason Required', 'Please provide an audit reason for correcting attendance.', 'warning');
      return;
    }
    try {
      await correctAttendanceStatus({
        record: correctingRecord,
        newStatus: correctionStatus,
        reason: correctionReason,
        actor: {
          uid: firebaseUser.uid,
          name: facultyProfile.name,
          email: facultyProfile.email,
          role: 'faculty',
        },
      });
      showToast('Attendance Corrected', 'The updated status has been logged.', 'success');
      setCorrectingRecord(null);
      setCorrectionReason('');
      await loadData();
    } catch (err) {
      showToast(
        'Correction Denied',
        err instanceof Error ? err.message : 'Insufficient permission to correct attendance.',
        'error'
      );
    }
  };

  const openSubstituteModal = (entry: TimetableEntry) => {
    if (!facultyProfile?.canSubstitute) {
      showToast('Permission Restricted', 'Temporary substitution permission is disabled for your account.', 'warning');
      return;
    }
    const defaultSlot = entry.slots[0];
    setSubModalEntry(entry);
    setSubBatch(defaultSlot.batch);
    setSubActualSubjectId(defaultSlot.subjectId);
    setSubActualFacultyId(facultyProfile.id);
    setSubClassroom(defaultSlot.classroom || 'LH-E-303');
    setSubReason('');
  };

  const handleSaveSubstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subModalEntry || !facultyProfile || !firebaseUser) return;
    const origSlot =
      subModalEntry.slots.find((s) => s.batch === subBatch) || subModalEntry.slots[0];
    const actSubject = subjects.find((s) => s.id === subActualSubjectId);
    const actFaculty = facultyRoster.find((f) => f.id === subActualFacultyId);
    if (!actSubject || !actFaculty) {
      showToast('Validation Error', 'Please select both actual subject and actual faculty.', 'warning');
      return;
    }

    setSavingSub(true);
    try {
      await createSubstitution(
        {
          date: subDate,
          classId: subModalEntry.classId,
          periodNumber: subModalEntry.periodNumber,
          endPeriodNumber: subModalEntry.endPeriodNumber,
          batch: subBatch,
          originalSubjectId: origSlot.subjectId,
          originalSubjectName: origSlot.subjectShortName,
          originalFacultyId: origSlot.facultyId,
          originalFacultyName: origSlot.facultyName,
          actualSubjectId: actSubject.id,
          actualSubjectName: actSubject.shortName,
          actualFacultyId: actFaculty.id,
          actualFacultyName: actFaculty.name,
          classroom: subClassroom,
          reason: subReason,
          changedByUid: firebaseUser.uid,
          changedByName: facultyProfile.name,
          changedByRole: 'faculty',
        },
        {
          uid: firebaseUser.uid,
          name: facultyProfile.name,
          email: facultyProfile.email,
          role: 'faculty',
        }
      );
      showToast(
        'Substitution Saved',
        `${subDate} Period ${subModalEntry.periodNumber} updated to ${actSubject.shortName} (${actFaculty.name}).`,
        'success'
      );
      setSubModalEntry(null);
      await loadData();
    } catch (err) {
      showToast(
        'Substitution Failed',
        err instanceof Error ? err.message : 'Unable to save substitution.',
        'error'
      );
    } finally {
      setSavingSub(false);
    }
  };

  const handlePublishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyProfile || !firebaseUser || !noticeTitle.trim() || !noticeBody.trim()) return;
    try {
      await createNotice({
        title: noticeTitle,
        body: noticeBody,
        category: 'academic',
        targetRole: 'all',
        classId: selectedClassId,
        authorName: facultyProfile.name,
        authorUid: firebaseUser.uid,
        isPinned: false,
      });
      setNoticeTitle('');
      setNoticeBody('');
      showToast('Notice Published', 'Announcement posted to students and faculty.', 'success');
      await loadData();
    } catch (err) {
      showToast('Failed', err instanceof Error ? err.message : 'Could not post notice.', 'error');
    }
  };

  const metrics = useMemo(() => calculateAttendanceMetrics(attendance), [attendance]);
  const subjectSummaries = useMemo(
    () => summarizeBySubject(attendance, subjects),
    [attendance, subjects]
  );
  const studentReportRows = useMemo(
    () => buildStudentWiseReport(attendance, students),
    [attendance, students]
  );

  const filteredAttendanceHistory = useMemo(() => {
    return attendance.filter((r) => {
      if (histDateFilter && r.date !== histDateFilter) return false;
      if (histSourceFilter !== 'all' && r.source !== histSourceFilter) return false;
      return true;
    });
  }, [attendance, histDateFilter, histSourceFilter]);

  if (!facultyProfile) return null;

  const activeTabLabel = FACULTY_NAV.find((n) => n.id === activeTab)?.label || 'Overview';

  return (
    <SidebarLayout
      portalTitle="Faculty Portal"
      navItems={FACULTY_NAV}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      breadcrumbSection={`Faculty · ${activeTabLabel}`}
      headerAction={
        classes.length > 0 ? (
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-md border border-[#DDE6EE] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F1E36]"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : undefined
      }
    >
      {/* Faculty Profile Header */}
      <section className="mb-5 rounded-lg border border-[#DDE6EE] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#0F1E36] font-display">{facultyProfile.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#5B6B80]">
              <span className="font-mono-data font-semibold text-[#0284C7]">
                {facultyProfile.facultyCode}
              </span>
              <span aria-hidden="true">·</span>
              <span>{facultyProfile.designation}</span>
              <span aria-hidden="true">·</span>
              <span>{facultyProfile.departmentName || 'AI&ML'}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-[#5B6B80]">Assigned Classes:</span>{' '}
              <strong className="font-mono-data text-[#0F1E36]">{classes.length}</strong>
            </div>
            <div>
              <span className="text-[#5B6B80]">Assigned Subjects:</span>{' '}
              <strong className="font-mono-data text-[#0F1E36]">{mySubjects.length}</strong>
            </div>
            <div>
              <span className="text-[#5B6B80]">Substitution Auth:</span>{' '}
              <strong className={facultyProfile.canSubstitute ? 'text-emerald-700' : 'text-slate-500'}>
                {facultyProfile.canSubstitute ? 'Enabled' : 'Disabled'}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="space-y-5">
          <CardGridSkeleton count={4} />
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : (
        <>
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Assigned Students" value={students.length} subtext="Active class roster" />
                <StatCard label="My Subjects" value={mySubjects.length} subtext="Theory & Lab allocations" />
                <StatCard
                  label="Class Attendance Rate"
                  value={metrics.total > 0 ? `${metrics.percentage}%` : '—'}
                  subtext={`${metrics.present + metrics.late} present / ${metrics.total} records`}
                  tone="primary"
                />
                <StatCard
                  label="Active Substitutions"
                  value={substitutions.filter((s) => s.status === 'active').length}
                  subtext="Temporary overrides"
                />
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="lg:col-span-6 rounded-lg border border-[#DDE6EE] bg-white p-5">
                  <h2 className="text-sm font-bold text-[#0F1E36] font-display border-b border-[#EEF3F7] pb-3">
                    Today&apos;s Class Timetable ({istNow.dayOfWeek})
                  </h2>
                  {todayBlocks.length === 0 ? (
                    <p className="mt-4 text-xs text-[#5B6B80]">No periods scheduled today.</p>
                  ) : (
                    <div className="mt-3 divide-y divide-[#EEF3F7]">
                      {todayBlocks.map((b) => (
                        <div key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                          <div className="min-w-0">
                            <div className="font-semibold text-[#0F1E36]">
                              {b.slots.map((s) => (s.batch !== 'ALL' ? `${s.batch}: ${s.subjectShortName}` : s.subjectShortName)).join(' / ')}
                            </div>
                            <div className="text-[11px] text-[#5B6B80] truncate">
                              {b.slots.map((s) => s.facultyName).join(' · ')}
                            </div>
                          </div>
                          <div className="text-right font-mono-data text-[11px] text-[#5B6B80] shrink-0">
                            <div>P{b.periodNumber}{b.endPeriodNumber > b.periodNumber ? `-${b.endPeriodNumber}` : ''}</div>
                            <div>{b.startTime}–{b.endTime}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-6 rounded-lg border border-[#DDE6EE] bg-white p-5">
                  <h2 className="text-sm font-bold text-[#0F1E36] font-display border-b border-[#EEF3F7] pb-3">
                    My Assigned Subjects
                  </h2>
                  {mySubjects.length === 0 ? (
                    <p className="mt-4 text-xs text-[#5B6B80]">No subjects explicitly linked yet.</p>
                  ) : (
                    <div className="mt-3 divide-y divide-[#EEF3F7]">
                      {mySubjects.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                          <div className="min-w-0">
                            <span className="font-bold text-[#0F1E36]">{sub.shortName}</span>
                            <span className="ml-2 text-[#5B6B80]">{sub.name}</span>
                          </div>
                          <span className="font-mono-data text-[11px] uppercase text-[#0284C7] shrink-0">
                            {sub.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ASSIGNED STUDENTS */}
          {activeTab === 'students' && (
            <div className="rounded-lg border border-[#DDE6EE] bg-white">
              <div className="border-b border-[#DDE6EE] px-4 py-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#0F1E36] font-display">
                  Assigned Class Roster ({students.length})
                </h2>
              </div>
              {students.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Users}
                    title="No Students Assigned"
                    description="Students enrolled in your assigned class will appear here."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
                        <th className="px-4 py-2.5 font-semibold">Roll No</th>
                        <th className="px-4 py-2.5 font-semibold">Student ID</th>
                        <th className="px-4 py-2.5 font-semibold">Name</th>
                        <th className="px-4 py-2.5 font-semibold">Batch</th>
                        <th className="px-4 py-2.5 font-semibold">RFID Card UID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF3F7]">
                      {students.map((s) => (
                        <tr key={s.id} className="hover:bg-[#FAFCFE]">
                          <td className="px-4 py-2.5 font-mono-data font-semibold text-[#0F1E36]">
                            {s.rollNumber}
                          </td>
                          <td className="px-4 py-2.5 font-mono-data text-[#5B6B80]">{s.studentId}</td>
                          <td className="px-4 py-2.5 font-medium text-[#0F1E36]">{s.name}</td>
                          <td className="px-4 py-2.5 font-mono-data text-[#0284C7]">{s.batch}</td>
                          <td className="px-4 py-2.5 font-mono-data text-[#5B6B80]">
                            {s.rfidUid || 'Unassigned'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* MANUAL ATTENDANCE & HISTORY */}
          {activeTab === 'attendance' && (
            <div className="space-y-5">
              <div className="rounded-lg border border-[#DDE6EE] bg-white p-5">
                <h2 className="text-sm font-bold text-[#0F1E36] font-display">
                  Mark Manual Class Attendance
                </h2>
                <p className="mt-0.5 text-xs text-[#5B6B80]">
                  Uses the same deterministic Firestore attendance structure as RFID scans to prevent duplicates.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Date</label>
                    <input
                      type="date"
                      value={attDate}
                      onChange={(e) => setAttDate(e.target.value)}
                      className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Period</label>
                    <select
                      value={attPeriod}
                      onChange={(e) => setAttPeriod(Number(e.target.value))}
                      className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs"
                    >
                      {PERIOD_TIMINGS.map((p) => (
                        <option key={p.period} value={p.period}>
                          {p.label} ({p.display})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Subject</label>
                    <select
                      value={attSubjectId}
                      onChange={(e) => setAttSubjectId(e.target.value)}
                      className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shortName} · {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Batch</label>
                    <select
                      value={attBatchFilter}
                      onChange={(e) => setAttBatchFilter(e.target.value as BatchType)}
                      className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs"
                    >
                      <option value="ALL">All Batches</option>
                      <option value="B-I">Batch B-I</option>
                      <option value="B-II">Batch B-II</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Classroom</label>
                    <input
                      type="text"
                      value={attClassroom}
                      onChange={(e) => setAttClassroom(e.target.value)}
                      className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data"
                    />
                  </div>
                </div>

                {existingSessionRecords.length > 0 && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Existing Attendance Detected:</strong> {existingSessionRecords.length} record(s) already exist for this date, subject, and period. Submitting will only add missing students and skip duplicates. To edit existing entries, use the Correction action in the table below.
                    </span>
                  </div>
                )}

                <div className="mt-4 overflow-x-auto rounded-md border border-[#DDE6EE]">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
                        <th className="px-3 py-2 font-semibold">Roll No</th>
                        <th className="px-3 py-2 font-semibold">Student Name</th>
                        <th className="px-3 py-2 font-semibold">Batch</th>
                        <th className="px-3 py-2 font-semibold text-right">Mark Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF3F7]">
                      {manualRosterStudents.map((s) => {
                        const existing = existingSessionRecords.find((r) => r.studentDocId === s.id);
                        return (
                          <tr key={s.id}>
                            <td className="px-3 py-2 font-mono-data font-semibold">{s.rollNumber}</td>
                            <td className="px-3 py-2">
                              {s.name}
                              {existing && (
                                <span className="ml-2 text-[11px] font-mono-data text-amber-700">
                                  (Recorded: {existing.status.toUpperCase()})
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono-data text-[#5B6B80]">{s.batch}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="inline-flex rounded-md border border-[#DDE6EE] bg-[#F8FAFC] p-0.5">
                                {(['present', 'absent', 'late'] as AttendanceStatus[]).map((st) => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => setRosterMarks((prev) => ({ ...prev, [s.id]: st }))}
                                    className={`rounded px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                                      rosterMarks[s.id] === st
                                        ? st === 'present'
                                          ? 'bg-emerald-600 text-white'
                                          : st === 'absent'
                                          ? 'bg-red-600 text-white'
                                          : 'bg-amber-600 text-white'
                                        : 'text-[#5B6B80] hover:text-[#0F1E36]'
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={savingAttendance || manualRosterStudents.length === 0}
                    onClick={handleSubmitManualAttendance}
                    className="inline-flex items-center gap-2 rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36] hover:bg-[#02B3E0] disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{savingAttendance ? 'Saving Attendance...' : 'Save Manual Attendance'}</span>
                  </button>
                </div>
              </div>

              {/* Attendance History + Authorized Correction */}
              <div className="rounded-lg border border-[#DDE6EE] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DDE6EE] px-4 py-3">
                  <h2 className="text-sm font-bold text-[#0F1E36] font-display">
                    Class Attendance Records (RFID &amp; Manual)
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={histDateFilter}
                      onChange={(e) => setHistDateFilter(e.target.value)}
                      className="rounded-md border border-[#DDE6EE] px-2.5 py-1 text-xs font-mono-data"
                    />
                    <select
                      value={histSourceFilter}
                      onChange={(e) => setHistSourceFilter(e.target.value as 'all' | 'rfid' | 'manual')}
                      className="rounded-md border border-[#DDE6EE] px-2.5 py-1 text-xs"
                    >
                      <option value="all">All Sources</option>
                      <option value="rfid">RFID Scans</option>
                      <option value="manual">Manual Entries</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
                        <th className="px-4 py-2.5 font-semibold">Date</th>
                        <th className="px-4 py-2.5 font-semibold">Period</th>
                        <th className="px-4 py-2.5 font-semibold">Roll No</th>
                        <th className="px-4 py-2.5 font-semibold">Student</th>
                        <th className="px-4 py-2.5 font-semibold">Subject</th>
                        <th className="px-4 py-2.5 font-semibold">Source</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF3F7]">
                      {filteredAttendanceHistory.slice(0, 100).map((r) => (
                        <tr key={r.id} className="hover:bg-[#FAFCFE]">
                          <td className="px-4 py-2 font-mono-data">{r.date}</td>
                          <td className="px-4 py-2 font-mono-data">P-{r.period}</td>
                          <td className="px-4 py-2 font-mono-data font-semibold">{r.rollNumber}</td>
                          <td className="px-4 py-2">{r.studentName}</td>
                          <td className="px-4 py-2 font-medium">{r.subjectShortName}</td>
                          <td className="px-4 py-2 uppercase font-mono-data text-[11px] text-[#5B6B80]">
                            {r.source}
                          </td>
                          <td className="px-4 py-2 font-mono-data font-semibold">
                            <span
                              className={
                                r.status === 'present'
                                  ? 'text-emerald-700'
                                  : r.status === 'late'
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                              }
                            >
                              {r.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {facultyProfile.canCorrectAttendance && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCorrectingRecord(r);
                                  setCorrectionStatus(r.status);
                                  setCorrectionReason('');
                                }}
                                className="rounded border border-[#DDE6EE] px-2 py-0.5 text-[11px] font-medium text-[#0F1E36] hover:border-[#03CAFC]"
                              >
                                Correct
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TIMETABLE & SUBSTITUTIONS */}
          {activeTab === 'timetable' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DDE6EE] bg-white px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-[#0F1E36] font-display">
                    Weekly Timetable &amp; Authorized Period Substitution
                  </h2>
                  <p className="text-xs text-[#5B6B80]">
                    Click &ldquo;Edit Class&rdquo; on any period to substitute BOTH the actual subject and faculty for a specific date without altering the master timetable.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#5B6B80]">Effective Date:</label>
                  <input
                    type="date"
                    value={subDate}
                    onChange={(e) => setSubDate(e.target.value)}
                    className="rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data"
                  />
                </div>
              </div>

              <TimetableGrid
                entries={timetable}
                substitutions={substitutions}
                selectedDate={subDate}
                canSubstitute={facultyProfile.canSubstitute}
                onSubstituteEntry={openSubstituteModal}
              />

              {/* Substitution History */}
              <div className="rounded-lg border border-[#DDE6EE] bg-white">
                <div className="border-b border-[#DDE6EE] px-4 py-3">
                  <h3 className="text-sm font-bold text-[#0F1E36] font-display">
                    Substitution History
                  </h3>
                </div>
                {substitutions.length === 0 ? (
                  <div className="p-6 text-xs text-[#5B6B80]">No temporary substitutions recorded yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
                          <th className="px-4 py-2.5 font-semibold">Date &amp; Period</th>
                          <th className="px-4 py-2.5 font-semibold">Original Class</th>
                          <th className="px-4 py-2.5 font-semibold">Actual Substituted Class</th>
                          <th className="px-4 py-2.5 font-semibold">Changed By</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF3F7]">
                        {substitutions.map((s) => (
                          <tr key={s.id}>
                            <td className="px-4 py-2.5 font-mono-data">
                              {s.date} · P{s.periodNumber}{s.endPeriodNumber > s.periodNumber ? `-${s.endPeriodNumber}` : ''} ({s.batch})
                            </td>
                            <td className="px-4 py-2.5 text-[#5B6B80]">
                              {s.originalSubjectName} ({s.originalFacultyName || 'Regular'})
                            </td>
                            <td className="px-4 py-2.5 font-medium text-[#0F1E36]">
                              {s.actualSubjectName} ({s.actualFacultyName})
                              {s.reason && <div className="text-[11px] text-[#5B6B80]">Reason: {s.reason}</div>}
                            </td>
                            <td className="px-4 py-2.5 text-[#5B6B80]">{s.changedByName}</td>
                            <td className="px-4 py-2.5 text-right">
                              {s.status === 'active' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    cancelSubstitution(s, {
                                      uid: firebaseUser!.uid,
                                      name: facultyProfile.name,
                                      email: facultyProfile.email,
                                      role: 'faculty',
                                    }).then(loadData)
                                  }
                                  className="rounded border border-red-200 px-2 py-0.5 text-[11px] text-red-700 hover:bg-red-50"
                                >
                                  Cancel
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
                )}
              </div>
            </div>
          )}

          {/* REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="lg:col-span-6 rounded-lg border border-[#DDE6EE] bg-white p-5">
                  <h2 className="text-sm font-bold text-[#0F1E36] font-display mb-4">
                    Subject-wise Attendance Distribution
                  </h2>
                  <SubjectDistributionBars
                    summaries={subjectSummaries}
                    threshold={portalSettings.lowAttendanceThreshold}
                  />
                </div>
                <div className="lg:col-span-6 rounded-lg border border-[#DDE6EE] bg-white p-5 flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[#0F1E36] font-display">
                      Export Class Attendance Report
                    </h2>
                    <p className="mt-1 text-xs text-[#5B6B80]">
                      Download complete student-wise totals for your assigned class in CSV format compatible with Excel.
                    </p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(
                          `MCET_Class_Attendance_${istNow.dateStr}.csv`,
                          ['Roll No', 'Student ID', 'Name', 'Batch', 'Present', 'Late', 'Absent', 'Total', 'Percentage'],
                          studentReportRows.map((r) => [
                            r.rollNumber,
                            r.studentId,
                            r.name,
                            r.batch,
                            r.present,
                            r.late,
                            r.absent,
                            r.total,
                            `${r.percentage}%`,
                          ])
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36] hover:bg-[#02B3E0]"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Student-wise CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#DDE6EE] bg-white overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
                      <th className="px-4 py-2.5 font-semibold">Roll No</th>
                      <th className="px-4 py-2.5 font-semibold">Student Name</th>
                      <th className="px-4 py-2.5 font-semibold">Batch</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Present</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Absent</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Total</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3F7]">
                    {studentReportRows.map((row) => (
                      <tr key={row.studentDocId}>
                        <td className="px-4 py-2.5 font-mono-data font-semibold">{row.rollNumber}</td>
                        <td className="px-4 py-2.5">{row.name}</td>
                        <td className="px-4 py-2.5 font-mono-data text-[#5B6B80]">{row.batch}</td>
                        <td className="px-4 py-2.5 text-right font-mono-data text-emerald-700">
                          {row.present + row.late}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-data text-red-700">{row.absent}</td>
                        <td className="px-4 py-2.5 text-right font-mono-data">{row.total}</td>
                        <td className="px-4 py-2.5 text-right font-mono-data font-bold">
                          {row.total > 0 ? `${row.percentage}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* NOTICES */}
          {activeTab === 'notices' && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <form
                onSubmit={handlePublishNotice}
                className="lg:col-span-5 rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3 h-fit"
              >
                <h2 className="text-sm font-bold text-[#0F1E36] font-display">Post Class Notice</h2>
                <div>
                  <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    placeholder="e.g. Lab Assessment Schedule"
                    className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Details</label>
                  <textarea
                    rows={4}
                    required
                    value={noticeBody}
                    onChange={(e) => setNoticeBody(e.target.value)}
                    placeholder="Enter notice message..."
                    className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36] hover:bg-[#02B3E0]"
                >
                  Publish Notice
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {notices.map((n) => (
                  <article key={n.id} className="rounded-lg border border-[#DDE6EE] bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#0F1E36]">{n.title}</h3>
                      <span className="font-mono-data text-[11px] uppercase text-[#0284C7]">{n.category}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-[#5B6B80] whitespace-pre-line">{n.body}</p>
                    <div className="mt-2.5 text-[11px] text-[#5B6B80]">By {n.authorName}</div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Attendance Correction Modal */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={handleSaveCorrection}
            className="w-full max-w-md rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-[#DDE6EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F1E36]">Correct Attendance Status</h3>
              <button type="button" onClick={() => setCorrectingRecord(null)}>
                <X className="h-4 w-4 text-[#5B6B80]" />
              </button>
            </div>
            <div className="text-xs text-[#5B6B80]">
              Student: <strong className="text-[#0F1E36]">{correctingRecord.rollNumber} · {correctingRecord.studentName}</strong>
              <br />
              Session: <span className="font-mono-data">{correctingRecord.date} P-{correctingRecord.period} · {correctingRecord.subjectShortName}</span>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Updated Status</label>
              <select
                value={correctionStatus}
                onChange={(e) => setCorrectionStatus(e.target.value as AttendanceStatus)}
                className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">
                Correction Reason (Logged to Audit)
              </label>
              <input
                type="text"
                required
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="e.g. RFID card read missed / medical leave verified"
                className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCorrectingRecord(null)}
                className="rounded-md border border-[#DDE6EE] px-3.5 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36]"
              >
                Save Correction
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Substitution Modal */}
      {subModalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={handleSaveSubstitution}
            className="w-full max-w-lg rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-[#DDE6EE] pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-[#0284C7]" />
                <h3 className="text-sm font-bold text-[#0F1E36]">
                  Temporary Class Substitution ({subModalEntry.dayOfWeek} P{subModalEntry.periodNumber})
                </h3>
              </div>
              <button type="button" onClick={() => setSubModalEntry(null)}>
                <X className="h-4 w-4 text-[#5B6B80]" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={subDate}
                  onChange={(e) => setSubDate(e.target.value)}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs font-mono-data"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Batch Scope</label>
                <select
                  value={subBatch}
                  onChange={(e) => setSubBatch(e.target.value as BatchType)}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                >
                  <option value="ALL">Entire Class (ALL)</option>
                  <option value="B-I">Batch B-I</option>
                  <option value="B-II">Batch B-II</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Actual Subject</label>
                <select
                  value={subActualSubjectId}
                  onChange={(e) => setSubActualSubjectId(e.target.value)}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shortName} · {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Actual Faculty</label>
                <select
                  value={subActualFacultyId}
                  onChange={(e) => setSubActualFacultyId(e.target.value)}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                >
                  {facultyRoster.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Classroom</label>
                <input
                  type="text"
                  required
                  value={subClassroom}
                  onChange={(e) => setSubClassroom(e.target.value)}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs font-mono-data"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Reason (Optional)</label>
                <input
                  type="text"
                  value={subReason}
                  onChange={(e) => setSubReason(e.target.value)}
                  placeholder="e.g. Regular faculty on leave"
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubModalEntry(null)}
                className="rounded-md border border-[#DDE6EE] px-3.5 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSub}
                className="rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36] hover:bg-[#02B3E0]"
              >
                {savingSub ? 'Saving...' : 'Save Temporary Substitution'}
              </button>
            </div>
          </form>
        </div>
      )}
    </SidebarLayout>
  );
}
