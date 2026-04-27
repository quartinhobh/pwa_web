import { useIdToken } from '@/hooks/useIdToken';
import AlbumSuggestionForm from '@/components/bares/AlbumSuggestionForm';

export default function SugerirDisco() {
  const idToken = useIdToken();
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="font-display text-3xl text-zine-burntOrange">sugerir disco</h1>

      <aside className="flex items-start gap-2 border-2 border-dashed border-zine-burntYellow/50 bg-zine-burntYellow/10 dark:bg-zine-burntYellow/10 p-3">
        <div className="font-body text-xs text-zine-burntOrange/70 dark:text-zine-cream/70 leading-relaxed italic">
          discos sugeridos passam por curadoria do quartinho — voce não ve a lista, mas a gente le todas.
        </div>
      </aside>

      <AlbumSuggestionForm idToken={idToken} />
    </main>
  );
}
