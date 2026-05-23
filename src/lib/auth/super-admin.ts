/** Platform school used only to attach super_admin roles (not a real school). */
export const DEFAULT_PLATFORM_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export function getPlatformSchoolId(): string {
  return process.env.PLATFORM_SCHOOL_ID?.trim() || DEFAULT_PLATFORM_SCHOOL_ID;
}

/** Comma-separated list in SUPER_ADMIN_EMAILS */
export function getSuperAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter((e) => e.includes('@'));
}

export function isSuperAdminEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  return getSuperAdminEmails().includes(normalized);
}
