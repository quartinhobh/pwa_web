import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { useModeration } from '@/hooks/useModeration';
import { useIdToken } from '@/hooks/useIdToken';
import { fetchUserProfile } from '@/services/api';

export interface ModerationPanelProps {
  idToken?: string | null;
}

/** Lightweight in-memory cache: userId → displayName. */
function useUserNames(idToken: string | null, userIds: string[]) {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!idToken || userIds.length === 0) return;
    let cancelled = false;
    void Promise.all(
      userIds
        .filter((id) => !(id in names))
        .map(async (id) => {
          try {
            const profile = await fetchUserProfile(id, idToken);
            return [id, profile.displayName ?? id] as const;
          } catch {
            return [id, id] as const;
          }
        }),
    ).then((entries) => {
      if (cancelled) return;
      if (entries.length > 0) {
        setNames((prev) => {
          const next = { ...prev };
          for (const [k, v] of entries) next[k] = v;
          return next;
        });
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken, userIds.join(',')]);
  return (id: string) => names[id] ?? id.slice(0, 8) + '…';
}

export const ModerationPanel: React.FC<ModerationPanelProps> = () => {
  const idToken = useIdToken();
  const { bans, logs, loading, error, unbanUser } = useModeration(idToken);
  const allUserIds = [
    ...bans.map((b) => b.userId),
    ...logs.map((l) => l.targetUserId),
  ];
  const getName = useUserNames(idToken, allUserIds);

  return (
    <div className="flex flex-col gap-4">
      <ZineFrame bg="cream">
        <h2 className="font-display text-2xl text-zine-burntOrange mb-3">
          Banimentos ativos
        </h2>
        {loading && (
          <p className="font-body text-zine-burntOrange/70">carregando…</p>
        )}
        {error && (
          <p className="font-body text-zine-burntOrange">erro: {error}</p>
        )}
        {!loading && bans.length === 0 && (
          <p className="font-body text-zine-burntOrange/70 italic">
            Nenhum banimento ativo.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {bans.map((b) => (
            <li
              key={b.userId}
              data-testid={`ban-row-${b.userId}`}
              className="flex items-center justify-between gap-3 border-b border-zine-burntOrange/30 pb-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zine-burntYellow flex items-center justify-center font-display text-zine-cream text-sm">
                  {getName(b.userId).charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-zine-burntOrange">
                    {getName(b.userId)}
                  </span>
                  <span className="font-body text-xs text-zine-burntOrange/70">
                    {b.reason ?? 'sem motivo'} · {new Date(b.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
              <Button onClick={() => void unbanUser(b.userId)}>desbanir</Button>
            </li>
          ))}
        </ul>
      </ZineFrame>

      <ZineFrame bg="cream">
        <h2 className="font-display text-2xl text-zine-burntOrange mb-3">
          Registo de moderação
        </h2>
        {logs.length === 0 ? (
          <p className="font-body text-zine-burntOrange/70 italic">
            Sem entradas.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {logs.map((l) => (
              <li
                key={l.id}
                data-testid={`log-row-${l.id}`}
                className="font-body text-sm text-zine-burntOrange"
              >
                <span className="font-display text-zine-burntYellow mr-2">
                  {l.action}
                </span>
                {getName(l.targetUserId)}
                {l.reason ? ` — ${l.reason}` : ''}
              </li>
            ))}
          </ul>
        )}
      </ZineFrame>
    </div>
  );
};

export default ModerationPanel;
