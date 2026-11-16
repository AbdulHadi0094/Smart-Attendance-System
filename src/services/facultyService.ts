import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Faculty } from '../types/erp';
import { logActivity } from './auditNoticeService';

export async function fetchFacultyList(): Promise<Faculty[]> {
  try {
    const snap = await getDocs(query(collection(db, 'faculty'), orderBy('name', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Faculty, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'faculty');
  }
}

export async function saveFaculty(
  faculty: Omit<Faculty, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  actor: { uid: string; name: string; email: string }
): Promise<string> {
  const cleanId =
    faculty.id ||
    `fac_${faculty.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${Date.now().toString(36)}`;
  const isUpdate = Boolean(faculty.id);

  try {
    const payload: Record<string, unknown> = {
      uid: (faculty.uid || '').trim(),
      facultyCode: faculty.facultyCode.trim().slice(0, 64),
      name: faculty.name.trim().slice(0, 120),
      email: faculty.email.trim().toLowerCase().slice(0, 200),
      departmentId: faculty.departmentId.trim(),
      departmentName: (faculty.departmentName || '').trim().slice(0, 160),
      designation: faculty.designation.trim().slice(0, 120),
      assignedClassIds: faculty.assignedClassIds || [],
      assignedSubjectIds: faculty.assignedSubjectIds || [],
      canSubstitute: Boolean(faculty.canSubstitute),
      canCorrectAttendance: Boolean(faculty.canCorrectAttendance),
      photoUrl: (faculty.photoUrl || '').trim().slice(0, 500),
      status: faculty.status || 'active',
      isDemo: Boolean(faculty.isDemo),
      updatedAt: serverTimestamp(),
    };

    if (isUpdate) {
      await updateDoc(doc(db, 'faculty', cleanId), payload);
    } else {
      await setDoc(doc(db, 'faculty', cleanId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }

    // Sync linked user permissions if Google account already linked
    if (faculty.uid) {
      await updateDoc(doc(db, 'users', faculty.uid), {
        assignedClassIds: faculty.assignedClassIds || [],
        assignedSubjectIds: faculty.assignedSubjectIds || [],
        status: faculty.status || 'active',
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    await logActivity({
      action: isUpdate ? 'Updated Faculty Profile' : 'Added Faculty Member',
      category: 'faculty',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'faculty',
      targetId: cleanId,
      targetLabel: `${faculty.facultyCode} · ${faculty.name}`,
      updatedValue: `Classes: ${(faculty.assignedClassIds || []).length}, Subjects: ${(faculty.assignedSubjectIds || []).length}`,
    });

    return cleanId;
  } catch (error) {
    handleFirestoreError(error, isUpdate ? OperationType.UPDATE : OperationType.CREATE, `faculty/${cleanId}`);
  }
}

export async function toggleFacultyStatus(
  faculty: Faculty,
  nextStatus: 'active' | 'inactive',
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'faculty', faculty.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    if (faculty.uid) {
      await updateDoc(doc(db, 'users', faculty.uid), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    await logActivity({
      action: nextStatus === 'active' ? 'Activated Faculty Member' : 'Deactivated Faculty Member',
      category: 'faculty',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'faculty',
      targetId: faculty.id,
      targetLabel: faculty.name,
      previousValue: faculty.status,
      updatedValue: nextStatus,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `faculty/${faculty.id}`);
  }
}

export async function deleteFacultyRecord(
  faculty: Faculty,
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'faculty', faculty.id));
    await logActivity({
      action: 'Deleted Faculty Record',
      category: 'faculty',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'faculty',
      targetId: faculty.id,
      targetLabel: faculty.name,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `faculty/${faculty.id}`);
  }
}
