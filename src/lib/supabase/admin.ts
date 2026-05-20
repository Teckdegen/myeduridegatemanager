/**
 * Creates a Supabase client with service role key.
 * Handles URL cleanup (strips /rest/v1/ if present).
 * Use this in ALL API routes.
 */
export function getAdminClient() {
  const { createClient } = require('@supabase/supabase-js');
  
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  // Strip any trailing paths like /rest/v1/ or /rest/v1/anything
  url = url.replace(/\/rest\/v1\/?.*$/, '').replace(/\/$/, '');
  // Fallback if URL is still invalid
  if (!url || !url.startsWith('https://')) {
    url = 'https://qbtafanhemwhdlklvifx.supabase.co';
  }

  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
