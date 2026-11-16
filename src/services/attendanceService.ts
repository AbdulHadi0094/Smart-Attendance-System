import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AttendanceRecord,
  AttendanceStatus,
  Faculty,
  Student,
  Subject,
  SubjectAttendanceSummary,
  UserRole,
} from '../types/erp';
import { logActivity } from './auditNoticeService';

export function buildAttendanceDocId(params: {
  date: string;
  classId: string;
  period: number;
  subjectId: string;
  studentDocId: string;
}): string {
  return `${params.date}_${params.classId}_P${params.period}_${params.subjectId}_${params.studentDocId}`.replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
}

export async function fetchStudentPrivateAttendance(params: {
  studentUid?: string;
  studentEmail: string;
}): Promise<AttendanceRecord[]> {
  try {
    const colRef = collection(db, 'attendance');
    const q = params.studentUid
      ? query(colRef, where('studentUid', '==', params.studentUid))
      : query(colRef, where('studentEmail', '==', params.studentEmail.toLowerCase()));
    const snap = await getDocs(q);
    const byUid = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }));

    // Also include records recorded by RFID before student UID linked (matched by email)
    if (params.studentUid && params.studentEmail) {
      const emailSnap = await getDocs(
        query(colRef, where('studentEmail', '==', params.studentEmail.toLowerCase()))
      );
      const map = new Map<string, AttendanceRecord>();
      byUid.forEach((r) => map.set(r.id, r));
      emailSnap.docs.forEach((d) =>
        map.set(d.id, { id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) })
      );
      return Array.from(map.values()).sort(
        (a, b) => b.date.localeCompare(a.date) || b.period - a.period
      );
    }

    return byUid.sort((a, b) => b.date.localeCompare(a.date) || b.period - a.period);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'attendance');
  }
}

export async function fetchAttendanceRecords(filters?: {
  classId?: string;
  date?: string;
  subjectId?: string;
  maxResults?: number;
}): Promise<AttendanceRecord[]> {
  try {
    const colRef = collection(db, 'attendance');
    let q;
    if (filters?.classId) {
      q = query(colRef, where('classId', '==', filters.classId), limit(filters?.maxResults || 1000));
    } else if (filters?.date) {
      q = query(colRef, where('date', '==', filters.date), limit(filters?.maxResults || 1000));
    } else if (filters?.subjectId) {
      q = query(colRef, where('subjectId', '==', filters.subjectId), limit(filters?.maxResults || 1000));
    } else {
      q = query(colRef, orderBy('date', 'desc'), limit(filters?.maxResults || 1000));
    }

    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }))
      .filter((r) => {
        if (filters?.classId && r.classId !== filters.classId) return false;
        if (filters?.date && r.date !== filters.date) return false;
        if (filters?.subjectId && r.subjectId !== filters.subjectId) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'attendance');
  }
}

export async function markManualAttendanceBatch(params: {
  date: string;
  period: number;
  classroom: string;
  subject: Subject;
  entries: Array<{ student: Student; status: AttendanceStatus }>;
  faculty?: Faculty;
  actor: { uid: string; name: string; email: string; role: UserRole };
  allowOverwrite?: boolean;
}): Promise<{ createdCount: number; skippedDuplicates: number }> {
  let createdCount = 0;
  let skippedDuplicates = 0;

  try {
    for (const item of params.entries) {
      const docId = buildAttendanceDocId({
        date: params.date,
        classId: item.student.classId,
        period: params.period,
        subjectId: params.subject.id,
        studentDocId: item.student.id,
      });
      const ref = doc(db, 'attendance', docId);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists() && !params.allowOverwrite) {
          skippedDuplicates += 1;
          return;
        }
        if (snap.exists() && params.allowOverwrite) {
          tx.update(ref, {
            status: item.status,
            correctedBy: params.actor.name,
            correctionReason: 'Manual roster re-submission',
            updatedAt: serverTimestamp(),
          });
          createdCount += 1;
          return;
        }
        tx.set(ref, {
          studentUid: item.student.uid || '',
          studentDocId: item.student.id,
          studentId: item.student.studentId,
          studentName: item.student.name,
          studentEmail: item.student.email.toLowerCase(),
          rollNumber: item.student.rollNumber,
          classId: item.student.classId,
          className: item.student.className,
          section: item.student.section,
          batch: item.student.batch,
          subjectId: params.subject.id,
          subjectShortName: params.subject.shortName,
          subjectName: params.subject.name,
          date: params.date,
          period: Number(params.period),
          classroom: params.classroom,
          status: item.status,
          source: 'manual',
          deviceId: '',
          eventId: '',
          facultyId: params.faculty?.id || '',
          facultyUid: params.actor.uid,
          facultyEmail: params.actor.email,
          facultyName: params.faculty?.name || params.actor.name,
          isSubstituted: false,
          substitutionId: '',
          scanTimestamp: Timestamp.fromDate(new Date()),
          recordedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isDemo: Boolean(item.student.isDemo),
        });
        createdCount += 1;
      });
    }

    await logActivity({
      action: 'Marked Manual Class Attendance',
      category: 'attendance',
      performedByUid: params.actor.uid,
      performedByName: params.actor.name,
      performedByEmail: params.actor.email,
      performedByRole: params.actor.role,
      targetType: 'attendance',
      targetId: `${params.date}_${params.subject.id}_P${params.period}`,
      targetLabel: `${params.subject.shortName} · ${params.date} · P${params.period}`,
      updatedValue: `Recorded: ${createdCount}, Skipped duplicates: ${skippedDuplicates}`,
    });

    return { createdCount, skippedDuplicates };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'attendance');
  }
}

export async function correctAttendanceStatus(params: {
  record: AttendanceRecord;
  newStatus: AttendanceStatus;
  reason: string;
  actor: { uid: string; name: string; email: string; role: UserRole };
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'attendance', params.record.id), {
      status: params.newStatus,
      correctedBy: params.actor.name,
      correctionReason: params.reason.trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    });

    await logActivity({
      action: 'Corrected Attendance Record',
      category: 'attendance',
      performedByUid: params.actor.uid,
      performedByName: params.actor.name,
      performedByEmail: params.actor.email,
      performedByRole: params.actor.role,
      targetType: 'attendance',
      targetId: params.record.id,
      targetLabel: `${params.record.rollNumber} · ${params.record.subjectShortName} · ${params.record.date} P${params.record.period}`,
      previousValue: params.record.status,
      updatedValue: params.newStatus,
      details: params.reason,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `attendance/${params.record.id}`);
  }
}

export function calculateAttendanceMetrics(records: AttendanceRecord[]): {
  present: number;
  late: number;
  absent: number;
  total: number;
  percentage: number;
} {
  let present = 0;
  let late = 0;
  let absent = 0;

  for (const r of records) {
    if (r.status === 'present') present += 1;
    else if (r.status === 'late') late += 1;
    else if (r.status === 'absent') absent += 1;
  }

  const attended = present + late;
  const total = attended + absent;
  const percentage = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;

  return { present, late, absent, total, percentage };
}

export function summarizeBySubject(
  records: AttendanceRecord[],
  subjects: Subject[]
): SubjectAttendanceSummary[] {
  const map = new Map<string, SubjectAttendanceSummary>();

  for (const sub of subjects) {
    if (sub.type === 'activity') continue;
    map.set(sub.id, {
      subjectId: sub.id,
      subjectShortName: sub.shortName,
      subjectName: sub.name,
      present: 0,
      late: 0,
      absent: 0,
      total: 0,
      percentage: 0,
    });
  }

  for (const r of records) {
    if (!map.has(r.subjectId)) {
      map.set(r.subjectId, {
        subjectId: r.subjectId,
        subjectShortName: r.subjectShortName,
        subjectName: r.subjectName,
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
        percentage: 0,
      });
    }
    const bucket = map.get(r.subjectId)!;
    if (r.status === 'present') bucket.present += 1;
    else if (r.status === 'late') bucket.late += 1;
    else if (r.status === 'absent') bucket.absent += 1;
  }

  return Array.from(map.values()).map((item) => {
    const attended = item.present + item.late;
    const total = attended + item.absent;
    return {
      ...item,
      total,
      percentage: total > 0 ? Math.round((attended / total) * 1000) / 10 : 0,
    };
  });
}
