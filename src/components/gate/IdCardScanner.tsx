'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Student } from '@/lib/types';
import { ArrowLeft, Loader2, ScanBarcode } from 'lucide-react';

interface Props {
  onStudentMatched: (student: Student) => void;
  onCancel: () => void;
}

export function IdCardScanner({ onStudentMatched, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'scanning' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const initCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: 640, height: 480 },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('ready');
        startScanning();
      } catch {
        setStatus('error');
        setErrorMsg('Camera access denied. Please allow camera permissions.');
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  const startScanning = () => {
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Use jsQR to decode QR/barcode
      const jsQR = (await import('jsqr')).default;
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
        }
        await lookupStudent(code.data);
      }
    }, 400); // Scan every 400ms
  };

  const lookupStudent = async (qrData: string) => {
    setStatus('scanning');
    setErrorMsg('');

    const supabase = createClient();

    // Try QR code data first
    let { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('qr_code_data', qrData)
      .eq('is_active', true)
      .single();

    // If not found by QR, try student_id_number (barcode might encode just the ID)
    if (!student) {
      const { data: byId } = await supabase
        .from('students')
        .select('*')
        .eq('student_id_number', qrData)
        .eq('is_active', true)
        .single();
      student = byId;
    }

    if (student) {
      onStudentMatched(student);
    } else {
      setStatus('ready');
      setErrorMsg('Student not found. Please try scanning again.');
      startScanning();
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Back</span>
      </button>

      {/* Camera view for barcode scanning */}
      <div className="relative rounded-2xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="w-full aspect-video object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan guide overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-40 border-2 border-dashed border-primary-400 rounded-xl opacity-60" />
        </div>

        {/* Scanning indicator */}
        {status === 'ready' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-white">Scanning for barcode...</span>
          </div>
        )}

        {status === 'scanning' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="animate-spin text-white" size={32} />
          </div>
        )}

        {status === 'loading' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-primary-400" size={32} />
            <span className="text-sm text-gray-300">Starting camera...</span>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-gray-800 border border-gray-700">
        <ScanBarcode size={20} className="text-primary-400 shrink-0" />
        <p className="text-sm text-gray-300">
          Hold the student ID card barcode in front of the camera. It will scan automatically.
        </p>
      </div>

      {errorMsg && (
        <div className="mt-3 p-3 rounded-lg bg-red-900/20 border border-red-800/30">
          <p className="text-sm text-red-300">{errorMsg}</p>
        </div>
      )}

      {status === 'error' && (
        <button
          onClick={onCancel}
          className="mt-4 w-full py-3 rounded-xl bg-gray-700 text-white font-medium hover:bg-gray-600 transition-colors"
        >
          Go Back
        </button>
      )}
    </div>
  );
}
