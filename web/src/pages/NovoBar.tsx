import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIdToken } from '@/hooks/useIdToken';
import BarSuggestionForm from '@/components/bares/BarSuggestionForm';
import BaratonaIntro from '@/components/bares/BaratonaIntro';
import Button from '@/components/common/Button';

export default function NovoBar() {
  const idToken = useIdToken();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="font-display text-3xl text-zine-burntOrange">indicar bar</h1>

      <BaratonaIntro variant="short" />

      {submitted ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-3 border-2 border-zine-burntYellow p-4 bg-zine-burntYellow/10"
        >
          <p className="font-body text-sm text-zine-burntOrange">bar indicado com sucesso!</p>
          <Button type="button" onClick={() => navigate('/bares')}>
            ver bares
          </Button>
        </div>
      ) : (
        <BarSuggestionForm idToken={idToken} onSuccess={() => setSubmitted(true)} />
      )}
    </main>
  );
}
