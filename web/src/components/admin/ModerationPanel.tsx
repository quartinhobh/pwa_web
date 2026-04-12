import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import { LoadingState } from '@/components/common/LoadingState';
import Button from '@/components/common/Button';
import HelperBox from '@/components/admin/HelperBox';
import { useModeration } from '@/hooks/useModeration';
import { useIdToken } from '@/hooks/useIdToken';
import { fetchModerationUserProfile, fetchEvents, updateEvent, clearChat } from '@/services/api';
import type { Event } from '@/types';

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
            const profile = await fetchModerationUserProfile(id, idToken);
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

  // ── Chat config ──────────────────────────────────────────────────
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatClosesAt, setChatClosesAt] = useState<string>('');
  const [chatSaving, setChatSaving] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [clearingChat, setClearingChat] = useState(false);

  useEffect(() => {
    void fetchEvents().then((list) => {
      const arr = list ?? [];
      setEvents(arr);
      if (arr.length > 0 && !selectedEventId) {
        setSelectedEventId(arr[0]!.id);
        setChatEnabled(arr[0]!.chatEnabled ?? true);
        setChatClosesAt(arr[0]!.chatClosesAt ? new Date(arr[0]!.chatClosesAt).toISOString().slice(0, 16) : '');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectEvent(eventId: string) {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    setSelectedEventId(eventId);
    setChatEnabled(event.chatEnabled ?? true);
    setChatClosesAt(event.chatClosesAt ? new Date(event.chatClosesAt).toISOString().slice(0, 16) : '');
    setChatError(null);
  }

  async function handleSaveChat() {
    if (!idToken || !selectedEventId) return;
    setChatSaving(true);
    setChatError(null);
    try {
      await updateEvent(selectedEventId, {
        chatEnabled,
        chatClosesAt: chatClosesAt ? new Date(chatClosesAt).getTime() : null,
      }, idToken);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setChatSaving(false);
    }
  }

  async function handleClearChat() {
    if (!idToken || !selectedEventId) return;
    if (!confirm('Tem certeza que quer apagar TODAS as mensagens do chat? Isso não pode ser desfeito.')) return;
    setClearingChat(true);
    setChatError(null);
    try {
      await clearChat(selectedEventId, idToken);
      alert('Chat apagado com sucesso.');
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Erro ao apagar chat');
    } finally {
      setClearingChat(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <HelperBox>Veja banimentos ativos e o histórico de moderação. Usuários banidos não conseguem usar o chat nem confirmar presença. Clique em 'desbanir' pra liberar o acesso novamente.</HelperBox>

      {/* Chat config */}
      <ZineFrame bg="cream">
        <h2 className="font-display text-2xl text-zine-burntOrange mb-3">
          Configuração do chat
        </h2>
        <div className="flex flex-col gap-3">
          <label className="font-body text-zine-burntOrange flex flex-col gap-1">
            <span>Evento</span>
            <select
              aria-label="chat-event-select"
              value={selectedEventId}
              onChange={(e) => handleSelectEvent(e.target.value)}
              className="border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>

          <label className="font-body text-zine-burntOrange flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="chat-enabled-moderation"
              checked={chatEnabled}
              onChange={(e) => setChatEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Ativar chat</span>
          </label>

          {chatEnabled && (
            <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
              <span>Fecha em (opcional)</span>
              <input
                type="datetime-local"
                aria-label="chat-closes-at-moderation"
                value={chatClosesAt}
                onChange={(e) => setChatClosesAt(e.target.value)}
                className="border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange"
              />
            </label>
          )}

          {chatError && (
            <p role="alert" className="font-body text-sm text-zine-burntOrange">
              erro: {chatError}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => void handleSaveChat()} disabled={chatSaving || clearingChat}>
              {chatSaving ? 'a guardar…' : 'guardar config'}
            </Button>
            <Button onClick={() => void handleClearChat()} disabled={clearingChat || chatSaving} className="bg-zine-burntOrange/20 border-zine-burntOrange">
              {clearingChat ? 'a apagar…' : 'apagar chat'}
            </Button>
          </div>
        </div>
      </ZineFrame>

      <ZineFrame bg="cream">
        <h2 className="font-display text-2xl text-zine-burntOrange mb-3">
          Banimentos ativos
        </h2>
        {loading && <LoadingState />}
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
