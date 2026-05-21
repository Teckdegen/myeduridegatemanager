// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { downloadIdCardsPdf } from '@/lib/id-card/download';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { Search, Download, CheckSquare, Square, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminIdCardsPage() {
  const [students, setStudents] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const schoolRes = await fetch('/api/schools/list', { cache: 'no-store' });
      const schoolData = await schoolRes.json();
      setSchools(schoolData.schools || []);

      const allStudents = [];
      for (const school of schoolData.schools || []) {
        const res = await fetch(`/api/schools/students?school_id=${school.id}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        const data = await res.json();
        (data.students || []).forEach((s) => allStudents.push({ ...s, school }));
      }
      setStudents(allStudents);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load students');
    }
    setLoading(false);
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = `${s.first_name} ${s.last_name} ${s.student_id_number}`.toLowerCase().includes(q);
    const matchSchool = selectedSchool === 'all' || s.school?.id === selectedSchool;
    return matchSearch && matchSchool;
  });

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownload = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select students first');
      return;
    }

    const selected = students.filter((s) => selectedIds.has(s.id));
    const schoolId = selected[0]?.school?.id || selected[0]?.school_id;
    if (!schoolId) {
      toast.error('Could not determine school');
      return;
    }

    const sameSchool = selected.every((s) => (s.school?.id || s.school_id) === schoolId);
    if (!sameSchool) {
      toast.error('Select students from one school at a time');
      return;
    }

    setGenerating(true);
    const result = await downloadIdCardsPdf({
      school_id: schoolId,
      student_ids: [...selectedIds],
      fileName: 'student_id_cards.pdf',
    });

    if (result.ok) toast.success('PDF ready — open it and print at 100% scale');
    else toast.error(result.error);
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-12">
        <div className="animate-pulse text-primary-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen pt-14">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">ID Cards</h1>
          <p className="text-sm text-gray-500">{students.length} students · PDF with photo + QR</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={selectedIds.size === 0 || generating}
          className="btn-primary flex items-center gap-2"
        >
          <Download size={18} />
          {generating ? 'Generating...' : `Download PDF (${selectedIds.size})`}
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students..."
            className="input pl-9"
          />
        </div>
        <select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)} className="input w-56">
          <option value="all">All Schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => {
          if (selectedIds.size === filteredStudents.length) setSelectedIds(new Set());
          else setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
        }}
        className="text-sm text-primary-600 mb-3 flex items-center gap-2"
      >
        {selectedIds.size === filteredStudents.length ? <CheckSquare size={16} /> : <Square size={16} />}
        Select all shown
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredStudents.map((student) => (
          <div
            key={student.id}
            onClick={() => toggleSelect(student.id)}
            className={`card flex items-center gap-3 py-3 cursor-pointer ${
              selectedIds.has(student.id) ? 'border-primary-500 bg-primary-50' : ''
            }`}
          >
            {selectedIds.has(student.id) ? (
              <CheckSquare size={18} className="text-primary-600 shrink-0" />
            ) : (
              <Square size={18} className="text-gray-300 shrink-0" />
            )}
            <StudentAvatar
              photoUrl={student.photo_url}
              firstName={student.first_name}
              lastName={student.last_name}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {student.first_name} {student.last_name}
              </p>
              <p className="text-xs text-gray-400">{student.school?.name}</p>
              <p className="text-xs font-mono">{student.student_id_number}</p>
            </div>
          </div>
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <div className="card text-center py-8 text-gray-400">No students found</div>
      )}
    </div>
  );
}
