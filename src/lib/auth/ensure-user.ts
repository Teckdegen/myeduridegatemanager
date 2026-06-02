import type { SupabaseClient } from '@supabase/supabase-js';
import {
  authEmailFromUsername,
  generateRandomPassword,
  generateUniqueUsername,
  normalizeUsername,
} from '@/lib/auth/username';

/** Paginated lookup — listUsers() without args only returns the first page. */
export async function findAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const normalized = email.toLowerCase().trim();
  let page = 1;
  const perPage = 1000;

  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error('[auth] listUsers error:', error.message);
      return null;
    }

    const found = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (found) return found.id;

    if (data.users.length < perPage) break;
    page++;
  }

  return null;
}

export async function findProfileByUsername(supabase: SupabaseClient, username: string) {
  const normalized = normalizeUsername(username);
  return supabase
    .from('user_profiles')
    .select('id, username, email, full_name, failed_login_attempts, locked_until')
    .eq('username', normalized)
    .maybeSingle();
}

type EnsureAuthParams = {
  username?: string;
  email?: string | null;
  full_name?: string;
  password?: string;
};

/** Create auth user + return credentials. Uses internal auth email derived from username. */
export async function ensureAuthUser(
  supabase: SupabaseClient,
  params: EnsureAuthParams | string
): Promise<{ userId: string | null; username?: string; password?: string; error?: string }> {
  const input: EnsureAuthParams =
    typeof params === 'string' ? { username: params } : params;

  let username = input.username ? normalizeUsername(input.username) : '';
  if (!username && input.email) {
    username = await generateUniqueUsername(
      supabase,
      input.email.split('@')[0] || 'user'
    );
  }
  if (!username) {
    return { userId: null, error: 'Username is required' };
  }

  const generatedPassword = input.password || generateRandomPassword(10);
  const authEmail = authEmailFromUsername(username);

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: authEmail,
    email_confirm: true,
    password: generatedPassword,
    user_metadata: {
      login_password: generatedPassword,
      username,
      full_name: input.full_name || '',
    },
  });

  if (!authError && authUser?.user) {
    return { userId: authUser.user.id, username, password: generatedPassword };
  }

  const existingId = await findAuthUserIdByEmail(supabase, authEmail);
  if (existingId) {
    return { userId: existingId, username };
  }

  return { userId: null, error: authError?.message || 'Failed to create user' };
}

export async function ensureUserProfile(
  supabase: SupabaseClient,
  params: {
    id: string;
    username: string;
    email?: string | null;
    full_name: string;
    phone?: string | null;
  }
) {
  return supabase.from('user_profiles').upsert(
    {
      id: params.id,
      username: normalizeUsername(params.username),
      email: params.email?.toLowerCase().trim() || null,
      full_name: params.full_name,
      phone: params.phone || null,
      auth_preference: 'password',
    },
    { onConflict: 'id' }
  );
}
