'use client';

import { useEffect, useState } from 'react';
import { isValidUsername, normalizeUsername } from '@/lib/auth/username';

export type UsernameLookupUser = {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  roles: string[];
};

export function useUsernameLookup(username: string) {
  const [existingUser, setExistingUser] = useState<UsernameLookupUser | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const normalized = normalizeUsername(username);
    if (!normalized || !isValidUsername(normalized)) {
      setExistingUser(null);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/lookup-by-username?username=${encodeURIComponent(normalized)}`,
          { credentials: 'include', cache: 'no-store' }
        );
        const data = await res.json();
        if (!cancelled) {
          setExistingUser(res.ok && data.found ? data.user : null);
        }
      } catch {
        if (!cancelled) setExistingUser(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  return { existingUser, checking, isExisting: !!existingUser };
}
