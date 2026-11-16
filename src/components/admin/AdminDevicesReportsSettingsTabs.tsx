import React, { useEffect, useMemo, useState } from 'react';
import {
  Cpu,
  Download,
  Plus,
  Power,
  Trash2,
  WifiOff,
  CheckCircle2,
  X,
  Code2,
  Send,
  Shield,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { DailyAttendanceTrendChart, SubjectDistributionBars } from '../../components/ui/AttendanceCharts';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { StatCard } from '../../components/ui/StatCard';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getISTParts } from '../../constants/timetable';
import {
  initializeMcetCurriculum,
  seedDemoStudentsAndDevice,
} from '../../services/academicService';
import { summarizeBySubject } from '../../services/attendanceService';
import { createNotice, deleteNotice } from '../../services/auditNoticeService';
import { updateAccessRequestStatus } from '../../services/authService';
import {
  deleteDevice,
  generateEsp32FirmwareSnippet,
  saveDevice,
  simulateAdminRfidScan,
  SimulationScanResult,
  toggleDeviceStatus,
} from '../../services/deviceService';
import {
  buildClassWiseReport,
  buildDailyTrend,
  buildFacultyWiseReport,
  buildStudentWiseReport,
  downloadCsv,
  filterRecordsByPeriodRange,
} from '../../services/reportService';
import {
  addAuthorizedAdmin,
  AdminRecord,
  listAdmins,
  removeAuthorizedAdmin,
  savePortalSettings,
} from '../../services/settingsService';
import {
  AcademicClass,
  AccessRequest,
  ActivityLog,
  AttendanceRecord,
  DeviceScanEvent,
  Faculty,
  Notice,
  PortalSettings,
  RfidDevice,
  Student,
  Subject,
  Substitution,
  TimetableEntry,
} from '../../types/erp';

interface AdminExtraProps {
  actor: { uid: string; name: string; email: string };
  classes: AcademicClass[];
  subjects: Subject[];
  facultyList: Faculty[];
  students: Student[];
  timetable: TimetableEntry[];
  substitutions: Substitution[];
  attendance: AttendanceRecord[];
  devices: RfidDevice[];
  deviceScans: DeviceScanEvent[];
  activityLogs: ActivityLog[];
  notices: Notice[];
  accessRequests: AccessRequest[];
  onRefresh: () => Promise<void>;
}

export function AdminReportsTab({
  classes,
  subjects,
  facultyList,
  students,
  attendance,
}: AdminExtraProps) {
  const { portalSettings } = useAuth();
  const istNow = useMemo(() => getISTParts(new Date()), []);
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('all');
  const [anchorDate, setAnchorDate] = useState(istNow.dateStr);
  const [viewMode, setViewMode] = useState<'subject' | 'student' | 'faculty' | 'class'>('subject');

  const scopedRecords = useMemo(
    () => filterRecordsByPeriodRange(attendance, range, anchorDate),
    [anchorDate, attendance, range]
  );

  const subjectRows = useMemo(
    () => summarizeBySubject(scopedRecords, subjects),
    [scopedRecords, subjects]
  );
  const studentRows = useMemo(
    () => buildStudentWiseReport(scopedRecords, students),
    [scopedRecords, students]
  );
  const facultyRows = useMemo(
    () => buildFacultyWiseReport(scopedRecords, facultyList),
    [facultyList, scopedRecords]
  );
  const classRows = useMemo(() => buildClassWiseReport(scopedRecords), [scopedRecords]);
  const dailyTrend = useMemo(() => buildDailyTrend(scopedRecords, 14), [scopedRecords]);

  const lowestSubjects = useMemo(
    () =>
      subjectRows
        .filter((s) => s.total > 0 && s.percentage < (portalSettings.lowAttendanceThreshold || 75))
        .sort((a, b) => a.percentage - b.percentage),
    [portalSettings.lowAttendanceThreshold, subjectRows]
  );

  const handleExport = () => {
    if (viewMode === 'student') {
      downloadCsv(
        `MCET_Student_Report_${range}_${anchorDate}.csv`,
        ['Roll No', 'Student ID', 'Name', 'Class', 'Batch', 'Present', 'Late', 'Absent', 'Total', 'Percentage'],
        studentRows.map((r) => [r.rollNumber, r.studentId, r.name, r.className, r.batch, r.present, r.late, r.absent, r.total, `${r.percentage}%`])
      );
    } else if (viewMode === 'subject') {
      downloadCsv(
        `MCET_Subject_Report_${range}_${anchorDate}.csv`,
        ['Code/Short', 'Subject Name', 'Present', 'Late', 'Absent', 'Total', 'Percentage'],
        subjectRows.map((r) => [r.subjectShortName, r.subjectName, r.present, r.late, r.absent, r.total, `${r.percentage}%`])
      );
    } else if (viewMode === 'faculty') {
      downloadCsv(
        `MCET_Faculty_Report_${range}_${anchorDate}.csv`,
        ['Faculty Name', 'Sessions Conducted', 'Present Marks', 'Absent Marks', 'Percentage'],
        facultyRows.map((r) => [r.facultyName, r.sessionsCount, r.presentCount, r.absentCount, `${r.percentage}%`])
      );
    } else {
      downloadCsv(
        `MCET_Class_Report_${range}_${anchorDate}.csv`,
        ['Class', 'Present', 'Absent', 'Total', 'Percentage'],
        classRows.map((r) => [r.className, r.present, r.absent, r.total, `${r.percentage}%`])
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DDE6EE] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-[#DDE6EE] bg-[#F8FAFC] p-0.5">
            {(['daily', 'weekly', 'monthly', 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize ${
                  range === r ? 'bg-white text-[#0F1E36] shadow-sm font-semibold' : 'text-[#5B6B80]'
                }`}
              >
                {r === 'all' ? 'All Time' : r}
              </button>
            ))}
          </div>
          {range !== 'all' && (
            <input
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs font-mono-data"
            />
          )}
          <div className="flex rounded-md border border-[#DDE6EE] bg-[#F8FAFC] p-0.5">
            {(['subject', 'student', 'faculty', 'class'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize ${
                  viewMode === m ? 'bg-white text-[#0F1E36] shadow-sm font-semibold' : 'text-[#5B6B80]'
                }`}
              >
                {m}-wise
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#03CAFC] px-3.5 py-2 text-xs font-semibold text-[#0F1E36] hover:bg-[#02B3E0]"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export CSV / Excel</span>
        </button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-6 rounded-lg border border-[#DDE6EE] bg-white p-5">
          <h3 className="text-sm font-bold text-[#0F1E36] font-display mb-3">Attendance Trend</h3>
          <DailyAttendanceTrendChart data={dailyTrend} />
        </div>
        <div className="lg:col-span-6 rounded-lg border border-[#DDE6EE] bg-white p-5">
          <h3 className="text-sm font-bold text-[#0F1E36] font-display mb-3">
            Subject-wise Attendance ({classes[0]?.name || 'All Classes'})
          </h3>
          <SubjectDistributionBars
            summaries={subjectRows}
            threshold={portalSettings.lowAttendanceThreshold}
          />
        </div>
      </div>

      {lowestSubjects.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Lowest Attendance Subjects (&lt; {portalSettings.lowAttendanceThreshold}%):</strong>{' '}
            {lowestSubjects.map((s) => `${s.subjectShortName} (${s.percentage}%)`).join(', ')}
          </div>
        </div>
      )}

      {/* Breakdown Table */}
      <div className="rounded-lg border border-[#DDE6EE] bg-white overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
              {viewMode === 'subject' && (
                <>
                  <th className="px-4 py-2.5 font-semibold">Subject</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Present</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Absent</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Total</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Percentage</th>
                </>
              )}
              {viewMode === 'student' && (
                <>
                  <th className="px-4 py-2.5 font-semibold">Roll No</th>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Batch</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Present</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Absent</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Percentage</th>
                </>
              )}
              {viewMode === 'faculty' && (
                <>
                  <th className="px-4 py-2.5 font-semibold">Faculty Name</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Sessions</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Present</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Absent</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Rate</th>
                </>
              )}
              {viewMode === 'class' && (
                <>
                  <th className="px-4 py-2.5 font-semibold">Class</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Present</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Absent</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Total</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Rate</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF3F7]">
            {viewMode === 'subject' &&
              subjectRows.map((r) => (
                <tr key={r.subjectId}>
                  <td className="px-4 py-2.5"><strong>{r.subjectShortName}</strong> · {r.subjectName}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data text-emerald-700">{r.present + r.late}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data text-red-700">{r.absent}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data">{r.total}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data font-bold">{r.total > 0 ? `${r.percentage}%` : '—'}</td>
                </tr>
              ))}
            {viewMode === 'student' &&
              studentRows.map((r) => (
                <tr key={r.studentDocId}>
                  <td className="px-4 py-2.5 font-mono-data font-semibold">{r.rollNumber}</td>
                  <td className="px-4 py-2.5">{r.name}</td>
                  <td className="px-4 py-2.5 font-mono-data">{r.batch}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data text-emerald-700">{r.present + r.late}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data text-red-700">{r.absent}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data font-bold">{r.total > 0 ? `${r.percentage}%` : '—'}</td>
                </tr>
              ))}
            {viewMode === 'faculty' &&
              facultyRows.map((r) => (
                <tr key={r.facultyId}>
                  <td className="px-4 py-2.5 font-medium">{r.facultyName}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data">{r.sessionsCount}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data text-emerald-700">{r.presentCount}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data text-red-700">{r.absentCount}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data font-bold">{r.presentCount + r.absentCount > 0 ? `${r.percentage}%` : '—'}</td>
                </tr>
              ))}
            {viewMode === 'class' &&
              classRows.map((r) => (
                <tr key={r.classId}>
                  <td className="px-4 py-2.5 font-medium">{r.className}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data text-emerald-700">{r.present}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data text-red-700">{r.absent}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data">{r.total}</td>
                  <td className="px-4 py-2.5 text-right font-mono-data font-bold">{r.total > 0 ? `${r.percentage}%` : '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminDevicesTab({
  actor,
  classes,
  students,
  timetable,
  substitutions,
  devices,
  deviceScans,
  onRefresh,
}: AdminExtraProps) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState<Partial<RfidDevice> | null>(null);
  const [deleting, setDeleting] = useState<RfidDevice | null>(null);
  const [backendStatus, setBackendStatus] = useState<{
    firebaseAdminReady: boolean;
    deviceSecretConfigured: boolean;
    note: string;
  } | null>(null);

  // Admin Hardware Verification / Offline Sync Test Console
  const [testDeviceId, setTestDeviceId] = useState(devices[0]?.deviceId || '');
  const [testRfidUid, setTestRfidUid] = useState(students[0]?.rfidUid || '');
  const [testDateTime, setTestDateTime] = useState(() => {
    const now = new Date();
    const ist = getISTParts(now);
    return `${ist.dateStr}T${ist.timeStr}`;
  });
  const [testOfflineMode, setTestOfflineMode] = useState(false);
  const [testEventId, setTestEventId] = useState(`TEST_EVT_${Date.now().toString(36)}`);
  const [lcdOutput, setLcdOutput] = useState<SimulationScanResult | null>(null);
  const [showFirmware, setShowFirmware] = useState(false);

  useEffect(() => {
    fetch('/api/esp32/health')
      .then((r) => r.json())
      .then(setBackendStatus)
      .catch(() => {});
  }, []);

  const handleRunTestScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const dev = devices.find((d) => d.deviceId === (testDeviceId || devices[0]?.deviceId));
    if (!dev) {
      showToast('No Device Selected', 'Please register an ESP32 device node first.', 'warning');
      return;
    }
    const scanDate = new Date(`${testDateTime}:00+05:30`);
    const result = await simulateAdminRfidScan({
      device: dev,
      rfidUid: testRfidUid,
      scanDate,
      eventId: testEventId,
      offlineBuffered: testOfflineMode,
      students,
      timetable,
      substitutions,
      actor,
    });
    setLcdOutput(result);
    showToast(`Test Scan: ${result.status}`, result.message, result.status === 'MARKED' ? 'success' : 'warning');
    await onRefresh();
  };

  return (
    <div className="space-y-5">
      {/* Honest Hardware & Server Readiness Banner */}
      <div className="rounded-lg border border-[#DDE6EE] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#0F1E36] font-display">
              ESP32 Hardware &amp; Ingestion Server Status
            </h2>
            <p className="text-xs text-[#5B6B80]">
              Physical ESP32 nodes connect securely over HTTPS to <code className="font-mono-data text-[#0F1E36]">POST /api/esp32/scan</code> and <code className="font-mono-data text-[#0F1E36]">/api/esp32/sync-batch</code> using <code className="font-mono-data">x-device-secret</code> (never storing Firebase Admin keys on ESP32).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowFirmware((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-semibold text-[#0F1E36] hover:border-[#03CAFC]"
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>{showFirmware ? 'Hide ESP32 Firmware' : 'View ESP32 Arduino Code'}</span>
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded border border-[#DDE6EE] bg-[#F8FAFC] px-3 py-2">
            <span className="text-[#5B6B80]">Server Firebase Admin SDK:</span>{' '}
            <strong className={backendStatus?.firebaseAdminReady ? 'text-emerald-700' : 'text-amber-700'}>
              {backendStatus?.firebaseAdminReady ? 'Configured' : 'Pending Server Secret'}
            </strong>
          </div>
          <div className="rounded border border-[#DDE6EE] bg-[#F8FAFC] px-3 py-2">
            <span className="text-[#5B6B80]">ESP32_DEVICE_KEY:</span>{' '}
            <strong className={backendStatus?.deviceSecretConfigured ? 'text-emerald-700' : 'text-amber-700'}>
              {backendStatus?.deviceSecretConfigured ? 'Configured' : 'Pending Env Var'}
            </strong>
          </div>
          <div className="rounded border border-[#DDE6EE] bg-[#F8FAFC] px-3 py-2">
            <span className="text-[#5B6B80]">Registered Nodes:</span>{' '}
            <strong className="font-mono-data text-[#0F1E36]">{devices.length}</strong>
          </div>
        </div>

        {showFirmware && (
          <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-[#DDE6EE] bg-[#0F1E36] p-3 text-[11px] font-mono-data text-slate-100">
            {generateEsp32FirmwareSnippet(
              window.location.origin,
              devices[0]?.deviceId || 'ESP32_LH_E_303'
            )}
          </pre>
        )}
      </div>

      {/* Device Inventory */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0F1E36] font-display">Registered Classroom RFID Nodes</h3>
          <button
            type="button"
            onClick={() =>
              setEditing({
                deviceId: 'ESP32_ROOM_',
                name: '',
                classroom: 'LH-E-303',
                assignedClassId: classes[0]?.id || '',
                assignedClassName: classes[0]?.name || '',
                status: 'active',
                connectionStatus: 'unconfigured',
                pendingUploads: 0,
                firmwareVersion: '1.0.0-rc522',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-[#03CAFC] px-3.5 py-2 text-xs font-semibold text-[#0F1E36]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Register ESP32 Node</span>
          </button>
        </div>

        <div className="rounded-lg border border-[#DDE6EE] bg-white overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
                <th className="px-4 py-2.5 font-semibold">Device ID</th>
                <th className="px-4 py-2.5 font-semibold">Classroom &amp; Class</th>
                <th className="px-4 py-2.5 font-semibold">Connection</th>
                <th className="px-4 py-2.5 font-semibold">Pending Uploads</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F7]">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[#5B6B80]">
                    No ESP32 RFID devices registered yet.
                  </td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2.5 font-mono-data font-bold text-[#0F1E36]">
                      <div>{d.deviceId}</div>
                      <div className="font-normal text-[11px] text-[#5B6B80]">{d.name}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-mono-data font-semibold">Room {d.classroom}</div>
                      <div className="text-[11px] text-[#5B6B80]">{d.assignedClassName}</div>
                    </td>
                    <td className="px-4 py-2.5 font-mono-data text-[11px] uppercase">
                      <span
                        className={
                          d.connectionStatus === 'online'
                            ? 'text-emerald-700 font-semibold'
                            : d.connectionStatus === 'offline'
                            ? 'text-red-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        {d.connectionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono-data">{d.pendingUploads}</td>
                    <td className="px-4 py-2.5 font-mono-data uppercase text-[11px]">
                      {d.status}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            toggleDeviceStatus(d, d.status === 'active' ? 'inactive' : 'active', actor).then(onRefresh)
                          }
                          className="rounded border border-[#DDE6EE] p-1 text-[#5B6B80] hover:text-[#0F1E36]"
                          title="Toggle Active Status"
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(d)}
                          className="rounded border border-[#DDE6EE] p-1 text-red-600"
                          title="Remove Device"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hardware Test & Offline Sync Verification Console */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <form
          onSubmit={handleRunTestScan}
          className="lg:col-span-7 rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-[#EEF3F7] pb-2.5">
            <h3 className="text-sm font-bold text-[#0F1E36] font-display">
              Hardware Scan &amp; Offline Sync Test Console (Admin Verification)
            </h3>
            <span className="font-mono-data text-[10px] font-semibold text-amber-800">
              TEST MODE
            </span>
          </div>
          <p className="text-xs text-[#5B6B80]">
            Verifies automatic timetable lookup, batch split resolution, substitution override, and idempotent offline event ID deduplication before flashing physical ESP32 hardware.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#5B6B80] mb-1">Device Node</label>
              <select
                value={testDeviceId || devices[0]?.deviceId || ''}
                onChange={(e) => setTestDeviceId(e.target.value)}
                className="w-full rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs font-mono-data"
              >
                {devices.map((d) => <option key={d.id} value={d.deviceId}>{d.deviceId} ({d.classroom})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#5B6B80] mb-1">RFID Card UID</label>
              <input
                type="text"
                required
                value={testRfidUid}
                onChange={(e) => setTestRfidUid(e.target.value)}
                placeholder="e.g. DEMO_04A1B2C6"
                className="w-full rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs font-mono-data uppercase"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#5B6B80] mb-1">Scan Timestamp (IST)</label>
              <input
                type="datetime-local"
                value={testDateTime}
                onChange={(e) => setTestDateTime(e.target.value)}
                className="w-full rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs font-mono-data"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#5B6B80] mb-1">Unique Event ID (Idempotency)</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  required
                  value={testEventId}
                  onChange={(e) => setTestEventId(e.target.value)}
                  className="flex-1 rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs font-mono-data"
                />
                <button
                  type="button"
                  onClick={() => setTestEventId(`TEST_EVT_${Date.now().toString(36)}`)}
                  className="rounded border border-[#DDE6EE] px-2 text-[11px]"
                >
                  New
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-[#0F1E36]">
              <input
                type="checkbox"
                checked={testOfflineMode}
                onChange={(e) => setTestOfflineMode(e.target.checked)}
              />
              <span>Simulate Offline Buffered Upload (Re-run same Event ID to verify dedup)</span>
            </label>
            <button
              type="submit"
              className="rounded-md bg-[#0F1E36] px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Simulate Scan
            </button>
          </div>
        </form>

        {/* 16x2 LCD Display Preview */}
        <div className="lg:col-span-5 rounded-lg border border-[#DDE6EE] bg-white p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F1E36] font-display">
              ESP32 16×2 LCD Display Output
            </h3>
            <p className="mt-1 text-xs text-[#5B6B80]">
              Shows what the classroom reader displays on scan confirmation, invalid card, duplicate, or offline flag.
            </p>
            <div className="mt-4 rounded-md border-4 border-slate-800 bg-[#0A3A2A] p-4 font-mono-data text-emerald-300 shadow-inner">
              <div className="text-base tracking-widest uppercase truncate">
                {lcdOutput ? lcdOutput.lcdLine1 : 'MCET RFID READY'}
              </div>
              <div className="mt-1 text-base tracking-widest uppercase truncate">
                {lcdOutput ? lcdOutput.lcdLine2 : 'TAP STUDENT CARD'}
              </div>
            </div>
          </div>
          {lcdOutput && (
            <p className="mt-3 text-xs text-[#5B6B80]">
              <strong className="text-[#0F1E36]">{lcdOutput.status}:</strong> {lcdOutput.message}
            </p>
          )}
        </div>
      </div>

      {/* Recent Device Scan Audit */}
      <div className="rounded-lg border border-[#DDE6EE] bg-white overflow-x-auto">
        <div className="border-b border-[#DDE6EE] px-4 py-3">
          <h3 className="text-sm font-bold text-[#0F1E36] font-display">Device Scan &amp; Offline Sync Queue Log</h3>
        </div>
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
              <th className="px-4 py-2 font-semibold">Event ID</th>
              <th className="px-4 py-2 font-semibold">Device / Room</th>
              <th className="px-4 py-2 font-semibold">RFID UID</th>
              <th className="px-4 py-2 font-semibold">Student / Subject</th>
              <th className="px-4 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF3F7]">
            {deviceScans.slice(0, 25).map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-mono-data text-[11px]">{s.eventId}</td>
                <td className="px-4 py-2 font-mono-data">{s.deviceId} ({s.classroom})</td>
                <td className="px-4 py-2 font-mono-data">{s.rfidUid}</td>
                <td className="px-4 py-2">
                  {s.studentName ? `${s.rollNumber} · ${s.studentName}` : 'Unknown Card'}
                  <div className="text-[11px] text-[#5B6B80]">{s.message}</div>
                </td>
                <td className="px-4 py-2 font-mono-data text-[11px] font-semibold uppercase">
                  <span
                    className={
                      s.status === 'processed' || s.status === 'offline_synced'
                        ? 'text-emerald-700'
                        : s.status === 'duplicate'
                        ? 'text-amber-700'
                        : 'text-red-700'
                    }
                  >
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Device Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const cls = classes.find((c) => c.id === editing.assignedClassId);
              await saveDevice(
                {
                  deviceId: editing.deviceId || '',
                  name: editing.name || 'Classroom RFID Reader',
                  classroom: editing.classroom || 'LH-E-303',
                  assignedClassId: editing.assignedClassId || classes[0]?.id || '',
                  assignedClassName: cls?.name || editing.assignedClassName || '',
                  status: 'active',
                  connectionStatus: 'unconfigured',
                  pendingUploads: 0,
                  firmwareVersion: editing.firmwareVersion || '1.0.0-rc522',
                },
                actor
              );
              setEditing(null);
              showToast('Device Registered', 'ESP32 node saved to Firestore.', 'success');
              await onRefresh();
            }}
            className="w-full max-w-md rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-[#DDE6EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F1E36]">Register ESP32 RFID Node</h3>
              <button type="button" onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="block text-[11px] text-[#5B6B80] mb-1">Device ID *</label>
              <input type="text" required value={editing.deviceId || ''} onChange={(e) => setEditing({ ...editing, deviceId: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data" />
            </div>
            <div>
              <label className="block text-[11px] text-[#5B6B80] mb-1">Display Name *</label>
              <input type="text" required value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. LH-E-303 Primary Reader" className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Classroom *</label>
                <input type="text" required value={editing.classroom || ''} onChange={(e) => setEditing({ ...editing, classroom: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data" />
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Assigned Class</label>
                <select value={editing.assignedClassId || ''} onChange={(e) => setEditing({ ...editing, assignedClassId: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs">
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs">Cancel</button>
              <button type="submit" className="rounded-md bg-[#03CAFC] px-4 py-1.5 text-xs font-semibold text-[#0F1E36]">Save Device</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove ESP32 Device"
        message={`Remove ${deleting?.deviceId} from registered classroom devices?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteDevice(deleting, actor);
          setDeleting(null);
          await onRefresh();
        }}
      />
    </div>
  );
}

export function AdminNoticesAndRequestsTab({
  actor,
  notices,
  accessRequests,
  onRefresh,
}: AdminExtraProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<Notice['category']>('announcement');
  const [targetRole, setTargetRole] = useState<Notice['targetRole']>('all');

  return (
    <div className="space-y-6">
      {/* Pending Access Requests */}
      <div className="rounded-lg border border-[#DDE6EE] bg-white overflow-x-auto">
        <div className="border-b border-[#DDE6EE] px-4 py-3">
          <h2 className="text-sm font-bold text-[#0F1E36] font-display">
            Unregistered Account Access Requests ({accessRequests.filter((r) => r.status === 'pending').length} Pending)
          </h2>
        </div>
        {accessRequests.length === 0 ? (
          <div className="p-4 text-xs text-[#5B6B80]">No access requests submitted.</div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
                <th className="px-4 py-2 font-semibold">User</th>
                <th className="px-4 py-2 font-semibold">Role / Roll No</th>
                <th className="px-4 py-2 font-semibold">Notes</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F7]">
              {accessRequests.map((req) => (
                <tr key={req.id}>
                  <td className="px-4 py-2">
                    <div className="font-semibold">{req.displayName}</div>
                    <div className="text-[11px] text-[#5B6B80]">{req.email}</div>
                  </td>
                  <td className="px-4 py-2 font-mono-data uppercase">
                    {req.requestedRole} {req.rollNumber ? `· ${req.rollNumber}` : ''}
                  </td>
                  <td className="px-4 py-2 text-[#5B6B80]">{req.notes || req.department || '—'}</td>
                  <td className="px-4 py-2 font-mono-data uppercase text-[11px]">{req.status}</td>
                  <td className="px-4 py-2 text-right space-x-1">
                    {req.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => updateAccessRequestStatus(req.id, 'approved', actor).then(onRefresh)}
                          className="rounded border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-700"
                        >
                          Mark Approved
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAccessRequestStatus(req.id, 'rejected', actor).then(onRefresh)}
                          className="rounded border border-red-200 px-2 py-0.5 text-[11px] text-red-700"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Notices */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await createNotice({
              title,
              body,
              category,
              targetRole,
              authorName: actor.name,
              authorUid: actor.uid,
              isPinned: true,
            });
            setTitle('');
            setBody('');
            showToast('Notice Published', title, 'success');
            await onRefresh();
          }}
          className="lg:col-span-5 rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3 h-fit"
        >
          <h3 className="text-sm font-bold text-[#0F1E36] font-display">Publish Academic Notice</h3>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notice title" className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value as Notice['category'])} className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs">
              <option value="announcement">Announcement</option>
              <option value="academic">Academic</option>
              <option value="timetable">Timetable Update</option>
              <option value="college">College Info</option>
            </select>
            <select value={targetRole} onChange={(e) => setTargetRole(e.target.value as Notice['targetRole'])} className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs">
              <option value="all">All Users</option>
              <option value="student">Students Only</option>
              <option value="faculty">Faculty Only</option>
            </select>
          </div>
          <textarea rows={4} required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Notice details..." className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs" />
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36]">
            <Send className="h-3.5 w-3.5" />
            <span>Publish Notice</span>
          </button>
        </form>

        <div className="lg:col-span-7 space-y-3">
          {notices.map((n) => (
            <article key={n.id} className="rounded-lg border border-[#DDE6EE] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-[#0F1E36]">{n.title}</h4>
                  <span className="text-[11px] font-mono-data uppercase text-[#0284C7]">
                    {n.category} · Target: {n.targetRole}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteNotice(n.id).then(onRefresh)}
                  className="rounded border border-[#DDE6EE] p-1 text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 text-xs text-[#5B6B80] whitespace-pre-line">{n.body}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminLogsAndSettingsTab({
  actor,
  activityLogs,
  onRefresh,
}: AdminExtraProps) {
  const { portalSettings, refreshPortalSettings } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState<PortalSettings>(portalSettings);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    setForm(portalSettings);
  }, [portalSettings]);

  useEffect(() => {
    listAdmins().then(setAdmins).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Data Initialization Tools */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#0284C7]" />
            <h3 className="text-sm font-bold text-[#0F1E36] font-display">
              Official MCET Curriculum &amp; Timetable Setup
            </h3>
          </div>
          <p className="text-xs text-[#5B6B80]">
            Populates Firestore with the authoritative MCET III Semester BE AI&amp;ML - A department, class, 11 faculty members, 14 subjects/activities, and exact Monday–Saturday timetable.
          </p>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={async () => {
              setBusyAction('mcet');
              try {
                await initializeMcetCurriculum(actor);
                await refreshPortalSettings();
                await onRefresh();
                showToast('MCET Curriculum Initialized', 'Official timetable, faculty, and subjects saved to Firestore.', 'success');
              } finally {
                setBusyAction(null);
              }
            }}
            className="rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36] hover:bg-[#02B3E0]"
          >
            {busyAction === 'mcet' ? 'Initializing...' : 'Initialize MCET Timetable & Roster'}
          </button>
        </div>

        <div className="rounded-lg border border-amber-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold text-[#0F1E36] font-display">
              Optional Sample Students &amp; Device Profile (DEMO DATA)
            </h3>
          </div>
          <p className="text-xs text-[#5B6B80]">
            Creates 5 clearly marked <strong>DEMO DATA</strong> student records (Roll Nos 01, 02, 06, 07, 31) and 1 unconfigured ESP32 reader profile for verification testing. Does not create fake live attendance.
          </p>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={async () => {
              setBusyAction('demo');
              try {
                await seedDemoStudentsAndDevice(actor);
                await onRefresh();
                showToast('DEMO DATA Seeded', '5 sample DEMO students and 1 ESP32 node created.', 'info');
              } finally {
                setBusyAction(null);
              }
            }}
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            {busyAction === 'demo' ? 'Seeding...' : 'Seed DEMO DATA Students & Node'}
          </button>
        </div>
      </div>

      {/* Configurable College Branding */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await savePortalSettings(form, actor);
          await refreshPortalSettings();
          showToast('Branding Updated', 'Portal configuration saved to Firestore.', 'success');
        }}
        className="rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-4"
      >
        <h3 className="text-sm font-bold text-[#0F1E36] font-display border-b border-[#EEF3F7] pb-2.5">
          Institutional Branding &amp; Academic Configuration
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[11px] text-[#5B6B80] mb-1">College Full Name</label>
            <input type="text" required value={form.collegeName} onChange={(e) => setForm({ ...form, collegeName: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs" />
          </div>
          <div>
            <label className="block text-[11px] text-[#5B6B80] mb-1">Short Name / Acronym</label>
            <input type="text" required value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] text-[#5B6B80] mb-1">College Crest / Logo URL</label>
            <input type="text" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data" />
          </div>
          <div>
            <label className="block text-[11px] text-[#5B6B80] mb-1">Low Attendance Alert (%)</label>
            <input type="number" min={1} max={100} value={form.lowAttendanceThreshold} onChange={(e) => setForm({ ...form, lowAttendanceThreshold: Number(e.target.value) })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data" />
          </div>
          <div>
            <label className="block text-[11px] text-[#5B6B80] mb-1">Academic Year</label>
            <input type="text" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data" />
          </div>
          <div>
            <label className="block text-[11px] text-[#5B6B80] mb-1">Active Semester</label>
            <input type="text" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs" />
          </div>
          <div>
            <label className="block text-[11px] text-[#5B6B80] mb-1">Default Classroom</label>
            <input type="text" value={form.defaultClassroom} onChange={(e) => setForm({ ...form, defaultClassroom: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36] hover:bg-[#02B3E0]">
            Save Portal Settings
          </button>
        </div>
      </form>

      {/* Authorized Administrators */}
      <div className="rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#0284C7]" />
          <h3 className="text-sm font-bold text-[#0F1E36] font-display">Authorized System Administrators</h3>
        </div>
        <div className="divide-y divide-[#EEF3F7] text-xs">
          {admins.map((a) => (
            <div key={a.uid} className="flex items-center justify-between py-2">
              <div>
                <strong>{a.name}</strong> · <span className="font-mono-data text-[#5B6B80]">{a.email}</span>
                <div className="font-mono-data text-[10px] text-[#5B6B80]">UID: {a.uid}</div>
              </div>
              {a.uid !== actor.uid && (
                <button
                  type="button"
                  onClick={() => removeAuthorizedAdmin(a.uid, actor).then(() => listAdmins().then(setAdmins))}
                  className="rounded border border-red-200 px-2 py-0.5 text-[11px] text-red-700"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newAdminUid || !newAdminEmail || !newAdminName) return;
            await addAuthorizedAdmin({ uid: newAdminUid, email: newAdminEmail, name: newAdminName }, actor);
            setNewAdminUid('');
            setNewAdminEmail('');
            setNewAdminName('');
            setAdmins(await listAdmins());
            showToast('Admin Authorized', newAdminEmail, 'success');
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-[#EEF3F7]"
        >
          <input type="text" required placeholder="Firebase Auth UID" value={newAdminUid} onChange={(e) => setNewAdminUid(e.target.value)} className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs font-mono-data" />
          <input type="email" required placeholder="Admin Google Email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs" />
          <input type="text" required placeholder="Full Name" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs" />
          <button type="submit" className="rounded-md bg-[#0F1E36] px-3 py-1.5 text-xs font-semibold text-white">
            Authorize Admin
          </button>
        </form>
      </div>

      {/* Activity Logs */}
      <div className="rounded-lg border border-[#DDE6EE] bg-white overflow-x-auto">
        <div className="border-b border-[#DDE6EE] px-4 py-3">
          <h3 className="text-sm font-bold text-[#0F1E36] font-display">
            System Activity &amp; Audit Logs ({activityLogs.length})
          </h3>
        </div>
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
              <th className="px-4 py-2 font-semibold">Action</th>
              <th className="px-4 py-2 font-semibold">Category</th>
              <th className="px-4 py-2 font-semibold">Performed By</th>
              <th className="px-4 py-2 font-semibold">Target</th>
              <th className="px-4 py-2 font-semibold">Change Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF3F7]">
            {activityLogs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-2 font-semibold text-[#0F1E36]">{log.action}</td>
                <td className="px-4 py-2 font-mono-data uppercase text-[11px] text-[#0284C7]">{log.category}</td>
                <td className="px-4 py-2">
                  {log.performedByName} <span className="text-[#5B6B80]">({log.performedByRole})</span>
                </td>
                <td className="px-4 py-2 text-[#5B6B80]">{log.targetLabel}</td>
                <td className="px-4 py-2 text-[#5B6B80]">
                  {log.previousValue ? `${log.previousValue} → ` : ''}
                  {log.updatedValue || log.details || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
