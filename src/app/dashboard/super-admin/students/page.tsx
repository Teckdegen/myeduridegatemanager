'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Student, School } from '@/lib/types';
import { Search, Trash2, Edit, CreditCard, Eye, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface StudentWithSchool extends Student {
  school: School;
  class: { name: string } | null;
}

export default function SuperAdminStudentsPage() {
  const [students, setStudents] = useState<StudentWithSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [schools, setSchools] = useState<School[]>([]);
  const [editingStudent, setEditingStudent] = useState<StudentWithSchool | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();

    // Get all schools
    const { data: schoolData } = await supabase
      .from('schools')
      .select('*')
      .order('name');
    if (schoolData) setSchools(schoolData);

    // Get all students
    const { data } = await supabase
      .from('students')
      .select('*, school:schools(id, name, primary_color), class:school_classes(name)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(200);

    if (data) setStudents(data as any);
    setLoading(false);
  };

  const handleDelete = async (studentId: string, studentName: string) => {
    if (!confirm(`Permanently delete ${studentName}? This cannot be undone.`)) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId);

    if (error) {
      toast.error('Failed to delete student');
    } else {
      setStudents(prev => prev.filter(s => s.id !== studentId));
      toast.success(`${studentName} deleted permanently`);
    }
  };

  const handleDeactivate = async (studentId: string) => {
    const supabase = createClient();
    await supabase.from('students').update({ is_active: false }).eq('id', studentId);
    setStudents(prev => prev.filter(s => s.id !== studentId));
    toast.success('Student deactivated');
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    const supabase = createClient();

    const { error } = await supabase
      .from('students')
      .update({
        first_name: editingStudent.first_name,
        last_name: editingStudent.last_name,
        custom_fields: editingStudent.custom_fields,
      })
      .eq('id', editingStudent.id);

    if (error) {
      toast.error('Failed to update student');
    } else {
      setStudents(prev => prev.map(s => s.id === editingStudent.id ? editingStudent : s));
      toast.success('Student updated');
      setEditingStudent(null);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name} ${s.student_id_number}`
      .toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSchool = selectedSchool === 'all' || s.school_id === selectedSchool;
    return matchesSearch && matchesSchool;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading students...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Students</h1>
          <p className="text-sm text-gray-500">{students.length} students across all schools</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or ID..."
            className="input pl-9 text-sm"
          />
        </div>
        <select
          value={selectedSchool}
          onChange={(e) => setSelectedSchool(e.target.value)}
          className="input w-64 text-sm"
        >
          <option value="all">All Schools</option>
          {schools.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">School</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Face</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredStudents.map(student => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {student.photo_url ? (
                      <img src={student.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                        {student.first_name[0]}{student.last_name[0]}
                      </div>
                    )}
                    <span className="text-sm font-medium">{student.first_name} {student.last_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-gray-500">{student.student_id_number}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Building2 size={12} />
                    {student.school?.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{student.class?.name || '-'}</td>
                <td className="px-4 py-3">
                  {student.face_descriptor ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">Enrolled</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">None</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditingStudent(student)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <Edit size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(student.id, `${student.first_name} ${student.last_name}`)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete permanently"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredStudents.length === 0 && (
          <div className="py-8 text-center text-gray-400">No students found</div>
        )}
      </div>

      {/* Edit Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Edit size={18} className="text-primary-600" />
              Edit Student
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                  <input
                    type="text"
                    value={editingStudent.first_name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, first_name: e.target.value })}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editingStudent.last_name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, last_name: e.target.value })}
                    className="input text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Student ID</label>
                <input
                  type="text"
                  value={editingStudent.student_id_number}
                  className="input text-sm bg-gray-50"
                  disabled
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">School</label>
                <input
                  type="text"
                  value={editingStudent.school?.name || ''}
                  className="input text-sm bg-gray-50"
                  disabled
                />
              </div>

              {/* Custom fields (editable as JSON for super admin) */}
              {editingStudent.custom_fields && Object.keys(editingStudent.custom_fields).length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Custom Fields</label>
                  <div className="space-y-2">
                    {Object.entries(editingStudent.custom_fields).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-3 gap-2 items-center">
                        <span className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                        <input
                          type="text"
                          value={String(value || '')}
                          onChange={(e) => setEditingStudent({
                            ...editingStudent,
                            custom_fields: { ...editingStudent.custom_fields, [key]: e.target.value }
                          })}
                          className="input text-sm col-span-2"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingStudent(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button onClick={handleSaveEdit} className="btn-primary flex-1 text-sm">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
