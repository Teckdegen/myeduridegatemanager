// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Users, GraduationCap, UserCheck, Clock, ArrowLeft, Plus, Trash2, Edit, DoorOpen, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function SchoolDetailPage() {
  const params = useParams();
  const schoolId = params.schoolId;
  const [school, setSchool] = useState(null);
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [stats, setStats] = useState({ total_students: 0, total_teachers: 0, present_today: 0, late_today: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: '', full_name: '', role: 'teacher' });

  useEffect(() => { loadSchool(); }, [schoolId]);

  const loadSchool = async () => {
    try {
      const schoolRes = await fetch('/api/schools/list', { cache: 'no-store' });
      const schoolData = await schoolRes.json();
      const found = schoolData.schools?.find((s) => s.id === schoolId);
      if (found) setSchool(found);

      // Stats
      const statsRes = await fetch('/api/data', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_school_dashboard', params: { school_id: schoolId } }) });
      const statsData = await statsRes.json();
      if (statsData) setStats(statsData);

      // Students
      const studentsRes = await fetch('/api/data', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_students', params: { school_id: schoolId } }) });
      const studentsData = await studentsRes.json();
      setStudents(studentsData.students || []);

      // Staff
      const staffRes = await fetch('/api/data', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'query', params: { table: 'user_school_roles', select: '*, profile:user_profiles(*)', filters: { school_id: schoolId, is_active: true } } }) });
      const staffData = await staffRes.json();
      setStaff((staffData.data || []).filter((r) => ['school_admin', 'teacher', 'gate_officer'].includes(r.role)));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleDeleteStudent = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return;
    await fetch('/api/students/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: id }) });
    toast.success('Deleted');
    loadSchool();
  };

  const handleDeleteStaff = async (roleId) => {
    if (!confirm('Remove this staff member?')) return;
    await fetch('/api/staff/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id: roleId }) });
    toast.success('Removed');
    loadSchool();
  };

  const handleAddStaff = async () => {
    const res = await fetch('/api/staff/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newStaff, school_id: schoolId, phone: '' }) });
    if (res.ok) { toast.success('Staff added'); setShowAddStaff(false); setNewStaff({ email: '', full_name: '', role: 'teacher' }); loadSchool(); }
    else toast.error('Failed');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 min-h-screen">
      <Link href="/dashboard/super-admin" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Back to All Schools
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{school?.name || 'School'}</h1>
          <p className="text-sm text-gray-500">{school?.address || ''}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="stat-card"><div><p className="text-xs text-gray-500">Students</p><p className="text-xl font-bold">{stats.total_students}</p></div><Users size={18} className="text-primary-600" /></div>
        <div className="stat-card"><div><p className="text-xs text-gray-500">Staff</p><p className="text-xl font-bold">{staff.length}</p></div><GraduationCap size={18} className="text-blue-600" /></div>
        <div className="stat-card"><div><p className="text-xs text-gray-500">Present</p><p className="text-xl font-bold text-green-600">{stats.present_today}</p></div><UserCheck size={18} className="text-green-600" /></div>
        <div className="stat-card"><div><p className="text-xs text-gray-500">Late</p><p className="text-xl font-bold text-amber-600">{stats.late_today}</p></div><Clock size={18} className="text-amber-600" /></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {['overview', 'students', 'staff'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-white shadow-sm' : 'text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {/* Students tab */}
      {tab === 'students' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">Students ({students.length})</span>
          </div>
          <div className="divide-y">
            {students.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">{s.first_name?.[0]}{s.last_name?.[0]}</div>
                <div className="flex-1"><p className="text-sm font-medium">{s.first_name} {s.last_name}</p><p className="text-xs text-gray-400">{s.student_id_number}</p></div>
                <button onClick={() => handleDeleteStudent(s.id, `${s.first_name} ${s.last_name}`)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
            {students.length === 0 && <div className="py-8 text-center text-gray-400">No students</div>}
          </div>
        </div>
      )}

      {/* Staff tab */}
      {tab === 'staff' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowAddStaff(true)} className="btn-primary text-sm flex items-center gap-1"><Plus size={14} /> Add Staff</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="divide-y">
              {staff.map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">{s.profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0,2) || '?'}</div>
                  <div className="flex-1"><p className="text-sm font-medium">{s.profile?.full_name}</p><p className="text-xs text-gray-400">{s.profile?.email}</p></div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 capitalize">{s.role.replace('_', ' ')}</span>
                  <button onClick={() => handleDeleteStaff(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
              {staff.length === 0 && <div className="py-8 text-center text-gray-400">No staff</div>}
            </div>
          </div>
        </div>
      )}

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-sm font-semibold mb-3">Recent Students</h3>
            {students.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center gap-2 py-1.5"><div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">{s.first_name?.[0]}</div><span className="text-sm">{s.first_name} {s.last_name}</span></div>
            ))}
            {students.length === 0 && <p className="text-sm text-gray-400">No students yet</p>}
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold mb-3">Staff</h3>
            {staff.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center gap-2 py-1.5"><div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">{s.profile?.full_name?.[0]}</div><span className="text-sm">{s.profile?.full_name}</span><span className="text-xs text-gray-400 capitalize ml-auto">{s.role.replace('_',' ')}</span></div>
            ))}
            {staff.length === 0 && <p className="text-sm text-gray-400">No staff yet</p>}
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">Add Staff</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Full Name" value={newStaff.full_name} onChange={e => setNewStaff({...newStaff, full_name: e.target.value})} className="input" />
              <input type="email" placeholder="Email" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} className="input" />
              <select value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} className="input">
                <option value="school_admin">School Admin</option>
                <option value="teacher">Teacher</option>
                <option value="gate_officer">Gate Officer</option>
              </select>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddStaff(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAddStaff} className="btn-primary flex-1">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
