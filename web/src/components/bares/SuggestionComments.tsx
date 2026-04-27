import React, { useCallback, useEffect, useState } from 'react';
import Button from '@/components/common/Button';
import ZineFrame from '@/components/common/ZineFrame';
import {
  fetchSuggestionComments,
  postSuggestionComment,
  deleteSuggestionComment,
} from '@/services/api';
import type { SuggestionCommentWithUser } from '@/types';

export interface SuggestionCommentsProps {
  barId: string;
  idToken: string | null;
  firebaseUid: string | null;
  onRequestLogin?: () => void;
}

export const SuggestionComments: React.FC<SuggestionCommentsProps> = ({
  barId,
  idToken,
  firebaseUid,
  onRequestLogin,
}) => {
  const [comments, setComments] = useState<SuggestionCommentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSuggestionComments(barId);
      setComments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao carregar comentários');
    } finally {
      setLoading(false);
    }
  }, [barId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !inputValue.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await postSuggestionComment(barId, inputValue.trim(), idToken);
      setInputValue('');
      await loadComments();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'erro ao comentar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (!idToken) return;
      await deleteSuggestionComment(barId, commentId, idToken);
      await loadComments();
    },
    [barId, idToken, loadComments],
  );

  const handleInputClick = () => {
    if (!firebaseUid) {
      onRequestLogin?.();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {loading && (
        <p
          role="status"
          aria-live="polite"
          className="font-body text-sm text-zine-burntOrange/70"
        >
          carregando comentários...
        </p>
      )}

      {!loading && error && (
        <p
          role="alert"
          aria-live="assertive"
          className="font-body text-sm text-zine-burntOrange font-bold dark:text-zine-burntYellow"
        >
          {error}
        </p>
      )}

      {!loading && !error && comments.length === 0 && (
        <p className="font-body text-sm text-zine-burntOrange/70">nenhum comentário ainda</p>
      )}

      {!loading && !error && comments.length > 0 && (
        <div className="flex flex-col">
          {comments.map((c) => (
            <div
              key={c.id}
              className="flex gap-3 py-3 border-b border-zine-burntYellow/20 dark:border-zine-cream/20"
            >
              <div className="shrink-0">
                {c.user.avatarUrl ? (
                  <img
                    src={c.user.avatarUrl}
                    alt={c.user.displayName}
                    className="w-10 h-10 rounded-full border-2 border-zine-burntYellow object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full border-2 border-zine-burntYellow bg-zine-burntYellow flex items-center justify-center text-zine-cream font-display text-sm">
                    {c.user.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold font-body text-zine-burntOrange dark:text-zine-cream">
                    {c.user.displayName}
                  </span>
                  <span className="font-body text-xs text-zine-burntOrange/50 dark:text-zine-cream/50">
                    {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <p className="font-body text-sm mt-1 text-zine-burntOrange dark:text-zine-cream whitespace-pre-wrap break-words">
                  {c.content}
                </p>
                {firebaseUid === c.userId && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(c.id)}
                    className="font-body text-xs text-zine-burntOrange/60 hover:text-zine-burntOrange mt-2 min-h-[44px] px-3 py-2"
                  >
                    excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!firebaseUid ? (
        <ZineFrame bg="cream" borderColor="burntYellow" className="p-4">
          {onRequestLogin ? (
            <button
              type="button"
              onClick={onRequestLogin}
              className="font-body text-zine-burntOrange text-center w-full underline"
            >
              entrar pra comentar →
            </button>
          ) : (
            <p className="font-body text-zine-burntOrange text-center">
              faca login pra comentar
            </p>
          )}
        </ZineFrame>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onClick={handleInputClick}
            placeholder="escreva um comentário..."
            rows={3}
            className="w-full font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow resize-none"
          />
          {submitError && (
            <p
              role="alert"
              aria-live="assertive"
              className="font-body text-xs text-zine-burntOrange font-bold dark:text-zine-burntYellow"
            >
              {submitError}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !inputValue.trim()} className="text-sm">
              {submitting ? 'enviando...' : 'comentar'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default SuggestionComments;
