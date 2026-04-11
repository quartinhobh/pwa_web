import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from '@/hooks/useChat';
import { useEvent } from '@/hooks/useEvent';
import { useModeration } from '@/hooks/useModeration';
import { useSessionStore } from '@/store/sessionStore';
import { auth } from '@/services/firebase';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { ChatInput } from '@/components/chat/ChatInput';
import { LoadingState } from '@/components/common/LoadingState';
import LoginModal from '@/components/auth/LoginModal';
import ZineFrame from '@/components/common/ZineFrame';
import { getChatConfig } from '@/services/api';
import {
  isChatAvailable,
  chatStatusText,
  formatChatWindow,
} from '@/utils/chatAvailability';

export interface LiveChatProps {
  eventId?: string;
}

export const LiveChat: React.FC<LiveChatProps> = ({ eventId: eventIdProp }) => {
  const params = useParams<{ eventId?: string }>();
  const eventId = eventIdProp ?? params.eventId ?? 'debug-chat';
  const { event, loading: eventLoading } = useEvent(eventId);
  const { messages, sendMessage, removeMessage, loading } = useChat(eventId);
  const role = useSessionStore((s) => s.role);
  const canModerate = role === 'admin' || role === 'moderator';
  const [loginOpen, setLoginOpen] = useState(false);

  // Re-render every 60s so countdown text updates smoothly while waiting.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const [globalPaused, setGlobalPaused] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void getChatConfig()
        .then((cfg) => {
          if (!cancelled) setGlobalPaused(cfg.pauseAll);
        })
        .catch(() => { /* keep last value */ });
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const [idToken, setIdToken] = useState<string | null>(null);
  useEffect(() => {
    const unsub = auth.onIdTokenChanged(async (user) => {
      if (user) {
        setIdToken(await user.getIdToken());
      } else {
        setIdToken(null);
      }
    });
    return unsub;
  }, []);

  const { deleteMessage, banUser } = useModeration(idToken);

  if (!eventId) {
    return (
      <main className="font-body text-zine-burntOrange p-4">
        no event selected
      </main>
    );
  }

  if (eventLoading || loading) {
    return (
      <main className="p-4">
        <LoadingState />
      </main>
    );
  }

  const eventAvailable = event ? isChatAvailable(event) : true;
  const available = eventAvailable && !globalPaused;
  const statusText = globalPaused
    ? 'chat pausado pelo admin — volta logo'
    : (event ? chatStatusText(event) : null);
  const windowText = event ? formatChatWindow(event) : null;

  if (event && !available) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <ZineFrame bg="cream" borderColor="burntYellow">
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <h2 className="font-display text-2xl text-zine-burntOrange">
              {statusText ?? 'chat indisponível'}
            </h2>
            {windowText && (
              <p className="font-body text-sm text-zine-burntOrange/70 italic">
                {windowText}
              </p>
            )}
            <p className="font-body text-sm text-zine-burntOrange/80">
              volta mais tarde pra conversar com a galera.
            </p>
          </div>
        </ZineFrame>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      {windowText && (
        <p className="font-body text-xs text-zine-burntOrange/60 italic text-center">
          {windowText}
        </p>
      )}
      <ChatRoom
        messages={messages}
        canModerate={canModerate}
        onDeleteMessage={
          canModerate
            ? (messageId, reason, targetUserId) => {
                removeMessage(messageId);
                void deleteMessage(eventId, messageId, reason, targetUserId);
              }
            : undefined
        }
        onBanUser={
          canModerate
            ? (userId, reason) => banUser(userId, eventId, reason)
            : undefined
        }
      />
      {role === 'guest' ? (
        <div className="flex flex-col items-center gap-2 py-3">
          <p className="font-body text-sm text-zine-burntOrange/80 text-center">
            Entre pra participar da conversa.
          </p>
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="font-body font-bold text-sm text-zine-cream bg-zine-burntOrange border-2 border-zine-burntOrange px-4 py-1 hover:bg-zine-burntYellow hover:border-zine-burntYellow hover:text-zine-burntOrange transition-colors"
          >
            entrar
          </button>
          <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
        </div>
      ) : (
        <ChatInput onSend={sendMessage} />
      )}
    </main>
  );
};

export default LiveChat;
