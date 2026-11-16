import { signInWithPopup, signOut, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  createGoogleProvider,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { AccessRequest, Faculty, Student, UserAccount, UserRole } from '../types/erp';
import { logActivity } from './auditNoticeService';

export const BOOTSTRAPPED_ADMIN_EMAILS = ['4623hadi@gmail.com'];

export interface ResolvedAuthIdentity {
  role: UserRole | 'unregistered';
  userAccount?: UserAccount;
  studentProfile?: Student;
  facultyProfile?: Faculty;
  mismatchMessage?: string;
}

export async function signInWithGoogleChooser(
  intendedPortal: 'student' | 'faculty'
): Promise<{ user: User; identity: ResolvedAuthIdentity }> {
  const provider = createGoogleProvider();
  const cred = await signInWithPopup(auth, provider);
  const user = cred.user;

  if (!user.email || !user.emailVerified) {
    await signOut(auth);
    throw new Error('Your Google account email must be verified before accessing the MCET Portal.');
  }

  const identity = await resolveUserIdentity(user, intendedPortal);
  return { user, identity };
}

export async function resolveUserIdentity(
  user: User,
  intendedPortal?: 'student' | 'faculty'
): Promise<ResolvedAuthIdentity> {
  const email = (user.email || '').toLowerCase().trim();
  const uid = user.uid;

  // 1. Check trusted Admin authorization FIRST (works regardless of which login button was clicked)
  let isAdminUser = BOOTSTRAPPED_ADMIN_EMAILS.includes(email);
  if (!isAdminUser) {
    try {
      const adminSnap = await getDoc(doc(db, 'admins', uid));
      if (adminSnap.exists()) {
        isAdminUser = true;
      }
    } catch {
      // Non-admin read denial or missing doc is normal
    }
  }

  if (isAdminUser) {
    const userRef = doc(db, 'users', uid);
    try {
      const userSnap = await getDoc(userRef);
      const accountPayload: UserAccount = {
        uid,
        email,
        displayName: user.displayName || 'System Administrator',
        photoUrl: user.photoURL || '',
        role: 'admin',
        linkedProfileId: 'admin',
        assignedClassIds: [],
        assignedSubjectIds: [],
        status: 'active',
      };
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          ...accountPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        // Also ensure /admins/{uid} exists for fast rule lookups
        await setDoc(doc(db, 'admins', uid), {
          uid,
          email,
          name: user.displayName || 'System Administrator',
          createdAt: serverTimestamp(),
          createdBy: 'bootstrap',
        });
      } else {
        await updateDoc(userRef, {
          displayName: user.displayName || userSnap.data().displayName,
          photoUrl: user.photoURL || userSnap.data().photoUrl || '',
          updatedAt: serverTimestamp(),
        });
      }
      return { role: 'admin', userAccount: accountPayload };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  }

  // 2. Check Faculty registry by UID or email
  let facultyProfile: Faculty | undefined;
  try {
    const facByUid = await getDocs(
      query(collection(db, 'faculty'), where('uid', '==', uid), limit(5))
    );
    const activeByUid = facByUid.docs.find((d) => (d.data() as Faculty).status === 'active');
    if (activeByUid) {
      facultyProfile = { id: activeByUid.id, ...(activeByUid.data() as Omit<Faculty, 'id'>) };
    } else {
      const facByEmail = await getDocs(
        query(collection(db, 'faculty'), where('email', '==', email), limit(5))
      );
      const activeByEmail = facByEmail.docs.find((d) => (d.data() as Faculty).status === 'active');
      if (activeByEmail) {
        facultyProfile = { id: activeByEmail.id, ...(activeByEmail.data() as Omit<Faculty, 'id'>) };
        if (!facultyProfile.uid) {
          await updateDoc(doc(db, 'faculty', activeByEmail.id), {
            uid,
            photoUrl: user.photoURL || '',
            updatedAt: serverTimestamp(),
          });
          facultyProfile.uid = uid;
        }
      }
    }
  } catch {
    // Not a faculty member
  }

  if (facultyProfile) {
    if (intendedPortal === 'student') {
      return {
        role: 'faculty',
        facultyProfile,
        mismatchMessage:
          'This Google account is registered as Faculty. Please sign in using the Faculty Login button.',
      };
    }

    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const accountPayload: UserAccount = {
      uid,
      email,
      displayName: facultyProfile.name || user.displayName || 'Faculty Member',
      photoUrl: user.photoURL || facultyProfile.photoUrl || '',
      role: 'faculty',
      linkedProfileId: facultyProfile.id,
      assignedClassIds: facultyProfile.assignedClassIds || [],
      assignedSubjectIds: facultyProfile.assignedSubjectIds || [],
      status: 'active',
    };
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        ...accountPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: accountPayload.displayName,
        photoUrl: accountPayload.photoUrl || '',
        updatedAt: serverTimestamp(),
      });
    }
    return { role: 'faculty', userAccount: accountPayload, facultyProfile };
  }

  // 3. Check Student registry by UID or email
  let studentProfile: Student | undefined;
  try {
    const stuByUid = await getDocs(
      query(collection(db, 'students'), where('uid', '==', uid), limit(5))
    );
    const activeByUid = stuByUid.docs.find((d) => (d.data() as Student).status === 'active');
    if (activeByUid) {
      studentProfile = { id: activeByUid.id, ...(activeByUid.data() as Omit<Student, 'id'>) };
    } else {
      const stuByEmail = await getDocs(
        query(collection(db, 'students'), where('email', '==', email), limit(5))
      );
      const activeByEmail = stuByEmail.docs.find((d) => (d.data() as Student).status === 'active');
      if (activeByEmail) {
        studentProfile = { id: activeByEmail.id, ...(activeByEmail.data() as Omit<Student, 'id'>) };
        if (!studentProfile.uid) {
          await updateDoc(doc(db, 'students', activeByEmail.id), {
            uid,
            photoUrl: user.photoURL || '',
            updatedAt: serverTimestamp(),
          });
          studentProfile.uid = uid;
        }
      }
    }
  } catch {
    // Not a student
  }

  if (studentProfile) {
    if (intendedPortal === 'faculty') {
      return {
        role: 'student',
        studentProfile,
        mismatchMessage:
          'This Google account is registered as a Student. Please sign in using the Student Login button.',
      };
    }

    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const accountPayload: UserAccount = {
      uid,
      email,
      displayName: studentProfile.name || user.displayName || 'Student',
      photoUrl: user.photoURL || studentProfile.photoUrl || '',
      role: 'student',
      linkedProfileId: studentProfile.id,
      assignedClassIds: [studentProfile.classId],
      assignedSubjectIds: [],
      status: 'active',
    };
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        ...accountPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: accountPayload.displayName,
        photoUrl: accountPayload.photoUrl || '',
        updatedAt: serverTimestamp(),
      });
    }
    return { role: 'student', userAccount: accountPayload, studentProfile };
  }

  return { role: 'unregistered' };
}

export async function submitAccessRequest(params: {
  uid: string;
  email: string;
  displayName: string;
  requestedRole: 'student' | 'faculty';
  rollNumber?: string;
  department?: string;
  notes?: string;
}): Promise<string> {
  try {
    const ref = await addDoc(collection(db, 'accessRequests'), {
      uid: params.uid,
      email: params.email.toLowerCase().trim(),
      displayName: params.displayName.slice(0, 120),
      requestedRole: params.requestedRole,
      rollNumber: (params.rollNumber || '').slice(0, 32),
      department: (params.department || '').slice(0, 120),
      notes: (params.notes || '').slice(0, 400),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'accessRequests');
  }
}

export async function fetchAccessRequests(): Promise<AccessRequest[]> {
  try {
    const snap = await getDocs(query(collection(db, 'accessRequests'), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AccessRequest, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'accessRequests');
  }
}

export async function updateAccessRequestStatus(
  id: string,
  status: 'approved' | 'rejected',
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'accessRequests', id), {
      status,
      reviewedBy: actor.name,
      updatedAt: serverTimestamp(),
    });
    await logActivity({
      action: `Access Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      category: 'auth',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'accessRequest',
      targetId: id,
      targetLabel: id,
      updatedValue: status,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `accessRequests/${id}`);
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}
