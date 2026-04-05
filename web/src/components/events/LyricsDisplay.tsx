import React from 'react';
import { ZineFrame } from '@/components/common/ZineFrame';

export interface LyricsDisplayProps {
  lyrics: string | null;
  loading?: boolean;
}

/**
 * LyricsDisplay — renders lyrics inside a periwinkle ZineFrame with
 * whitespace preserved. Shows "Letra não encontrada" when lyrics are null.
 */
export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  loading = false,
}) => {
  return (
    <ZineFrame bg="periwinkle">
      {loading ? (
        <p className="font-body text-zine-cream opacity-70">
          Carregando letra...
        </p>
      ) : lyrics ? (
        <pre
          className="font-body text-zine-cream whitespace-pre-wrap max-h-96 overflow-y-auto"
          aria-label="lyrics"
        >
          {lyrics}
        </pre>
      ) : (
        <p className="font-body text-zine-cream">Letra não encontrada</p>
      )}
    </ZineFrame>
  );
};

export default LyricsDisplay;
