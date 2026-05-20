// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Plus, Users, GraduationCap, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => { loadClasses(); }, []);

  const loadClasses = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setLoading(false); return; }
      setSchoolId(schoolData.school_id);

      const { classes: data } = await fetchData('get_classes', { school_id: schoolData.school_id });
      setClasses(data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Classes</h1>
          <p className="text-sm text-gray-500">{classes.length} classes</p>
        </div>
        <Link href="/dashboard/school-admin/setup" className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Class
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls: any) => (
          <div key={cls.id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold">{cls.name}</h3>
                <p className="text-sm text-gray-500">{cls.grade}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                <Users size={18} className="text-primary-600" />
              </div>
            </div>
          </div>
        ))}
        {classes.length === 0 && (
          <div className="col-span-full card text-center py-12 text-gray-400">
            No classes yet. Complete the setup wizard to add classes.
          </div>
        )}
      </div>
    </div>
  );
}
