/** Normalize QR / ID scan input (MYEDURIDE:STU001 → multiple lookup keys). */
export function scanLookupValues(raw: string): string[] {
  const trimmed = (raw || '').trim();
  if (!trimmed) return [];

  const values = new Set<string>([trimmed]);
  if (trimmed.toUpperCase().startsWith('MYEDURIDE:')) {
    values.add(trimmed.slice(trimmed.indexOf(':') + 1).trim());
  }
  return [...values];
}
