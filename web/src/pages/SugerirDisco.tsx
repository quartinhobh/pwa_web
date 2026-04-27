import { useIdToken } from '@/hooks/useIdToken';
import AlbumSuggestionForm from '@/components/bares/AlbumSuggestionForm';
import ZineFrame from '@/components/common/ZineFrame';

export default function SugerirDisco() {
  const idToken = useIdToken();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl text-zine-burntOrange">sugerir disco</h1>

      <ZineFrame bg="cream">
        <p className="font-body text-sm text-zine-burntOrange/80 dark:text-zine-cream/80 leading-relaxed italic">
          🎵 discos sugeridos passam por curadoria do quartinho — voce não ve a lista, mas a gente le todas.
        </p>
      </ZineFrame>

      <AlbumSuggestionForm idToken={idToken} />
    </div>
  );
}
