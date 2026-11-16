import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  BookOpen,
  Megaphone,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { SidebarLayout, NavItem } from '../components/ui/SidebarLayout';
import { StatCard } from '../components/ui/StatCard';
import { CardGridSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { TimetableGrid } from '../components/ui/TimetableGrid';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  getISTParts,
  getUpcomingPeriodFromTime,
  resolvePeriodFromTime,
} from '../constants/timetable';
import { fetchSubjects } from '../services/academicService';
import {
  calculateAttendanceMetrics,
  fetchStudentPrivateAttendance,
  summarizeBySubject,
} from '../services/attendanceService';
import { fetchNotices } from '../services/auditNoticeService';
import { fetchSubstitutions } from '../services/substitutionService';
import { fetchTimetable } from '../services/timetableService';
import {
  AttendanceRecord,
  DayOfWeek,
  Notice,
  Subject,
  Substitution,
  TimetableEntry,
} from '../types/erp';

const STUDENT_NAV: NavItem[] = [
  { id: 'overview', label: 'Attendance Overview', icon: LayoutDashboard },
  { id: 'subjects', label: 'Subject-wise Status', icon: BookOpen },
  { id: 'history', label: 'History & Calendar', icon: CalendarIcon },
  { id: 'timetable', label: 'My Timetable', icon: Clock },
  { id: 'notices', label: 'Academic Notices', icon: Megaphone },
];

export default function StudentDashboard() {
  const { studentProfile, portalSettings, firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);

  // Filters & Calendar state
  const istNow = useMemo(() => getISTParts(new Date()), []);
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(istNow.dateStr);
  const [calendarMonth, setCalendarMonth] = useState(istNow.dateStr.slice(0, 7));

  const loadData = useCallback(async () => {
    if (!studentProfile) return;
    setLoading(true);
    try {
      const [attList, subList, ttList, subsList, noticeList] = await Promise.all([
        fetchStudentPrivateAttendance({
          studentUid: firebaseUser?.uid || studentProfile.uid,
          studentEmail: studentProfile.email,
        }),
        fetchSubjects(),
        fetchTimetable(studentProfile.classId),
        fetchSubstitutions({ classId: studentProfile.classId }),
        fetchNotices('student'),
      ]);
      setRecords(attList);
      setSubjects(subList.filter((s) => s.classId === studentProfile.classId && s.status === 'active'));
      setTimetable(ttList);
      setSubstitutions(subsList);
      setNotices(noticeList);
    } catch (err) {
      showToast(
        'Data Load Error',
        err instanceof Error ? err.message : 'Could not load student records.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [firebaseUser?.uid, showToast, studentProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const metrics = useMemo(() => calculateAttendanceMetrics(records), [records]);
  const todayRecords = useMemo(
    () => records.filter((r) => r.date === istNow.dateStr),
    [records, istNow.dateStr]
  );
  const todayMetrics = useMemo(() => calculateAttendanceMetrics(todayRecords), [todayRecords]);
  const subjectSummaries = useMemo(
    () => summarizeBySubject(records, subjects),
    [records, subjects]
  );

  // Current and upcoming period live resolution in Asia/Kolkata
  const currentPeriodInfo = useMemo(() => resolvePeriodFromTime(istNow.timeStr), [istNow.timeStr]);
  const upcomingPeriodInfo = useMemo(
    () => getUpcomingPeriodFromTime(istNow.timeStr),
    [istNow.timeStr]
  );

  const resolveSlotForPeriod = useCallback(
    (periodNum: number | undefined) => {
      if (!periodNum || !studentProfile || istNow.dayOfWeek === 'Sunday') return null;
      const entry = timetable.find(
        (t) =>
          t.status === 'active' &&
          t.dayOfWeek === (istNow.dayOfWeek as DayOfWeek) &&
          periodNum >= t.periodNumber &&
          periodNum <= t.endPeriodNumber
      );
      if (!entry) return null;
      const slot =
        entry.slots.find((s) => s.batch === studentProfile.batch) ||
        entry.slots.find((s) => s.batch === 'ALL') ||
        entry.slots[0];
      const activeSub = substitutions.find(
        (s) =>
          s.status === 'active' &&
          s.date === istNow.dateStr &&
          periodNum >= s.periodNumber &&
          periodNum <= s.endPeriodNumber &&
          (s.batch === 'ALL' || s.batch === studentProfile.batch)
      );
      return {
        entry,
        subjectName: activeSub ? activeSub.actualSubjectName : slot.subjectName,
        subjectShort: activeSub ? activeSub.actualSubjectName : slot.subjectShortName,
        facultyName: activeSub ? activeSub.actualFacultyName : slot.facultyName,
        classroom: activeSub ? activeSub.classroom : slot.classroom,
        isSubstituted: Boolean(activeSub),
      };
    },
    [istNow.dateStr, istNow.dayOfWeek, studentProfile, substitutions, timetable]
  );

  const currentClassSlot = useMemo(
    () => resolveSlotForPeriod(currentPeriodInfo?.period),
    [currentPeriodInfo?.period, resolveSlotForPeriod]
  );
  const upcomingClassSlot = useMemo(
    () => resolveSlotForPeriod(upcomingPeriodInfo?.period),
    [resolveSlotForPeriod, upcomingPeriodInfo?.period]
  );

  const filteredHistory = useMemo(() => {
    return records.filter((r) => (subjectFilter === 'ALL' ? true : r.subjectId === subjectFilter));
  }, [records, subjectFilter]);

  const rfidScans = useMemo(() => records.filter((r) => r.source === 'rfid').slice(0, 10), [records]);

  // Calendar day cells for selected month
  const calendarDays = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    if (!year || !month) return [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const cells: Array<{ day: number | null; dateStr?: string; present: number; absent: number }> = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ day: null, present: 0, absent: 0 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayRecs = records.filter((r) => r.date === dateStr);
      const present = dayRecs.filter((r) => r.status === 'present' || r.status === 'late').length;
      const absent = dayRecs.filter((r) => r.status === 'absent').length;
      cells.push({ day: d, dateStr, present, absent });
    }
    return cells;
  }, [calendarMonth, records]);

  if (!studentProfile) {
    return null;
  }

  const threshold = portalSettings.lowAttendanceThreshold || 75;
  const activeTabLabel = STUDENT_NAV.find((n) => n.id === activeTab)?.label || 'Overview';

  return (
    <SidebarLayout
      portalTitle="Student Portal"
      navItems={STUDENT_NAV}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      breadcrumbSection={`Student · ${activeTabLabel}`}
    >
      {/* Persistent Student Institutional Profile Header */}
      <section className="mb-5 rounded-lg border border-[#DDE6EE] bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {studentProfile.photoUrl || firebaseUser?.photoURL ? (
              <img
                src={studentProfile.photoUrl || firebaseUser?.photoURL || ''}
                alt={studentProfile.name}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-lg border border-[#DDE6EE] object-cover shrink-0"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[#BBE9FA] bg-[#ECFAFE] text-xl font-bold text-[#0F1E36] font-display">
                {studentProfile.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-[#0F1E36] font-display truncate">
                  {studentProfile.name}
                </h1>
                {studentProfile.isDemo && (
                  <span className="font-mono-data text-[11px] font-semibold text-amber-800">
                    DEMO DATA
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#5B6B80]">
                <span>
                  Roll No: <strong className="font-mono-data text-[#0F1E36]">{studentProfile.rollNumber}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Student ID: <strong className="font-mono-data text-[#0F1E36]">{studentProfile.studentId}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>{studentProfile.className}</span>
                <span aria-hidden="true">·</span>
                <span>
                  Batch <strong className="font-mono-data text-[#0284C7]">{studentProfile.batch}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-[#EEF3F7] text-xs shrink-0">
            <div>
              <div className="text-[11px] text-[#5B6B80]">Department</div>
              <div className="font-semibold text-[#0F1E36] truncate max-w-[140px]">
                {studentProfile.departmentName || 'AI&ML'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#5B6B80]">Semester / Sec</div>
              <div className="font-semibold text-[#0F1E36] font-mono-data">
                Sem {studentProfile.semester} · Sec {studentProfile.section}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#5B6B80]">Academic Year</div>
              <div className="font-semibold text-[#0F1E36] font-mono-data">
                {studentProfile.academicYear}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#5B6B80]">RFID Card UID</div>
              <div className="font-semibold text-[#0F1E36] font-mono-data">
                {studentProfile.rfidUid || 'Unassigned'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="space-y-5">
          <CardGridSkeleton count={5} />
          <TableSkeleton rows={5} cols={4} />
        </div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Low Attendance Alert */}
              {metrics.total > 0 && metrics.percentage < threshold && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Attendance Below {threshold}% Threshold:</span>{' '}
                    Your overall attendance is currently{' '}
                    <strong className="font-mono-data">{metrics.percentage}%</strong>. Please review subject-wise shortfalls below.
                  </div>
                </div>
              )}

              {/* KPI Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard
                  label="Overall Attendance"
                  value={metrics.total > 0 ? `${metrics.percentage}%` : '—'}
                  subtext={metrics.total > 0 ? `Target ≥ ${threshold}%` : 'No classes recorded yet'}
                  tone={
                    metrics.total === 0
                      ? 'default'
                      : metrics.percentage >= threshold
                      ? 'primary'
                      : 'danger'
                  }
                />
                <StatCard
                  label="Total Classes Conducted"
                  value={metrics.total}
                  subtext="Finalized periods"
                />
                <StatCard
                  label="Classes Attended"
                  value={metrics.present + metrics.late}
                  subtext={`Present: ${metrics.present} · Late: ${metrics.late}`}
                  tone="success"
                />
                <StatCard
                  label="Total Absences"
                  value={metrics.absent}
                  subtext="Recorded absences"
                  tone={metrics.absent > 0 ? 'warning' : 'default'}
                />
                <StatCard
                  label="Today's Attendance"
                  value={todayMetrics.total > 0 ? `${todayMetrics.present + todayMetrics.late}/${todayMetrics.total}` : '0/0'}
                  subtext={istNow.dateStr}
                />
              </div>

              {/* Current / Upcoming Schedule + Recent RFID Scans */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="lg:col-span-6 rounded-lg border border-[#DDE6EE] bg-white p-5">
                  <div className="flex items-center justify-between border-b border-[#EEF3F7] pb-3">
                    <h2 className="text-sm font-bold text-[#0F1E36] font-display">
                      Today&apos;s Live Schedule ({istNow.dayOfWeek})
                    </h2>
                    <span className="text-xs text-[#5B6B80] font-mono-data">{istNow.timeStr} IST</span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-md border border-[#DDE6EE] bg-[#F8FAFC] p-3.5">
                      <div className="text-[11px] font-medium text-[#5B6B80]">Current Period</div>
                      {currentClassSlot ? (
                        <>
                          <div className="mt-1 text-sm font-bold text-[#0F1E36]">
                            {currentClassSlot.subjectShort}
                          </div>
                          <div className="text-xs text-[#5B6B80] truncate">
                            {currentClassSlot.facultyName}
                          </div>
                          <div className="mt-1.5 text-[11px] font-mono-data text-[#0284C7]">
                            {currentPeriodInfo?.display} · Room {currentClassSlot.classroom}
                          </div>
                        </>
                      ) : (
                        <div className="mt-1.5 text-xs text-[#5B6B80]">
                          No active class period right now.
                        </div>
                      )}
                    </div>

                    <div className="rounded-md border border-[#DDE6EE] bg-[#F8FAFC] p-3.5">
                      <div className="text-[11px] font-medium text-[#5B6B80]">Upcoming Class</div>
                      {upcomingClassSlot ? (
                        <>
                          <div className="mt-1 text-sm font-bold text-[#0F1E36]">
                            {upcomingClassSlot.subjectShort}
                          </div>
                          <div className="text-xs text-[#5B6B80] truncate">
                            {upcomingClassSlot.facultyName}
                          </div>
                          <div className="mt-1.5 text-[11px] font-mono-data text-[#0F1E36]">
                            {upcomingPeriodInfo?.display} · Room {upcomingClassSlot.classroom}
                          </div>
                        </>
                      ) : (
                        <div className="mt-1.5 text-xs text-[#5B6B80]">
                          No remaining periods scheduled today.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 rounded-lg border border-[#DDE6EE] bg-white p-5">
                  <div className="flex items-center justify-between border-b border-[#EEF3F7] pb-3">
                    <h2 className="text-sm font-bold text-[#0F1E36] font-display">
                      Recent RFID &amp; Portal Scans
                    </h2>
                    <Radio className="h-4 w-4 text-[#0284C7]" />
                  </div>
                  {rfidScans.length === 0 ? (
                    <p className="mt-4 text-xs text-[#5B6B80]">
                      No RFID card scans recorded for your Roll Number yet.
                    </p>
                  ) : (
                    <div className="mt-3 divide-y divide-[#EEF3F7]">
                      {rfidScans.slice(0, 5).map((scan) => (
                        <div key={scan.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                          <div className="min-w-0">
                            <span className="font-semibold text-[#0F1E36]">{scan.subjectShortName}</span>
                            <span className="ml-2 text-[#5B6B80]">
                              Period {scan.period} · Room {scan.classroom}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0 font-mono-data text-[11px]">
                            <span className="text-[#5B6B80]">{scan.date}</span>
                            <span className="font-semibold text-emerald-700 uppercase">{scan.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Subject Grid */}
              <div className="rounded-lg border border-[#DDE6EE] bg-white p-5">
                <div className="flex items-center justify-between border-b border-[#EEF3F7] pb-3 mb-4">
                  <h2 className="text-sm font-bold text-[#0F1E36] font-display">
                    Subject-wise Attendance Summary
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('subjects')}
                    className="text-xs font-semibold text-[#0284C7] hover:underline"
                  >
                    View Detailed Cards &rarr;
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {subjectSummaries.map((sub) => {
                    const isLow = sub.total > 0 && sub.percentage < threshold;
                    return (
                      <div
                        key={sub.subjectId}
                        className={`rounded-md border p-3.5 ${
                          isLow ? 'border-red-200 bg-red-50/40' : 'border-[#DDE6EE] bg-[#FAFCFE]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#0F1E36]">{sub.subjectShortName}</div>
                            <div className="text-[11px] text-[#5B6B80] truncate" title={sub.subjectName}>
                              {sub.subjectName}
                            </div>
                          </div>
                          <span
                            className={`font-mono-data text-sm font-bold shrink-0 ${
                              isLow ? 'text-red-700' : 'text-[#0F1E36]'
                            }`}
                          >
                            {sub.total > 0 ? `${sub.percentage}%` : '—'}
                          </span>
                        </div>
                        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                          <div
                            className={`h-full ${isLow ? 'bg-red-500' : 'bg-[#03CAFC]'}`}
                            style={{ width: `${sub.total > 0 ? Math.min(100, sub.percentage) : 0}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-[#5B6B80] font-mono-data">
                          <span>Present: {sub.present + sub.late}</span>
                          <span>Absent: {sub.absent}</span>
                          <span>Total: {sub.total}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SUBJECTS TAB */}
          {activeTab === 'subjects' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {subjectSummaries.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon={BookOpen}
                    title="No Subjects Configured"
                    description="No active subjects were found for your class."
                  />
                </div>
              ) : (
                subjectSummaries.map((sub) => {
                  const isLow = sub.total > 0 && sub.percentage < threshold;
                  return (
                    <div
                      key={sub.subjectId}
                      className={`rounded-lg border bg-white p-5 ${
                        isLow ? 'border-red-300' : 'border-[#DDE6EE]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-[#0284C7] font-mono-data">
                            {sub.subjectShortName}
                          </div>
                          <h3 className="mt-0.5 text-sm font-bold text-[#0F1E36] leading-snug">
                            {sub.subjectName}
                          </h3>
                        </div>
                        <div
                          className={`text-xl font-bold font-mono-data ${
                            isLow ? 'text-red-700' : 'text-[#0F1E36]'
                          }`}
                        >
                          {sub.total > 0 ? `${sub.percentage}%` : '—'}
                        </div>
                      </div>

                      <div className="mt-4 h-2 w-full overflow-hidden rounded-sm bg-[#EEF3F7]">
                        <div
                          className={`h-full ${isLow ? 'bg-red-500' : 'bg-[#03CAFC]'}`}
                          style={{ width: `${sub.total > 0 ? Math.min(100, sub.percentage) : 0}%` }}
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#EEF3F7] pt-3 text-center text-xs">
                        <div>
                          <div className="text-[11px] text-[#5B6B80]">Present</div>
                          <div className="mt-0.5 font-bold text-emerald-700 font-mono-data">
                            {sub.present + sub.late}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#5B6B80]">Absent</div>
                          <div className="mt-0.5 font-bold text-red-700 font-mono-data">{sub.absent}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#5B6B80]">Total</div>
                          <div className="mt-0.5 font-bold text-[#0F1E36] font-mono-data">{sub.total}</div>
                        </div>
                      </div>

                      {isLow && (
                        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Below {threshold}% requirement</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* HISTORY & CALENDAR TAB */}
          {activeTab === 'history' && (
            <div className="space-y-5">
              {/* Attendance Calendar */}
              <div className="rounded-lg border border-[#DDE6EE] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF3F7] pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#0F1E36] font-display">
                      Monthly Attendance Calendar
                    </h2>
                    <p className="text-xs text-[#5B6B80]">
                      Daily count of Present (P) and Absent (A) periods
                    </p>
                  </div>
                  <input
                    type="month"
                    value={calendarMonth}
                    onChange={(e) => setCalendarMonth(e.target.value)}
                    className="rounded-md border border-[#DDE6EE] bg-white px-3 py-1.5 text-xs font-mono-data text-[#0F1E36]"
                  />
                </div>
                <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-[#5B6B80]">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1.5">
                  {calendarDays.map((cell, idx) =>
                    cell.day === null ? (
                      <div key={`empty_${idx}`} className="h-14 rounded bg-[#F8FAFC]" />
                    ) : (
                      <div
                        key={cell.dateStr}
                        className={`flex h-14 flex-col justify-between rounded border p-1.5 text-xs ${
                          cell.present > 0 && cell.absent === 0
                            ? 'border-emerald-200 bg-emerald-50/50'
                            : cell.absent > 0
                            ? 'border-amber-200 bg-amber-50/50'
                            : 'border-[#EEF3F7] bg-white'
                        }`}
                      >
                        <span className="font-mono-data text-[11px] font-semibold text-[#0F1E36]">
                          {cell.day}
                        </span>
                        {(cell.present > 0 || cell.absent > 0) && (
                          <span className="font-mono-data text-[10px]">
                            {cell.present > 0 && (
                              <span className="text-emerald-700 font-semibold">P:{cell.present} </span>
                            )}
                            {cell.absent > 0 && (
                              <span className="text-red-700 font-semibold">A:{cell.absent}</span>
                            )}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Date-wise & Subject-wise Table */}
              <div className="rounded-lg border border-[#DDE6EE] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DDE6EE] px-4 py-3">
                  <h2 className="text-sm font-bold text-[#0F1E36] font-display">
                    Detailed Attendance Log
                  </h2>
                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="rounded-md border border-[#DDE6EE] bg-white px-3 py-1.5 text-xs text-[#0F1E36]"
                  >
                    <option value="ALL">All Subjects</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shortName} · {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={CheckCircle2}
                      title="No Attendance Records Found"
                      description="Your RFID card scans and manual class attendance entries will appear here once sessions are recorded."
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
                          <th className="px-4 py-2.5 font-semibold">Date</th>
                          <th className="px-4 py-2.5 font-semibold">Period</th>
                          <th className="px-4 py-2.5 font-semibold">Subject</th>
                          <th className="px-4 py-2.5 font-semibold">Classroom</th>
                          <th className="px-4 py-2.5 font-semibold">Source</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF3F7]">
                        {filteredHistory.map((r) => (
                          <tr key={r.id} className="hover:bg-[#FAFCFE]">
                            <td className="px-4 py-2.5 font-mono-data text-[#0F1E36]">{r.date}</td>
                            <td className="px-4 py-2.5 font-mono-data text-[#5B6B80]">P-{r.period}</td>
                            <td className="px-4 py-2.5">
                              <span className="font-semibold text-[#0F1E36]">{r.subjectShortName}</span>
                              <span className="ml-1.5 text-[#5B6B80]">{r.subjectName}</span>
                            </td>
                            <td className="px-4 py-2.5 font-mono-data text-[#5B6B80]">{r.classroom}</td>
                            <td className="px-4 py-2.5 uppercase font-mono-data text-[11px] text-[#5B6B80]">
                              {r.source}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-data font-semibold">
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TIMETABLE TAB */}
          {activeTab === 'timetable' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DDE6EE] bg-white px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-[#0F1E36] font-display">
                    {studentProfile.className} · Weekly Timetable (Filtered for Batch {studentProfile.batch})
                  </h2>
                  <p className="text-xs text-[#5B6B80]">
                    Includes any temporary subject or faculty substitutions for the selected date.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#5B6B80]">Check Date:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-md border border-[#DDE6EE] bg-white px-3 py-1.5 text-xs font-mono-data text-[#0F1E36]"
                  />
                </div>
              </div>

              <TimetableGrid
                entries={timetable}
                substitutions={substitutions}
                selectedDate={selectedDate}
                studentBatch={studentProfile.batch}
              />
            </div>
          )}

          {/* NOTICES TAB */}
          {activeTab === 'notices' && (
            <div className="space-y-3">
              {notices.length === 0 ? (
                <EmptyState
                  icon={Megaphone}
                  title="No Notices Published"
                  description="Academic announcements and timetable notices from the college administration will appear here."
                />
              ) : (
                notices.map((n) => (
                  <article key={n.id} className="rounded-lg border border-[#DDE6EE] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#0F1E36]">{n.title}</h3>
                      <span className="text-[11px] font-mono-data uppercase text-[#0284C7]">
                        {n.category}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#5B6B80] leading-relaxed whitespace-pre-line">
                      {n.body}
                    </p>
                    <div className="mt-3 text-[11px] text-[#5B6B80]">Published by {n.authorName}</div>
                  </article>
                ))
              )}
            </div>
          )}
        </>
      )}
    </SidebarLayout>
  );
}
