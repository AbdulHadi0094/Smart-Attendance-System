import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  BarChart3,
  Cpu,
  Megaphone,
  Settings,
  Database,
} from 'lucide-react';
import { SidebarLayout, NavItem } from '../components/ui/SidebarLayout';
import { StatCard } from '../components/ui/StatCard';
import { CardGridSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { DailyAttendanceTrendChart, SubjectDistributionBars } from '../components/ui/AttendanceCharts';
import {
  AdminFacultyTab,
  AdminStudentsTab,
  AdminSubjectsAndClassesTab,
} from '../components/admin/AdminDirectoryTabs';
import {
  AdminAttendanceTab,
  AdminTimetableTab,
} from '../components/admin/AdminTimetableAndAttendanceTabs';
import {
  AdminDevicesTab,
  AdminLogsAndSettingsTab,
  AdminNoticesAndRequestsTab,
  AdminReportsTab,
} from '../components/admin/AdminDevicesReportsSettingsTabs';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getISTParts } from '../constants/timetable';
import {
  fetchClasses,
  fetchDepartments,
  fetchSubjects,
  initializeMcetCurriculum,
} from '../services/academicService';
import {
  calculateAttendanceMetrics,
  fetchAttendanceRecords,
  summarizeBySubject,
} from '../services/attendanceService';
import { fetchActivityLogs, fetchNotices } from '../services/auditNoticeService';
import { fetchAccessRequests } from '../services/authService';
import { fetchDevices, fetchDeviceScans } from '../services/deviceService';
import { fetchFacultyList } from '../services/facultyService';
import { buildDailyTrend } from '../services/reportService';
import { fetchStudents } from '../services/studentService';
import { fetchSubstitutions } from '../services/substitutionService';
import { fetchTimetable } from '../services/timetableService';
import {
  AcademicClass,
  AccessRequest,
  ActivityLog,
  AttendanceRecord,
  Department,
  DeviceScanEvent,
  Faculty,
  Notice,
  RfidDevice,
  Student,
  Subject,
  Substitution,
  TimetableEntry,
} from '../types/erp';

const ADMIN_NAV: NavItem[] = [
  { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
  { id: 'students', label: 'Student Management', icon: Users },
  { id: 'faculty', label: 'Faculty Management', icon: UserCheck },
  { id: 'academics', label: 'Subjects & Classes', icon: BookOpen },
  { id: 'timetable', label: 'Timetable & Substitutions', icon: CalendarClock },
  { id: 'attendance', label: 'Attendance Records', icon: ClipboardCheck },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { id: 'devices', label: 'RFID Devices & ESP32', icon: Cpu },
  { id: 'notices', label: 'Notices & Access Requests', icon: Megaphone },
  { id: 'settings', label: 'Logs & Portal Settings', icon: Settings },
];

export default function AdminDashboard() {
  const { firebaseUser, userAccount, portalSettings, refreshPortalSettings } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [devices, setDevices] = useState<RfidDevice[]>([]);
  const [deviceScans, setDeviceScans] = useState<DeviceScanEvent[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);

  const actor = useMemo(
    () => ({
      uid: firebaseUser?.uid || '',
      name: userAccount?.displayName || firebaseUser?.displayName || 'System Administrator',
      email: firebaseUser?.email || '',
    }),
    [firebaseUser?.displayName, firebaseUser?.email, firebaseUser?.uid, userAccount?.displayName]
  );

  const loadAllData = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const [
        depts,
        cls,
        subs,
        stus,
        facs,
        tt,
        subOverrides,
        atts,
        devs,
        scans,
        logs,
        nots,
        reqs,
      ] = await Promise.all([
        fetchDepartments(),
        fetchClasses(),
        fetchSubjects(),
        fetchStudents(),
        fetchFacultyList(),
        fetchTimetable(),
        fetchSubstitutions(),
        fetchAttendanceRecords({ maxResults: 1000 }),
        fetchDevices(),
        fetchDeviceScans(),
        fetchActivityLogs({ role: 'admin', uid: firebaseUser.uid, maxResults: 100 }),
        fetchNotices('admin'),
        fetchAccessRequests(),
      ]);
      setDepartments(depts);
      setClasses(cls);
      setSubjects(subs);
      setStudents(stus);
      setFacultyList(facs);
      setTimetable(tt);
      setSubstitutions(subOverrides);
      setAttendance(atts);
      setDevices(devs);
      setDeviceScans(scans);
      setActivityLogs(logs);
      setNotices(nots);
      setAccessRequests(reqs);
    } catch (err) {
      showToast(
        'Admin Load Error',
        err instanceof Error ? err.message : 'Unable to load portal data.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, showToast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const istNow = useMemo(() => getISTParts(new Date()), []);
  const overallMetrics = useMemo(() => calculateAttendanceMetrics(attendance), [attendance]);
  const todayRecords = useMemo(
    () => attendance.filter((r) => r.date === istNow.dateStr),
    [attendance, istNow.dateStr]
  );
  const todayMetrics = useMemo(() => calculateAttendanceMetrics(todayRecords), [todayRecords]);
  const dailyTrend = useMemo(() => buildDailyTrend(attendance, 10), [attendance]);
  const subjectSummaries = useMemo(
    () => summarizeBySubject(attendance, subjects),
    [attendance, subjects]
  );
  const onlineDevicesCount = useMemo(
    () => devices.filter((d) => d.connectionStatus === 'online' && d.status === 'active').length,
    [devices]
  );

  const sharedProps = {
    actor,
    departments,
    classes,
    subjects,
    students,
    facultyList,
    timetable,
    substitutions,
    attendance,
    devices,
    deviceScans,
    activityLogs,
    notices,
    accessRequests,
    onRefresh: loadAllData,
  };

  const activeTabLabel = ADMIN_NAV.find((n) => n.id === activeTab)?.label || 'Overview';

  return (
    <SidebarLayout
      portalTitle="Administrator ERP"
      navItems={ADMIN_NAV}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      breadcrumbSection={`Admin · ${activeTabLabel}`}
    >
      {loading ? (
        <div className="space-y-5">
          <CardGridSkeleton count={4} />
          <TableSkeleton rows={6} cols={5} />
        </div>
      ) : (
        <>
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* First-time MCET Curriculum Setup Callout */}
              {classes.length === 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#BBE9FA] bg-[#ECFAFE] p-4">
                  <div className="flex items-start gap-3">
                    <Database className="h-5 w-5 text-[#0284C7] shrink-0 mt-0.5" />
                    <div>
                      <h2 className="text-sm font-bold text-[#0F1E36]">
                        Initialize Official MCET AI&amp;ML Curriculum &amp; Timetable
                      </h2>
                      <p className="mt-0.5 text-xs text-[#5B6B80]">
                        Firestore is connected. Click once to populate {portalSettings.shortName} Department of AI&amp;ML, Class III Semester BE AI&amp;ML - A, faculty roster, subjects, and the Monday–Saturday timetable.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await initializeMcetCurriculum(actor);
                      await refreshPortalSettings();
                      await loadAllData();
                      showToast('MCET Timetable Initialized', 'Ready for student & device management.', 'success');
                    }}
                    className="rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36] hover:bg-[#02B3E0] whitespace-nowrap"
                  >
                    Initialize MCET Data
                  </button>
                </div>
              )}

              {/* Primary KPI Strip */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Students"
                  value={students.filter((s) => s.status === 'active').length}
                  subtext={`${students.length} total registered`}
                />
                <StatCard
                  label="Total Faculty"
                  value={facultyList.filter((f) => f.status === 'active').length}
                  subtext={`${classes.length} active class(es) · ${subjects.length} subjects`}
                />
                <StatCard
                  label="Today's Attendance"
                  value={todayMetrics.total > 0 ? `${todayMetrics.percentage}%` : '—'}
                  subtext={`Present: ${todayMetrics.present + todayMetrics.late} · Absent: ${todayMetrics.absent}`}
                  tone="primary"
                />
                <StatCard
                  label="Overall Attendance"
                  value={overallMetrics.total > 0 ? `${overallMetrics.percentage}%` : '—'}
                  subtext={`Connected RFID Readers: ${onlineDevicesCount}/${devices.length}`}
                  tone={overallMetrics.total > 0 && overallMetrics.percentage >= 75 ? 'success' : 'default'}
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="lg:col-span-6 rounded-lg border border-[#DDE6EE] bg-white p-5">
                  <h2 className="text-sm font-bold text-[#0F1E36] font-display mb-3">
                    Daily Attendance Trend
                  </h2>
                  <DailyAttendanceTrendChart data={dailyTrend} />
                </div>
                <div className="lg:col-span-6 rounded-lg border border-[#DDE6EE] bg-white p-5">
                  <h2 className="text-sm font-bold text-[#0F1E36] font-display mb-3">
                    Subject-wise Attendance Overview
                  </h2>
                  <SubjectDistributionBars
                    summaries={subjectSummaries}
                    threshold={portalSettings.lowAttendanceThreshold}
                  />
                </div>
              </div>

              {/* Recent Activity */}
              <div className="rounded-lg border border-[#DDE6EE] bg-white">
                <div className="flex items-center justify-between border-b border-[#DDE6EE] px-4 py-3">
                  <h2 className="text-sm font-bold text-[#0F1E36] font-display">Recent Administrative Activity</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="text-xs font-semibold text-[#0284C7] hover:underline"
                  >
                    Full Audit Log &rarr;
                  </button>
                </div>
                {activityLogs.length === 0 ? (
                  <div className="p-5 text-xs text-[#5B6B80]">No activity logs recorded yet.</div>
                ) : (
                  <div className="divide-y divide-[#EEF3F7]">
                    {activityLogs.slice(0, 8).map((log) => (
                      <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
                        <div>
                          <span className="font-semibold text-[#0F1E36]">{log.action}</span>
                          <span className="ml-2 text-[#5B6B80]">· {log.targetLabel}</span>
                        </div>
                        <div className="font-mono-data text-[11px] text-[#5B6B80]">
                          {log.performedByName} · {log.category.toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'students' && <AdminStudentsTab {...sharedProps} />}
          {activeTab === 'faculty' && <AdminFacultyTab {...sharedProps} />}
          {activeTab === 'academics' && <AdminSubjectsAndClassesTab {...sharedProps} />}
          {activeTab === 'timetable' && <AdminTimetableTab {...sharedProps} />}
          {activeTab === 'attendance' && <AdminAttendanceTab {...sharedProps} />}
          {activeTab === 'reports' && <AdminReportsTab {...sharedProps} />}
          {activeTab === 'devices' && <AdminDevicesTab {...sharedProps} />}
          {activeTab === 'notices' && <AdminNoticesAndRequestsTab {...sharedProps} />}
          {activeTab === 'settings' && <AdminLogsAndSettingsTab {...sharedProps} />}
        </>
      )}
    </SidebarLayout>
  );
}
