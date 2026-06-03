import type { StudentParentCredential } from '@/lib/school/student-parent-credentials';

export type SchoolParentChild = {
  student_id: string;
  student_name: string;
  class_name: string | null;
  student_id_number: string;
};

export type SchoolParentRow = {
  id: string | null;
  name: string;
  phone: string | null;
  username: string | null;
  has_login: boolean;
  children: SchoolParentChild[];
};

function parentKey(row: StudentParentCredential): string {
  if (row.parent_user_id) return `user:${row.parent_user_id}`;
  const name = (row.parent_on_file_name || row.parent_name || '').trim().toLowerCase();
  const phone = (row.parent_phone || '').replace(/\D/g, '');
  return `file:${name}|${phone}`;
}

export function aggregateStudentParentRows(rows: StudentParentCredential[]): SchoolParentRow[] {
  const map = new Map<string, SchoolParentRow>();

  for (const row of rows) {
    const name = (row.parent_name || row.parent_on_file_name || '').trim();
    if (!name) continue;

    const key = parentKey(row);
    const child: SchoolParentChild = {
      student_id: row.student_id,
      student_name: row.student_name,
      class_name: row.class_name,
      student_id_number: row.student_id_number,
    };

    const hasLogin = !!row.parent_user_id && !!row.parent_username?.trim();
    const existing = map.get(key);

    if (existing) {
      if (!existing.children.some((c) => c.student_id === child.student_id)) {
        existing.children.push(child);
      }
      if (row.parent_user_id) {
        existing.id = row.parent_user_id;
        existing.username = row.parent_username?.trim() || existing.username;
        existing.has_login = hasLogin || existing.has_login;
      }
      if (row.parent_phone && !existing.phone) existing.phone = row.parent_phone;
    } else {
      map.set(key, {
        id: row.parent_user_id,
        name,
        phone: row.parent_phone,
        username: row.parent_username?.trim() || null,
        has_login: hasLogin,
        children: [child],
      });
    }
  }

  for (const parent of map.values()) {
    parent.children.sort((a, b) => a.student_name.localeCompare(b.student_name));
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
