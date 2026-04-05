import React from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from '@/hooks/useChat';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { ChatInput } from '@/components/chat/ChatInput';

export interface LiveChatProps {
  /** Optional override — if not supplied, eventId is read from route params. */
  eventId?: string;
}

/**
 * LiveChat — composes ChatRoom + ChatInput for a given eventId.
 * Route: /chat/:eventId (eventId prop overrides route param).
 */
export const LiveChat: React.FC<LiveChatProps> = ({ eventId: eventIdProp }) => {
  const params = useParams<{ eventId?: string }>();
  const eventId = eventIdProp ?? params.eventId ?? '';
  const { messages, sendMessage } = useChat(eventId);

  if (!eventId) {
    return (
      <main className="font-body text-zine-burntOrange p-4">
        no event selected
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <ChatRoom messages={messages} />
      <ChatInput onSend={sendMessage} />
    </main>
  );
};

export default LiveChat;
