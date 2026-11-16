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
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Student } from '../types/erp';
import { logActivity } from './auditNoticeService';

export async function fetchStudents(classId?: string): Promise<Student[]> {
  try {
    const colRef = collection(db, 'students');
    const q = classId
      ? query(colRef, where('classId', '==', classId))
      : query(colRef, orderBy('rollNumber', 'asc'));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }));
    return list.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'students');
  }
}

export async function saveStudent(
  student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  actor: { uid: string; name: string; email: string }
): Promise<string> {
  const cleanId =
    student.id ||
    `stu_${student.rollNumber.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${Date.now().toString(36)}`;
  const isUpdate = Boolean(student.id);

  try {
    const payload: Record<string, unknown> = {
      uid: (student.uid || '').trim(),
      studentId: student.studentId.trim().slice(0, 64),
      rollNumber: student.rollNumber.trim().slice(0, 32),
      name: student.name.trim().slice(0, 120),
      email: student.email.trim().toLowerCase().slice(0, 200),
      phone: (student.phone || '').trim().slice(0, 32),
      departmentId: student.departmentId.trim(),
      departmentName: (student.departmentName || '').trim().slice(0, 160),
      semester: student.semester.trim().slice(0, 32),
      classId: student.classId.trim(),
      className: student.className.trim().slice(0, 160),
      section: student.section.trim().slice(0, 32),
      batch: student.batch,
      academicYear: student.academicYear.trim().slice(0, 32),
      rfidUid: student.rfidUid.trim().toUpperCase().slice(0, 64),
      photoUrl: (student.photoUrl || '').trim().slice(0, 500),
      status: student.status || 'active',
      isDemo: Boolean(student.isDemo),
      updatedAt: serverTimestamp(),
    };

    if (isUpdate) {
      await updateDoc(doc(db, 'students', cleanId), payload);
    } else {
      await setDoc(doc(db, 'students', cleanId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }

    if (student.uid) {
      await updateDoc(doc(db, 'users', student.uid), {
        assignedClassIds: [student.classId],
        status: student.status || 'active',
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    await logActivity({
      action: isUpdate ? 'Updated Student Record' : 'Added Student Record',
      category: 'student',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'student',
      targetId: cleanId,
      targetLabel: `${student.rollNumber} · ${student.name}`,
      updatedValue: `RFID: ${payload.rfidUid || 'Unassigned'} · Batch: ${student.batch}`,
    });

    return cleanId;
  } catch (error) {
    handleFirestoreError(error, isUpdate ? OperationType.UPDATE : OperationType.CREATE, `students/${cleanId}`);
  }
}

export async function toggleStudentStatus(
  student: Student,
  nextStatus: 'active' | 'inactive',
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'students', student.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    if (student.uid) {
      await updateDoc(doc(db, 'users', student.uid), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    await logActivity({
      action: nextStatus === 'active' ? 'Activated Student' : 'Deactivated Student',
      category: 'student',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'student',
      targetId: student.id,
      targetLabel: `${student.rollNumber} · ${student.name}`,
      previousValue: student.status,
      updatedValue: nextStatus,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${student.id}`);
  }
}

export async function deleteStudentRecord(
  student: Student,
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'students', student.id));
    await logActivity({
      action: 'Deleted Student Record',
      category: 'student',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'student',
      targetId: student.id,
      targetLabel: `${student.rollNumber} · ${student.name}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `students/${student.id}`);
  }
}
