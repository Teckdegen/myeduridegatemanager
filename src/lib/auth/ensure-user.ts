import type { SupabaseClient } from '@supabase/supabase-js';

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

/** Create an auth user or return the existing auth user id for this email. */
export async function ensureAuthUser(
  supabase: SupabaseClient,
  email: string
): Promise<{ userId: string | null; error?: string }> {
  const normalized = email.toLowerCase().trim();

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
  });

  if (!authError && authUser?.user) {
    return { userId: authUser.user.id };
  }

  const existingId = await findAuthUserIdByEmail(supabase, normalized);
  if (existingId) {
    return { userId: existingId };
  }

  return { userId: null, error: authError?.message || 'Failed to create user' };
}

export async function ensureUserProfile(
  supabase: SupabaseClient,
  params: { id: string; email: string; full_name: string; phone?: string | null }
) {
  return supabase.from('user_profiles').upsert(
    {
      id: params.id,
      email: params.email.toLowerCase().trim(),
      full_name: params.full_name,
      phone: params.phone || null,
    },
    { onConflict: 'id' }
  );
}
