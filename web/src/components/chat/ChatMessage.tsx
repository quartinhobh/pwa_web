import React, { useCallback, useState } from 'react';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import UserAvatar from '@/components/common/UserAvatar';
import ProfilePopover from '@/components/chat/ProfilePopover';
import type { ChatMessage as ChatMessageType } from '@/types';

export interface ChatMessageProps {
  message: ChatMessageType & { id?: string };
  canModerate?: boolean;
  onDelete?: (messageId: string, reason?: string) => Promise<void> | void;
  onBan?: (userId: string, reason?: string) => Promise<void> | void;
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
 * (too heavy); a simple cream divider line instead. P3-F adds an
 * optional moderator-only delete affordance that opens a Modal prompt
 * for a reason before calling onDelete.
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  canModerate = false,
  onDelete,
  onBan,
}) => {
  const [confirming, setConfirming] = useState<'delete' | 'ban' | null>(null);
  const [reason, setReason] = useState('');
  const [popover, setPopover] = useState<DOMRect | null>(null);
  const showDelete = canModerate && !!onDelete && !!message.id && !message.isDeleted;
  const showBan = canModerate && !!onBan && !!message.uid && !message.isDeleted;

  const handleNameClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setPopover((prev) => (prev ? null : e.currentTarget.getBoundingClientRect()));
  }, []);

  const handleConfirm = async (): Promise<void> => {
    const trimmed = reason.trim() || undefined;
    if (confirming === 'delete' && onDelete && message.id) {
      await onDelete(message.id, trimmed);
    } else if (confirming === 'ban' && onBan && message.uid) {
      await onBan(message.uid, trimmed);
    }
    setConfirming(null);
    setReason('');
  };

  return (
    <div className="border-b border-zine-cream/40 py-2 px-1 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <UserAvatar src={null} name={message.displayName} size="sm" />
        <button
          type="button"
          onClick={handleNameClick}
          className="font-display text-zine-burntYellow text-sm hover:underline cursor-pointer bg-transparent border-none p-0"
        >
          {message.displayName}
        </button>
        <span
          data-testid="chat-message-time"
          className="font-body text-xs text-zine-burntOrange/70"
        >
          {formatRelative(message.timestamp)}
        </span>
        {(showDelete || showBan) && (
          <span className="ml-auto flex gap-2">
            {showDelete && (
              <button
                type="button"
                data-testid="chat-delete-btn"
                onClick={() => setConfirming('delete')}
                className="font-body text-xs text-zine-burntOrange/80 underline hover:text-zine-burntOrange"
              >
                apagar
              </button>
            )}
            {showBan && (
              <button
                type="button"
                data-testid="chat-ban-btn"
                onClick={() => setConfirming('ban')}
                className="font-body text-xs text-zine-burntOrange underline hover:text-zine-burntOrange font-bold"
              >
                banir
              </button>
            )}
          </span>
        )}
      </div>
      <p className="font-body text-zine-burntOrange break-words">
        {message.isDeleted ? (
          <em className="text-zine-burntOrange/50">[mensagem apagada]</em>
        ) : (
          message.text
        )}
      </p>
      {popover && (
        <ProfilePopover
          uid={message.uid}
          displayName={message.displayName}
          anchorRect={popover}
          onClose={() => setPopover(null)}
        />
      )}
      {confirming && (
        <Modal
          isOpen={!!confirming}
          onClose={() => setConfirming(null)}
          title={confirming === 'ban' ? `Banir ${message.displayName}` : 'Apagar mensagem'}
        >
          <div className="flex flex-col gap-3">
            <label className="font-body text-sm" style={{ color: '#1A1A1A' }}>
              Motivo (opcional)
            </label>
            <input
              data-testid="chat-mod-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border-2 border-zine-burntOrange bg-zine-cream font-body px-2 py-1"
            />
            <div className="flex gap-2 justify-end">
              <Button onClick={() => setConfirming(null)}>cancelar</Button>
              <Button
                data-testid="chat-mod-confirm"
                onClick={() => void handleConfirm()}
              >
                {confirming === 'ban' ? 'banir' : 'apagar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ChatMessage;
