import React, { useEffect, useMemo, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { LoadingState } from '@/components/common/LoadingState';
import HelperBox from '@/components/admin/HelperBox';
import { useIdToken } from '@/hooks/useIdToken';
import { useModeration } from '@/hooks/useModeration';
import {
  getChatConfig,
  updateChatConfig,
  fetchEvents,
  fetchModerationUserProfile,
} from '@/services/api';
import { isChatAvailable } from '@/utils/chatAvailability';
import type { Event } from '@/types';

interface InitialData {
  config: { pauseAll: boolean };
  events: Event[];
}

type EventChatStatus = 'open' | 'paused' | 'scheduled' | 'disabled';

function computeEventChatStatus(event: Event, now: number = Date.now()): EventChatStatus {
  if (event.chatEnabled === false) return 'disabled';
  if (isChatAvailable(event, now)) return 'open';
  if (event.chatOpensAt != null && now < event.chatOpensAt) return 'scheduled';
  return 'paused';
}

const STATUS_STYLES: Record<EventChatStatus, { label: string; className: string }> = {
  open: {
    label: 'aberto agora',
    className: 'border-zine-mint bg-zine-mint/30 text-zine-burntOrange',
  },
  paused: {
    label: 'pausado',
    className: 'border-zine-burntYellow bg-zine-burntYellow/30 text-zine-burntOrange',
  },
  scheduled: {
    label: 'programado',
    className: 'border-zine-burntOrange/40 bg-zine-burntOrange/10 text-zine-burntOrange/80',
  },
  disabled: {
    label: 'desativado',
    className: 'border-zine-burntOrange/40 bg-zine-burntOrange/5 text-zine-burntOrange/50 line-through',
  },
};

export const ChatPanel: React.FC = () => {
  const idToken = useIdToken();
  const [data, setData] = useState<InitialData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moderation = useModeration(idToken);

  useEffect(() => {
    if (!idToken) return;
    setData(null);
    setError(null);
    Promise.all([getChatConfig(idToken), fetchEvents()])
      .then(([config, events]) => {
        const active = (events ?? []).filter(
          (e) => e.status === 'upcoming' || e.status === 'live',
        );
        setData({ config, events: active });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar painel de chat');
      });
  }, [idToken]);

  if (error) return <p className="font-body text-zine-burntOrange p-4">{error}</p>;
  if (!idToken || !data) return <LoadingState />;

  return (
    <div className="flex flex-col gap-4">
      <HelperBox>
        Controle global do chat: pause todos de uma vez, confira a janela de cada evento e
        gerencie banimentos ativos.
      </HelperBox>
      <GlobalChatConfig
        idToken={idToken}
        initial={data.config}
        onChange={(next) => setData((d) => (d ? { ...d, config: next } : d))}
      />
      <EventsChatList events={data.events} />
      <BansList
        idToken={idToken}
        bans={moderation.bans}
        loading={moderation.loading}
        error={moderation.error}
        onUnban={(uid) => void moderation.unbanUser(uid)}
      />
    </div>
  );
};

interface GlobalChatConfigProps {
  idToken: string;
  initial: { pauseAll: boolean };
  onChange: (next: { pauseAll: boolean }) => void;
}

const GlobalChatConfig: React.FC<GlobalChatConfigProps> = ({ idToken, initial, onChange }) => {
  const [pauseAll, setPauseAll] = useState(initial.pauseAll);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleToggle(next: boolean): Promise<void> {
    setSaving(true);
    setErr(null);
    const prev = pauseAll;
    setPauseAll(next);
    try {
      const result = await updateChatConfig(idToken, { pauseAll: next });
      setPauseAll(result.pauseAll);
      onChange(result);
    } catch (e) {
      setPauseAll(prev);
      setErr(e instanceof Error ? e.message : 'erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ZineFrame bg="cream">
      <h2 className="font-display text-2xl text-zine-burntOrange mb-3">Config global</h2>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={pauseAll}
          disabled={saving}
          onChange={(e) => void handleToggle(e.target.checked)}
          aria-label="pausar todos os chats"
          className="mt-1 w-5 h-5 accent-zine-burntOrange"
        />
        <span className="flex flex-col">
          <span className="font-display text-xl text-zine-burntOrange">
            Pausar todos os chats
          </span>
          <span className="font-body text-sm text-zine-burntOrange/70">
            quando ligado, todos os chats ficam read-only. usuários veem aviso "chat pausado pelo admin — volta logo".
          </span>
        </span>
      </label>
      {err && <p role="alert" className="font-body text-zine-burntOrange mt-2">{err}</p>}
      {pauseAll && (
        <div className="mt-3 border-2 border-dashed border-zine-burntYellow bg-zine-burntYellow/20 p-3 font-body text-sm text-zine-burntOrange">
          chat globalmente pausado. ninguém consegue enviar mensagem agora.
        </div>
      )}
    </ZineFrame>
  );
};

const EventsChatList: React.FC<{ events: Event[] }> = ({ events }) => {
  return (
    <ZineFrame bg="cream">
      <h2 className="font-display text-2xl text-zine-burntOrange mb-3">Eventos com chat</h2>
      {events.length === 0 ? (
        <p className="font-body italic text-zine-burntOrange/70">
          Nenhum evento ativo no momento.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => {
            const status = computeEventChatStatus(e);
            const styles = STATUS_STYLES[status];
            return (
              <li
                key={e.id}
                data-testid={`chat-event-row-${e.id}`}
                className="flex items-center justify-between gap-3 border-b border-zine-burntOrange/30 pb-2"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-display text-zine-burntOrange truncate">
                    {e.title}
                  </span>
                  <span className="font-body text-xs text-zine-burntOrange/70">
                    {e.date}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-body border-2 ${styles.className}`}
                  >
                    {styles.label}
                  </span>
                  <a
                    href={`#events`}
                    className="font-body text-xs underline text-zine-burntOrange"
                    onClick={(ev) => {
                      ev.preventDefault();
                      window.location.hash = 'events';
                    }}
                  >
                    editar →
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ZineFrame>
  );
};

interface BansListProps {
  idToken: string;
  bans: { userId: string; reason: string | null; createdAt: number }[];
  loading: boolean;
  error: string | null;
  onUnban: (userId: string) => void;
}

const BansList: React.FC<BansListProps> = ({ idToken, bans, loading, error, onUnban }) => {
  const [names, setNames] = useState<Record<string, string>>({});
  const userIds = useMemo(() => bans.map((b) => b.userId), [bans]);

  useEffect(() => {
    if (!idToken || userIds.length === 0) return;
    let cancelled = false;
    void Promise.all(
      userIds
        .filter((id) => !(id in names))
        .map(async (id) => {
          try {
            const profile = await fetchModerationUserProfile(id, idToken);
            return [id, profile.displayName ?? id] as const;
          } catch {
            return [id, id] as const;
          }
        }),
    ).then((entries) => {
      if (cancelled || entries.length === 0) return;
      setNames((prev) => {
        const next = { ...prev };
        for (const [k, v] of entries) next[k] = v;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken, userIds.join(',')]);

  return (
    <ZineFrame bg="cream">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-2xl text-zine-burntOrange">Moderação</h2>
        <span className="font-body text-sm text-zine-burntOrange/70">
          {bans.length} ban{bans.length !== 1 ? 's' : ''} ativo{bans.length !== 1 ? 's' : ''}
        </span>
      </div>
      {loading && <LoadingState />}
      {error && <p className="font-body text-zine-burntOrange">erro: {error}</p>}
      {!loading && !error && bans.length === 0 && (
        <p className="font-body italic text-zine-burntOrange/70">
          nenhum usuário banido no momento. ✌️
        </p>
      )}
      {!loading && bans.length > 0 && (
        <ul className="flex flex-col gap-2">
          {bans.map((b) => {
            const name = names[b.userId] ?? b.userId.slice(0, 8) + '…';
            return (
              <li
                key={b.userId}
                data-testid={`chat-ban-row-${b.userId}`}
                className="flex items-center justify-between gap-3 border-b border-zine-burntOrange/30 pb-2"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-display text-zine-burntOrange truncate">{name}</span>
                  <span className="font-body text-xs text-zine-burntOrange/70">
                    {b.reason ?? 'sem motivo'} ·{' '}
                    {new Date(b.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <Button onClick={() => onUnban(b.userId)}>remover ban</Button>
              </li>
            );
          })}
        </ul>
      )}
    </ZineFrame>
  );
};

export default ChatPanel;
