import React, { useState } from 'react';
import Button from '@/components/common/Button';
import { createAlbumSuggestion } from '@/services/api';

export interface AlbumSuggestionFormProps {
  idToken?: string | null;
  onSuccess?: () => void;
}

export const AlbumSuggestionForm: React.FC<AlbumSuggestionFormProps> = ({ idToken, onSuccess }) => {
  const [albumTitle, setAlbumTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(null);

    if (!albumTitle.trim()) {
      setValidationError('preencha o nome do disco');
      return;
    }

    setBusy(true);
    try {
      await createAlbumSuggestion(
        {
          albumTitle: albumTitle.trim(),
          notes: notes.trim() || null,
        },
        idToken,
      );

      setAlbumTitle('');
      setNotes('');
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao indicar disco');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label
            className="font-body text-sm text-zine-burntOrange"
            htmlFor="album-title"
          >
            nome do album
          </label>
          <input
            id="album-title"
            type="text"
            value={albumTitle}
            onChange={(e) => setAlbumTitle(e.target.value)}
            aria-invalid={validationError ? 'true' : 'false'}
            aria-describedby={validationError ? 'album-validation-error' : undefined}
            placeholder="digita aqui"
            style={{ filter: 'url(#zine-wobble)' }}
            className="w-full font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="font-body text-sm text-zine-burntOrange"
            htmlFor="album-notes"
          >
            obs:
          </label>
          <textarea
            id="album-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={3}
            style={{ filter: 'url(#zine-wobble)' }}
            className="w-full font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow resize-none"
          />
        </div>

        {validationError && (
          <span
            id="album-validation-error"
            role="alert"
            aria-live="assertive"
            className="font-body text-xs text-zine-burntOrange font-bold dark:text-zine-burntYellow"
          >
            {validationError}
          </span>
        )}
        {success && (
          <p
            role="status"
            aria-live="polite"
            className="font-body text-sm text-zine-burntOrange"
          >
            disco indicado com sucesso!
          </p>
        )}
        {error && (
          <p
            role="alert"
            aria-live="assertive"
            className="font-body text-xs text-zine-burntOrange font-bold dark:text-zine-burntYellow"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'enviando...' : 'indicar disco'}
        </Button>
    </form>
  );
};

export default AlbumSuggestionForm;
