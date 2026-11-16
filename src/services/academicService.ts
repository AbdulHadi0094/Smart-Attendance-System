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
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_PORTAL_SETTINGS,
  MCET_CLASS_ID,
  MCET_DEPARTMENT_ID,
  MCET_FACULTY_SEEDS,
  MCET_SUBJECT_SEEDS,
  MCET_TIMETABLE_SEEDS,
} from '../constants/timetable';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { AcademicClass, Department, Subject } from '../types/erp';
import { logActivity } from './auditNoticeService';

export async function fetchDepartments(): Promise<Department[]> {
  try {
    const snap = await getDocs(query(collection(db, 'departments'), orderBy('name', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Department, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'departments');
  }
}

export async function saveDepartment(
  dept: Omit<Department, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  actor: { uid: string; name: string; email: string }
): Promise<string> {
  const id = dept.id || `dept_${dept.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  try {
    const payload = {
      code: dept.code.trim().toUpperCase().slice(0, 32),
      name: dept.name.trim().slice(0, 160),
      status: dept.status || 'active',
      updatedAt: serverTimestamp(),
    };
    if (dept.id) {
      await updateDoc(doc(db, 'departments', id), payload);
    } else {
      await setDoc(doc(db, 'departments', id), { ...payload, createdAt: serverTimestamp() });
    }
    await logActivity({
      action: dept.id ? 'Updated Department' : 'Created Department',
      category: 'settings',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'department',
      targetId: id,
      targetLabel: `${payload.code} · ${payload.name}`,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `departments/${id}`);
  }
}

export async function fetchClasses(): Promise<AcademicClass[]> {
  try {
    const snap = await getDocs(query(collection(db, 'classes'), orderBy('name', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AcademicClass, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'classes');
  }
}

export async function saveClass(
  cls: Omit<AcademicClass, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  actor: { uid: string; name: string; email: string }
): Promise<string> {
  const id =
    cls.id ||
    `class_${cls.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
  try {
    const payload = {
      departmentId: cls.departmentId.trim(),
      departmentName: cls.departmentName.trim().slice(0, 160),
      academicYear: cls.academicYear.trim().slice(0, 32),
      semester: cls.semester.trim().slice(0, 32),
      name: cls.name.trim().slice(0, 160),
      section: cls.section.trim().slice(0, 32),
      classroom: cls.classroom.trim().slice(0, 64),
      batches: cls.batches.length > 0 ? cls.batches : ['B-I', 'B-II'],
      status: cls.status || 'active',
      updatedAt: serverTimestamp(),
    };
    if (cls.id) {
      await updateDoc(doc(db, 'classes', id), payload);
    } else {
      await setDoc(doc(db, 'classes', id), { ...payload, createdAt: serverTimestamp() });
    }
    await logActivity({
      action: cls.id ? 'Updated Class Configuration' : 'Created Class',
      category: 'settings',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'class',
      targetId: id,
      targetLabel: payload.name,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `classes/${id}`);
  }
}

export async function deleteClass(
  id: string,
  label: string,
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'classes', id));
    await logActivity({
      action: 'Deleted Class',
      category: 'settings',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'class',
      targetId: id,
      targetLabel: label,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `classes/${id}`);
  }
}

export async function fetchSubjects(): Promise<Subject[]> {
  try {
    const snap = await getDocs(query(collection(db, 'subjects'), orderBy('shortName', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'subjects');
  }
}

export async function saveSubject(
  sub: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  actor: { uid: string; name: string; email: string }
): Promise<string> {
  const id =
    sub.id ||
    `sub_${sub.shortName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
  try {
    const payload = {
      code: (sub.code || '').trim().slice(0, 32),
      shortName: sub.shortName.trim().slice(0, 40),
      name: sub.name.trim().slice(0, 180),
      type: sub.type,
      departmentId: sub.departmentId.trim(),
      classId: sub.classId.trim(),
      facultyIds: sub.facultyIds || [],
      facultyNames: sub.facultyNames || [],
      status: sub.status || 'active',
      updatedAt: serverTimestamp(),
    };
    if (sub.id) {
      await updateDoc(doc(db, 'subjects', id), payload);
    } else {
      await setDoc(doc(db, 'subjects', id), { ...payload, createdAt: serverTimestamp() });
    }
    await logActivity({
      action: sub.id ? 'Updated Subject' : 'Created Subject',
      category: 'settings',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'subject',
      targetId: id,
      targetLabel: `${payload.shortName} · ${payload.name}`,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `subjects/${id}`);
  }
}

export async function deleteSubject(
  id: string,
  label: string,
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'subjects', id));
    await logActivity({
      action: 'Deleted Subject',
      category: 'settings',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'subject',
      targetId: id,
      targetLabel: label,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `subjects/${id}`);
  }
}

/**
 * Seeds the authoritative MCET III Semester BE AI&ML - A curriculum,
 * faculty roster, subjects, and Monday-Saturday timetable into Firestore.
 */
export async function initializeMcetCurriculum(actor: {
  uid: string;
  name: string;
  email: string;
}): Promise<void> {
  try {
    const [existingDepts, existingClasses, existingFaculty, existingSubjects, existingTimetable, existingNotices] =
      await Promise.all([
        getDocs(collection(db, 'departments')),
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'faculty')),
        getDocs(collection(db, 'subjects')),
        getDocs(collection(db, 'timetable')),
        getDocs(collection(db, 'notices')),
      ]);

    const deptIds = new Set(existingDepts.docs.map((d) => d.id));
    const classIds = new Set(existingClasses.docs.map((d) => d.id));
    const facultyMap = new Map(existingFaculty.docs.map((d) => [d.id, d.data()]));
    const subjectIds = new Set(existingSubjects.docs.map((d) => d.id));
    const timetableIds = new Set(existingTimetable.docs.map((d) => d.id));
    const noticeIds = new Set(existingNotices.docs.map((d) => d.id));

    const batch = writeBatch(db);

    batch.set(doc(db, 'settings', 'portal_config'), {
      ...DEFAULT_PORTAL_SETTINGS,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });

    const deptRef = doc(db, 'departments', MCET_DEPARTMENT_ID);
    const deptPayload = {
      code: 'AI&ML',
      name: 'Artificial Intelligence & Machine Learning',
      status: 'active',
      updatedAt: serverTimestamp(),
    };
    if (deptIds.has(MCET_DEPARTMENT_ID)) {
      batch.update(deptRef, deptPayload);
    } else {
      batch.set(deptRef, { ...deptPayload, createdAt: serverTimestamp() });
    }

    const classRef = doc(db, 'classes', MCET_CLASS_ID);
    const classPayload = {
      departmentId: MCET_DEPARTMENT_ID,
      departmentName: 'Artificial Intelligence & Machine Learning',
      academicYear: '2026-27',
      semester: 'III',
      name: 'III Semester BE AI&ML - A',
      section: 'A',
      classroom: 'LH-E-303',
      batches: ['B-I', 'B-II'],
      status: 'active',
      updatedAt: serverTimestamp(),
    };
    if (classIds.has(MCET_CLASS_ID)) {
      batch.update(classRef, classPayload);
    } else {
      batch.set(classRef, { ...classPayload, createdAt: serverTimestamp() });
    }

    for (const f of MCET_FACULTY_SEEDS) {
      const ref = doc(db, 'faculty', f.id);
      const prev = facultyMap.get(f.id);
      const facPayload = {
        uid: (prev?.uid as string) || '',
        facultyCode: f.facultyCode,
        name: f.name,
        email: f.email,
        departmentId: MCET_DEPARTMENT_ID,
        departmentName: 'Artificial Intelligence & Machine Learning',
        designation: f.designation,
        assignedClassIds: [MCET_CLASS_ID],
        assignedSubjectIds: f.assignedSubjectIds,
        canSubstitute: true,
        canCorrectAttendance: true,
        photoUrl: (prev?.photoUrl as string) || '',
        status: 'active',
        isDemo: false,
        updatedAt: serverTimestamp(),
      };
      if (prev) {
        batch.update(ref, facPayload);
      } else {
        batch.set(ref, { ...facPayload, createdAt: serverTimestamp() });
      }
    }

    for (const s of MCET_SUBJECT_SEEDS) {
      const ref = doc(db, 'subjects', s.id);
      const subPayload = {
        code: s.code,
        shortName: s.shortName,
        name: s.name,
        type: s.type,
        departmentId: MCET_DEPARTMENT_ID,
        classId: MCET_CLASS_ID,
        facultyIds: s.facultyIds,
        facultyNames: s.facultyNames,
        status: 'active',
        updatedAt: serverTimestamp(),
      };
      if (subjectIds.has(s.id)) {
        batch.update(ref, subPayload);
      } else {
        batch.set(ref, { ...subPayload, createdAt: serverTimestamp() });
      }
    }

    for (const tt of MCET_TIMETABLE_SEEDS) {
      const ref = doc(db, 'timetable', tt.id);
      const ttPayload = {
        classId: MCET_CLASS_ID,
        dayOfWeek: tt.dayOfWeek,
        periodNumber: tt.periodNumber,
        endPeriodNumber: tt.endPeriodNumber,
        startTime: tt.startTime,
        endTime: tt.endTime,
        isMerged: tt.isMerged,
        isBatchSplit: tt.isBatchSplit,
        slots: tt.slots,
        status: 'active',
        updatedAt: serverTimestamp(),
      };
      if (timetableIds.has(tt.id)) {
        batch.update(ref, ttPayload);
      } else {
        batch.set(ref, { ...ttPayload, createdAt: serverTimestamp() });
      }
    }

    const noticeRef = doc(db, 'notices', 'notice_mcet_tt_effective');
    const noticePayload = {
      title: 'III Semester BE AI&ML - A Timetable Effective from 03-08-2026',
      body: 'The official Monday–Saturday timetable for III Semester BE AI&ML - A (Classroom LH-E-303) is active. Note: Tuesday Periods III–IV (11:15 AM – 01:15 PM) SAC/OS batch allocation is flagged for Admin verification.',
      category: 'timetable',
      targetRole: 'all',
      classId: MCET_CLASS_ID,
      authorName: actor.name,
      authorUid: actor.uid,
      isPinned: true,
      updatedAt: serverTimestamp(),
    };
    if (noticeIds.has('notice_mcet_tt_effective')) {
      batch.update(noticeRef, noticePayload);
    } else {
      batch.set(noticeRef, { ...noticePayload, createdAt: serverTimestamp() });
    }

    await batch.commit();

    await logActivity({
      action: 'Initialized Official MCET AI&ML Curriculum & Timetable',
      category: 'timetable',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'class',
      targetId: MCET_CLASS_ID,
      targetLabel: 'III Semester BE AI&ML - A',
      details: 'Seeded 11 faculty members, 14 subjects/activities, and 26 weekly timetable blocks.',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch/mcet_curriculum');
  }
}

/**
 * Seeds clearly-labeled DEMO DATA sample students and 1 unconfigured ESP32 device node
 * for testing Roll-No privacy and RFID simulation without inventing fake live attendance.
 */
export async function seedDemoStudentsAndDevice(actor: {
  uid: string;
  name: string;
  email: string;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    const demoStudents = [
      { id: 'demo_stu_01', rollNumber: '01', studentId: '160725748001', name: 'Aarav Sharma (DEMO)', email: 'demo.student01@mcet.edu.in', batch: 'B-I', rfidUid: 'DEMO_04A1B2C1' },
      { id: 'demo_stu_02', rollNumber: '02', studentId: '160725748002', name: 'Ananya Reddy (DEMO)', email: 'demo.student02@mcet.edu.in', batch: 'B-I', rfidUid: 'DEMO_04A1B2C2' },
      { id: 'demo_stu_06', rollNumber: '06', studentId: '160725748006', name: 'Mohammed Zain (DEMO)', email: 'demo.student06@mcet.edu.in', batch: 'B-I', rfidUid: 'DEMO_04A1B2C6' },
      { id: 'demo_stu_07', rollNumber: '07', studentId: '160725748007', name: 'Priya Nair (DEMO)', email: 'demo.student07@mcet.edu.in', batch: 'B-II', rfidUid: 'DEMO_04A1B2C7' },
      { id: 'demo_stu_31', rollNumber: '31', studentId: '160725748031', name: 'Rohan Kulkarni (DEMO)', email: 'demo.student31@mcet.edu.in', batch: 'B-II', rfidUid: 'DEMO_04A1B231' },
    ];

    for (const s of demoStudents) {
      batch.set(doc(db, 'students', s.id), {
        uid: '',
        studentId: s.studentId,
        rollNumber: s.rollNumber,
        name: s.name,
        email: s.email,
        phone: '',
        departmentId: MCET_DEPARTMENT_ID,
        departmentName: 'Artificial Intelligence & Machine Learning',
        semester: 'III',
        classId: MCET_CLASS_ID,
        className: 'III Semester BE AI&ML - A',
        section: 'A',
        batch: s.batch,
        academicYear: '2026-27',
        rfidUid: s.rfidUid,
        photoUrl: '',
        status: 'active',
        isDemo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'devices', 'ESP32_LH_E_303'), {
      deviceId: 'ESP32_LH_E_303',
      name: 'LH-E-303 Primary Reader (DEMO NODE)',
      classroom: 'LH-E-303',
      assignedClassId: MCET_CLASS_ID,
      assignedClassName: 'III Semester BE AI&ML - A',
      status: 'active',
      connectionStatus: 'unconfigured',
      pendingUploads: 0,
      firmwareVersion: '1.0.0-rc522',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    await logActivity({
      action: 'Seeded Sample Students & Device Profile (DEMO DATA)',
      category: 'student',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'student',
      targetId: MCET_CLASS_ID,
      targetLabel: '5 DEMO students + 1 ESP32 device node',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch/demo_seed');
  }
}
