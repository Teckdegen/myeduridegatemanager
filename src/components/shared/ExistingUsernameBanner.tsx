'use client';

import type { UsernameLookupUser } from '@/hooks/useUsernameLookup';

export function ExistingUsernameBanner({
  user,
  checking,
  roleHint,
}: {
  user: UsernameLookupUser | null;
  checking?: boolean;
  roleHint?: string;
}) {
  if (checking) {
    return <p className="text-xs text-gray-400 mt-1">Checking username…</p>;
  }
  if (!user) return null;

  const roles = user.roles.length ? user.roles.join(', ').replace(/_/g, ' ') : roleHint || 'existing user';

  return (
    <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mt-2">
      Existing account <span className="font-semibold">@{user.username}</span> — details filled in.
      {roles ? ` (${roles})` : ''} No duplicate will be created.
    </p>
  );
}
