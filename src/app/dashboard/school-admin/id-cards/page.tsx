// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { generateIdCardsPdf } from '@/lib/id-card/generate-pdf';
import { ArrowLeft, Download, Search, CheckSquare, Square, Users, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function IdCardsPage() {
  const [entityTab, setEntityTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [school, setSchool] = useState(null);
  const [schoolId, setSchoolId] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    setSearchQuery('');
  }, [entityTab]);

  const loadPageData = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) {
        setLoading(false);
        return;
      }
      setSchoolId(schoolData.school_id);
      setSchool(schoolData.school);

      const { students: data } = await fetchData('get_students', { school_id: schoolData.school_id });
      const list = data || [];
      setStudents(list);
      setClasses([...new Set(list.map((s) => s.class?.name).filter(Boolean))].sort());

      const staffRes = await fetch(`/api/schools/staff?school_id=${schoolData.school_id}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const staffData = await staffRes.json();
      setStaff(
        (staffData.staff || []).filter((s) =>
          ['teacher', 'gate_officer', 'school_admin'].includes(s.role)
        )
      );
    } catch (err) {
      console.error(err);
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const currentList = entityTab === 'students' ? students : staff;

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = `${s.first_name} ${s.last_name} ${s.student_id_number}`.toLowerCase().includes(q);
    const matchClass = selectedClass === 'all' || s.class?.name === selectedClass;
    return matchSearch && matchClass;
  });

  const filteredStaff = staff.filter((s) => {
    const name = s.profile?.full_name || '';
    const id = s.staff?.staff_id_number || '';
    const q = searchQuery.toLowerCase();
    return `${name} ${id} ${s.role}`.toLowerCase().includes(q);
  });

  const filtered = entityTab === 'students' ? filteredStudents : filteredStaff;

  const getItemId = (item) => (entityTab === 'students' ? item.id : item.id);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((x) => getItemId(x))));
    }
  };

  const handleGenerateCards = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one person');
      return;
    }
    setGenerating(true);

    try {
      const persons = [];

      if (entityTab === 'students') {
        for (const s of students.filter((x) => selectedIds.has(x.id))) {
          if (!s.qr_code_data && !s.student_id_number) {
            toast.error(`${s.first_name} has no QR code — re-save student`);
            continue;
          }
          persons.push({
            kind: 'student',
            fullName: `${s.first_name} ${s.last_name}`,
            idNumber: s.student_id_number,
            qrData: s.qr_code_data || `MYEDURIDE:${s.student_id_number}`,
            photoUrl: s.photo_url,
            birth: s.custom_fields?.date_of_birth || '—',
            address: s.custom_fields?.address || school?.address || '—',
            className: s.class?.name,
          });
        }
      } else {
        for (const s of staff.filter((x) => selectedIds.has(x.id))) {
          const profile = s.staff;
          if (!profile?.qr_code_data && !profile?.staff_id_number) {
            toast.error(`${s.profile?.full_name} needs staff profile — re-add with face photos`);
            continue;
          }
          persons.push({
            kind: 'staff',
            fullName: s.profile?.full_name || 'Staff',
            idNumber: profile.staff_id_number,
            qrData: profile.qr_code_data || `MYEDURIDE:STAFF:${profile.staff_id_number}`,
            photoUrl: profile.photo_url,
            birth: '—',
            address: school?.address || '—',
            roleLabel: s.role.replace('_', ' '),
          });
        }
      }

      if (persons.length === 0) {
        toast.error('No valid cards to generate');
        setGenerating(false);
        return;
      }

      await generateIdCardsPdf(
        persons,
        {
          name: school?.name || 'School',
          address: school?.address,
          logoUrl: school?.logo_url,
          primaryColor: school?.primary_color,
        },
        `${entityTab}_id_cards_${new Date().toISOString().split('T')[0]}.pdf`
      );

      toast.success(`Generated ${persons.length} ID card(s) — front, back & QR`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF');
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4">
        <Link
          href="/dashboard/school-admin"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
        >
          <ArrowLeft size={18} />
          Back
        </Link>
        <h1 className="text-xl font-bold">ID Cards</h1>
        <p className="text-sm text-gray-500">Template with photo & QR code for gate scanning</p>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => setEntityTab('students')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
              entityTab === 'students' ? 'bg-white shadow text-primary-700' : 'text-gray-500'
            }`}
          >
            <Users size={16} /> Students ({students.length})
          </button>
          <button
            type="button"
            onClick={() => setEntityTab('staff')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
              entityTab === 'staff' ? 'bg-white shadow text-primary-700' : 'text-gray-500'
            }`}
          >
            <GraduationCap size={16} /> Staff ({staff.length})
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={entityTab === 'students' ? 'Search students...' : 'Search staff...'}
              className="input pl-10"
            />
          </div>
          {entityTab === 'students' && (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input w-40"
            >
              <option value="all">All Classes</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleGenerateCards}
            disabled={selectedIds.size === 0 || generating}
            className="btn-primary flex items-center gap-1 text-sm shrink-0"
          >
            <Download size={16} />
            {generating ? 'Generating...' : `PDF (${selectedIds.size})`}
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button onClick={selectAll} className="text-sm text-primary-600 hover:underline flex items-center gap-2">
            {selectedIds.size === filtered.length ? <CheckSquare size={16} /> : <Square size={16} />}
            {selectedIds.size === filtered.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {entityTab === 'students' &&
            filteredStudents.map((student) => (
              <div
                key={student.id}
                onClick={() => toggleSelect(student.id)}
                className={`card cursor-pointer flex items-center gap-3 py-3 ${
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
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="text-xs font-mono text-gray-600">{student.student_id_number}</p>
                  {!student.qr_code_data && (
                    <p className="text-xs text-amber-600">Missing QR</p>
                  )}
                </div>
              </div>
            ))}

          {entityTab === 'staff' &&
            filteredStaff.map((member) => (
              <div
                key={member.id}
                onClick={() => toggleSelect(member.id)}
                className={`card cursor-pointer flex items-center gap-3 py-3 ${
                  selectedIds.has(member.id) ? 'border-primary-500 bg-primary-50' : ''
                }`}
              >
                {selectedIds.has(member.id) ? (
                  <CheckSquare size={18} className="text-primary-600 shrink-0" />
                ) : (
                  <Square size={18} className="text-gray-300 shrink-0" />
                )}
                <StudentAvatar
                  photoUrl={member.staff?.photo_url}
                  firstName={member.profile?.full_name?.split(' ')[0]}
                  lastName={member.profile?.full_name?.split(' ').slice(1).join(' ')}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{member.profile?.full_name}</p>
                  <p className="text-xs font-mono text-gray-600">
                    {member.staff?.staff_id_number || 'No ID yet'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{member.role.replace('_', ' ')}</p>
                </div>
              </div>
            ))}
        </div>

        {filtered.length === 0 && (
          <div className="card text-center py-12 text-gray-500">
            {entityTab === 'students'
              ? 'No students found.'
              : 'No staff with ID profiles. Add staff with face photos first.'}
          </div>
        )}
      </main>
    </div>
  );
}
