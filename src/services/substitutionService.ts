import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Substitution, UserRole } from '../types/erp';
import { logActivity } from './auditNoticeService';

export async function fetchSubstitutions(params?: {
  classId?: string;
  date?: string;
}): Promise<Substitution[]> {
  try {
    const colRef = collection(db, 'substitutions');
    const q = params?.classId
      ? query(colRef, where('classId', '==', params.classId))
      : params?.date
      ? query(colRef, where('date', '==', params.date))
      : query(colRef, orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Substitution, 'id'>) }))
      .filter((s) => (params?.date ? s.date === params.date : true))
      .sort((a, b) => b.date.localeCompare(a.date) || a.periodNumber - b.periodNumber);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'substitutions');
  }
}

export async function createSubstitution(
  sub: Omit<Substitution, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  actor: { uid: string; name: string; email: string; role: UserRole }
): Promise<string> {
  const id = `sub_${sub.date.replace(/-/g, '')}_${sub.classId}_P${sub.periodNumber}_${sub.batch}_${Date.now().toString(36)}`;
  try {
    await setDoc(doc(db, 'substitutions', id), {
      date: sub.date,
      classId: sub.classId,
      periodNumber: Number(sub.periodNumber),
      endPeriodNumber: Number(sub.endPeriodNumber),
      batch: sub.batch,
      originalSubjectId: sub.originalSubjectId,
      originalSubjectName: sub.originalSubjectName,
      originalFacultyId: sub.originalFacultyId || '',
      originalFacultyName: sub.originalFacultyName || '',
      actualSubjectId: sub.actualSubjectId,
      actualSubjectName: sub.actualSubjectName,
      actualFacultyId: sub.actualFacultyId,
      actualFacultyName: sub.actualFacultyName,
      classroom: sub.classroom,
      reason: (sub.reason || '').slice(0, 300),
      changedByUid: actor.uid,
      changedByName: actor.name,
      changedByRole: actor.role === 'admin' ? 'admin' : 'faculty',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logActivity({
      action: 'Created Subject & Faculty Substitution',
      category: 'substitution',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: actor.role,
      targetType: 'substitution',
      targetId: id,
      targetLabel: `${sub.date} · Period ${sub.periodNumber}${sub.endPeriodNumber > sub.periodNumber ? `-${sub.endPeriodNumber}` : ''} (${sub.batch})`,
      previousValue: `${sub.originalSubjectName} (${sub.originalFacultyName || 'Regular'})`,
      updatedValue: `${sub.actualSubjectName} (${sub.actualFacultyName})`,
      details: sub.reason || 'Temporary period override',
    });

    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `substitutions/${id}`);
  }
}

export async function cancelSubstitution(
  sub: Substitution,
  actor: { uid: string; name: string; email: string; role: UserRole }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'substitutions', sub.id), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
    await logActivity({
      action: 'Cancelled Temporary Substitution',
      category: 'substitution',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: actor.role,
      targetType: 'substitution',
      targetId: sub.id,
      targetLabel: `${sub.date} · P${sub.periodNumber}`,
      previousValue: `${sub.actualSubjectName} (${sub.actualFacultyName})`,
      updatedValue: `Reverted to ${sub.originalSubjectName}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `substitutions/${sub.id}`);
  }
}
