// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Users, GraduationCap, UserCheck, Clock, ArrowLeft, Plus, Trash2, Edit, X, School } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function SchoolDetailPage() {
  const params = useParams();
  const schoolId = params.schoolId;
  const [school, setSchool] = useState(null);
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState({ total_students: 0, total_teachers: 0, present_today: 0, late_today: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('students');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddClass, setShowAddClass] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [editStaff, setEditStaff] = useState(null);
  const [newStaff, setNewStaff] = useState({ email: '', full_name: '', role: 'teacher' });
  const [newStudent, setNewStudent] = useState({ first_name: '', last_name: '' });
  const [newClass, setNewClass] = useState({ name: '', grade: '' });

  useEffect(() => { loadSchool(); }, [schoolId]);

  const loadSchool = async () => {
    try {
      const schoolRes = await fetch('/api/schools/list', { cache: 'no-store' });
      const schoolData = await schoolRes.json();
      setSchool(schoolData.schools?.find((s) => s.id === schoolId) || null);

      const statsRes = await fetch('/api/data', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_school_dashboard', params: { school_id: schoolId } }) });
      const statsData = await statsRes.json();
      if (statsData) setStats(statsData);

      const studentsRes = await fetch('/api/data', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_students', params: { school_id: schoolId } }) });
      setStudents((await studentsRes.json()).students || []);

      const staffRes = await fetch('/api/data', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'query', params: { table: 'user_school_roles', select: '*, profile:user_profiles(*)', filters: { school_id: schoolId, is_active: true } } }) });
      const staffData = await staffRes.json();
      setStaff((staffData.data || []).filter((r) => ['school_admin', 'teacher', 'gate_officer'].includes(r.role)));

      const classRes = await fetch('/api/data', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_classes', params: { school_id: schoolId } }) });
      setClasses((await classRes.json()).classes || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleAddStudent = async () => {
    if (!newStudent.first_name || !newStudent.last_name) { toast.error('Name required'); return; }
    const res = await fetch('/api/students/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_id: schoolId, first_name: newStudent.first_name, last_name: newStudent.last_name, custom_fields: {} }) });
    if (res.ok) { toast.success('Student added'); setShowAddStudent(false); setNewStudent({ first_name: '', last_name: '' }); loadSchool(); }
    else { const d = await res.json(); toast.error(d.error || 'Failed'); }
  };

  const handleDeleteStudent = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return;
    await fetch('/api/students/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: id }) });
    toast.success('Deleted'); loadSchool();
  };

  const handleSaveStudent = async () => {
    if (!editStudent) return;
    await fetch('/api/students/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editStudent) });
    toast.success('Updated'); setEditStudent(null); loadSchool();
  };

  const handleAddStaff = async () => {
    const res = await fetch('/api/staff/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newStaff, school_id: schoolId, phone: '' }) });
    if (res.ok) { toast.success('Staff added'); setShowAddStaff(false); setNewStaff({ email: '', full_name: '', role: 'teacher' }); loadSchool(); }
    else toast.error('Failed');
  };

  const handleDeleteStaff = async (roleId) => {
    if (!confirm('Remove?')) return;
    await fetch('/api/staff/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id: roleId }) });
    toast.success('Removed'); loadSchool();
  };

  const handleAddClass = async () => {
    if (!newClass.name) { toast.error('Class name required'); return; }
    await fetch('/api/setup/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_id: schoolId, classes: [...classes.map(c => ({ name: c.name, grade: c.grade })), newClass] }) });
    toast.success('Class added'); setShowAddClass(false); setNewClass({ name: '', grade: '' }); loadSchool();
  };

  const handleDeleteClass = async (classId) => {
    if (!confirm('Delete this class?')) return;
    const remaining = classes.filter(c => c.id !== classId);
    await fetch('/api/setup/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_id: schoolId, classes: remaining.map(c => ({ name: c.name, grade: c.grade })) }) });
    toast.success('Deleted'); loadSchool();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 min-h-screen">
      <Link href="/dashboard/super-admin" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"><ArrowLeft size={16} /> Back</Link>
      <h1 className="text-2xl font-bold">{school?.name || 'School'}</h1>
      <p className="text-sm text-gray-500 mb-6">{school?.address || ''}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="stat-card"><div><p className="text-xs text-gray-500">Students</p><p className="text-xl font-bold">{stats.total_students}</p></div><Users size={18} className="text-primary-600" /></div>
        <div className="stat-card"><div><p className="text-xs text-gray-500">Staff</p><p className="text-xl font-bold">{staff.length}</p></div><GraduationCap size={18} className="text-blue-600" /></div>
        <div className="stat-card"><div><p className="text-xs text-gray-500">Classes</p><p className="text-xl font-bold">{classes.length}</p></div><School size={18} className="text-purple-600" /></div>
        <div className="stat-card"><div><p className="text-xs text-gray-500">Present</p><p className="text-xl font-bold text-green-600">{stats.present_today}</p></div><UserCheck size={18} className="text-green-600" /></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {['students', 'staff', 'classes'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-white shadow-sm' : 'text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {/* STUDENTS */}
      {tab === 'students' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowAddStudent(true)} className="btn-primary text-sm flex items-center gap-1"><Plus size={14} /> Add Student</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="divide-y">
              {students.map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">{s.first_name?.[0]}{s.last_name?.[0]}</div>
                  <div className="flex-1"><p className="text-sm font-medium">{s.first_name} {s.last_name}</p><p className="text-xs text-gray-400">{s.student_id_number} • {s.class?.name || 'No class'}</p></div>
                  <button onClick={() => setEditStudent({...s})} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Edit size={14} /></button>
                  <button onClick={() => handleDeleteStudent(s.id, `${s.first_name} ${s.last_name}`)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
              {students.length === 0 && <div className="py-8 text-center text-gray-400">No students</div>}
            </div>
          </div>
        </div>
      )}

      {/* STAFF */}
      {tab === 'staff' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowAddStaff(true)} className="btn-primary text-sm flex items-center gap-1"><Plus size={14} /> Add Staff</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="divide-y">
              {staff.map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">{s.profile?.full_name?.[0] || '?'}</div>
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

      {/* CLASSES */}
      {tab === 'classes' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowAddClass(true)} className="btn-primary text-sm flex items-center gap-1"><Plus size={14} /> Add Class</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="divide-y">
              {classes.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold">{c.name?.[0]}</div>
                  <div className="flex-1"><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-gray-400">{c.grade}</p></div>
                  <button onClick={() => handleDeleteClass(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
              {classes.length === 0 && <div className="py-8 text-center text-gray-400">No classes</div>}
            </div>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showAddStudent && (
        <Modal title="Add Student" onClose={() => setShowAddStudent(false)}>
          <div className="space-y-3">
            <input type="text" placeholder="First Name" value={newStudent.first_name} onChange={e => setNewStudent({...newStudent, first_name: e.target.value})} className="input" />
            <input type="text" placeholder="Last Name" value={newStudent.last_name} onChange={e => setNewStudent({...newStudent, last_name: e.target.value})} className="input" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowAddStudent(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleAddStudent} className="btn-primary flex-1">Add</button>
          </div>
        </Modal>
      )}

      {/* ADD STAFF MODAL */}
      {showAddStaff && (
        <Modal title="Add Staff" onClose={() => setShowAddStaff(false)}>
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
        </Modal>
      )}

      {/* ADD CLASS MODAL */}
      {showAddClass && (
        <Modal title="Add Class" onClose={() => setShowAddClass(false)}>
          <div className="space-y-3">
            <input type="text" placeholder="Class Name (e.g. JSS 1A)" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} className="input" />
            <input type="text" placeholder="Grade (e.g. Grade 7)" value={newClass.grade} onChange={e => setNewClass({...newClass, grade: e.target.value})} className="input" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowAddClass(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleAddClass} className="btn-primary flex-1">Add</button>
          </div>
        </Modal>
      )}

      {/* EDIT STUDENT MODAL */}
      {editStudent && (
        <Modal title="Edit Student" onClose={() => setEditStudent(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
              <input type="text" value={editStudent.first_name} onChange={e => setEditStudent({...editStudent, first_name: e.target.value})} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
              <input type="text" value={editStudent.last_name} onChange={e => setEditStudent({...editStudent, last_name: e.target.value})} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Student ID</label>
              <input type="text" value={editStudent.student_id_number} className="input bg-gray-50" disabled />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setEditStudent(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSaveStudent} className="btn-primary flex-1">Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
