import React, { useEffect, useState } from 'react';
import CommentInput from './CommentInput';
import CommentItem from './CommentItem';
import ZineFrame from '@/components/common/ZineFrame';
import { fetchComments, postComment, deleteComment } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useSessionStore } from '@/store/sessionStore';
import type { CommentWithUser } from '@/types';

interface CommentsSectionProps {
  eventId: string;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ eventId }) => {
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  const { user } = useAuth();
  const { role } = useSessionStore();

  const isModerator = role === 'moderator' || role === 'admin';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchComments(eventId);
        if (!cancelled) {
          setComments(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar comentários');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const handleSubmit = async (content: string) => {
    if (!user) throw new Error('Não autenticado');
    const idToken = await user.getIdToken();

    const comment = await postComment(eventId, content, idToken);

    const newCommentWithUser: CommentWithUser = {
      ...comment,
      user: {
        id: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'Você',
        avatarUrl: user.photoURL,
      },
    };

    setComments((prev) => [newCommentWithUser, ...prev]);
  };

  const handleDelete = async (commentId: string) => {
    if (!user) return;
    const idToken = await user.getIdToken();

    setDeleting((prev) => new Set(prev).add(commentId));

    try {
      await deleteComment(commentId, idToken);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir comentário');
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <ZineFrame bg="cream" borderColor="burntYellow">
        <p className="font-body text-zine-burntOrange text-center py-4">
          Carregando comentários...
        </p>
      </ZineFrame>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CommentInput onSubmit={handleSubmit} disabled={deleting.size > 0} />

      {error && (
        <ZineFrame bg="cream" borderColor="burntYellow">
          <p className="font-body text-red-500 text-center py-2">{error}</p>
        </ZineFrame>
      )}

      {comments.length === 0 ? (
        <ZineFrame bg="cream" borderColor="burntYellow">
          <p className="font-body text-zine-burntOrange/60 text-center py-4">
            Nenhum comentário ainda. Seja o primeiro!
          </p>
        </ZineFrame>
      ) : (
        <ZineFrame bg="cream" borderColor="burntYellow">
          <div className="divide-y divide-zine-burntYellow/20 dark:divide-zine-cream/20">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={user?.uid}
                onDelete={handleDelete}
                canDelete={isModerator}
              />
            ))}
          </div>
        </ZineFrame>
      )}
    </div>
  );
};

export default CommentsSection;