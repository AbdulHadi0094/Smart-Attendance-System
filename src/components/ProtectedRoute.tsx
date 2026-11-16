import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/erp';

interface ProtectedRouteProps {
  allowedRole: UserRole;
  children: React.ReactNode;
}

export function ProtectedRoute({ allowedRole, children }: ProtectedRouteProps) {
  const { authLoading, firebaseUser, role } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FA]">
        <div className="w-full max-w-sm rounded-lg border border-[#DDE6EE] bg-white p-6 text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#03CAFC] border-t-transparent" />
          <p className="mt-3 text-sm font-medium text-[#0F1E36]">Verifying Institutional Session</p>
          <p className="mt-1 text-xs text-[#5B6B80]">Checking Firebase permissions...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !role || role === 'unregistered') {
    return <Navigate to="/login" replace />;
  }

  if (role !== allowedRole) {
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'faculty') return <Navigate to="/faculty" replace />;
    return <Navigate to="/student" replace />;
  }

  return <>{children}</>;
}
