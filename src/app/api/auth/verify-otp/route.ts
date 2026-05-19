import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code required' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Find valid OTP
    const { data: otpRecord } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('code', code)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!otpRecord) {
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
      .eq('email', email.toLowerCase().trim())
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate a Supabase session for this user using admin API
    // This creates a proper auth session so the client SDK works
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase().trim(),
    });

    if (sessionError || !sessionData) {
      // Fallback: sign in directly
      // Use admin to create a session token
      const { data: userData } = await supabase.auth.admin.getUserById(profile.id);
      
      if (!userData?.user) {
        return NextResponse.json({ error: 'Auth user not found' }, { status: 404 });
      }

      // Return user info - client will use this to establish session
      return NextResponse.json({
        success: true,
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
        },
        // Return the magic link token for client-side session creation
        token_hash: sessionData?.properties?.hashed_token || null,
        redirect_url: sessionData?.properties?.action_link || null,
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
      },
      token_hash: sessionData.properties?.hashed_token || null,
      redirect_url: sessionData.properties?.action_link || null,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
