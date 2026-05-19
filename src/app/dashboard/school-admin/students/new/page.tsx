'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Camera, Upload, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { SchoolClass, SchoolCustomField } from '@/lib/types';
import { DynamicFieldInput } from '@/components/shared/DynamicFieldInput';

export default function AddStudentPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [customFields, setCustomFields] = useState<SchoolCustomField[]>([]);
  const [schoolId, setSchoolId] = useState('');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [classId, setClassId] = useState('');
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [facePhotos, setFacePhotos] = useState<string[]>([]);
  const [step, setStep] = useState<'info' | 'face'>('info');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchSchoolConfig();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const fetchSchoolConfig = async () => {
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

    // Fetch classes
    const { data: classData } = await supabase
      .from('school_classes')
      .select('*')
      .eq('school_id', role.school_id)
      .eq('is_active', true)
      .order('sort_order');

    // Fetch custom fields for students
    const { data: fieldData } = await supabase
      .from('school_custom_fields')
      .select('*')
      .eq('school_id', role.school_id)
      .eq('entity_type', 'student')
      .eq('is_active', true)
      .order('sort_order');

    if (classData) setClasses(classData);
    if (fieldData) setCustomFields(fieldData);
    setPageLoading(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitInfo = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required custom fields
    for (const field of customFields) {
      if (field.is_required && !customData[field.field_name]) {
        toast.error(`${field.field_label} is required`);
        return;
      }
    }

    setStep('face');
  };

  const handleStartCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      toast.error('Camera access denied');
    }
  };

  const handleCaptureFace = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setFacePhotos(prev => [...prev, dataUrl]);

    if (facePhotos.length >= 4) {
      toast.success('Face enrollment complete');
    }
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Upload photo
      let photoUrl = null;
      if (photo) {
        const fileName = `students/${schoolId}/${Date.now()}_${photo.name}`;
        const { data: uploadData } = await supabase.storage.from('photos').upload(fileName, photo);
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);
          photoUrl = publicUrl;
        }
      }

      // Generate IDs
      const studentIdNumber = `STU-${schoolId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const qrCodeData = `MYEDURIDE:${studentIdNumber}`;

      // Generate face descriptor (client-side)
      let faceDescriptor = null;
      if (facePhotos.length >= 3) {
        try {
          const faceapi = await import('face-api.js');
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          ]);

          const descriptors: Float32Array[] = [];
          for (const photoData of facePhotos) {
            const img = new Image();
            img.src = photoData;
            await new Promise(resolve => { img.onload = resolve; });

            const detection = await faceapi
              .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (detection) {
              descriptors.push(detection.descriptor);
            }
          }

          if (descriptors.length > 0) {
            // Average all descriptors
            const avg = new Float32Array(128);
            for (const d of descriptors) {
              for (let i = 0; i < 128; i++) avg[i] += d[i];
            }
            for (let i = 0; i < 128; i++) avg[i] /= descriptors.length;
            faceDescriptor = Array.from(avg);
          }
        } catch (err) {
          console.error('Face processing error:', err);
        }
      }

      // Create student
      const { data: student, error } = await supabase
        .from('students')
        .insert({
          school_id: schoolId,
          class_id: classId,
          first_name: firstName,
          last_name: lastName,
          student_id_number: studentIdNumber,
          qr_code_data: qrCodeData,
          photo_url: photoUrl,
          face_descriptor: faceDescriptor,
          custom_fields: customData,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Invite parent if email provided
      const parentEmail = customData.parent_email;
      if (parentEmail && parentEmail.includes('@') && student) {
        await fetch('/api/parents/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: student.id,
            school_id: schoolId,
            parent_email: parentEmail,
            parent_name: customData.parent_name || 'Parent',
            parent_phone: customData.parent_phone || '',
            relationship: customData.relationship || 'parent',
          }),
        });
      }

      toast.success('Student registered successfully');
      router.push('/dashboard/school-admin/students');
    } catch (err) {
      toast.error('Failed to register student');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading form...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard/school-admin/students" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-3">
            <ArrowLeft size={16} />
            Back to Students
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Add New Student</h1>
          <p className="text-sm text-gray-500 mt-1">
            Step {step === 'info' ? '1' : '2'} of 2 — {step === 'info' ? 'Student Information' : 'Face Enrollment'}
          </p>
        </div>

        {step === 'info' ? (
          <form onSubmit={handleSubmitInfo} className="space-y-6">
            {/* Core fields */}
            <div className="card">
              <h2 className="font-semibold mb-4">Basic Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input text-sm"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Class <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="input text-sm"
                    required
                  >
                    <option value="">Select class...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {c.grade}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Photo */}
            <div className="card">
              <h2 className="font-semibold mb-4">Student Photo</h2>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-xl object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Camera className="text-gray-400" size={24} />
                  </div>
                )}
                <label className="btn-primary cursor-pointer flex items-center gap-2 text-sm">
                  <Upload size={16} />
                  Upload Photo
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
              </div>
            </div>

            {/* Dynamic custom fields */}
            {customFields.length > 0 && (
              <div className="card">
                <h2 className="font-semibold mb-4">Additional Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  {customFields.map(field => (
                    <div key={field.id} className={field.field_type === 'textarea' ? 'col-span-2' : ''}>
                      <DynamicFieldInput
                        field={field}
                        value={customData[field.field_name] || ''}
                        onChange={(value) => setCustomData(prev => ({ ...prev, [field.field_name]: value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              Next: Face Enrollment
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          /* Face Enrollment Step */
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold mb-2">Face Enrollment</h2>
              <p className="text-sm text-gray-500 mb-4">
                Capture 3-5 photos of the student from slightly different angles.
                This will be used for gate recognition. You can skip this and do it later.
              </p>

              <div className="relative rounded-xl overflow-hidden bg-black mb-4">
                <video
                  ref={videoRef}
                  className="w-full aspect-video object-cover"
                  playsInline
                  muted
                />
              </div>

              <div className="flex gap-3">
                <button onClick={handleStartCamera} className="btn-primary flex-1 text-sm">
                  Start Camera
                </button>
                <button
                  onClick={handleCaptureFace}
                  disabled={facePhotos.length >= 5}
                  className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  Capture ({facePhotos.length}/5)
                </button>
              </div>

              {facePhotos.length > 0 && (
                <div className="flex gap-2 mt-4">
                  {facePhotos.map((p, i) => (
                    <img key={i} src={p} alt={`Capture ${i + 1}`} className="w-14 h-14 rounded-lg object-cover border-2 border-green-500" />
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('info')}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 font-medium hover:bg-gray-50 text-sm"
              >
                <ArrowLeft size={16} className="inline mr-1" />
                Back
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={loading}
                className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
              >
                {loading ? 'Registering...' : 'Complete Registration'}
                <CheckCircle size={16} />
              </button>
            </div>

            {facePhotos.length < 3 && facePhotos.length > 0 && (
              <p className="text-sm text-amber-600 text-center">
                Minimum 3 captures recommended for accurate recognition
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
