import { useCallback, useEffect, useState } from 'react';
import {
  ref,
  onChildAdded,
  off,
  push,
  serverTimestamp,
} from 'firebase/database';
import { realtimeDb } from '@/services/firebase';
import { useSessionStore } from '@/store/sessionStore';
import type { ChatMessage } from '@/types';

export interface ChatMessageWithId extends ChatMessage {
  id: string;
}

export interface UseChatResult {
  messages: ChatMessageWithId[];
  sendMessage: (text: string) => Promise<void>;
  loading: boolean;
}

/**
 * useChat — client-side RTDB subscription for `/chats/{eventId}/messages`.
 * Writes go directly from the client under Firebase security rules
 * (see firebase/database.rules.json). No api backend in the hot path.
 */
export function useChat(eventId: string): UseChatResult {
  const [messages, setMessages] = useState<ChatMessageWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const firebaseUid = useSessionStore((s) => s.firebaseUid);
  const sessionId = useSessionStore((s) => s.sessionId);
  const guestName = useSessionStore((s) => s.guestName);

  useEffect(() => {
    if (!eventId) return;
    setMessages([]);
    setLoading(true);

    const messagesRef = ref(realtimeDb, `chats/${eventId}/messages`);
    const handler = (snap: { key: string | null; val: () => unknown }) => {
      const raw = snap.val() as ChatMessage | null;
      if (!raw) return;
      if (raw.isDeleted === true) return;
      const id = snap.key ?? `${raw.timestamp}-${Math.random()}`;
      setMessages((prev) => [...prev, { ...raw, id }]);
      setLoading(false);
    };

    onChildAdded(messagesRef, handler);
    // First snapshot may never fire if empty — flip loading on next tick.
    const t = setTimeout(() => setLoading(false), 0);

    return () => {
      clearTimeout(t);
      off(messagesRef);
    };
  }, [eventId]);

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const uid = firebaseUid ?? sessionId ?? 'anonymous';
      const displayName = guestName ?? 'Convidado';
      const messagesRef = ref(realtimeDb, `chats/${eventId}/messages`);
      await push(messagesRef, {
        uid,
        displayName,
        text: trimmed,
        timestamp: serverTimestamp(),
        isDeleted: false,
      });
    },
    [eventId, firebaseUid, sessionId, guestName]
  );

  return { messages, sendMessage, loading };
}
