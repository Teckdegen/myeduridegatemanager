// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Search, Plus, Upload, Download, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function StudentsListPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [classes, setClasses] = useState([]);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setLoading(false); return; }
      setSchoolId(schoolData.school_id);

      const { students: data } = await fetchData('get_students', { school_id: schoolData.school_id });
      setStudents(data || []);

      const uniqueClasses = [...new Set(data.map((s: any) => s.class?.name).filter(Boolean))].sort();
      setClasses(uniqueClasses);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleDelete = async (studentId: string) => {
    if (!confirm('Deactivate this student?')) return;

    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'query',
        params: { table: 'students', select: '*', filters: { id: studentId } }
      }),
    });

    // Actually deactivate via a dedicated call
    const res = await fetch('/api/schools/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: '__deactivate_student__', student_id: studentId }),
    });

    setStudents(prev => prev.filter((s: any) => s.id !== studentId));
    toast.success('Student deactivated');
  };

  const handleExportCSV = () => {
    const headers = ['Student ID', 'First Name', 'Last Name', 'Class'];
    const rows = filteredStudents.map((s: any) => [
      s.student_id_number, s.first_name, s.last_name, s.class?.name || '',
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const filteredStudents = students.filter((s: any) => {
    const matchesSearch = `${s.first_name} ${s.last_name} ${s.student_id_number}`
      .toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || s.class?.name === selectedClass;
    return matchesSearch && matchesClass;
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading students...</div></div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Students ({students.length})</h1>
          <p className="text-sm text-gray-500">Manage enrolled students</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
            <Download size={16} /> Export
          </button>
          <Link href="/dashboard/school-admin/students/new" className="btn-primary flex items-center gap-1 text-sm">
            <Plus size={16} /> Add Student
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or ID..." className="input pl-10" />
        </div>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input w-48">
          <option value="all">All Classes</option>
          {classes.map((c: any) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Face</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredStudents.map((student: any) => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                      {student.first_name?.[0]}{student.last_name?.[0]}
                    </div>
                    <span className="text-sm font-medium">{student.first_name} {student.last_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">{student.student_id_number}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{student.class?.name || '-'}</td>
                <td className="px-4 py-3">
                  {student.face_descriptor ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">Yes</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700">No</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(student.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No students found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
