import { AttendanceRecord, Faculty, Student } from '../types/erp';

export interface StudentAttendanceReportRow {
  studentDocId: string;
  rollNumber: string;
  studentId: string;
  name: string;
  className: string;
  batch: string;
  present: number;
  late: number;
  absent: number;
  total: number;
  percentage: number;
}

export interface FacultyReportRow {
  facultyId: string;
  facultyName: string;
  sessionsCount: number;
  presentCount: number;
  absentCount: number;
  percentage: number;
}

export interface ClassReportRow {
  classId: string;
  className: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

export interface DailyTrendPoint {
  date: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

export function filterRecordsByPeriodRange(
  records: AttendanceRecord[],
  range: 'daily' | 'weekly' | 'monthly' | 'all',
  anchorDate: string
): AttendanceRecord[] {
  if (range === 'all') return records;
  if (range === 'daily') return records.filter((r) => r.date === anchorDate);

  const anchor = new Date(`${anchorDate}T00:00:00Z`);
  if (Number.isNaN(anchor.getTime())) return records;

  const daysBack = range === 'weekly' ? 7 : 30;
  const start = new Date(anchor.getTime() - (daysBack - 1) * 86400000);
  const startStr = start.toISOString().slice(0, 10);

  return records.filter((r) => r.date >= startStr && r.date <= anchorDate);
}

export function buildStudentWiseReport(
  records: AttendanceRecord[],
  students: Student[]
): StudentAttendanceReportRow[] {
  const map = new Map<string, StudentAttendanceReportRow>();
  for (const s of students) {
    map.set(s.id, {
      studentDocId: s.id,
      rollNumber: s.rollNumber,
      studentId: s.studentId,
      name: s.name,
      className: s.className,
      batch: s.batch,
      present: 0,
      late: 0,
      absent: 0,
      total: 0,
      percentage: 0,
    });
  }

  for (const r of records) {
    if (!map.has(r.studentDocId)) {
      map.set(r.studentDocId, {
        studentDocId: r.studentDocId,
        rollNumber: r.rollNumber,
        studentId: r.studentId,
        name: r.studentName,
        className: r.className,
        batch: r.batch,
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
        percentage: 0,
      });
    }
    const row = map.get(r.studentDocId)!;
    if (r.status === 'present') row.present += 1;
    else if (r.status === 'late') row.late += 1;
    else if (r.status === 'absent') row.absent += 1;
  }

  return Array.from(map.values())
    .map((row) => {
      const attended = row.present + row.late;
      const total = attended + row.absent;
      return {
        ...row,
        total,
        percentage: total > 0 ? Math.round((attended / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
}

export function buildFacultyWiseReport(
  records: AttendanceRecord[],
  facultyList: Faculty[]
): FacultyReportRow[] {
  const map = new Map<string, { facultyName: string; sessions: Set<string>; present: number; absent: number }>();

  for (const f of facultyList) {
    map.set(f.id, { facultyName: f.name, sessions: new Set(), present: 0, absent: 0 });
  }

  for (const r of records) {
    const key = r.facultyId || r.facultyName || 'unassigned';
    if (!map.has(key)) {
      map.set(key, {
        facultyName: r.facultyName || 'Department Faculty',
        sessions: new Set(),
        present: 0,
        absent: 0,
      });
    }
    const entry = map.get(key)!;
    entry.sessions.add(`${r.date}_${r.classId}_P${r.period}_${r.subjectId}`);
    if (r.status === 'present' || r.status === 'late') entry.present += 1;
    else entry.absent += 1;
  }

  return Array.from(map.entries()).map(([facultyId, v]) => {
    const total = v.present + v.absent;
    return {
      facultyId,
      facultyName: v.facultyName,
      sessionsCount: v.sessions.size,
      presentCount: v.present,
      absentCount: v.absent,
      percentage: total > 0 ? Math.round((v.present / total) * 1000) / 10 : 0,
    };
  });
}

export function buildClassWiseReport(records: AttendanceRecord[]): ClassReportRow[] {
  const map = new Map<string, ClassReportRow>();
  for (const r of records) {
    if (!map.has(r.classId)) {
      map.set(r.classId, { classId: r.classId, className: r.className, present: 0, absent: 0, total: 0, percentage: 0 });
    }
    const row = map.get(r.classId)!;
    if (r.status === 'present' || r.status === 'late') row.present += 1;
    else row.absent += 1;
  }
  return Array.from(map.values()).map((row) => {
    const total = row.present + row.absent;
    return {
      ...row,
      total,
      percentage: total > 0 ? Math.round((row.present / total) * 1000) / 10 : 0,
    };
  });
}

export function buildDailyTrend(records: AttendanceRecord[], limitDays = 14): DailyTrendPoint[] {
  const map = new Map<string, { present: number; absent: number }>();
  for (const r of records) {
    if (!map.has(r.date)) map.set(r.date, { present: 0, absent: 0 });
    const d = map.get(r.date)!;
    if (r.status === 'present' || r.status === 'late') d.present += 1;
    else d.absent += 1;
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-limitDays)
    .map(([date, v]) => {
      const total = v.present + v.absent;
      return {
        date,
        present: v.present,
        absent: v.absent,
        total,
        percentage: total > 0 ? Math.round((v.present / total) * 1000) / 10 : 0,
      };
    });
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const escapeCell = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
