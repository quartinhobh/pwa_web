import React from 'react';
import type { CommentWithUser } from '@/types';

interface CommentItemProps {
  comment: CommentWithUser;
  currentUserId?: string | null;
  onDelete?: (commentId: string) => Promise<void>;
  canDelete?: boolean;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  onDelete,
  canDelete,
}) => {
  const isOwnComment = currentUserId === comment.userId;
  const canDeleteComment = canDelete || isOwnComment;

  return (
    <div className="flex gap-3 py-3 border-b border-zine-burntYellow/20 dark:border-zine-cream/20">
      <div className="shrink-0">
        {comment.user.avatarUrl ? (
          <img
            src={comment.user.avatarUrl}
            alt={comment.user.displayName}
            className="w-10 h-10 rounded-full border-2 border-zine-burntYellow object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full border-2 border-zine-burntYellow bg-zine-burntYellow flex items-center justify-center text-zine-cream font-display text-sm">
            {getInitials(comment.user.displayName)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold font-body text-zine-burntOrange dark:text-zine-cream">
            {comment.user.displayName}
          </span>
          <span className="font-body text-xs text-zine-burntOrange/60 dark:text-zine-cream/60">
            {formatDate(comment.createdAt)}
          </span>
        </div>

        <p className="font-body text-sm mt-1 text-zine-burntOrange dark:text-zine-cream whitespace-pre-wrap break-words">
          {comment.content}
        </p>

        {canDeleteComment && onDelete && (
          <button
            type="button"
            onClick={() => void onDelete(comment.id)}
            className="font-body text-xs text-zine-burntOrange/60 hover:text-zine-burntOrange mt-2 min-h-[44px] px-3 py-2"
          >
            excluir
          </button>
        )}
      </div>
    </div>
  );
};

export default CommentItem;
