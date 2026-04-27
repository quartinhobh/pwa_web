import React, { useState } from 'react';
import Button from '@/components/common/Button';
import AddressAutocomplete from '@/components/common/AddressAutocomplete';
import { createBarSuggestion } from '@/services/api';
import type { CreateBarSuggestionPayload } from '@/types';

export interface BarSuggestionFormProps {
  idToken?: string | null;
  onSuccess?: () => void;
}

export const BarSuggestionForm: React.FC<BarSuggestionFormProps> = ({ idToken, onSuccess }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [instagram, setInstagram] = useState('');
  const [isClosed, setIsClosed] = useState(false);
  const [hasSoundSystem, setHasSoundSystem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setError(null);

    if (!name.trim()) {
      setNameError('nome é obrigatório');
      return;
    }

    const payload: CreateBarSuggestionPayload = {
      name: name.trim(),
      address: address.trim() || null,
      instagram: instagram.trim() || null,
      isClosed,
      hasSoundSystem,
    };

    setBusy(true);
    try {
      await createBarSuggestion(payload, idToken);
      setName('');
      setAddress('');
      setInstagram('');
      setIsClosed(false);
      setHasSoundSystem(false);
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao indicar bar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">

        <div className="flex flex-col gap-1">
          <label className="font-body text-sm text-zine-burntOrange" htmlFor="bar-name">
            nome do bar *
          </label>
          <input
            id="bar-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameError ? 'true' : 'false'}
            aria-describedby={nameError ? 'bar-name-error' : undefined}
            className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow"
          />
          {nameError && (
            <span
              id="bar-name-error"
              role="alert"
              className="font-body text-xs text-zine-burntOrange font-bold dark:text-zine-burntYellow"
            >
              {nameError}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-body text-sm text-zine-burntOrange" htmlFor="bar-address">
            endereço
          </label>
          <AddressAutocomplete
            id="bar-address"
            value={address}
            onChange={setAddress}
            placeholder="comece a digitar o endereço…"
            className="w-full font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-body text-sm text-zine-burntOrange" htmlFor="bar-instagram">
            instagram
          </label>
          <input
            id="bar-instagram"
            type="text"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow"
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-body text-sm text-zine-burntOrange">marque se vc souber que:</p>
          <label className="flex items-center gap-2 font-body text-sm text-zine-burntOrange cursor-pointer">
            <input
              type="checkbox"
              checked={isClosed}
              onChange={(e) => setIsClosed(e.target.checked)}
              className="accent-zine-burntOrange"
            />
            bar com ambiente fechado
          </label>
          <label className="flex items-center gap-2 font-body text-sm text-zine-burntOrange cursor-pointer">
            <input
              type="checkbox"
              checked={hasSoundSystem}
              onChange={(e) => setHasSoundSystem(e.target.checked)}
              className="accent-zine-burntOrange"
            />
            tem sistema de som / boa música ao vivo
          </label>
        </div>

        {success && (
          <div role="status" aria-live="polite" className="flex flex-col gap-2">
            <p className="font-body text-sm text-zine-burntOrange">bar indicado com sucesso!</p>
          </div>
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

        <Button type="submit" disabled={busy}>
          {busy ? 'enviando...' : 'indicar bar'}
        </Button>
    </form>
  );
};

export default BarSuggestionForm;
