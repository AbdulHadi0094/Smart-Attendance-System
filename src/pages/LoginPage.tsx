import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { GraduationCap, BookOpen, ShieldCheck, AlertCircle, Send, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { submitAccessRequest } from '../services/authService';

export default function LoginPage() {
  const {
    firebaseUser,
    role,
    portalSettings,
    authLoading,
    authError,
    mismatchMessage,
    loginWithGoogle,
    logout,
    clearAuthNotices,
  } = useAuth();
  const { showToast } = useToast();

  const [signingInRole, setSigningInRole] = useState<'student' | 'faculty' | null>(null);
  const [logoError, setLogoError] = useState(false);

  // Unregistered account access request form state
  const [reqRole, setReqRole] = useState<'student' | 'faculty'>('student');
  const [reqRoll, setReqRoll] = useState('');
  const [reqDept, setReqDept] = useState('Artificial Intelligence & Machine Learning');
  const [reqNotes, setReqNotes] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);
  const [reqSubmitted, setReqSubmitted] = useState(false);

  if (!authLoading && firebaseUser && role && role !== 'unregistered') {
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'faculty') return <Navigate to="/faculty" replace />;
    return <Navigate to="/student" replace />;
  }

  const handleLogin = async (portal: 'student' | 'faculty') => {
    clearAuthNotices();
    setSigningInRole(portal);
    try {
      await loginWithGoogle(portal);
    } finally {
      setSigningInRole(null);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser?.email) return;
    setSubmittingReq(true);
    try {
      await submitAccessRequest({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email,
        requestedRole: reqRole,
        rollNumber: reqRoll,
        department: reqDept,
        notes: reqNotes,
      });
      setReqSubmitted(true);
      showToast('Access Request Submitted', 'An administrator will review and link your account.', 'success');
    } catch (err) {
      showToast(
        'Request Failed',
        err instanceof Error ? err.message : 'Unable to submit access request.',
        'error'
      );
    } finally {
      setSubmittingReq(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F8FA] text-[#0F1E36]">
      {/* Main Centered Institutional ERP Workspace */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-2xl mx-auto">
          {/* Top Institutional Identity Header */}
          <header className="flex flex-col items-center text-center mb-8">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-[#DDE6EE] bg-white shadow-xs mb-4">
              {!logoError && portalSettings.logoUrl ? (
                <img
                  src={portalSettings.logoUrl}
                  alt={`${portalSettings.shortName} crest`}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="h-14 w-14 object-contain"
                />
              ) : (
                <ShieldCheck className="h-8 w-8 text-[#03CAFC]" />
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F1E36] font-display text-balance">
              {portalSettings.collegeName}
            </h1>

            <p className="mt-1.5 text-sm sm:text-base font-semibold text-[#0284C7]">
              Smart IoT Attendance Management System
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs text-[#5B6B80] font-mono-data tabular-nums">
              <span>Academic Year {portalSettings.academicYear}</span>
              <span aria-hidden="true">·</span>
              <span>Semester {portalSettings.semester}</span>
            </div>
          </header>

          {authLoading ? (
            <div className="mx-auto max-w-md rounded-md border border-[#DDE6EE] bg-white px-6 py-10 text-center shadow-xs">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#03CAFC] border-t-transparent" />
              <p className="mt-3 text-sm font-medium text-[#0F1E36]">
                Checking Google Session...
              </p>
            </div>
          ) : firebaseUser && role === 'unregistered' ? (
            /* Unregistered Authenticated Account -> Access Request Flow */
            <section className="mx-auto max-w-xl rounded-md border border-[#DDE6EE] bg-white p-6 shadow-xs space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Account Not Registered in Portal</p>
                    <p className="mt-0.5 text-amber-800">
                      Signed in as <span className="font-mono-data">{firebaseUser.email}</span>. This email is not yet linked to an active student, faculty, or administrator record.
                    </p>
                  </div>
                </div>
              </div>

              {reqSubmitted ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                  <p className="font-semibold">Request Recorded</p>
                  <p className="mt-1">
                    Your access request has been queued for the {portalSettings.shortName} Administrator. Once approved, sign in again with this Google account.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-3">
                  <div className="text-sm font-semibold text-[#0F1E36]">
                    Request Portal Registration
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#5B6B80] mb-1">
                        Role Requested
                      </label>
                      <select
                        value={reqRole}
                        onChange={(e) => setReqRole(e.target.value as 'student' | 'faculty')}
                        className="w-full rounded-md border border-[#DDE6EE] bg-white px-3 py-2 text-xs text-[#0F1E36] focus:border-[#03CAFC] focus:outline-none"
                      >
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5B6B80] mb-1">
                        {reqRole === 'student' ? 'Roll Number / Student ID' : 'Faculty Code'}
                      </label>
                      <input
                        type="text"
                        value={reqRoll}
                        onChange={(e) => setReqRoll(e.target.value)}
                        placeholder={reqRole === 'student' ? 'e.g. 06' : 'e.g. MCET-AIML-04'}
                        className="w-full rounded-md border border-[#DDE6EE] bg-white px-3 py-2 text-xs text-[#0F1E36] focus:border-[#03CAFC] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5B6B80] mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={reqDept}
                      onChange={(e) => setReqDept(e.target.value)}
                      className="w-full rounded-md border border-[#DDE6EE] bg-white px-3 py-2 text-xs text-[#0F1E36] focus:border-[#03CAFC] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5B6B80] mb-1">
                      Additional Details (Class / Section / Batch)
                    </label>
                    <textarea
                      rows={2}
                      value={reqNotes}
                      onChange={(e) => setReqNotes(e.target.value)}
                      placeholder="e.g. III Semester BE AI&ML - A, Batch B-I"
                      className="w-full rounded-md border border-[#DDE6EE] bg-white px-3 py-2 text-xs text-[#0F1E36] focus:border-[#03CAFC] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingReq}
                    className="inline-flex items-center gap-2 rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36] transition-colors hover:bg-[#02B3E0] disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{submittingReq ? 'Submitting...' : 'Submit Access Request'}</span>
                  </button>
                </form>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-[#DDE6EE] pt-4">
                <button
                  type="button"
                  onClick={() => handleLogin('student')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE6EE] bg-white px-3 py-2 text-xs font-medium text-[#0F1E36] hover:bg-[#F5F8FA]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Switch Google Account</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE6EE] bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </section>
          ) : (
            /* Clean Institutional ERP Sign-In Section */
            <section aria-labelledby="login-heading">
              <div className="text-center mb-6">
                <h2
                  id="login-heading"
                  className="text-lg font-bold text-[#0F1E36] font-display"
                >
                  Sign in to your account
                </h2>
                <p className="mt-1 text-xs text-[#5B6B80]">
                  Select your portal role to continue with Google account selection.
                </p>
              </div>

              {(authError || mismatchMessage) && (
                <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{mismatchMessage || authError}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student Login Rectangular Card */}
                <button
                  type="button"
                  disabled={signingInRole !== null}
                  onClick={() => handleLogin('student')}
                  className="group flex flex-col justify-between rounded-md border border-[#DDE6EE] bg-white p-5 text-left shadow-xs transition-colors hover:border-[#03CAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03CAFC] disabled:opacity-60"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#DDE6EE] bg-[#F5F8FA] text-[#0284C7] transition-colors group-hover:border-[#03CAFC]">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div className="text-base font-bold text-[#0F1E36] font-display">
                        Student Login
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-[#5B6B80] leading-relaxed">
                      Access personal attendance records, subject percentages, and class timetable.
                    </p>
                  </div>

                  <div className="mt-5 flex w-full items-center justify-center rounded bg-[#03CAFC] px-4 py-2.5 text-xs font-semibold text-[#0F1E36] transition-colors group-hover:bg-[#02B3E0] whitespace-nowrap">
                    {signingInRole === 'student' ? 'Opening Google Sign-In...' : 'Sign in with Google'}
                  </div>
                </button>

                {/* Faculty Login Rectangular Card */}
                <button
                  type="button"
                  disabled={signingInRole !== null}
                  onClick={() => handleLogin('faculty')}
                  className="group flex flex-col justify-between rounded-md border border-[#DDE6EE] bg-white p-5 text-left shadow-xs transition-colors hover:border-[#03CAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03CAFC] disabled:opacity-60"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#DDE6EE] bg-[#F5F8FA] text-[#0F1E36] transition-colors group-hover:border-[#03CAFC]">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div className="text-base font-bold text-[#0F1E36] font-display">
                        Faculty Login
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-[#5B6B80] leading-relaxed">
                      Manage assigned classes, attendance entries, period substitutions, and reports.
                    </p>
                  </div>

                  <div className="mt-5 flex w-full items-center justify-center rounded bg-[#03CAFC] px-4 py-2.5 text-xs font-semibold text-[#0F1E36] transition-colors group-hover:bg-[#02B3E0] whitespace-nowrap">
                    {signingInRole === 'faculty' ? 'Opening Google Sign-In...' : 'Sign in with Google'}
                  </div>
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="border-t border-[#DDE6EE] bg-white px-6 py-3 text-center text-xs text-[#5B6B80]">
        {portalSettings.collegeName} ({portalSettings.shortName}) · Smart IoT Attendance Management System
      </footer>
    </div>
  );
}
