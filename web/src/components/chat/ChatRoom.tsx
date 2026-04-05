import React, { useEffect, useRef } from 'react';
import { ZineFrame } from '@/components/common/ZineFrame';
import { ChatMessage } from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '@/types';

export interface ChatRoomProps {
  messages: Array<ChatMessageType & { id: string }>;
}

/**
 * ChatRoom — scrollable message list wrapped in a cream ZineFrame.
 * Auto-scrolls to bottom when a new message arrives.
 */
export const ChatRoom: React.FC<ChatRoomProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  return (
    <ZineFrame bg="cream">
      <div className="flex flex-col max-h-[60vh] overflow-y-auto">
        {messages.length === 0 ? (
          <p className="font-body text-zine-burntOrange/60 italic py-4">
            Sem mensagens ainda.
          </p>
        ) : (
          messages.map((m) => <ChatMessage key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>
    </ZineFrame>
  );
};

export default ChatRoom;
