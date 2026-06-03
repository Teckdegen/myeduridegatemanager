import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ensureAuthUser,
  ensureUserProfile,
  findAuthUserIdByEmail,
  reserveUsernameForProfile,
} from '@/lib/auth/ensure-user';
import {
  authEmailFromUsername,
  generateRandomPassword,
  isValidUsername,
  normalizeUsername,
  suggestUniqueUsername,
} from '@/lib/auth/username';
import { resolveInitialPassword } from '@/lib/auth/password-policy';
import { setAuthPasswordForProfile } from '@/lib/auth/update-password';

export type ProvisionParentResult =
  | {
      parent_user_id: string;
      parent_username: string;
      password: string;
      created: boolean;
    }
  | { error: string };

type CustomFields = {
  parent_name?: string;
  parent_username?: string;
  parent_email?: string;
  parent_phone?: string;
  relationship?: string;
};

export function parentInfoFromCustomFields(
  customFields: CustomFields | null | undefined
): {
  parent_name: string;
  parent_username: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  relationship: string;
} {
  const cf = customFields || {};
  const parentName =
    cf.parent_name ||
    (cf as Record<string, string>).parent_full_name ||
    (cf as Record<string, string>).parent ||
    '';
  return {
    parent_name: String(parentName).trim(),
    parent_username: cf.parent_username?.trim() || null,
    parent_email: cf.parent_email?.includes('@') ? cf.parent_email.toLowerCase().trim() : null,
    parent_phone: cf.parent_phone?.trim() || null,
    relationship: cf.relationship?.trim() || 'parent',
  };
}

/** Create or link a parent login for a student (idempotent). Username is the source of truth. */
export async function provisionParentForStudent(
  supabase: SupabaseClient,
  opts: {
    student_id: string;
    school_id: string;
    parent_name: string;
    parent_username?: string | null;
    parent_email?: string | null;
    parent_phone?: string | null;
    relationship?: string;
    password?: string;
  }
): Promise<ProvisionParentResult> {
  const parentName = opts.parent_name?.trim();
  if (!parentName && !opts.parent_username?.trim()) {
    return { error: 'Parent name or username is required' };
  }

  const email = opts.parent_email?.includes('@') ? opts.parent_email.toLowerCase().trim() : null;
  const explicitPassword = opts.password?.trim() || '';
  const resolvedPassword = resolveInitialPassword(explicitPassword || undefined, generateRandomPassword(10));
  let parentUserId: string | undefined;
  let parentUsername: string | undefined;
  let generatedPassword = resolvedPassword;
  let created = false;
  let explicitUsernameForCreate: string | null = null;

  if (opts.parent_username?.trim()) {
    const normalized = normalizeUsername(opts.parent_username);
    if (!isValidUsername(normalized)) {
      return { error: 'Parent username must be 3–30 characters (letters, numbers, underscore only)' };
    }

    const { data: byUsername } = await supabase
      .from('user_profiles')
      .select('id, username, full_name, email, phone')
      .eq('username', normalized)
      .maybeSingle();

    if (byUsername?.id) {
      parentUserId = byUsername.id;
      parentUsername = byUsername.username || normalized;
    } else {
      explicitUsernameForCreate = normalized;
      parentUsername = normalized;
    }
  }

  if (!parentUserId && email) {
    const { data: byEmail } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('email', email)
      .maybeSingle();
    if (byEmail?.id) {
      parentUserId = byEmail.id;
      parentUsername = byEmail.username || undefined;
    }
  }

  if (!parentUserId) {
    const { data: existingLink } = await supabase
      .from('student_parents')
      .select('parent_user_id')
      .eq('student_id', opts.student_id)
      .eq('is_primary', true)
      .maybeSingle();

    if (existingLink?.parent_user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, username')
        .eq('id', existingLink.parent_user_id)
        .maybeSingle();
      if (profile?.id) {
        parentUserId = profile.id;
        parentUsername = profile.username || undefined;
      }
    }
  }

  if (!parentUserId) {
    const desiredUsername =
      explicitUsernameForCreate || (await suggestUniqueUsername(supabase, parentName || 'parent'));

    const { data: profileByUsername } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('username', desiredUsername)
      .maybeSingle();

    if (profileByUsername?.id) {
      parentUserId = profileByUsername.id;
      parentUsername = profileByUsername.username || desiredUsername;
    } else {
      const existingAuthId = await findAuthUserIdByEmail(
        supabase,
        authEmailFromUsername(desiredUsername)
      );

      if (existingAuthId) {
        parentUserId = existingAuthId;
        parentUsername = desiredUsername;
      } else {
        const { userId, password, error: authErr } = await ensureAuthUser(supabase, {
          username: desiredUsername,
          full_name: parentName || parentUsername || desiredUsername,
          password: explicitPassword || resolvedPassword,
        });
        if (!userId) {
          return { error: authErr || 'Could not create parent auth account' };
        }
        parentUserId = userId;
        parentUsername = desiredUsername;
        generatedPassword = password || resolvedPassword;
        created = true;
      }
    }
  }

  if (!parentUserId) {
    return { error: 'Could not resolve parent account' };
  }

  if (!parentUsername) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', parentUserId)
      .maybeSingle();
    parentUsername = profile?.username || (await suggestUniqueUsername(supabase, parentName));
  }

  parentUsername = await reserveUsernameForProfile(
    supabase,
    parentUserId,
    parentUsername || parentName || 'parent'
  );

  const profileName = parentName || parentUsername || 'Parent';

  const { error: profileErr } = await ensureUserProfile(supabase, {
    id: parentUserId,
    username: parentUsername,
    full_name: profileName,
    phone: opts.parent_phone || null,
    email,
  });
  if (profileErr) {
    return { error: profileErr.message };
  }

  if (created || explicitPassword) {
    const { error: pwErr } = await setAuthPasswordForProfile(supabase, parentUserId, generatedPassword, {
      createAuthIfMissing: true,
    });
    if (pwErr) {
      return { error: pwErr };
    }
  }

  await supabase.from('user_school_roles').upsert(
    {
      user_id: parentUserId,
      school_id: opts.school_id,
      role: 'parent',
      is_active: true,
    },
    { onConflict: 'user_id,school_id,role' }
  );

  await supabase.from('student_parents').upsert(
    {
      student_id: opts.student_id,
      parent_user_id: parentUserId,
      relationship: opts.relationship || 'parent',
      is_primary: true,
    },
    { onConflict: 'student_id,parent_user_id' }
  );

  return {
    parent_user_id: parentUserId,
    parent_username: parentUsername,
    password: generatedPassword,
    created,
  };
}
