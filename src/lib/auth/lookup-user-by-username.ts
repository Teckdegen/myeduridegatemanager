import type { SupabaseClient } from '@supabase/supabase-js';
import { findProfileByUsername } from '@/lib/auth/ensure-user';
import { isValidUsername, normalizeUsername } from '@/lib/auth/username';

export type LookedUpUser = {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  roles: string[];
};

export async function lookupUserByUsername(
  supabase: SupabaseClient,
  rawUsername: string
): Promise<LookedUpUser | null> {
  const username = normalizeUsername(rawUsername);
  if (!username || !isValidUsername(username)) return null;

  const { data: profile } = await findProfileByUsername(supabase, username);
  if (!profile?.id) return null;

  const { data: roleRows } = await supabase
    .from('user_school_roles')
    .select('role')
    .eq('user_id', profile.id)
    .eq('is_active', true);

  const roles = [...new Set((roleRows || []).map((r) => r.role))].sort();

  return {
    id: profile.id,
    username: profile.username || username,
    full_name: profile.full_name || '',
    phone: profile.phone?.trim() || null,
    email: profile.email?.trim() || null,
    roles,
  };
}
