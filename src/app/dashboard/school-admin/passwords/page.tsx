'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  RefreshCcw,
  Search,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

type CredentialUser = {
  id: string;
  username: string;
  full_name: string;
  roles: string[];
  password: string;
  staff_id_number?: string | null;
};

type SchoolBlock = {
  id: string;
  name: string;
  address: string | null;
  staff: CredentialUser[];
  parents: CredentialUser[];
  other: CredentialUser[];
  users: CredentialUser[];
  total_users: number;
};

function formatRole(role: string) {
  return role.replace(/_/g, ' ');
}

function UserRows({
  users,
  draftPasswords,
  setDraftPasswords,
  onSave,
  savingId,
  showPasswords,
}: {
  users: CredentialUser[];
  draftPasswords: Record<string, string>;
  setDraftPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (userId: string) => void;
  savingId: string | null;
  showPasswords: boolean;
}) {
  if (users.length === 0) return null;

  return (
    <tbody>
      {users.map((user) => (
        <tr key={user.id} className="border-b last:border-b-0 hover:bg-gray-50/80">
          <td className="py-3 px-5">
            <p className="font-medium text-gray-900">{user.full_name || '—'}</p>
            {user.staff_id_number && (
              <p className="text-xs font-mono text-gray-500">{user.staff_id_number}</p>
            )}
          </td>
          <td className="py-3 pr-4 font-mono text-xs">{user.username || '—'}</td>
          <td className="py-3 pr-4 capitalize text-xs">
            {user.roles.length ? user.roles.map(formatRole).join(', ') : '—'}
          </td>
          <td className="py-3 pr-4 min-w-[200px]">
            <input
              type={showPasswords ? 'text' : 'password'}
              value={draftPasswords[user.id] ?? ''}
              onChange={(e) =>
                setDraftPasswords((prev) => ({ ...prev, [user.id]: e.target.value }))
              }
              className="input h-9 font-mono text-xs w-full"
              placeholder="No password on file"
            />
          </td>
          <td className="py-3 pr-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const pw = draftPasswords[user.id] ?? user.password ?? '';
                  navigator.clipboard.writeText(
                    `Username: ${user.username}\nPassword: ${pw || '(not set)'}`
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
                onClick={() => onSave(user.id)}
                disabled={savingId === user.id}
                className="btn-primary h-9 px-3 inline-flex items-center gap-1.5"
              >
                <KeyRound size={14} />
                {savingId === user.id ? 'Saving…' : 'Save'}
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function UserSection({
  title,
  icon,
  users,
  draftPasswords,
  setDraftPasswords,
  onSave,
  savingId,
  showPasswords,
}: {
  title: string;
  icon: React.ReactNode;
  users: CredentialUser[];
  draftPasswords: Record<string, string>;
  setDraftPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (userId: string) => void;
  savingId: string | null;
  showPasswords: boolean;
}) {
  if (users.length === 0) return null;

  return (
    <div className="border-t first:border-t-0">
      <div className="px-5 py-2.5 bg-gray-50/90 flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wide">
        {icon}
        {title}
        <span className="text-gray-400 font-normal">({users.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left border-b bg-white text-xs text-gray-500 uppercase">
              <th className="py-2 px-5">Name</th>
              <th className="py-2 pr-4">Username</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Password</th>
              <th className="py-2 pr-5">Actions</th>
            </tr>
          </thead>
          <UserRows
            users={users}
            draftPasswords={draftPasswords}
            setDraftPasswords={setDraftPasswords}
            onSave={onSave}
            savingId={savingId}
            showPasswords={showPasswords}
          />
        </table>
      </div>
    </div>
  );
}

function SchoolPasswordBlock({
  school,
  draftPasswords,
  setDraftPasswords,
  onSave,
  savingId,
  showPasswords,
  defaultExpanded,
}: {
  school: SchoolBlock;
  draftPasswords: Record<string, string>;
  setDraftPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (userId: string) => void;
  savingId: string | null;
  showPasswords: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);

  const content = (
    <div>
      {school.total_users === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">No users at this school yet</div>
      ) : (
        <>
          <UserSection
            title="Staff (admin, teachers, gate, general)"
            icon={<GraduationCap size={14} className="text-blue-600" />}
            users={school.staff}
            draftPasswords={draftPasswords}
            setDraftPasswords={setDraftPasswords}
            onSave={onSave}
            savingId={savingId}
            showPasswords={showPasswords}
          />
          <UserSection
            title="Parents"
            icon={<User size={14} className="text-orange-600" />}
            users={school.parents}
            draftPasswords={draftPasswords}
            setDraftPasswords={setDraftPasswords}
            onSave={onSave}
            savingId={savingId}
            showPasswords={showPasswords}
          />
          <UserSection
            title="Other"
            icon={<Users size={14} className="text-gray-600" />}
            users={school.other}
            draftPasswords={draftPasswords}
            setDraftPasswords={setDraftPasswords}
            onSave={onSave}
            savingId={savingId}
            showPasswords={showPasswords}
          />
        </>
      )}
    </div>
  );

  return (
    <div className="card p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 min-h-[52px]"
      >
        {expanded ? (
          <ChevronDown size={18} className="text-gray-400 shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-gray-400 shrink-0" />
        )}
        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
          <Building2 size={18} className="text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{school.name}</p>
          {school.address && <p className="text-xs text-gray-500 truncate">{school.address}</p>}
          <p className="text-xs text-gray-400 mt-0.5">
            {school.staff.length} staff · {school.parents.length} parents
          </p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 shrink-0">
          {school.total_users} users
        </span>
      </button>
      {expanded && content}
    </div>
  );
}

export default function SchoolAdminPasswordsPage() {
  const [schools, setSchools] = useState<SchoolBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftPasswords, setDraftPasswords] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/school-admin/passwords', {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load credentials');
        return;
      }

      const loadedSchools: SchoolBlock[] = data.schools || [];
      setSchools(loadedSchools);
      setTotalUsers(data.total_users || 0);

      const passwordMap: Record<string, string> = {};
      for (const school of loadedSchools) {
        for (const user of school.users) {
          passwordMap[user.id] = user.password || '';
        }
      }
      setDraftPasswords(passwordMap);
    } catch {
      toast.error('Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const filteredSchools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return schools;

    return schools
      .map((school) => {
        const schoolMatch =
          school.name.toLowerCase().includes(q) ||
          (school.address || '').toLowerCase().includes(q);

        const filterList = (list: CredentialUser[]) =>
          list.filter(
            (u) =>
              u.full_name.toLowerCase().includes(q) ||
              u.username.toLowerCase().includes(q) ||
              u.roles.some((r) => formatRole(r).includes(q)) ||
              (u.staff_id_number || '').toLowerCase().includes(q)
          );

        const staff = filterList(school.staff);
        const parents = filterList(school.parents);
        const other = filterList(school.other);

        if (schoolMatch) return school;
        if (staff.length + parents.length + other.length === 0) return null;

        const users = [...staff, ...parents, ...other];
        return { ...school, staff, parents, other, users, total_users: users.length };
      })
      .filter(Boolean) as SchoolBlock[];
  }, [schools, searchQuery]);

  const savePassword = async (userId: string) => {
    const password = (draftPasswords[userId] || '').trim();
    if (!password) {
      toast.error('Enter a password first');
      return;
    }

    setSavingId(userId);
    try {
      const res = await fetch('/api/school-admin/users/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update password');
        return;
      }

      toast.success('Password updated');
      const patch = (u: CredentialUser) => (u.id === userId ? { ...u, password } : u);
      setSchools((prev) =>
        prev.map((s) => ({
          ...s,
          staff: s.staff.map(patch),
          parents: s.parents.map(patch),
          other: s.other.map(patch),
          users: s.users.map(patch),
        }))
      );
    } catch {
      toast.error('Failed to update password');
    } finally {
      setSavingId(null);
    }
  };

  const staffCount = schools.reduce((n, s) => n + s.staff.length, 0);
  const parentCount = schools.reduce((n, s) => n + s.parents.length, 0);
  const singleSchool = filteredSchools.length === 1 ? filteredSchools[0] : null;

  return (
    <div className="p-4 sm:p-6 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <KeyRound size={24} className="text-primary-700" />
            Passwords
          </h1>
          <p className="text-sm text-gray-500">
            All usernames and passwords for staff and parents at your school
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={() => setShowPasswords((v) => !v)}
            className="btn-secondary flex items-center gap-2 text-sm min-h-[44px]"
          >
            {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPasswords ? 'Hide' : 'Show'}
          </button>
          <button type="button" onClick={fetchCredentials} className="btn-secondary flex items-center gap-2 min-h-[44px]">
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="card py-3">
          <p className="text-2xl font-bold">{totalUsers}</p>
          <p className="text-xs text-gray-500">Total accounts</p>
        </div>
        <div className="card py-3">
          <p className="text-2xl font-bold">{staffCount}</p>
          <p className="text-xs text-gray-500">Staff</p>
        </div>
        <div className="card py-3 col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold">{parentCount}</p>
          <p className="text-xs text-gray-500">Parents</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search names, usernames, roles, staff IDs…"
          className="input pl-9 min-h-[44px] w-full"
        />
      </div>

      {loading ? (
        <div className="card text-center py-10 text-gray-500">Loading passwords…</div>
      ) : filteredSchools.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">No users match your search</div>
      ) : singleSchool ? (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b bg-primary-50/50">
            <p className="font-semibold text-gray-900">{singleSchool.name}</p>
            {singleSchool.address && (
              <p className="text-xs text-gray-500">{singleSchool.address}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {singleSchool.staff.length} staff · {singleSchool.parents.length} parents ·{' '}
              {singleSchool.total_users} total
            </p>
          </div>
          {singleSchool.total_users === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No users at this school yet</div>
          ) : (
            <>
              <UserSection
                title="Staff (admin, teachers, gate, general)"
                icon={<GraduationCap size={14} className="text-blue-600" />}
                users={singleSchool.staff}
                draftPasswords={draftPasswords}
                setDraftPasswords={setDraftPasswords}
                onSave={savePassword}
                savingId={savingId}
                showPasswords={showPasswords}
              />
              <UserSection
                title="Parents"
                icon={<User size={14} className="text-orange-600" />}
                users={singleSchool.parents}
                draftPasswords={draftPasswords}
                setDraftPasswords={setDraftPasswords}
                onSave={savePassword}
                savingId={savingId}
                showPasswords={showPasswords}
              />
              <UserSection
                title="Other"
                icon={<Users size={14} className="text-gray-600" />}
                users={singleSchool.other}
                draftPasswords={draftPasswords}
                setDraftPasswords={setDraftPasswords}
                onSave={savePassword}
                savingId={savingId}
                showPasswords={showPasswords}
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSchools.map((school) => (
            <SchoolPasswordBlock
              key={school.id}
              school={school}
              draftPasswords={draftPasswords}
              setDraftPasswords={setDraftPasswords}
              onSave={savePassword}
              savingId={savingId}
              showPasswords={showPasswords}
              defaultExpanded
            />
          ))}
        </div>
      )}
    </div>
  );
}
