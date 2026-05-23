import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureSuperAdminAccess } from '@/lib/auth/ensure-super-admin';
import { isSuperAdminEmail } from '@/lib/auth/super-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();
    const code = (body.code || '').trim();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: otpRecord, error: otpErr } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpErr || !otpRecord) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id);

    let profileRow = (
      await supabase.from('user_profiles').select('id, email, full_name').eq('email', email).single()
    ).data;

    if (!profileRow && isSuperAdminEmail(email)) {
      const boot = await ensureSuperAdminAccess(supabase, email);
      if (!boot.ok) {
        return NextResponse.json({ error: boot.error || 'Could not provision super admin' }, { status: 500 });
      }
      profileRow = (
        await supabase.from('user_profiles').select('id, email, full_name').eq('email', email).single()
      ).data;
    } else if (profileRow && isSuperAdminEmail(email)) {
      await ensureSuperAdminAccess(supabase, email);
    }

    if (!profileRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const { data: roles, error: rolesErr } = await supabase
      .from('user_school_roles')
      .select('role, school_id')
      .eq('user_id', profileRow.id)
      .eq('is_active', true);

    console.log('[VERIFY] User:', profileRow.email, 'Roles found:', roles?.length, 'Roles:', JSON.stringify(roles));
    if (rolesErr) console.error('[VERIFY] Roles error:', rolesErr);

    const sessionData = JSON.stringify({
      user_id: profileRow.id,
      email: profileRow.email,
      full_name: profileRow.full_name,
      roles: roles || [],
    });

    const response = NextResponse.json({
      success: true,
      user: { id: profileRow.id, email: profileRow.email, full_name: profileRow.full_name },
      roles: roles || [],
    });

    response.cookies.set('myeduride_session', sessionData, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Verify OTP error:', err?.message || err);
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 });
  }
}
