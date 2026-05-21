// @ts-nocheck
'use client';

import { useEffect, useState, useRef } from 'react';
import { Search, Download, Printer } from 'lucide-react';

const MYEDURIDE_LOGO = 'https://www.image2url.com/r2/default/images/1779230378321-292c7b74-6217-41ff-832a-180a535ea4cb.png';

export default function IdCardsPage() {
  const [students, setStudents] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedSchoolData, setSelectedSchoolData] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const schoolRes = await fetch('/api/schools/list', { cache: 'no-store' });
      const schoolData = await schoolRes.json();
      setSchools(schoolData.schools || []);

      // Get all students across all schools
      const allStudents = [];
      for (const school of (schoolData.schools || [])) {
        const res = await fetch('/api/data', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_students', params: { school_id: school.id } }) });
        const data = await res.json();
        (data.students || []).forEach(s => allStudents.push({ ...s, school }));
      }
      setStudents(allStudents);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = `${s.first_name} ${s.last_name} ${s.student_id_number}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSchool = selectedSchool === 'all' || s.school?.id === selectedSchool;
    return matchSearch && matchSchool;
  });

  const printCard = (student) => {
    setSelectedStudent(student);
    setSelectedSchoolData(student.school);
    setTimeout(() => window.print(), 300);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">ID Cards</h1>
          <p className="text-sm text-gray-500">{students.length} students across all schools</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search students..." className="input pl-9" />
        </div>
        <select value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)} className="input w-56">
          <option value="all">All Schools</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Student grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredStudents.map(student => (
          <div key={student.id} className="card flex items-center gap-3 py-3">
            {student.photo_url ? (
              <img src={student.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">{student.first_name?.[0]}{student.last_name?.[0]}</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{student.first_name} {student.last_name}</p>
              <p className="text-xs text-gray-400">{student.school?.name}</p>
            </div>
            <button onClick={() => printCard(student)} className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors" title="Print ID Card">
              <Printer size={16} />
            </button>
          </div>
        ))}
        {filteredStudents.length === 0 && (
          <div className="col-span-full card text-center py-8 text-gray-400">No students found</div>
        )}
      </div>

      {/* Print-only ID card */}
      {selectedStudent && (
        <div className="hidden print:block">
          <IdCard student={selectedStudent} school={selectedSchoolData} />
        </div>
      )}
    </div>
  );
}

function IdCard({ student, school }) {
  const schoolColor = school?.primary_color || '#1B4D3E';
  const schoolName = school?.name || 'School Name';
  const schoolAddress = school?.address || 'School Address';

  return (
    <div style={{ width: '85.6mm', height: '54mm', fontFamily: 'Arial, sans-serif', position: 'relative', overflow: 'hidden', background: '#e8f4fd', border: '1px solid #ccc', borderRadius: '8px' }}>
      {/* Header */}
      <div style={{ background: schoolColor, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {school?.logo_url && <img src={school.logo_url} alt="" style={{ height: '24px', objectFit: 'contain' }} />}
        <div>
          <div style={{ color: 'white', fontWeight: 'bold', fontSize: '11px' }}>{schoolName}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '8px' }}>{schoolAddress}</div>
        </div>
        <img src="https://www.image2url.com/r2/default/images/1779230378321-292c7b74-6217-41ff-832a-180a535ea4cb.png" alt="MyEduRide" style={{ height: '20px', marginLeft: 'auto', objectFit: 'contain' }} />
      </div>

      {/* Card type banner */}
      <div style={{ background: '#2196F3', color: 'white', textAlign: 'center', padding: '3px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px' }}>
        STUDENT CARD
      </div>

      {/* Body */}
      <div style={{ display: 'flex', padding: '6px 8px', gap: '8px' }}>
        {/* Photo */}
        <div style={{ width: '28mm', height: '28mm', background: '#b3d9f0', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
          {student.photo_url ? (
            <img src={student.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', color: '#666' }}>
              {student.first_name?.[0]}{student.last_name?.[0]}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, fontSize: '8px' }}>
          <div style={{ marginBottom: '3px' }}><strong>NAME:</strong> {student.first_name} {student.last_name}</div>
          <div style={{ marginBottom: '3px' }}><strong>CLASS:</strong> {student.class?.name || ''}</div>
          <div style={{ marginBottom: '3px' }}><strong>ADDRESS:</strong> {student.custom_fields?.address || ''}</div>
          <div style={{ marginBottom: '3px' }}><strong>ID NO:</strong> {student.student_id_number}</div>
        </div>

        {/* QR Code placeholder */}
        <div style={{ width: '20mm', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{ width: '18mm', height: '18mm', border: '2px solid #1B4D3E', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', color: '#666', textAlign: 'center' }}>
            QR<br/>{student.student_id_number?.slice(-6)}
          </div>
        </div>
      </div>

      {/* Barcode area */}
      <div style={{ textAlign: 'center', fontSize: '7px', color: '#333', paddingBottom: '3px' }}>
        <div style={{ letterSpacing: '3px', fontFamily: 'monospace', fontSize: '14px', lineHeight: '1' }}>||| || ||| | || ||| ||</div>
        <div>{student.student_id_number}</div>
      </div>
    </div>
  );
}
