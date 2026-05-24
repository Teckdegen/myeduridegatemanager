import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'photos';

const ALLOWED_LOGO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

export function isAllowedLogoMime(mime: string): boolean {
  return ALLOWED_LOGO_MIMES.has(mime.toLowerCase());
}

/** Upload school logo; store storage path in schools.logo_url (works with /api/photo). */
export async function uploadSchoolLogoBuffer(
  supabase: SupabaseClient,
  schoolId: string,
  buffer: Buffer,
  contentType: string
): Promise<{ path: string | null; error: string | null }> {
  const mime = (contentType || 'image/jpeg').toLowerCase();
  if (!isAllowedLogoMime(mime)) {
    return { path: null, error: 'Logo must be JPG, PNG, or WebP' };
  }
  const ext = extFromMime(mime);
  const storagePath = `logos/${schoolId}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: contentType || 'image/jpeg', upsert: true });

  if (error) {
    console.error('[upload-school-logo]', error.message);
    return { path: null, error: error.message };
  }

  return { path: storagePath, error: null };
}
