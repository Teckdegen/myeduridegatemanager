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
  const [schoolId, setSchoolId] = useState('');
  const [form, setForm] = useState({
    first_name: '', last_name: '', address: '',
    parent_name: '', parent_phone: '', parent_email: '', class_id: '',
  });
  const [facePhotos, setFacePhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [tab, setTab] = useState('single');
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
      setClasses(classData || []);
    } catch (err) { console.error(err); }
    setPageLoading(false);
  };

  const startCamera = async () => {
    try {
      const constraints = { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCameraActive(true);
      // Wait for next render then attach stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) { 
      console.error('Camera error:', err);
      toast.error('Camera access denied. Check browser permissions.'); 
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    setFacePhotos(prev => [...prev, canvas.toDataURL('image/jpeg', 0.8)]);
  };

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name) { toast.error('Name is required'); return; }
    if (facePhotos.length < 1) { toast.error('Take a photo of the student'); return; }
    setLoading(true);

    try {
      const res = await fetch('/api/students/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          class_id: form.class_id || null,
          first_name: form.first_name,
          last_name: form.last_name,
          photo_base64: facePhotos[0] || null,
          custom_fields: {
            address: form.address,
            parent_name: form.parent_name,
            parent_phone: form.parent_phone,
            parent_email: form.parent_email,
          },
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Student added! ID Card: ${result.student?.student_id_number}`);
        // ID card is auto-generated (QR code data stored on student record)
        router.push('/dashboard/school-admin/students');
      }
      else toast.error(result.error || 'Failed');
    } catch { toast.error('Failed'); }
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
        body: JSON.stringify({ school_id: schoolId, class_id: form.class_id || null, first_name: record.first_name || '', last_name: record.last_name || '', custom_fields: record }),
      });
      if (res.ok) imported++;
    }
    toast.success(`Imported ${imported} students`);
    setLoading(false);
    router.push('/dashboard/school-admin/students');
  };

  if (pageLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard/school-admin/students" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"><ArrowLeft size={16} /> Back</Link>
        <h1 className="text-2xl font-bold mb-6">Add Student</h1>

          <div className="space-y-5">
            {/* Student Info */}
            <div className="card">
              <h2 className="font-semibold mb-3">Student Information</h2>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label><input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="input" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label><input type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="input" /></div>
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Address</label><input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input" placeholder="Home address" /></div>
                {classes.length > 0 && (
                  <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                    <select value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})} className="input">
                      <option value="">Select class...</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Parent Info */}
            <div className="card">
              <h2 className="font-semibold mb-3">Parent / Guardian</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Parent Name *</label><input type="text" value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} className="input" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Parent Phone</label><input type="tel" value={form.parent_phone} onChange={e => setForm({...form, parent_phone: e.target.value})} className="input" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Parent Email</label><input type="email" value={form.parent_email} onChange={e => setForm({...form, parent_email: e.target.value})} className="input" /></div>
              </div>
            </div>

            {/* Photo - REQUIRED (for ID card) */}
            <div className="card">
              <h2 className="font-semibold mb-1">Student Photo *</h2>
              <p className="text-xs text-gray-500 mb-3">Take a photo for the student ID card. Required.</p>
              {!cameraActive ? (
                <button onClick={startCamera} className="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center gap-2 hover:border-primary-400 hover:bg-primary-50 transition-all">
                  <Camera size={28} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Click to open camera</span>
                </button>
              ) : (
                <div>
                  <div className="relative rounded-xl overflow-hidden bg-gray-900 mb-3">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      style={{ width: '100%', height: 'auto', display: 'block', minHeight: '240px' }}
                    />
                  </div>
                  <button onClick={capturePhoto} disabled={facePhotos.length >= 1} className="btn-primary w-full">
                    {facePhotos.length === 0 ? 'Take Photo' : 'Photo Taken'}
                  </button>
                </div>
              )}
              {facePhotos.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {facePhotos.map((p, i) => (
                    <div key={i} className="relative">
                      <img src={p} className="w-20 h-20 rounded-lg object-cover border-2 border-primary-300" />
                      <button onClick={() => setFacePhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><X size={10} className="text-white" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={loading || !form.first_name || !form.last_name || facePhotos.length < 1}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              {loading ? 'Adding...' : 'Add Student'} <CheckCircle size={16} />
            </button>
          </div>
      </div>
    </div>
  );
}
