import React from 'react';
import type { ChatMessage as ChatMessageType } from '@/types';

export interface ChatMessageProps {
  message: ChatMessageType;
}

function formatRelative(ts: number): string {
  if (!ts || Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 0) return 'agora';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

/**
 * ChatMessage — single row. Per P3-E spec: no per-message ZineFrame
 * (too heavy); a simple cream divider line instead.
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  return (
    <div className="border-b border-zine-cream/40 py-2 px-1 flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-zine-burntYellow text-sm">
          {message.displayName}
        </span>
        <span
          data-testid="chat-message-time"
          className="font-body text-xs text-zine-burntOrange/70"
        >
          {formatRelative(message.timestamp)}
        </span>
      </div>
      <p className="font-body text-zine-burntOrange break-words">
        {message.text}
      </p>
    </div>
  );
};

export default ChatMessage;
