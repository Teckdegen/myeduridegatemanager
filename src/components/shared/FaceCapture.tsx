'use client';

import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import { averageDescriptors, computeDescriptorFromDataUrl } from '@/lib/face/descriptor';

type FaceCaptureProps = {
  label?: string;
  minPhotos?: number;
  maxPhotos?: number;
  onChange: (payload: { photos: string[]; face_descriptor: number[] | null }) => void;
};

export default function FaceCapture({
  label = 'Face photos',
  minPhotos = 3,
  maxPhotos = 3,
  onChange,
}: FaceCaptureProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const updateParent = async (next: string[]) => {
    if (next.length === 0) {
      onChange({ photos: [], face_descriptor: null });
      return;
    }
    try {
      const descriptors = await Promise.all(next.map((p) => computeDescriptorFromDataUrl(p)));
      onChange({ photos: next, face_descriptor: averageDescriptors(descriptors) });
    } catch {
      onChange({ photos: next, face_descriptor: null });
    }
  };

  const startCamera = async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      toast.error('Camera access denied');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const next = [...photos, dataUrl].slice(0, maxPhotos);
    setPhotos(next);
    await updateParent(next);
    if (next.length >= maxPhotos) stopCamera();
  };

  const removePhoto = async (index: number) => {
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    await updateParent(next);
  };

  return (
    <div>
      <h3 className="font-semibold text-sm mb-1">{label} *</h3>
      <p className="text-xs text-gray-500 mb-3">
        Take {minPhotos} clear face photos (front, slight left, slight right) for gate recognition.
      </p>

      {!cameraActive ? (
        <button
          type="button"
          onClick={startCamera}
          className="w-full py-6 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center gap-2 hover:border-primary-400 hover:bg-primary-50"
        >
          <Camera size={24} className="text-gray-400" />
          <span className="text-sm text-gray-500">Open camera</span>
        </button>
      ) : (
        <div>
          <div className="relative rounded-xl overflow-hidden bg-gray-900 mb-3">
            <video ref={videoRef} autoPlay playsInline muted className="w-full min-h-[200px] object-cover" />
          </div>
          <button
            type="button"
            onClick={capturePhoto}
            disabled={photos.length >= maxPhotos}
            className="btn-primary w-full mb-2"
          >
            {photos.length < maxPhotos ? `Capture photo ${photos.length + 1}/${maxPhotos}` : 'Done'}
          </button>
          <button type="button" onClick={stopCamera} className="btn-secondary w-full text-sm">
            Close camera
          </button>
        </div>
      )}

      {photos.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              <img src={p} alt={`Face ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border-2 border-primary-300" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className={`text-xs mt-2 ${photos.length >= minPhotos ? 'text-green-600' : 'text-amber-600'}`}>
        {photos.length}/{minPhotos} photos captured
      </p>
    </div>
  );
}
