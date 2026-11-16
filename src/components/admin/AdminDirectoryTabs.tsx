import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Eye,
  X,
} from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../contexts/ToastContext';
import {
  deleteClass,
  deleteSubject,
  saveClass,
  saveDepartment,
  saveSubject,
} from '../../services/academicService';
import {
  deleteFacultyRecord,
  saveFaculty,
  toggleFacultyStatus,
} from '../../services/facultyService';
import {
  deleteStudentRecord,
  saveStudent,
  toggleStudentStatus,
} from '../../services/studentService';
import {
  AcademicClass,
  BatchType,
  Department,
  Faculty,
  Student,
  Subject,
} from '../../types/erp';

interface DirectoryProps {
  actor: { uid: string; name: string; email: string };
  departments: Department[];
  classes: AcademicClass[];
  subjects: Subject[];
  students: Student[];
  facultyList: Faculty[];
  onRefresh: () => Promise<void>;
}

export function AdminStudentsTab({
  actor,
  departments,
  classes,
  students,
  onRefresh,
}: DirectoryProps) {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [batchFilter, setBatchFilter] = useState<'ALL_FILTER' | BatchType>('ALL_FILTER');

  const [editing, setEditing] = useState<Partial<Student> | null>(null);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter !== 'ALL' && s.classId !== classFilter) return false;
      if (batchFilter !== 'ALL_FILTER' && s.batch !== batchFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.rfidUid.toLowerCase().includes(q)
      );
    });
  }, [batchFilter, classFilter, search, students]);

  const openNew = () => {
    const defClass = classes[0];
    setEditing({
      studentId: '',
      rollNumber: '',
      name: '',
      email: '',
      phone: '',
      departmentId: defClass?.departmentId || departments[0]?.id || '',
      departmentName: defClass?.departmentName || departments[0]?.name || '',
      semester: defClass?.semester || 'III',
      classId: defClass?.id || '',
      className: defClass?.name || '',
      section: defClass?.section || 'A',
      batch: 'B-I',
      academicYear: defClass?.academicYear || '2026-27',
      rfidUid: '',
      status: 'active',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name || !editing.rollNumber || !editing.studentId || !editing.email || !editing.classId) {
      showToast('Validation Error', 'Roll No, Student ID, Name, Email, and Class are required.', 'warning');
      return;
    }
    const cls = classes.find((c) => c.id === editing.classId);
    setSaving(true);
    try {
      await saveStudent(
        {
          id: editing.id,
          uid: editing.uid || '',
          studentId: editing.studentId,
          rollNumber: editing.rollNumber,
          name: editing.name,
          email: editing.email,
          phone: editing.phone || '',
          departmentId: cls?.departmentId || editing.departmentId || 'dept_aiml',
          departmentName: cls?.departmentName || editing.departmentName || 'AI&ML',
          semester: cls?.semester || editing.semester || 'III',
          classId: editing.classId,
          className: cls?.name || editing.className || '',
          section: cls?.section || editing.section || 'A',
          batch: (editing.batch as BatchType) || 'B-I',
          academicYear: cls?.academicYear || editing.academicYear || '2026-27',
          rfidUid: editing.rfidUid || '',
          photoUrl: editing.photoUrl || '',
          status: editing.status || 'active',
          isDemo: Boolean(editing.isDemo),
        },
        actor
      );
      showToast('Student Saved', `${editing.rollNumber} · ${editing.name} persisted in Firestore.`, 'success');
      setEditing(null);
      await onRefresh();
    } catch (err) {
      showToast('Save Failed', err instanceof Error ? err.message : 'Unable to save student.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DDE6EE] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#5B6B80]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, roll no, RFID UID, email..."
              className="w-full rounded-md border border-[#DDE6EE] pl-8 pr-3 py-1.5 text-xs focus:border-[#03CAFC] focus:outline-none"
            />
          </div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs"
          >
            <option value="ALL">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value as 'ALL_FILTER' | BatchType)}
            className="rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs"
          >
            <option value="ALL_FILTER">All Batches</option>
            <option value="B-I">Batch B-I</option>
            <option value="B-II">Batch B-II</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#03CAFC] px-3.5 py-2 text-xs font-semibold text-[#0F1E36] hover:bg-[#02B3E0] whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Student</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No Students Registered"
          description="Add individual students with their Google email and RFID card UID, or initialize sample DEMO DATA from Settings."
          actionLabel="Add First Student"
          onAction={openNew}
        />
      ) : (
        <div className="rounded-lg border border-[#DDE6EE] bg-white overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
                <th className="px-4 py-2.5 font-semibold">Roll No</th>
                <th className="px-4 py-2.5 font-semibold">Student ID</th>
                <th className="px-4 py-2.5 font-semibold">Name &amp; Google Email</th>
                <th className="px-4 py-2.5 font-semibold">Class / Batch</th>
                <th className="px-4 py-2.5 font-semibold">RFID UID</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F7]">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-[#FAFCFE]">
                  <td className="px-4 py-2.5 font-mono-data font-bold text-[#0F1E36]">{s.rollNumber}</td>
                  <td className="px-4 py-2.5 font-mono-data text-[#5B6B80]">{s.studentId}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-[#0F1E36]">
                      {s.name} {s.isDemo && <span className="font-mono-data text-[10px] text-amber-700">(DEMO DATA)</span>}
                    </div>
                    <div className="text-[11px] text-[#5B6B80]">{s.email}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-[#0F1E36]">{s.className}</div>
                    <div className="font-mono-data text-[11px] text-[#0284C7]">Batch {s.batch}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono-data text-[#0F1E36]">
                    {s.rfidUid || <span className="text-amber-700">Unassigned</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono-data text-[11px] font-semibold">
                    <span className={s.status === 'active' ? 'text-emerald-700' : 'text-red-700'}>
                      {s.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewing(s)}
                        className="rounded border border-[#DDE6EE] p-1 text-[#5B6B80] hover:text-[#0F1E36]"
                        title="View Profile"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        className="rounded border border-[#DDE6EE] p-1 text-[#5B6B80] hover:text-[#0284C7]"
                        title="Edit Student"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggleStudentStatus(
                            s,
                            s.status === 'active' ? 'inactive' : 'active',
                            actor
                          ).then(onRefresh)
                        }
                        className="rounded border border-[#DDE6EE] p-1 text-[#5B6B80] hover:text-amber-700"
                        title={s.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        {s.status === 'active' ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(s)}
                        className="rounded border border-[#DDE6EE] p-1 text-[#5B6B80] hover:text-red-700"
                        title="Delete Student"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Student Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-xl rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3.5 shadow-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#DDE6EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F1E36]">
                {editing.id ? 'Edit Student Record' : 'Register New Student'}
              </h3>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="h-4 w-4 text-[#5B6B80]" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Roll Number *</label>
                <input
                  type="text"
                  required
                  value={editing.rollNumber || ''}
                  onChange={(e) => setEditing({ ...editing, rollNumber: e.target.value })}
                  placeholder="e.g. 06"
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs font-mono-data"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Student ID *</label>
                <input
                  type="text"
                  required
                  value={editing.studentId || ''}
                  onChange={(e) => setEditing({ ...editing, studentId: e.target.value })}
                  placeholder="e.g. 160725748006"
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs font-mono-data"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">
                  Linked Google Account Email *
                </label>
                <input
                  type="email"
                  required
                  value={editing.email || ''}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  placeholder="student@gmail.com"
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Class &amp; Section *</label>
                <select
                  value={editing.classId || ''}
                  onChange={(e) => setEditing({ ...editing, classId: e.target.value })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Lab Batch *</label>
                <select
                  value={editing.batch || 'B-I'}
                  onChange={(e) => setEditing({ ...editing, batch: e.target.value as BatchType })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                >
                  <option value="B-I">Batch B-I</option>
                  <option value="B-II">Batch B-II</option>
                  <option value="ALL">ALL</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">RFID Card UID</label>
                <input
                  type="text"
                  value={editing.rfidUid || ''}
                  onChange={(e) => setEditing({ ...editing, rfidUid: e.target.value })}
                  placeholder="e.g. 04A1B2C3"
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs font-mono-data uppercase"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Phone (Optional)</label>
                <input
                  type="text"
                  value={editing.phone || ''}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#EEF3F7] pt-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-[#DDE6EE] px-3.5 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36]"
              >
                {saving ? 'Saving...' : 'Save Student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Student Profile Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#DDE6EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F1E36]">Student Profile</h3>
              <button type="button" onClick={() => setViewing(null)}>
                <X className="h-4 w-4 text-[#5B6B80]" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-[#5B6B80]">Name:</span><div className="font-semibold">{viewing.name}</div></div>
              <div><span className="text-[#5B6B80]">Roll No:</span><div className="font-mono-data font-bold">{viewing.rollNumber}</div></div>
              <div><span className="text-[#5B6B80]">Student ID:</span><div className="font-mono-data">{viewing.studentId}</div></div>
              <div><span className="text-[#5B6B80]">Batch:</span><div className="font-mono-data text-[#0284C7]">{viewing.batch}</div></div>
              <div className="col-span-2"><span className="text-[#5B6B80]">Class:</span><div>{viewing.className} (Sem {viewing.semester} · Sec {viewing.section})</div></div>
              <div className="col-span-2"><span className="text-[#5B6B80]">Google Email:</span><div className="font-mono-data">{viewing.email}</div></div>
              <div><span className="text-[#5B6B80]">RFID UID:</span><div className="font-mono-data">{viewing.rfidUid || 'Unassigned'}</div></div>
              <div><span className="text-[#5B6B80]">UID Linked:</span><div className="font-mono-data">{viewing.uid ? 'Yes' : 'Pending 1st Login'}</div></div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Student Record"
        message={`Permanently delete ${deleting?.rollNumber} · ${deleting?.name}? Historical attendance documents will remain archived unless deleted separately.`}
        confirmLabel="Delete Student"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteStudentRecord(deleting, actor);
          setDeleting(null);
          showToast('Student Deleted', 'Student record removed from Firestore.', 'info');
          await onRefresh();
        }}
      />
    </div>
  );
}

export function AdminFacultyTab({
  actor,
  departments,
  classes,
  subjects,
  facultyList,
  onRefresh,
}: DirectoryProps) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState<Partial<Faculty> | null>(null);
  const [deleting, setDeleting] = useState<Faculty | null>(null);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing({
      facultyCode: '',
      name: '',
      email: '',
      departmentId: departments[0]?.id || 'dept_aiml',
      departmentName: departments[0]?.name || 'Artificial Intelligence & Machine Learning',
      designation: 'Assistant Professor',
      assignedClassIds: classes.map((c) => c.id),
      assignedSubjectIds: [],
      canSubstitute: true,
      canCorrectAttendance: true,
      status: 'active',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name || !editing.email || !editing.facultyCode) return;
    setSaving(true);
    try {
      await saveFaculty(
        {
          id: editing.id,
          uid: editing.uid || '',
          facultyCode: editing.facultyCode,
          name: editing.name,
          email: editing.email,
          departmentId: editing.departmentId || 'dept_aiml',
          departmentName: editing.departmentName || 'AI&ML',
          designation: editing.designation || 'Assistant Professor',
          assignedClassIds: editing.assignedClassIds || [],
          assignedSubjectIds: editing.assignedSubjectIds || [],
          canSubstitute: Boolean(editing.canSubstitute),
          canCorrectAttendance: Boolean(editing.canCorrectAttendance),
          photoUrl: editing.photoUrl || '',
          status: editing.status || 'active',
          isDemo: Boolean(editing.isDemo),
        },
        actor
      );
      showToast('Faculty Saved', `${editing.name} updated in Firestore.`, 'success');
      setEditing(null);
      await onRefresh();
    } catch (err) {
      showToast('Save Failed', err instanceof Error ? err.message : 'Unable to save faculty.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleArr = (arr: string[] = [], val: string) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-[#DDE6EE] bg-white p-4">
        <div>
          <h2 className="text-sm font-bold text-[#0F1E36] font-display">Faculty Directory &amp; Permissions</h2>
          <p className="text-xs text-[#5B6B80]">Manage faculty Google accounts, assigned classes, subjects, and substitution privileges.</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#03CAFC] px-3.5 py-2 text-xs font-semibold text-[#0F1E36] hover:bg-[#02B3E0]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Faculty</span>
        </button>
      </div>

      <div className="rounded-lg border border-[#DDE6EE] bg-white overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
              <th className="px-4 py-2.5 font-semibold">Code</th>
              <th className="px-4 py-2.5 font-semibold">Name &amp; Google Email</th>
              <th className="px-4 py-2.5 font-semibold">Assigned Subjects</th>
              <th className="px-4 py-2.5 font-semibold">Permissions</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF3F7]">
            {facultyList.map((f) => (
              <tr key={f.id} className="hover:bg-[#FAFCFE]">
                <td className="px-4 py-2.5 font-mono-data font-semibold">{f.facultyCode}</td>
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-[#0F1E36]">{f.name}</div>
                  <div className="text-[11px] text-[#5B6B80]">{f.email} · {f.designation}</div>
                </td>
                <td className="px-4 py-2.5 text-[#5B6B80]">
                  {f.assignedSubjectIds
                    .map((id) => subjects.find((s) => s.id === id)?.shortName || id)
                    .join(', ') || 'None'}
                </td>
                <td className="px-4 py-2.5 text-[11px] font-mono-data">
                  {f.canSubstitute ? 'Substitute' : 'No Sub'} · {f.canCorrectAttendance ? 'Correct' : 'View'}
                </td>
                <td className="px-4 py-2.5 font-mono-data text-[11px] font-semibold">
                  <span className={f.status === 'active' ? 'text-emerald-700' : 'text-red-700'}>
                    {f.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(f)}
                      className="rounded border border-[#DDE6EE] p-1 text-[#5B6B80] hover:text-[#0284C7]"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        toggleFacultyStatus(f, f.status === 'active' ? 'inactive' : 'active', actor).then(onRefresh)
                      }
                      className="rounded border border-[#DDE6EE] p-1 text-[#5B6B80] hover:text-amber-700"
                    >
                      {f.status === 'active' ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(f)}
                      className="rounded border border-[#DDE6EE] p-1 text-[#5B6B80] hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-xl rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3.5 shadow-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#DDE6EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F1E36]">
                {editing.id ? 'Edit Faculty Profile' : 'Add Faculty Member'}
              </h3>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="h-4 w-4 text-[#5B6B80]" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Faculty Code *</label>
                <input
                  type="text"
                  required
                  value={editing.facultyCode || ''}
                  onChange={(e) => setEditing({ ...editing, facultyCode: e.target.value })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs font-mono-data"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Designation *</label>
                <input
                  type="text"
                  required
                  value={editing.designation || ''}
                  onChange={(e) => setEditing({ ...editing, designation: e.target.value })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5B6B80] mb-1">Google Account Email *</label>
                <input
                  type="email"
                  required
                  value={editing.email || ''}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#5B6B80] mb-1.5">Assigned Classes</label>
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => (
                  <label key={c.id} className="inline-flex items-center gap-1.5 rounded border border-[#DDE6EE] px-2.5 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={(editing.assignedClassIds || []).includes(c.id)}
                      onChange={() =>
                        setEditing({
                          ...editing,
                          assignedClassIds: toggleArr(editing.assignedClassIds, c.id),
                        })
                      }
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#5B6B80] mb-1.5">Assigned Subjects</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto border border-[#DDE6EE] rounded-md p-2">
                {subjects.map((s) => (
                  <label key={s.id} className="inline-flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={(editing.assignedSubjectIds || []).includes(s.id)}
                      onChange={() =>
                        setEditing({
                          ...editing,
                          assignedSubjectIds: toggleArr(editing.assignedSubjectIds, s.id),
                        })
                      }
                    />
                    <span className="truncate">{s.shortName}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1 text-xs">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editing.canSubstitute)}
                  onChange={(e) => setEditing({ ...editing, canSubstitute: e.target.checked })}
                />
                <span>Allow Temporary Substitutions</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editing.canCorrectAttendance)}
                  onChange={(e) => setEditing({ ...editing, canCorrectAttendance: e.target.checked })}
                />
                <span>Allow Attendance Corrections</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#EEF3F7] pt-3">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-[#DDE6EE] px-3.5 py-2 text-xs">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-md bg-[#03CAFC] px-4 py-2 text-xs font-semibold text-[#0F1E36]">
                {saving ? 'Saving...' : 'Save Faculty'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Faculty Record"
        message={`Remove ${deleting?.name} from the active faculty directory?`}
        confirmLabel="Delete Faculty"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteFacultyRecord(deleting, actor);
          setDeleting(null);
          showToast('Faculty Removed', 'Faculty record deleted.', 'info');
          await onRefresh();
        }}
      />
    </div>
  );
}

export function AdminSubjectsAndClassesTab({
  actor,
  departments,
  classes,
  subjects,
  facultyList,
  onRefresh,
}: DirectoryProps) {
  const { showToast } = useToast();
  const [subModal, setSubModal] = useState<Partial<Subject> | null>(null);
  const [classModal, setClassModal] = useState<Partial<AcademicClass> | null>(null);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deletingSub, setDeletingSub] = useState<Subject | null>(null);
  const [deletingClass, setDeletingClass] = useState<AcademicClass | null>(null);

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subModal || !subModal.shortName || !subModal.name || !subModal.classId) return;
    const facNames = (subModal.facultyIds || []).map(
      (id) => facultyList.find((f) => f.id === id)?.name || id
    );
    await saveSubject(
      {
        id: subModal.id,
        code: subModal.code || '',
        shortName: subModal.shortName,
        name: subModal.name,
        type: subModal.type || 'theory',
        departmentId: subModal.departmentId || departments[0]?.id || 'dept_aiml',
        classId: subModal.classId,
        facultyIds: subModal.facultyIds || [],
        facultyNames: facNames,
        status: subModal.status || 'active',
      },
      actor
    );
    setSubModal(null);
    showToast('Subject Saved', `${subModal.shortName} updated.`, 'success');
    await onRefresh();
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classModal || !classModal.name || !classModal.classroom) return;
    const dept = departments.find((d) => d.id === classModal.departmentId);
    await saveClass(
      {
        id: classModal.id,
        departmentId: classModal.departmentId || departments[0]?.id || 'dept_aiml',
        departmentName: dept?.name || classModal.departmentName || 'AI&ML',
        academicYear: classModal.academicYear || '2026-27',
        semester: classModal.semester || 'III',
        name: classModal.name,
        section: classModal.section || 'A',
        classroom: classModal.classroom,
        batches: classModal.batches || ['B-I', 'B-II'],
        status: classModal.status || 'active',
      },
      actor
    );
    setClassModal(null);
    showToast('Class Saved', `${classModal.name} updated.`, 'success');
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Subjects Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-[#DDE6EE] bg-white p-4">
          <div>
            <h2 className="text-sm font-bold text-[#0F1E36] font-display">
              Theory, Lab &amp; Activity Subjects ({subjects.length})
            </h2>
            <p className="text-xs text-[#5B6B80]">Course codes are editable and left blank until verified.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setSubModal({
                code: '',
                shortName: '',
                name: '',
                type: 'theory',
                departmentId: departments[0]?.id || 'dept_aiml',
                classId: classes[0]?.id || '',
                facultyIds: [],
                facultyNames: [],
                status: 'active',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-[#03CAFC] px-3.5 py-2 text-xs font-semibold text-[#0F1E36]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Subject</span>
          </button>
        </div>

        <div className="rounded-lg border border-[#DDE6EE] bg-white overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#DDE6EE] bg-[#F8FAFC] text-[#5B6B80]">
                <th className="px-4 py-2.5 font-semibold">Course Code</th>
                <th className="px-4 py-2.5 font-semibold">Short Name</th>
                <th className="px-4 py-2.5 font-semibold">Subject Title</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Faculty</th>
                <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F7]">
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-mono-data text-[#5B6B80]">{s.code || '—'}</td>
                  <td className="px-4 py-2 font-bold text-[#0F1E36]">{s.shortName}</td>
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 uppercase font-mono-data text-[11px] text-[#0284C7]">{s.type}</td>
                  <td className="px-4 py-2 text-[#5B6B80]">{s.facultyNames.join(' / ') || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button type="button" onClick={() => setSubModal(s)} className="rounded border border-[#DDE6EE] p-1">
                        <Edit2 className="h-3.5 w-3.5 text-[#5B6B80]" />
                      </button>
                      <button type="button" onClick={() => setDeletingSub(s)} className="rounded border border-[#DDE6EE] p-1">
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Classes & Departments Section */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-lg border border-[#DDE6EE] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F1E36] font-display">Classes &amp; Sections</h3>
            <button
              type="button"
              onClick={() =>
                setClassModal({
                  departmentId: departments[0]?.id || '',
                  academicYear: '2026-27',
                  semester: 'III',
                  name: '',
                  section: 'A',
                  classroom: 'LH-E-303',
                  batches: ['B-I', 'B-II'],
                  status: 'active',
                })
              }
              className="rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-semibold hover:border-[#03CAFC]"
            >
              + Add Class
            </button>
          </div>
          <div className="divide-y divide-[#EEF3F7]">
            {classes.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <div className="font-bold text-[#0F1E36]">{c.name}</div>
                  <div className="text-[#5B6B80] font-mono-data">
                    {c.departmentName} · Room {c.classroom} · Batches {c.batches.join(', ')}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setClassModal(c)} className="rounded border border-[#DDE6EE] p-1">
                    <Edit2 className="h-3.5 w-3.5 text-[#5B6B80]" />
                  </button>
                  <button type="button" onClick={() => setDeletingClass(c)} className="rounded border border-[#DDE6EE] p-1">
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-lg border border-[#DDE6EE] bg-white p-4 space-y-3">
          <h3 className="text-sm font-bold text-[#0F1E36] font-display">Departments</h3>
          <div className="divide-y divide-[#EEF3F7]">
            {departments.map((d) => (
              <div key={d.id} className="py-2 text-xs flex justify-between">
                <span className="font-semibold text-[#0F1E36]">{d.name}</span>
                <span className="font-mono-data text-[#0284C7]">{d.code}</span>
              </div>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!deptCode || !deptName) return;
              await saveDepartment({ code: deptCode, name: deptName, status: 'active' }, actor);
              setDeptCode('');
              setDeptName('');
              showToast('Department Added', deptName, 'success');
              await onRefresh();
            }}
            className="border-t border-[#EEF3F7] pt-3 space-y-2"
          >
            <div className="text-[11px] font-semibold text-[#5B6B80]">Add New Department</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Code (CSE)"
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                className="w-24 rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs font-mono-data"
              />
              <input
                type="text"
                placeholder="Department Name"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                className="flex-1 rounded-md border border-[#DDE6EE] px-2.5 py-1.5 text-xs"
              />
              <button type="submit" className="rounded-md bg-[#0F1E36] px-3 py-1.5 text-xs font-semibold text-white">
                Add
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Subject Modal */}
      {subModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleSaveSubject} className="w-full max-w-lg rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#DDE6EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F1E36]">{subModal.id ? 'Edit Subject' : 'Add Subject'}</h3>
              <button type="button" onClick={() => setSubModal(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Course Code (Editable)</label>
                <input
                  type="text"
                  value={subModal.code || ''}
                  onChange={(e) => setSubModal({ ...subModal, code: e.target.value })}
                  placeholder="Optional"
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Short Name *</label>
                <input
                  type="text"
                  required
                  value={subModal.shortName || ''}
                  onChange={(e) => setSubModal({ ...subModal, shortName: e.target.value })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-[#5B6B80] mb-1">Full Subject Name *</label>
                <input
                  type="text"
                  required
                  value={subModal.name || ''}
                  onChange={(e) => setSubModal({ ...subModal, name: e.target.value })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Type</label>
                <select
                  value={subModal.type || 'theory'}
                  onChange={(e) => setSubModal({ ...subModal, type: e.target.value as Subject['type'] })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs"
                >
                  <option value="theory">Theory</option>
                  <option value="lab">Lab / Practical</option>
                  <option value="activity">Activity</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Class</label>
                <select
                  value={subModal.classId || ''}
                  onChange={(e) => setSubModal({ ...subModal, classId: e.target.value })}
                  className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs"
                >
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setSubModal(null)} className="rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs">Cancel</button>
              <button type="submit" className="rounded-md bg-[#03CAFC] px-4 py-1.5 text-xs font-semibold text-[#0F1E36]">Save Subject</button>
            </div>
          </form>
        </div>
      )}

      {/* Class Modal */}
      {classModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleSaveClass} className="w-full max-w-lg rounded-lg border border-[#DDE6EE] bg-white p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#DDE6EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F1E36]">{classModal.id ? 'Edit Class' : 'Add Class'}</h3>
              <button type="button" onClick={() => setClassModal(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] text-[#5B6B80] mb-1">Class Display Name *</label>
                <input type="text" required value={classModal.name || ''} onChange={(e) => setClassModal({ ...classModal, name: e.target.value })} placeholder="e.g. III Semester BE AI&ML - A" className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs" />
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Department</label>
                <select value={classModal.departmentId || ''} onChange={(e) => setClassModal({ ...classModal, departmentId: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs">
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Academic Year</label>
                <input type="text" value={classModal.academicYear || ''} onChange={(e) => setClassModal({ ...classModal, academicYear: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data" />
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Semester</label>
                <input type="text" value={classModal.semester || ''} onChange={(e) => setClassModal({ ...classModal, semester: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs" />
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B80] mb-1">Section</label>
                <input type="text" value={classModal.section || ''} onChange={(e) => setClassModal({ ...classModal, section: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs" />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-[#5B6B80] mb-1">Default Classroom *</label>
                <input type="text" required value={classModal.classroom || ''} onChange={(e) => setClassModal({ ...classModal, classroom: e.target.value })} className="w-full rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs font-mono-data" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setClassModal(null)} className="rounded-md border border-[#DDE6EE] px-3 py-1.5 text-xs">Cancel</button>
              <button type="submit" className="rounded-md bg-[#03CAFC] px-4 py-1.5 text-xs font-semibold text-[#0F1E36]">Save Class</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingSub)}
        title="Delete Subject"
        message={`Delete ${deletingSub?.shortName} · ${deletingSub?.name}?`}
        onCancel={() => setDeletingSub(null)}
        onConfirm={async () => {
          if (!deletingSub) return;
          await deleteSubject(deletingSub.id, deletingSub.shortName, actor);
          setDeletingSub(null);
          await onRefresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingClass)}
        title="Delete Class"
        message={`Delete ${deletingClass?.name}?`}
        onCancel={() => setDeletingClass(null)}
        onConfirm={async () => {
          if (!deletingClass) return;
          await deleteClass(deletingClass.id, deletingClass.name, actor);
          setDeletingClass(null);
          await onRefresh();
        }}
      />
    </div>
  );
}
