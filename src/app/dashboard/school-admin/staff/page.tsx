// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Plus, Trash2, Shield, GraduationCap, DoorOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function StaffManagementPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => { loadStaff(); }, []);

  const loadStaff = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setLoading(false); return; }
      setSchoolId(schoolData.school_id);

      const result = await fetchData('query', {
        table: 'user_school_roles',
        select: '*, profile:user_profiles(*)',
        filters: { school_id: schoolData.school_id, is_active: true },
      });

      const staffList = (result.data || []).filter((r: any) =>
        ['school_admin', 'teacher', 'gate_officer'].includes(r.role)
      );
      setStaff(staffList);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const getRoleIcon = (role: string) => {
    if (role === 'teacher') return <GraduationCap size={14} className="text-blue-600" />;
    if (role === 'gate_officer') return <DoorOpen size={14} className="text-orange-600" />;
    return <Shield size={14} className="text-purple-600" />;
  };

  const getRoleBadge = (role: string) => {
    if (role === 'teacher') return 'bg-blue-50 text-blue-700';
    if (role === 'gate_officer') return 'bg-orange-50 text-orange-700';
    return 'bg-purple-50 text-purple-700';
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading staff...</div></div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Staff ({staff.length})</h1>
          <p className="text-sm text-gray-500">Teachers and gate officers</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Staff
        </button>
      </div>

      <div className="space-y-3">
        {staff.map((s: any) => (
          <div key={s.id} className="card flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
              {s.profile?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{s.profile?.full_name || 'Unknown'}</p>
              <p className="text-xs text-gray-500">{s.profile?.email}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize flex items-center gap-1 ${getRoleBadge(s.role)}`}>
              {getRoleIcon(s.role)}
              {s.role.replace('_', ' ')}
            </span>
            <button onClick={() => {
              if (confirm(`Remove ${s.profile?.full_name}?`)) {
                fetch('/api/staff/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id: s.id }) })
                  .then(() => { toast.success('Staff removed'); loadStaff(); });
              }
            }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {staff.length === 0 && (
          <div className="card text-center text-gray-500 py-8">No staff members yet</div>
        )}
      </div>

      {showAddModal && (
        <AddStaffModal schoolId={schoolId} onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); loadStaff(); }} />
      )}
    </div>
  );
}

function AddStaffModal({ schoolId, onClose, onSuccess }: any) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('teacher');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/staff/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name: fullName, role, school_id: schoolId, phone: '' }),
    });
    const result = await res.json();
    if (result.success) { toast.success('Staff added'); onSuccess(); }
    else { toast.error(result.error || 'Failed'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">Add Staff Member</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
              <option value="teacher">Teacher</option>
              <option value="gate_officer">Gate Officer</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Adding...' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
