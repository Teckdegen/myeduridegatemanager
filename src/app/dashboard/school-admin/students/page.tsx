// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Search, Plus, Download, Trash2, Edit, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';

export default function StudentsListPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);

  useEffect(() => { loadStudents(); }, []);

  const loadStudents = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setLoading(false); return; }
      setSchoolId(schoolData.school_id);
      const { students: data } = await fetchData('get_students', { school_id: schoolData.school_id });
      setStudents(data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleDelete = async (studentId, name) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const res = await fetch('/api/students/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId }),
    });
    if (res.ok) { toast.success(`${name} deleted`); loadStudents(); }
    else toast.error('Failed to delete');
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    const res = await fetch('/api/students/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingStudent),
    });
    if (res.ok) { toast.success('Student updated'); setEditingStudent(null); loadStudents(); }
    else toast.error('Failed to update');
  };

  const filteredStudents = students.filter((s) =>
    `${s.first_name} ${s.last_name} ${s.student_id_number}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Students ({students.length})</h1>
          <p className="text-sm text-gray-500">Manage enrolled students</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/school-admin/id-cards" className="btn-secondary flex items-center gap-1 text-sm">
            <Download size={16} /> ID Cards
          </Link>
          <Link href="/dashboard/school-admin/students/new" className="btn-primary flex items-center gap-1 text-sm">
            <Plus size={16} /> Add Student
          </Link>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or ID..." className="input pl-10" />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredStudents.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <StudentAvatar
                      photoUrl={s.photo_url}
                      firstName={s.first_name}
                      lastName={s.last_name}
                      size="sm"
                    />
                    <span className="text-sm font-medium">{s.first_name} {s.last_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">{s.student_id_number}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{s.class?.name || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditingStudent({ ...s })} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(s.id, `${s.first_name} ${s.last_name}`)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredStudents.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-gray-400">No students found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit Student</h2>
              <button onClick={() => setEditingStudent(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                  <input type="text" value={editingStudent.first_name} onChange={(e) => setEditingStudent({ ...editingStudent, first_name: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                  <input type="text" value={editingStudent.last_name} onChange={(e) => setEditingStudent({ ...editingStudent, last_name: e.target.value })} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Student ID</label>
                <input type="text" value={editingStudent.student_id_number} className="input bg-gray-50" disabled />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditingStudent(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSaveEdit} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
