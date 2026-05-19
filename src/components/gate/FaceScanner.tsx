'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Student } from '@/lib/types';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface Props {
  onStudentMatched: (student: Student) => void;
  onCancel: () => void;
}

export function FaceScanner({ onStudentMatched, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'scanning' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;

    const initCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Load face-api models
        const faceapi = await import('face-api.js');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);

        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setErrorMsg('Camera access denied or face models failed to load.');
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleScan = async () => {
    if (!videoRef.current || status !== 'ready') return;
    setStatus('scanning');

    try {
      const faceapi = await import('face-api.js');

      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus('ready');
        setErrorMsg('No face detected. Please try again.');
        return;
      }

      const descriptor = Array.from(detection.descriptor);

      // Search for matching student in database
      const supabase = createClient();
      const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .not('face_descriptor', 'is', null);

      if (!students || students.length === 0) {
        setStatus('ready');
        setErrorMsg('No enrolled students found.');
        return;
      }

      // Find best match
      let bestMatch: Student | null = null;
      let bestDistance = Infinity;

      for (const student of students) {
        const studentDescriptor = new Float32Array(student.face_descriptor);
        const queryDescriptor = new Float32Array(descriptor);
        const distance = faceapi.euclideanDistance(
          Array.from(studentDescriptor),
          Array.from(queryDescriptor)
        );

        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = student;
        }
      }

      // Threshold: 0.6 is a good balance between accuracy and false positives
      if (bestMatch && bestDistance < 0.6) {
        onStudentMatched(bestMatch);
      } else {
        setStatus('ready');
        setErrorMsg('Face not recognized. Try again or use ID card.');
      }
    } catch {
      setStatus('ready');
      setErrorMsg('Recognition failed. Please try again.');
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <div className="relative rounded-xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="w-full aspect-video object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 border-2 border-primary-400 rounded-full opacity-50" />
        </div>
      </div>

      {errorMsg && (
        <p className="text-yellow-400 text-sm text-center mt-3">{errorMsg}</p>
      )}

      <button
        onClick={handleScan}
        disabled={status === 'loading' || status === 'scanning'}
        className="btn-primary w-full mt-4 py-3 text-lg flex items-center justify-center gap-2"
      >
        {status === 'loading' && <><Loader2 className="animate-spin" size={20} /> Loading models...</>}
        {status === 'ready' && 'Scan Face'}
        {status === 'scanning' && <><Loader2 className="animate-spin" size={20} /> Recognizing...</>}
        {status === 'error' && 'Camera Error'}
      </button>
    </div>
  );
}
