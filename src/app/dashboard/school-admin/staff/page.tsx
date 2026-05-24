// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Plus, Trash2, GraduationCap, DoorOpen, Shield, User, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import FaceCapture from '@/components/shared/FaceCapture';
import StudentAvatar from '@/components/shared/StudentAvatar';

const ACCESS_OPTIONS = [
  { value: 'staff', label: 'Staff (sign-in + own attendance)', icon: User },
  { value: 'teacher', label: 'Class teacher (class + dismissal)', icon: GraduationCap },
  { value: 'gate_officer', label: 'Gate officer', icon: DoorOpen },
  { value: 'school_admin', label: 'School admin', icon: Shield },
];

export default function StaffManagementPage() {
  const [staff, setStaff] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) {
        setLoading(false);
        return;
      }
      setSchoolId(schoolData.school_id);

      const [staffRes, rolesRes] = await Promise.all([
        fetch(`/api/schools/staff?school_id=${schoolData.school_id}&ensure_profiles=1`, {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch(`/api/schools/custom-roles?school_id=${schoolData.school_id}`, {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);

      const staffData = await staffRes.json();
      const rolesData = await rolesRes.json();
      setStaff(staffData.staff || []);
      setCustomRoles(rolesData.roles || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleDelete = async (roleId, name) => {
    if (!confirm(`Remove ${name}?`)) return;
    await fetch('/api/staff/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: roleId }),
    });
    toast.success('Removed');
    loadStaff();
  };

  const getRoleIcon = (role) => {
    if (role === 'teacher') return <GraduationCap size={14} className="text-blue-600" />;
    if (role === 'gate_officer') return <DoorOpen size={14} className="text-orange-600" />;
    if (role === 'school_admin') return <Shield size={14} className="text-purple-600" />;
    return <User size={14} className="text-slate-600" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center md:ml-56">
        <div className="animate-pulse text-primary-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen md:ml-56 pt-14 md:pt-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 pr-12 md:pr-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Staff ({staff.length})</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Most people are <strong>Staff</strong> (accountant, cleaner, subject teacher) — sign in at gate, own attendance only.
            Class teachers get the teacher app.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center justify-center gap-2 text-sm shrink-0 w-full sm:w-auto"
        >
          <Plus size={16} /> Add staff
        </button>
      </div>

      <CustomRolesPanel schoolId={schoolId} roles={customRoles} onChange={loadStaff} />

      <div className="card-elevated divide-y divide-slate-100 mt-6">
        {staff.map((s) => (
          <div key={s.id} className="list-row gap-4">
            <StudentAvatar
              photoUrl={s.staff?.photo_url}
              firstName={s.profile?.full_name?.split(' ')[0]}
              lastName={s.profile?.full_name?.split(' ').slice(1).join(' ')}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{s.profile?.full_name || 'Unknown'}</p>
              <p className="text-xs text-slate-500 truncate">{s.profile?.email}</p>
              {s.staff?.staff_id_number && (
                <p className="text-xs font-mono text-slate-600">{s.staff.staff_id_number}</p>
              )}
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 capitalize flex items-center gap-1 shrink-0 max-w-[140px] truncate">
              {getRoleIcon(s.role)} {s.job_title || s.role.replace('_', ' ')}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(s.id, s.profile?.full_name)}
              className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 shrink-0"
              aria-label="Remove staff"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {staff.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">No staff yet — add job roles above, then add people</div>
        )}
      </div>

      {showAddModal && (
        <AddStaffModal
          schoolId={schoolId}
          customRoles={customRoles}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadStaff();
          }}
        />
      )}
    </div>
  );
}

function CustomRolesPanel({ schoolId, roles, onChange }) {
  const [name, setName] = useState('');
  const [canAssignClass, setCanAssignClass] = useState(false);
  const [saving, setSaving] = useState(false);

  const addRole = async () => {
    if (!name.trim()) {
      toast.error('Enter a role name');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/schools/custom-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ school_id: schoolId, name: name.trim(), can_assign_class: canAssignClass }),
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Failed');
    else {
      toast.success('Role added');
      setName('');
      setCanAssignClass(false);
      onChange();
    }
    setSaving(false);
  };

  const addPreset = async (presetName, assignClass) => {
    setSaving(true);
    const res = await fetch('/api/schools/custom-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        school_id: schoolId,
        name: presetName,
        can_assign_class: assignClass,
      }),
    });
    if (res.ok) {
      toast.success(`${presetName} added`);
      onChange();
    }
    setSaving(false);
  };

  const removeRole = async (id) => {
    if (!confirm('Remove this job role? Existing staff keep their title until you edit them.')) return;
    await fetch(`/api/schools/custom-roles?id=${id}&school_id=${schoolId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    toast.success('Role removed');
    onChange();
  };

  return (
    <div className="card-elevated p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase size={18} className="text-primary-700" />
        <h2 className="font-bold text-slate-900">School job roles</h2>
      </div>
      <p className="text-xs text-slate-500">
        Create titles like Accountant, Cleaner, Subject teacher. Only roles marked &quot;class teacher&quot; can be linked to a class.
      </p>

      <div className="flex flex-wrap gap-2">
        {['Accountant', 'Cleaner', 'Subject teacher', 'Class teacher'].map((p) => {
          const exists = roles.some((r) => r.name.toLowerCase() === p.toLowerCase());
          if (exists) return null;
          return (
            <button
              key={p}
              type="button"
              disabled={saving}
              onClick={() => addPreset(p, p === 'Class teacher')}
              className="text-xs px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              + {p}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          className="input flex-1"
          placeholder="New role name (e.g. Librarian)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="flex items-center gap-2 text-xs text-slate-600 shrink-0 px-2">
          <input type="checkbox" checked={canAssignClass} onChange={(e) => setCanAssignClass(e.target.checked)} />
          Can be class teacher
        </label>
        <button type="button" onClick={addRole} disabled={saving} className="btn-primary text-sm shrink-0">
          Add role
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <span
            key={r.id}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary-50 text-primary-900 border border-primary-100"
          >
            {r.name}
            {r.can_assign_class && <span className="text-[10px] opacity-70">· class</span>}
            <button type="button" onClick={() => removeRole(r.id)} className="text-primary-400 hover:text-red-600 ml-1">
              ×
            </button>
          </span>
        ))}
        {roles.length === 0 && <span className="text-xs text-slate-400">No custom roles yet</span>}
      </div>
    </div>
  );
}

function AddStaffModal({ schoolId, customRoles, onClose, onSuccess }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    access_role: 'staff',
    custom_role_id: '',
    class_id: '',
  });
  const [faceData, setFaceData] = useState({ photos: [], face_descriptor: null });
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);

  const selectedCustom = customRoles.find((r) => r.id === form.custom_role_id);
  const mayAssignClass =
    form.access_role === 'teacher' || (form.access_role === 'staff' && selectedCustom?.can_assign_class);

  useEffect(() => {
    fetchData('get_classes', { school_id: schoolId })
      .then((d) => setClasses(d.classes || []))
      .catch(() => {});
  }, [schoolId]);

  useEffect(() => {
    if (form.access_role === 'staff' && customRoles.length === 1) {
      setForm((f) => ({ ...f, custom_role_id: customRoles[0].id }));
    }
  }, [customRoles, form.access_role]);

  const handleSubmit = async () => {
    if (!form.full_name || !form.email) {
      toast.error('Name and email required');
      return;
    }
    if (form.access_role === 'staff' && !form.custom_role_id) {
      toast.error('Select a job role (create one above if empty)');
      return;
    }
    if (form.access_role === 'gate_officer' && faceData.photos.length < 3) {
      toast.error('Gate officers need 3 face photos');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/staff/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        role: form.access_role,
        school_id: schoolId,
        custom_role_id: form.access_role === 'staff' ? form.custom_role_id : null,
        class_id: mayAssignClass ? form.class_id || null : null,
        photo_base64: faceData.photos[0] || null,
        face_photos: faceData.photos,
        face_descriptor: faceData.face_descriptor,
        skip_face: form.access_role !== 'gate_officer',
      }),
    });
    if (res.ok) {
      toast.success('Staff added');
      onSuccess();
    } else {
      const d = await res.json();
      toast.error(d.error || 'Failed');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Add staff member</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full name *</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">App access *</label>
            <select
              value={form.access_role}
              onChange={(e) =>
                setForm({ ...form, access_role: e.target.value, class_id: '', custom_role_id: '' })
              }
              className="input"
            >
              {ACCESS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {form.access_role === 'staff' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Job title *</label>
              <select
                value={form.custom_role_id}
                onChange={(e) => setForm({ ...form, custom_role_id: e.target.value, class_id: '' })}
                className="input"
              >
                <option value="">Select role...</option>
                {customRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.can_assign_class ? ' (may have class)' : ''}
                  </option>
                ))}
              </select>
              {customRoles.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">Add job roles on the staff page first.</p>
              )}
            </div>
          )}

          {mayAssignClass && classes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assign class (optional)</label>
              <select
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                className="input"
              >
                <option value="">No class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.access_role === 'gate_officer' && (
            <div className="border-t pt-3">
              <FaceCapture label="Gate face enrollment" minPhotos={3} maxPhotos={3} onChange={setFaceData} />
            </div>
          )}

          {form.access_role === 'staff' && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
              Staff sign in with their ID card at the gate. They only see their own attendance in the app — not other
              people&apos;s.
            </p>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Adding...' : 'Add staff'}
          </button>
        </div>
      </div>
    </div>
  );
}
