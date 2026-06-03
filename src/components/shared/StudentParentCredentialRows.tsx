'use client';

import { Copy, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export type StudentParentCredential = {
  student_id: string;
  student_name: string;
  student_id_number: string;
  class_name: string | null;
  parent_user_id: string | null;
  parent_name: string;
  parent_username: string;
  password: string;
};

type Props = {
  rows: StudentParentCredential[];
  draftPasswords: Record<string, string>;
  draftConfirmPasswords: Record<string, string>;
  setDraftPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setDraftConfirmPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (parentUserId: string) => void;
  savingId: string | null;
  showPasswords: boolean;
};

export function StudentParentCredentialTableHead() {
  return (
    <tr className="text-left border-b bg-white text-xs text-gray-500 uppercase">
      <th className="py-2.5 px-5 font-semibold">Student</th>
      <th className="py-2.5 pr-4 font-semibold">Parent name</th>
      <th className="py-2.5 pr-4 font-semibold">Parent username</th>
      <th className="py-2.5 pr-3 font-semibold">Password</th>
      <th className="py-2.5 pr-4 font-semibold">Confirm</th>
      <th className="py-2.5 pr-5 font-semibold">Actions</th>
    </tr>
  );
}

export function StudentParentCredentialRows({
  rows,
  draftPasswords,
  draftConfirmPasswords,
  setDraftPasswords,
  setDraftConfirmPasswords,
  onSave,
  savingId,
  showPasswords,
}: Props) {
  if (rows.length === 0) return null;

  return (
    <tbody>
      {rows.map((row) => {
        const key = row.parent_user_id || row.student_id;
        const hasParent = !!row.parent_user_id;

        return (
          <tr key={row.student_id} className="border-b last:border-b-0 hover:bg-gray-50/80">
            <td className="py-3 px-5">
              <p className="font-medium text-gray-900">{row.student_name}</p>
              <p className="text-xs font-mono text-gray-500">{row.student_id_number}</p>
              {row.class_name && <p className="text-xs text-gray-400">{row.class_name}</p>}
            </td>
            <td className="py-3 pr-4 text-sm">
              {hasParent ? row.parent_name : (
                <span className="text-amber-700 text-xs">No parent account</span>
              )}
            </td>
            <td className="py-3 pr-4 font-mono text-xs">
              {hasParent ? row.parent_username || '—' : '—'}
            </td>
            <td className="py-3 pr-3 min-w-[160px]">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={hasParent ? (draftPasswords[key] ?? '') : ''}
                onChange={(e) =>
                  hasParent &&
                  setDraftPasswords((prev) => ({ ...prev, [key]: e.target.value }))
                }
                disabled={!hasParent}
                className="input h-9 font-mono text-xs w-full disabled:opacity-50"
                placeholder={hasParent ? 'Password' : 'Add parent when registering student'}
              />
            </td>
            <td className="py-3 pr-4 min-w-[160px]">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={hasParent ? (draftConfirmPasswords[key] ?? '') : ''}
                onChange={(e) =>
                  hasParent &&
                  setDraftConfirmPasswords((prev) => ({ ...prev, [key]: e.target.value }))
                }
                disabled={!hasParent}
                className="input h-9 font-mono text-xs w-full disabled:opacity-50"
                placeholder="Confirm"
              />
            </td>
            <td className="py-3 pr-5">
              {hasParent ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const pw = draftPasswords[key] ?? row.password ?? '';
                      navigator.clipboard.writeText(
                        `Student: ${row.student_name}\nParent username: ${row.parent_username}\nPassword: ${pw || '(not set)'}`
                      );
                      toast.success('Copied');
                    }}
                    className="btn-secondary h-9 px-2.5"
                    title="Copy credentials"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSave(row.parent_user_id!)}
                    disabled={savingId === row.parent_user_id}
                    className="btn-primary h-9 px-3 inline-flex items-center gap-1.5"
                  >
                    <KeyRound size={14} />
                    {savingId === row.parent_user_id ? 'Saving…' : 'Update'}
                  </button>
                </div>
              ) : null}
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}
