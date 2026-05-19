import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();
    const code = (body.code || '').trim();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code required' }, { status: 400 });
    }

    // Create supabase client with service role
    const { createClient } = require('@supabase/supabase-js');
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Find valid OTP
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

    // Mark code as used
    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('id', otpRecord.id);

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate a magic link so we can create a Supabase Auth session
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (linkErr || !linkData) {
      // Still return success — user is verified, just session creation failed
      return NextResponse.json({
        success: true,
        user: { id: profile.id, email: profile.email, full_name: profile.full_name },
        token_hash: null,
        redirect_url: null,
      });
    }

    return NextResponse.json({
      success: true,
      user: { id: profile.id, email: profile.email, full_name: profile.full_name },
      token_hash: linkData.properties?.hashed_token || null,
      redirect_url: linkData.properties?.action_link || null,
    });
  } catch (err: any) {
    console.error('Verify OTP crash:', err?.message || err);
    return NextResponse.json({ error: 'Verification failed. Try again.' }, { status: 500 });
  }
}
