// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchData } from '@/lib/api';
import { toast } from 'sonner';
import { Camera, ArrowLeft, CheckCircle, Upload, X } from 'lucide-react';
import Link from 'next/link';

export default function AddStudentPage() {
  const [classes, setClasses] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [classId, setClassId] = useState('');
  const [customData, setCustomData] = useState({});
  const [facePhotos, setFacePhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [tab, setTab] = useState('single'); // single or csv
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    loadConfig();
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  const loadConfig = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setPageLoading(false); return; }
      setSchoolId(schoolData.school_id);
      const { classes: classData } = await fetchData('get_classes', { school_id: schoolData.school_id });
      const { fields } = await fetchData('get_custom_fields', { school_id: schoolData.school_id });
      setClasses(classData || []);
      setCustomFields((fields || []).filter((f) => f.entity_type === 'student'));
    } catch (err) { console.error(err); }
    setPageLoading(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 360 } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraActive(true);
    } catch { toast.error('Camera access denied'); }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    setFacePhotos(prev => [...prev, canvas.toDataURL('image/jpeg', 0.8)]);
    if (facePhotos.length >= 2) toast.success('Face captured');
  };

  const handleSubmit = async () => {
    if (!firstName || !lastName) { toast.error('Name is required'); return; }
    if (facePhotos.length < 3) { toast.error('Capture at least 3 face photos'); return; }
    setLoading(true);

    try {
      const res = await fetch('/api/students/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, class_id: classId || null, first_name: firstName, last_name: lastName, custom_fields: customData }),
      });
      const result = await res.json();
      if (result.success) { toast.success('Student added'); router.push('/dashboard/school-admin/students'); }
      else toast.error(result.error || 'Failed');
    } catch { toast.error('Failed to add student'); }
    setLoading(false);
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    const text = await file.text();
    const rows = text.split('\n').map(r => r.split(',').map(c => c.trim()));
    const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
    const dataRows = rows.slice(1).filter(r => r.length >= 2 && r[0]);

    let imported = 0;
    for (const row of dataRows) {
      const record = {};
      headers.forEach((h, i) => { record[h] = row[i] || ''; });

      const res = await fetch('/api/students/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          class_id: classId || null,
          first_name: record.first_name || record.firstname || '',
          last_name: record.last_name || record.lastname || '',
          custom_fields: record,
        }),
      });
      if (res.ok) imported++;
    }

    toast.success(`Imported ${imported} of ${dataRows.length} students`);
    setLoading(false);
    router.push('/dashboard/school-admin/students');
  };

  if (pageLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard/school-admin/students" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="text-2xl font-bold mb-6">Add Student</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
          <button onClick={() => setTab('single')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === 'single' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>Single Student</button>
          <button onClick={() => setTab('csv')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === 'csv' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>CSV Upload</button>
        </div>

        {tab === 'csv' ? (
          <div className="card">
            <h2 className="font-semibold mb-3">Upload CSV</h2>
            <p className="text-sm text-gray-500 mb-4">CSV should have columns: first_name, last_name (and any custom fields)</p>
            {classId && classes.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Assign all to class</label>
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input">
                  <option value="">No class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <input type="file" accept=".csv" onChange={handleCSVUpload} disabled={loading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium hover:file:bg-primary-100" />
            {loading && <p className="text-sm text-primary-600 mt-3 animate-pulse">Importing...</p>}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Basic info */}
            <div className="card">
              <h2 className="font-semibold mb-3">Student Info</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" />
                </div>
                {classes.length > 0 && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                    <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input">
                      <option value="">Select class...</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.grade}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Custom fields */}
            {customFields.length > 0 && (
              <div className="card">
                <h2 className="font-semibold mb-3">Additional Info</h2>
                <div className="grid grid-cols-2 gap-3">
                  {customFields.map((f) => (
                    <div key={f.id}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{f.field_label} {f.is_required && '*'}</label>
                      {f.field_type === 'select' ? (
                        <select value={customData[f.field_name] || ''} onChange={(e) => setCustomData(p => ({...p, [f.field_name]: e.target.value}))} className="input">
                          <option value="">Select...</option>
                          {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={f.field_type === 'date' ? 'date' : f.field_type === 'email' ? 'email' : 'text'}
                          value={customData[f.field_name] || ''} onChange={(e) => setCustomData(p => ({...p, [f.field_name]: e.target.value}))} className="input" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Face capture - REQUIRED */}
            <div className="card">
              <h2 className="font-semibold mb-1">Face Capture *</h2>
              <p className="text-xs text-gray-500 mb-3">Capture 3-5 photos for gate recognition. This is required.</p>

              {!cameraActive ? (
                <button onClick={startCamera} className="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center gap-2 hover:border-primary-400 hover:bg-primary-50 transition-all">
                  <Camera size={28} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Click to open camera</span>
                </button>
              ) : (
                <div>
                  <div className="relative rounded-xl overflow-hidden bg-black mb-3">
                    <video ref={videoRef} className="w-full aspect-[4/3] object-cover" playsInline muted />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-32 h-32 border-2 border-white/40 rounded-full" />
                    </div>
                  </div>
                  <button onClick={capturePhoto} disabled={facePhotos.length >= 5}
                    className="btn-primary w-full">
                    Capture Photo ({facePhotos.length}/5)
                  </button>
                </div>
              )}

              {facePhotos.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {facePhotos.map((p, i) => (
                    <div key={i} className="relative">
                      <img src={p} className="w-14 h-14 rounded-lg object-cover border-2 border-primary-300" />
                      <button onClick={() => setFacePhotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <X size={10} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {facePhotos.length < 3 && facePhotos.length > 0 && (
                <p className="text-xs text-amber-600 mt-2">Need at least 3 photos (have {facePhotos.length})</p>
              )}
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={loading || !firstName || !lastName || facePhotos.length < 3}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Student'}
              <CheckCircle size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
