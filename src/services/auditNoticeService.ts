import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ActivityLog, Notice, UserRole } from '../types/erp';

export async function logActivity(params: {
  action: string;
  category: ActivityLog['category'];
  performedByUid: string;
  performedByName: string;
  performedByEmail: string;
  performedByRole: UserRole | 'system';
  targetType: string;
  targetId: string;
  targetLabel: string;
  previousValue?: string;
  updatedValue?: string;
  details?: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      action: params.action.slice(0, 160),
      category: params.category,
      performedByUid: params.performedByUid.slice(0, 128),
      performedByName: params.performedByName.slice(0, 120),
      performedByEmail: params.performedByEmail.slice(0, 200),
      performedByRole: params.performedByRole,
      targetType: params.targetType.slice(0, 64),
      targetId: params.targetId.slice(0, 128),
      targetLabel: params.targetLabel.slice(0, 200),
      previousValue: (params.previousValue || '').slice(0, 500),
      updatedValue: (params.updatedValue || '').slice(0, 500),
      details: (params.details || '').slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'activityLogs');
  }
}

function timestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export async function fetchActivityLogs(params: {
  role: UserRole;
  uid: string;
  maxResults?: number;
}): Promise<ActivityLog[]> {
  try {
    const colRef = collection(db, 'activityLogs');
    const maxRes = params.maxResults || (params.role === 'admin' ? 100 : 50);
    const q =
      params.role === 'admin'
        ? query(colRef, orderBy('createdAt', 'desc'), limit(maxRes))
        : query(colRef, where('performedByUid', '==', params.uid), limit(maxRes));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) }))
      .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'activityLogs');
  }
}

export async function fetchNotices(role: UserRole): Promise<Notice[]> {
  try {
    const colRef = collection(db, 'notices');
    const q =
      role === 'student'
        ? query(colRef, where('targetRole', 'in', ['all', 'student']), limit(50))
        : query(colRef, orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Notice, 'id'>) }))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return timestampMillis(b.createdAt) - timestampMillis(a.createdAt);
      });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'notices');
  }
}

export async function createNotice(
  notice: Omit<Notice, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const payload: Record<string, unknown> = {
      title: notice.title.trim().slice(0, 200),
      body: notice.body.trim().slice(0, 2000),
      category: notice.category,
      targetRole: notice.targetRole,
      authorName: notice.authorName.slice(0, 120),
      authorUid: notice.authorUid.slice(0, 128),
      isPinned: Boolean(notice.isPinned),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (notice.classId) payload.classId = notice.classId;
    const ref = await addDoc(collection(db, 'notices'), payload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'notices');
  }
}

export async function updateNotice(
  id: string,
  updates: Partial<Pick<Notice, 'title' | 'body' | 'category' | 'targetRole' | 'isPinned'>>
): Promise<void> {
  try {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.title !== undefined) payload.title = updates.title.trim().slice(0, 200);
    if (updates.body !== undefined) payload.body = updates.body.trim().slice(0, 2000);
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.targetRole !== undefined) payload.targetRole = updates.targetRole;
    if (updates.isPinned !== undefined) payload.isPinned = updates.isPinned;
    await updateDoc(doc(db, 'notices', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notices/${id}`);
  }
}

export async function deleteNotice(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notices', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notices/${id}`);
  }
}
