import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureAuthUser, ensureUserProfile } from '@/lib/auth/ensure-user';
import { getPlatformSchoolId, isSuperAdminEmail } from '@/lib/auth/super-admin';

/** Create platform school, auth user, profile, and super_admin role for env-listed emails. */
export async function ensureSuperAdminAccess(
  supabase: SupabaseClient,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.toLowerCase().trim();
  if (!isSuperAdminEmail(normalized)) {
    return { ok: false, error: 'Not a configured super admin email' };
  }

  const platformSchoolId = getPlatformSchoolId();

  const { error: schoolErr } = await supabase.from('schools').upsert(
    {
      id: platformSchoolId,
      name: process.env.PLATFORM_SCHOOL_NAME?.trim() || 'MyEduRide Platform',
      setup_completed: true,
      setup_step: 'complete',
    },
    { onConflict: 'id' }
  );

  if (schoolErr) {
    console.error('[super-admin] platform school:', schoolErr.message);
    return { ok: false, error: schoolErr.message };
  }

  const { userId, error: authErr } = await ensureAuthUser(supabase, normalized);
  if (!userId) {
    return { ok: false, error: authErr || 'Could not create auth user' };
  }

  const localPart = normalized.split('@')[0] || 'Admin';
  const fullName =
    process.env.SUPER_ADMIN_DEFAULT_NAME?.trim() ||
    localPart.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const { error: profileErr } = await ensureUserProfile(supabase, {
    id: userId,
    email: normalized,
    full_name: fullName,
  });

  if (profileErr) {
    console.error('[super-admin] profile:', profileErr.message);
    return { ok: false, error: profileErr.message };
  }

  const { error: roleErr } = await supabase.from('user_school_roles').upsert(
    {
      user_id: userId,
      school_id: platformSchoolId,
      role: 'super_admin',
      is_active: true,
    },
    { onConflict: 'user_id,school_id,role' }
  );

  if (roleErr) {
    console.error('[super-admin] role:', roleErr.message);
    return { ok: false, error: roleErr.message };
  }

  return { ok: true };
}
