import React, { useState } from 'react';
import Button from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import ZineFrame from '@/components/common/ZineFrame';

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  disabled?: boolean;
}

const MAX_LENGTH = 2000;

export const CommentInput: React.FC<CommentInputProps> = ({
  onSubmit,
  disabled,
}) => {
  const { isAuthenticated } = useAuth();
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = value.trim().length > 0 && value.trim().length <= MAX_LENGTH && !disabled && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(value.trim());
      setValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao postar comentário');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <ZineFrame bg="cream" borderColor="burntYellow" className="p-4">
        <p className="font-body text-zine-burntOrange text-center">
          Faz login para comentar
        </p>
      </ZineFrame>
    );
  }

  return (
    <ZineFrame bg="cream" borderColor="burntYellow" className="p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Escreva um comentário…"
          maxLength={MAX_LENGTH}
          rows={3}
          className="w-full font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 dark:placeholder:text-zine-cream/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow resize-none"
        />
        <div className="flex justify-between items-center mt-2">
          <span className={`font-body text-xs ${value.length > MAX_LENGTH ? 'text-zine-burntOrange font-bold' : 'text-zine-burntOrange/60'}`}>
            {value.length}/{MAX_LENGTH}
          </span>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="text-sm"
          >
            {submitting ? 'Postando...' : 'Postar'}
          </Button>
        </div>
        {error && (
          <p
            role="alert"
            aria-live="assertive"
            className="font-body text-xs text-zine-burntOrange font-bold mt-2"
          >
            {error}
          </p>
        )}
      </form>
    </ZineFrame>
  );
};

export default CommentInput;
