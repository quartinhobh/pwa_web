import React, { useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { useIdToken } from '@/hooks/useIdToken';
import { uploadPhoto } from '@/services/api';
import type { Photo, PhotoCategory } from '@/types';

export interface PhotoUploadProps {
  eventId: string;
  idToken?: string | null;
  onUploaded?: (photo: Photo) => void;
}

/**
 * PhotoUpload — admin-only control to upload event photos into one of
 * two categories. Goes through the api backend (not direct-to-Storage)
 * to reuse the existing admin bearer-token flow.
 */
export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  eventId,
  onUploaded,
}) => {
  const idToken = useIdToken();
  const [category, setCategory] = useState<PhotoCategory>('category1');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!file || !idToken) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await uploadPhoto(eventId, category, file, idToken);
      onUploaded?.(photo);
      setFile(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ZineFrame bg="cream" borderColor="burntYellow">
      <form
        onSubmit={handleSubmit}
        aria-label="photo-upload"
        className="flex flex-col gap-3"
      >
        <h3 className="font-display text-xl text-zine-burntOrange">
          Enviar foto
        </h3>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Categoria</span>
          <select
            aria-label="photo-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as PhotoCategory)}
            className="border-4 border-zine-burntYellow bg-zine-cream text-zine-burntOrange font-body p-2"
          >
            <option value="category1">Fotos do evento</option>
            <option value="category2">Playlist</option>
          </select>
        </label>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Ficheiro</span>
          <input
            type="file"
            aria-label="photo-file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="font-body text-zine-burntOrange"
          />
        </label>

        {error ? (
          <p role="alert" className="font-body text-zine-burntOrange">
            erro: {error}
          </p>
        ) : null}

        <Button type="submit" disabled={busy || !file || !idToken}>
          {busy ? 'a enviar…' : 'enviar'}
        </Button>
      </form>
    </ZineFrame>
  );
};

export default PhotoUpload;
