// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Plus, Trash2, GraduationCap, DoorOpen, Shield } from 'lucide-react';
import { toast } from 'sonner';
import FaceCapture from '@/components/shared/FaceCapture';

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
      const result = await fetchData('query', { table: 'user_school_roles', select: '*, profile:user_profiles(*)', filters: { school_id: schoolData.school_id, is_active: true } });
      setStaff((result.data || []).filter((r) => ['school_admin', 'teacher', 'gate_officer'].includes(r.role)));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleDelete = async (roleId, name) => {
    if (!confirm(`Remove ${name}?`)) return;
    await fetch('/api/staff/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id: roleId }) });
    toast.success('Removed'); loadStaff();
  };

  const getRoleIcon = (role) => {
    if (role === 'teacher') return <GraduationCap size={14} className="text-blue-600" />;
    if (role === 'gate_officer') return <DoorOpen size={14} className="text-orange-600" />;
    return <Shield size={14} className="text-purple-600" />;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold">Staff ({staff.length})</h1><p className="text-sm text-gray-500">Teachers, gate officers, and admins</p></div>
        <div className="flex gap-2">
          <a href="/dashboard/school-admin/id-cards" className="btn-secondary flex items-center gap-1 text-sm">ID Cards</a>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1 text-sm"><Plus size={16} /> Add Staff</button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="divide-y">
          {staff.map((s) => (
            <div key={s.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                {s.profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0,2) || '?'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{s.profile?.full_name || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{s.profile?.email}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 capitalize flex items-center gap-1">{getRoleIcon(s.role)} {s.role.replace('_', ' ')}</span>
              <button onClick={() => handleDelete(s.id, s.profile?.full_name)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          {staff.length === 0 && <div className="py-8 text-center text-gray-400">No staff yet</div>}
        </div>
      </div>

      {showAddModal && <AddStaffModal schoolId={schoolId} onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); loadStaff(); }} />}
    </div>
  );
}

function AddStaffModal({ schoolId, onClose, onSuccess }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', address: '', role: 'teacher', class_id: '' });
  const [faceData, setFaceData] = useState({ photos: [], face_descriptor: null });
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    fetchData('get_classes', { school_id: schoolId }).then(d => setClasses(d.classes || [])).catch(() => {});
  }, [schoolId]);

  const handleSubmit = async () => {
    if (!form.full_name || !form.email) { toast.error('Name and email required'); return; }
    if (faceData.photos.length < 3) { toast.error('Take 3 face photos for gate recognition'); return; }
    setLoading(true);
    const res = await fetch('/api/staff/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        school_id: schoolId,
        class_id: form.role === 'teacher' ? form.class_id || null : null,
        photo_base64: faceData.photos[0],
        face_photos: faceData.photos,
        face_descriptor: faceData.face_descriptor,
      }),
    });
    if (res.ok) { toast.success('Staff added'); onSuccess(); }
    else { const d = await res.json(); toast.error(d.error || 'Failed'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Add Staff Member</h2>
        <div className="space-y-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label><input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="input" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Email Address *</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Telephone</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Address</label><input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Role / Position *</label>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="input">
              <option value="teacher">Teacher</option>
              <option value="gate_officer">Gate Officer</option>
              <option value="school_admin">School Admin</option>
            </select>
          </div>
          {form.role === 'teacher' && classes.length > 0 && (
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Assign to Class</label>
              <select value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})} className="input">
                <option value="">Select class...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="border-t pt-3">
            <FaceCapture
              label="Staff face enrollment"
              minPhotos={3}
              maxPhotos={3}
              onChange={setFaceData}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">{loading ? 'Adding...' : 'Add Staff'}</button>
        </div>
      </div>
    </div>
  );
}
