// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchData } from '@/lib/api';
import { toast } from 'sonner';
import { Camera, Upload, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { DynamicFieldInput } from '@/components/shared/DynamicFieldInput';

export default function AddStudentPage() {
  const [classes, setClasses] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [classId, setClassId] = useState('');
  const [customData, setCustomData] = useState({});
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const router = useRouter();

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setPageLoading(false); return; }
      setSchoolId(schoolData.school_id);

      const { classes: classData } = await fetchData('get_classes', { school_id: schoolData.school_id });
      const { fields } = await fetchData('get_custom_fields', { school_id: schoolData.school_id });

      setClasses(classData || []);
      setCustomFields((fields || []).filter((f: any) => f.entity_type === 'student'));
    } catch (err) { console.error(err); }
    setPageLoading(false);
  };

  const handleSubmit = async () => {
    if (!firstName || !lastName || !classId) {
      toast.error('Fill in required fields');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch('/api/students/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          class_id: classId,
          first_name: firstName,
          last_name: lastName,
          custom_fields: customData,
        }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success('Student added');
        router.push('/dashboard/school-admin/students');
      } else {
        toast.error(result.error || 'Failed to add student');
      }
    } catch (err) {
      toast.error('Failed to add student');
    }
    setLoading(false);
  };

  if (pageLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard/school-admin/students" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} /> Back to Students
        </Link>
        <h1 className="text-2xl font-bold mb-6">Add New Student</h1>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" required />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Class *</label>
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input" required>
                  <option value="">Select class...</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name} — {c.grade}</option>)}
                </select>
              </div>
            </div>
          </div>

          {customFields.length > 0 && (
            <div className="card">
              <h2 className="font-semibold mb-4">Additional Information</h2>
              <div className="grid grid-cols-2 gap-4">
                {customFields.map((field: any) => (
                  <div key={field.id} className={field.field_type === 'textarea' ? 'col-span-2' : ''}>
                    <DynamicFieldInput
                      field={field}
                      value={customData[field.field_name] || ''}
                      onChange={(value) => setCustomData((prev: any) => ({ ...prev, [field.field_name]: value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !firstName || !lastName || !classId}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            {loading ? 'Adding...' : 'Add Student'}
            <CheckCircle size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
