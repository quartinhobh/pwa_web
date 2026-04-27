import { useIdToken } from '@/hooks/useIdToken';
import AlbumSuggestionForm from '@/components/bares/AlbumSuggestionForm';

export default function SugerirDisco() {
  const idToken = useIdToken();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl text-zine-burntOrange">sugerir disco</h1>

      <p className="font-body text-sm text-zine-burntOrange/80 dark:text-zine-cream/80 leading-relaxed italic">
        Discos sugeridos passam por curadoria do quartinho. 🎵
      </p>

      <AlbumSuggestionForm idToken={idToken} />
    </div>
  );
}
