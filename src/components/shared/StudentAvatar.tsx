'use client';

import { useState } from 'react';
import { photoSrc } from '@/lib/photo';

type StudentAvatarProps = {
  photoUrl?: string | null;
  firstName?: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg';
  accentColor?: string;
};

const sizes = {
  sm: 'w-10 h-10 text-sm rounded-lg',
  md: 'w-16 h-16 text-lg rounded-xl',
  lg: 'w-24 h-24 text-2xl rounded-2xl',
};

export default function StudentAvatar({
  photoUrl,
  firstName = '',
  lastName = '',
  size = 'md',
  accentColor = '#1B4D3E',
}: StudentAvatarProps) {
  const [failed, setFailed] = useState(false);
  const src = photoSrc(photoUrl);
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName}`.trim()}
        className={`${sizes[size]} object-cover shrink-0 border-2 border-white shadow-sm`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} flex items-center justify-center text-white font-bold shrink-0 shadow-sm`}
      style={{ backgroundColor: accentColor }}
    >
      {initials}
    </div>
  );
}
