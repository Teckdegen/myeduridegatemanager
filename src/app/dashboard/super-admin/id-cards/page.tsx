'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Student, School } from '@/lib/types';
import { Search, CreditCard, Download, Building2 } from 'lucide-react';
import Link from 'next/link';

interface StudentWithSchool extends Student {
  school: School;
  class: { name: string } | null;
}

export default function SuperAdminIdCardsPage() {
  const [students, setStudents] = useState<StudentWithSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [schools, setSchools] = useState<School[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();

    const { data: schoolData } = await supabase.from('schools').select('*').order('name');
    if (schoolData) setSchools(schoolData);

    const { data } = await supabase
      .from('students')
      .select('*, school:schools(id, name, primary_color, logo_url), class:school_classes(name)')
      .eq('is_active', true)
      .order('last_name')
      .limit(200);

    if (data) setStudents(data as any);
    setLoading(false);
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
        <div className="animate-pulse text-primary-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Digital ID Cards</h1>
          <p className="text-sm text-gray-500">View and manage all student ID cards</p>
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

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map(student => (
          <Link
            key={student.id}
            href={`/dashboard/parent/id-card/${student.id}`}
            className="card hover:shadow-md transition-shadow p-4"
          >
            <div className="flex items-center gap-3">
              {student.photo_url ? (
                <img src={student.photo_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: student.school?.primary_color || '#1B4D3E' }}
                >
                  {student.first_name[0]}{student.last_name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{student.first_name} {student.last_name}</p>
                <p className="text-xs text-gray-400 font-mono">{student.student_id_number}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Building2 size={10} className="text-gray-400" />
                  <span className="text-xs text-gray-500 truncate">{student.school?.name}</span>
                </div>
              </div>
              <CreditCard size={18} className="text-gray-300 shrink-0" />
            </div>
          </Link>
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <div className="card text-center py-12">
          <CreditCard size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No students found</p>
        </div>
      )}
    </div>
  );
}
