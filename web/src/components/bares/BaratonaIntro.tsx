import React from 'react';

export interface BaratonaIntroProps {
  variant?: 'full' | 'short';
}

export const BaratonaIntro: React.FC<BaratonaIntroProps> = ({ variant = 'full' }) => {
  return (
    <aside className="flex items-start gap-2 border-2 border-dashed border-zine-burntYellow/70 bg-zine-burntYellow/10 dark:bg-zine-burntYellow/20 p-3 dark:border-zine-burntYellow/50">
      <span className="text-xl leading-none mt-0.5" aria-hidden>🍻</span>
      <div className="font-body text-sm text-zine-burntOrange/90 dark:text-zine-cream/90 leading-relaxed">
        {variant === 'full' ? (
          <>
            o quartinho é itinerante — toda edição rola num lugar diferente. tamo
            organizando uma <strong>baratona</strong> pra descobrir bares novos
            que combinem com a vibe. quer ajudar? indica um bar que voce curte,
            ou passa nos ja indicados pra dar seu feedback (curti / não gostei + comentário).
          </>
        ) : (
          <>
            indica um bar pra baratona — sua sugestão ajuda a gente a achar lugares novos.
          </>
        )}
      </div>
    </aside>
  );
};

export default BaratonaIntro;
