// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import DetailedAttendanceReports from '@/components/attendance/DetailedAttendanceReports';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
        if (!schoolData.school_id) { setLoading(false); return; }
        setSchoolId(schoolData.school_id);
        const res = await fetch(`/api/classes?school_id=${schoolData.school_id}`, { credentials: 'include' });
        const json = await res.json();
        setClasses(json.classes || []);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center md:ml-56"><div className="animate-pulse text-primary-600">Loading...</div></div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen md:ml-56 pt-14 md:pt-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Attendance reports</h1>
      <p className="text-sm text-gray-500 mb-6">Daily, weekly, and monthly reports for all classes. Export CSV or print PDF.</p>
      <div className="card-elevated p-5">
        <DetailedAttendanceReports schoolId={schoolId} classes={classes} title="General report (all classes)" />
      </div>
    </div>
  );
}
