import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { DEFAULT_PORTAL_SETTINGS } from '../constants/timetable';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { PortalSettings } from '../types/erp';
import { logActivity } from './auditNoticeService';

export async function getPortalSettings(): Promise<PortalSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'portal_config'));
    if (!snap.exists()) {
      return DEFAULT_PORTAL_SETTINGS;
    }
    const data = snap.data() as PortalSettings;
    const resolvedLogo =
      !data.logoUrl || data.logoUrl.startsWith('/src/assets/')
        ? DEFAULT_PORTAL_SETTINGS.logoUrl
        : data.logoUrl;
    return { ...DEFAULT_PORTAL_SETTINGS, ...data, logoUrl: resolvedLogo };
  } catch (error) {
    console.warn('Could not load portal_config, using defaults:', error);
    return DEFAULT_PORTAL_SETTINGS;
  }
}

export async function savePortalSettings(
  settings: PortalSettings,
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'portal_config'), {
      collegeName: settings.collegeName.trim().slice(0, 200),
      shortName: settings.shortName.trim().slice(0, 40),
      logoUrl: (settings.logoUrl || '').trim().slice(0, 500),
      academicYear: settings.academicYear.trim().slice(0, 32),
      semester: settings.semester.trim().slice(0, 32),
      effectiveFrom: (settings.effectiveFrom || '').trim().slice(0, 32),
      defaultClassroom: (settings.defaultClassroom || 'LH-E-303').trim().slice(0, 64),
      timezone: settings.timezone || 'Asia/Kolkata',
      lowAttendanceThreshold: Number(settings.lowAttendanceThreshold) || 75,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });

    await logActivity({
      action: 'Updated Portal Branding & Settings',
      category: 'settings',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'settings',
      targetId: 'portal_config',
      targetLabel: settings.collegeName,
      updatedValue: `${settings.shortName} · ${settings.academicYear} · Threshold ${settings.lowAttendanceThreshold}%`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/portal_config');
  }
}

export interface AdminRecord {
  uid: string;
  email: string;
  name: string;
  createdAt?: unknown;
  createdBy?: string;
}

export async function listAdmins(): Promise<AdminRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map((d) => d.data() as AdminRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admins');
  }
}

export async function addAuthorizedAdmin(
  admin: { uid: string; email: string; name: string },
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await setDoc(doc(db, 'admins', admin.uid.trim()), {
      uid: admin.uid.trim(),
      email: admin.email.trim().toLowerCase(),
      name: admin.name.trim().slice(0, 120),
      createdAt: serverTimestamp(),
      createdBy: actor.uid,
    });
    await logActivity({
      action: 'Authorized New System Administrator',
      category: 'auth',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'admin',
      targetId: admin.uid,
      targetLabel: admin.email,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `admins/${admin.uid}`);
  }
}

export async function removeAuthorizedAdmin(
  uid: string,
  actor: { uid: string; name: string; email: string }
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'admins', uid));
    await logActivity({
      action: 'Revoked Administrator Access',
      category: 'auth',
      performedByUid: actor.uid,
      performedByName: actor.name,
      performedByEmail: actor.email,
      performedByRole: 'admin',
      targetType: 'admin',
      targetId: uid,
      targetLabel: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
  }
}
