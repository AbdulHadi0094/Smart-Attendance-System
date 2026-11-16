import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { DEFAULT_PORTAL_SETTINGS } from '../constants/timetable';
import { auth, testFirestoreConnection } from '../lib/firebase';
import {
  logoutUser,
  ResolvedAuthIdentity,
  resolveUserIdentity,
  signInWithGoogleChooser,
} from '../services/authService';
import { getPortalSettings } from '../services/settingsService';
import { Faculty, PortalSettings, Student, UserAccount, UserRole } from '../types/erp';

interface AuthContextValue {
  firebaseUser: User | null;
  role: UserRole | 'unregistered' | null;
  userAccount: UserAccount | null;
  studentProfile: Student | null;
  facultyProfile: Faculty | null;
  portalSettings: PortalSettings;
  authLoading: boolean;
  authError: string | null;
  mismatchMessage: string | null;
  loginWithGoogle: (intendedPortal: 'student' | 'faculty') => Promise<ResolvedAuthIdentity | null>;
  logout: () => Promise<void>;
  refreshPortalSettings: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
  clearAuthNotices: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | 'unregistered' | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [studentProfile, setStudentProfile] = useState<Student | null>(null);
  const [facultyProfile, setFacultyProfile] = useState<Faculty | null>(null);
  const [portalSettings, setPortalSettings] = useState<PortalSettings>(DEFAULT_PORTAL_SETTINGS);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mismatchMessage, setMismatchMessage] = useState<string | null>(null);

  const refreshPortalSettings = useCallback(async () => {
    const cfg = await getPortalSettings();
    setPortalSettings(cfg);
  }, []);

  useEffect(() => {
    testFirestoreConnection();
    refreshPortalSettings();
  }, [refreshPortalSettings]);

  const applyIdentity = useCallback((identity: ResolvedAuthIdentity) => {
    if (identity.mismatchMessage) {
      setMismatchMessage(identity.mismatchMessage);
      setRole(null);
      setUserAccount(null);
      setStudentProfile(null);
      setFacultyProfile(null);
      return;
    }
    setMismatchMessage(null);
    setRole(identity.role);
    setUserAccount(identity.userAccount || null);
    setStudentProfile(identity.studentProfile || null);
    setFacultyProfile(identity.facultyProfile || null);
  }, []);

  const manualSignInRef = React.useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (manualSignInRef.current) {
        return;
      }
      setAuthLoading(true);
      setAuthError(null);
      if (!user) {
        setFirebaseUser(null);
        setRole(null);
        setUserAccount(null);
        setStudentProfile(null);
        setFacultyProfile(null);
        setAuthLoading(false);
        return;
      }

      setFirebaseUser(user);
      try {
        const identity = await resolveUserIdentity(user);
        applyIdentity(identity);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Unable to verify account role.');
        setRole('unregistered');
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, [applyIdentity]);

  const loginWithGoogle = useCallback(
    async (intendedPortal: 'student' | 'faculty'): Promise<ResolvedAuthIdentity | null> => {
      setAuthError(null);
      setMismatchMessage(null);
      manualSignInRef.current = true;
      try {
        const { user, identity } = await signInWithGoogleChooser(intendedPortal);
        if (identity.mismatchMessage) {
          await logoutUser();
          setFirebaseUser(null);
          applyIdentity(identity);
          return identity;
        }
        setFirebaseUser(user);
        applyIdentity(identity);
        await refreshPortalSettings();
        return identity;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'auth/popup-closed-by-user') {
          setAuthError('Google account selection was cancelled before sign-in completed.');
        } else if (code === 'auth/popup-blocked') {
          setAuthError('Sign-in popup was blocked by your browser. Please allow popups for this portal.');
        } else {
          setAuthError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
        }
        return null;
      } finally {
        manualSignInRef.current = false;
      }
    },
    [applyIdentity, refreshPortalSettings]
  );

  const logout = useCallback(async () => {
    await logoutUser();
    setFirebaseUser(null);
    setRole(null);
    setUserAccount(null);
    setStudentProfile(null);
    setFacultyProfile(null);
    setMismatchMessage(null);
    setAuthError(null);
  }, []);

  const refreshIdentity = useCallback(async () => {
    if (!auth.currentUser) return;
    const identity = await resolveUserIdentity(auth.currentUser);
    applyIdentity(identity);
  }, [applyIdentity]);

  const clearAuthNotices = useCallback(() => {
    setAuthError(null);
    setMismatchMessage(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        role,
        userAccount,
        studentProfile,
        facultyProfile,
        portalSettings,
        authLoading,
        authError,
        mismatchMessage,
        loginWithGoogle,
        logout,
        refreshPortalSettings,
        refreshIdentity,
        clearAuthNotices,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
