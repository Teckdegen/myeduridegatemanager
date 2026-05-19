'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Student } from '@/lib/types';
import { Search, Plus, Upload, Download, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function StudentsListPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [classes, setClasses] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: role } = await supabase
      .from('user_school_roles')
      .select('school_id')
      .eq('user_id', user.id)
      .eq('role', 'school_admin')
      .single();

    if (!role) return;
    setSchoolId(role.school_id);

    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', role.school_id)
      .eq('is_active', true)
      .order('last_name');

    if (data) {
      setStudents(data);
      const uniqueClasses = [...new Set(data.map(s => s.class_name))].sort();
      setClasses(uniqueClasses);
    }
    setLoading(false);
  };

  const handleDelete = async (studentId: string) => {
    if (!confirm('Are you sure you want to deactivate this student?')) return;

    const supabase = createClient();
    await supabase
      .from('students')
      .update({ is_active: false })
      .eq('id', studentId);

    setStudents(prev => prev.filter(s => s.id !== studentId));
    toast.success('Student deactivated');
  };

  const handleExportCSV = () => {
    const headers = ['Student ID', 'First Name', 'Last Name', 'Class', 'Grade', 'Date of Birth'];
    const rows = filteredStudents.map(s => [
      s.student_id_number,
      s.first_name,
      s.last_name,
      s.class_name,
      s.grade,
      s.date_of_birth || '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name} ${s.student_id_number}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || s.class_name === selectedClass;
    return matchesSearch && matchesClass;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading students...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Students ({students.length})</h1>
            <p className="text-sm text-gray-500">Manage all enrolled students</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
              <Upload size={16} />
              Import CSV
            </button>
            <button onClick={handleExportCSV} className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
              <Download size={16} />
              Export
            </button>
            <Link href="/dashboard/school-admin/students/new" className="btn-primary flex items-center gap-1 text-sm">
              <Plus size={16} />
              Add Student
            </Link>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-6xl mx-auto">
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or ID..."
              className="input pl-10"
            />
          </div>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input w-48"
          >
            <option value="all">All Classes</option>
            {classes.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">ID</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Class</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Grade</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Face Enrolled</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
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
                      <span className="font-medium text-sm">{student.first_name} {student.last_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{student.student_id_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{student.class_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{student.grade}</td>
                  <td className="px-4 py-3">
                    {student.face_descriptor ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Yes</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(student.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        title="Deactivate student"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No students found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* CSV Import Modal */}
      {showImportModal && (
        <CSVImportModal
          schoolId={schoolId}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); fetchStudents(); }}
        />
      )}
    </div>
  );
}

// ============ CSV IMPORT MODAL ============
function CSVImportModal({ schoolId, onClose, onSuccess }: {
  schoolId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
      setPreview(rows.slice(0, 6)); // Show first 5 rows + header
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
      const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
      const dataRows = rows.slice(1).filter(row => row.length >= 4 && row[0]);

      const supabase = createClient();
      let imported = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => { record[h] = row[idx] || ''; });

        const studentIdNumber = `STU-${schoolId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}${i}`;
        const qrCodeData = `MYEDURIDE:${studentIdNumber}`;

        const { error } = await supabase.from('students').insert({
          school_id: schoolId,
          first_name: record.first_name || record.firstname || '',
          last_name: record.last_name || record.lastname || '',
          class_name: record.class_name || record.class || '',
          grade: record.grade || '',
          date_of_birth: record.date_of_birth || record.dob || null,
          student_id_number: studentIdNumber,
          qr_code_data: qrCodeData,
          is_active: true,
        });

        if (!error) imported++;

        // If parent email provided, invite parent
        const parentEmail = record.parent_email || record.parent;
        if (parentEmail && parentEmail.includes('@')) {
          await fetch('/api/parents/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id: studentIdNumber, // Will need adjustment
              school_id: schoolId,
              parent_email: parentEmail,
              parent_name: record.parent_name || 'Parent',
              parent_phone: record.parent_phone || '',
              relationship: 'parent',
            }),
          });
        }

        setProgress(Math.round(((i + 1) / dataRows.length) * 100));
      }

      toast.success(`Imported ${imported} of ${dataRows.length} students`);
      setImporting(false);
      onSuccess();
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold mb-4">Import Students from CSV</h2>

        <div className="mb-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          <p className="font-medium mb-1">CSV Format Required:</p>
          <code className="text-xs">first_name, last_name, class_name, grade, date_of_birth, parent_email, parent_name, parent_phone</code>
        </div>

        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
        />

        {/* Preview */}
        {preview.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <p className="text-sm font-medium mb-2">Preview (first 5 rows):</p>
            <table className="text-xs w-full border">
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className={i === 0 ? 'bg-gray-100 font-medium' : ''}>
                    {row.map((cell, j) => (
                      <td key={j} className="border px-2 py-1">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Progress */}
        {importing && (
          <div className="mb-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-gray-500 mt-1">{progress}% complete</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="btn-primary"
          >
            {importing ? 'Importing...' : 'Import Students'}
          </button>
        </div>
      </div>
    </div>
  );
}
