export type UserRole = 'admin' | 'faculty' | 'student';
export type RecordStatus = 'active' | 'inactive';
export type BatchType = 'B-I' | 'B-II' | 'ALL';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type AttendanceStatus = 'present' | 'absent' | 'late';
export type AttendanceSource = 'rfid' | 'manual';

export interface PortalSettings {
  collegeName: string;
  shortName: string;
  logoUrl: string;
  academicYear: string;
  semester: string;
  effectiveFrom: string;
  defaultClassroom: string;
  timezone: string;
  lowAttendanceThreshold: number;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  role: UserRole;
  linkedProfileId?: string;
  assignedClassIds?: string[];
  assignedSubjectIds?: string[];
  status: RecordStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  status: RecordStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AcademicClass {
  id: string;
  departmentId: string;
  departmentName: string;
  academicYear: string;
  semester: string;
  name: string;
  section: string;
  classroom: string;
  batches: string[];
  status: RecordStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Subject {
  id: string;
  code?: string;
  shortName: string;
  name: string;
  type: 'theory' | 'lab' | 'activity';
  departmentId: string;
  classId: string;
  facultyIds: string[];
  facultyNames: string[];
  status: RecordStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Student {
  id: string;
  uid?: string;
  studentId: string;
  rollNumber: string;
  name: string;
  email: string;
  phone?: string;
  departmentId: string;
  departmentName?: string;
  semester: string;
  classId: string;
  className: string;
  section: string;
  batch: BatchType;
  academicYear: string;
  rfidUid: string;
  photoUrl?: string;
  status: RecordStatus;
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Faculty {
  id: string;
  uid?: string;
  facultyCode: string;
  name: string;
  email: string;
  departmentId: string;
  departmentName?: string;
  designation: string;
  assignedClassIds: string[];
  assignedSubjectIds: string[];
  canSubstitute: boolean;
  canCorrectAttendance: boolean;
  photoUrl?: string;
  status: RecordStatus;
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TimetableSlot {
  batch: BatchType;
  subjectId: string;
  subjectShortName: string;
  subjectName: string;
  facultyId: string;
  facultyName: string;
  classroom: string;
  needsConfirmation?: boolean;
  note?: string;
}

export interface TimetableEntry {
  id: string;
  classId: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  endPeriodNumber: number;
  startTime: string;
  endTime: string;
  isMerged: boolean;
  isBatchSplit: boolean;
  slots: TimetableSlot[];
  status: RecordStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Substitution {
  id: string;
  date: string; // YYYY-MM-DD
  classId: string;
  periodNumber: number;
  endPeriodNumber: number;
  batch: BatchType;
  originalSubjectId: string;
  originalSubjectName: string;
  originalFacultyId?: string;
  originalFacultyName?: string;
  actualSubjectId: string;
  actualSubjectName: string;
  actualFacultyId: string;
  actualFacultyName: string;
  classroom: string;
  reason?: string;
  changedByUid: string;
  changedByName: string;
  changedByRole: 'admin' | 'faculty';
  status: 'active' | 'cancelled';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AttendanceRecord {
  id: string;
  studentUid?: string;
  studentDocId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  rollNumber: string;
  classId: string;
  className: string;
  section: string;
  batch: BatchType;
  subjectId: string;
  subjectShortName: string;
  subjectName: string;
  date: string; // YYYY-MM-DD
  period: number;
  classroom: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  deviceId?: string;
  eventId?: string;
  facultyId?: string;
  facultyUid?: string;
  facultyEmail?: string;
  facultyName?: string;
  isSubstituted?: boolean;
  substitutionId?: string;
  scanTimestamp: unknown;
  recordedAt?: unknown;
  updatedAt?: unknown;
  correctedBy?: string;
  correctionReason?: string;
  isDemo?: boolean;
}

export interface RfidDevice {
  id: string;
  deviceId: string;
  name: string;
  classroom: string;
  assignedClassId: string;
  assignedClassName: string;
  status: RecordStatus;
  connectionStatus: 'online' | 'offline' | 'unconfigured';
  lastSyncAt?: unknown;
  pendingUploads: number;
  firmwareVersion?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DeviceScanEvent {
  id: string;
  eventId: string;
  deviceId: string;
  rfidUid: string;
  classroom: string;
  classId?: string;
  scanTimestamp: unknown;
  date: string;
  period?: number;
  status: 'processed' | 'flagged_no_timetable' | 'invalid_card' | 'duplicate' | 'offline_synced';
  studentDocId?: string;
  studentName?: string;
  rollNumber?: string;
  subjectName?: string;
  message: string;
  createdAt?: unknown;
}

export interface ActivityLog {
  id: string;
  action: string;
  category: 'student' | 'faculty' | 'attendance' | 'timetable' | 'substitution' | 'device' | 'settings' | 'auth';
  performedByUid: string;
  performedByName: string;
  performedByEmail: string;
  performedByRole: 'admin' | 'faculty' | 'student' | 'system';
  targetType: string;
  targetId: string;
  targetLabel: string;
  previousValue?: string;
  updatedValue?: string;
  details?: string;
  createdAt?: unknown;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  category: 'announcement' | 'academic' | 'timetable' | 'college';
  targetRole: 'all' | 'student' | 'faculty';
  classId?: string;
  authorName: string;
  authorUid: string;
  isPinned: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AccessRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  requestedRole: 'student' | 'faculty';
  rollNumber?: string;
  department?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PeriodTiming {
  period: number;
  roman: string;
  label: string;
  startTime: string; // HH:mm 24h
  endTime: string;   // HH:mm 24h
  display: string;
}

export interface SubjectAttendanceSummary {
  subjectId: string;
  subjectShortName: string;
  subjectName: string;
  present: number;
  late: number;
  absent: number;
  total: number;
  percentage: number;
}
