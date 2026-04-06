import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { useIdToken } from '@/hooks/useIdToken';
import {
  fetchUsers,
  updateUserRole,
  fetchInvites,
  createInvite,
  deleteInvite,
} from '@/services/api';
import type { RoleInvite } from '@/services/api';
import type { User, UserRole } from '@/types';

const ROLE_LABELS: Record<UserRole, string> = {
  guest: 'Guest',
  user: 'Usuário',
  moderator: 'Moderador',
  admin: 'Admin',
};

const ASSIGNABLE_ROLES: UserRole[] = ['user', 'moderator', 'admin'];

export const UsersPanel: React.FC = () => {
  const idToken = useIdToken();
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<RoleInvite[]>([]);
  const [filter, setFilter] = useState<'all' | 'admin' | 'moderator'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  // invite form
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState<UserRole>('admin');

  async function refresh(): Promise<void> {
    if (!idToken) return;
    const [list, inv] = await Promise.all([fetchUsers(idToken), fetchInvites(idToken)]);
    setUsers(list);
    setInvites(inv);
  }

  useEffect(() => {
    void refresh();
  }, [idToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRoleChange(userId: string, role: UserRole): Promise<void> {
    if (!idToken) return;
    setBusy(userId);
    try {
      await updateUserRole(userId, role, idToken);
      await refresh();
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleInvite(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!idToken || !invEmail) return;
    try {
      await createInvite(invEmail, invRole, idToken);
      setInvEmail('');
      await refresh();
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDeleteInvite(email: string): Promise<void> {
    if (!idToken) return;
    try {
      await deleteInvite(email, idToken);
      await refresh();
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter);

  const inputClass =
    'font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream text-zine-burntOrange focus:outline-none focus:border-zine-burntOrange w-full';

  return (
    <>
      {/* Invite by email */}
      <ZineFrame bg="cream" borderColor="burntYellow">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">
          Adicionar admin/moderador por email
        </h3>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
          <input
            type="email"
            placeholder="email@exemplo.com"
            value={invEmail}
            onChange={(e) => setInvEmail(e.target.value)}
            required
            className={inputClass}
          />
          <select
            value={invRole}
            onChange={(e) => setInvRole(e.target.value as UserRole)}
            className={inputClass}
          >
            <option value="admin">Admin</option>
            <option value="moderator">Moderador</option>
          </select>
          <Button type="submit">adicionar</Button>
        </form>

        {invites.length > 0 && (
          <div className="mt-4">
            <h4 className="font-display text-sm text-zine-burntOrange mb-2">Convites pendentes</h4>
            <ul className="flex flex-col gap-1">
              {invites.map((inv) => (
                <li key={inv.email} className="flex items-center justify-between gap-3 font-body text-sm text-zine-burntOrange">
                  <span>{inv.email} — {ROLE_LABELS[inv.role]}</span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteInvite(inv.email)}
                    className="text-zine-burntOrange/60 underline text-xs"
                  >
                    remover
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ZineFrame>

      {/* Existing users */}
      <ZineFrame bg="cream">
        <h2 className="font-display text-2xl text-zine-burntOrange mb-3">Usuários</h2>

        <div className="flex gap-2 mb-4">
          {(['all', 'admin', 'moderator'] as const).map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? 'ring-4 ring-zine-burntOrange' : ''}
            >
              {f === 'all' ? 'Todos' : f === 'admin' ? 'Admins' : 'Moderadores'}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="font-body italic text-zine-burntOrange/70">Nenhum usuário encontrado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 border-b border-zine-burntOrange/30 pb-2"
              >
                <div className="flex flex-col">
                  <span className="font-display text-zine-burntOrange">{u.displayName}</span>
                  <span className="font-body text-xs text-zine-burntOrange/70">
                    {u.email ?? 'sem email'} · {ROLE_LABELS[u.role]}
                  </span>
                </div>
                <select
                  value={u.role}
                  disabled={busy === u.id}
                  onChange={(e) => void handleRoleChange(u.id, e.target.value as UserRole)}
                  className="border-4 border-zine-burntYellow bg-zine-cream text-zine-burntOrange font-body p-1 text-sm"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </ZineFrame>
    </>
  );
};

export default UsersPanel;
