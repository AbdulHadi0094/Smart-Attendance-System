import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { DayOfWeek, TimetableEntry } from '../types/erp';
import { logActivity } from './auditNoticeService';

export async function fetchTimetable(classId?: string): Promise<TimetableEntry[]> {
  try {
    const colRef = collection(db, 'timetable');
    const q = classId ? query(colRef, where('classId', '==', classId)) : query(colRef);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TimetableEntry, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'timetable');
  }
}

export async function saveTimetableEntry(
  entry: Omit<TimetableEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  actor: { uid: string; name: string; email: string }
): Promise<string> {
  const id =
    entry.id ||
    `tt_${entry.dayOfWeek.slice(0, 3).toLowerCase()}_p${entry.periodNumber}_${Date.now().toString(36)}`;
  const isUpdate = Boolean(entry.id);

  try {
    const payload = {
      classId: entry.classId.trim(),
      dayOfWeek: entry.dayOfWeek,
      periodNumber: Number(entry.periodNumber),
      endPeriodNumber: Number(entry.endPeriodNumber),
      startTime: entry.startTime.trim(),
      endTime: entry.endTime.trim(),
      isMerged: Boolean(entry.endPeriodNumber > entry.periodNumber),
      isBatchSplit: Boolean(entry.slots.length > 1 || entry.slots.some((s) => s.batch !== 'ALL')),
      slots: entry.slots.map((s) => ({
        batch: s.batch,
        subjectId: s.subjectId,
        subjectShortName: s.subjectShortName,
        subjectName: s.subjectName,
        facultyId: s.facultyId || '',
        facultyName: s.facultyName || '',
        classroom: s.classroom || 'LH-E-303',
        needsConfirmation: Boolean(s.needsConfirmation),
        note: s.note || '',
      })),
      status: entry.status || 'active',
      updatedAt: serverTimestamp(),
    };

    if (isUpdate) {
      await updateDoc(doc(db, 'timetable', id), payload);
    } else {
      await setDoc(doc(db, 'timetable', id), { ...payload, createdAt: serverTimestamp() });
    }

    await logActivity({
      action: isUpdate ? 'Updated Timetable Entry' : 'Added Timetable Entry',
      category: 'timetable',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'timetable',
      targetId: id,
      targetLabel: `${entry.dayOfWeek} P${entry.periodNumber}${entry.endPeriodNumber > entry.periodNumber ? `-${entry.endPeriodNumber}` : ''}`,
      updatedValue: payload.slots.map((s) => `${s.batch}: ${s.subjectShortName}`).join(' / '),
    });

    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `timetable/${id}`);
  }
}

export async function deleteTimetableEntry(
  entry: TimetableEntry,
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'timetable', entry.id));
    await logActivity({
      action: 'Deleted Timetable Entry',
      category: 'timetable',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'timetable',
      targetId: entry.id,
      targetLabel: `${entry.dayOfWeek} P${entry.periodNumber}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `timetable/${entry.id}`);
  }
}

export function findTimetableBlockForPeriod(
  entries: TimetableEntry[],
  dayOfWeek: DayOfWeek,
  periodNumber: number
): TimetableEntry | undefined {
  return entries.find(
    (e) =>
      e.status === 'active' &&
      e.dayOfWeek === dayOfWeek &&
      periodNumber >= e.periodNumber &&
      periodNumber <= e.endPeriodNumber
  );
}
