import React from 'react';
import { Link } from 'react-router-dom';
import ZineFrame from '@/components/common/ZineFrame';

export interface BaratonaIntroProps {
  variant?: 'full' | 'short';
}

export const BaratonaIntro: React.FC<BaratonaIntroProps> = ({ variant = 'full' }) => {
  return (
    <ZineFrame bg="cream">
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none mt-0.5" aria-hidden>🍻</span>
        <div className="font-body text-sm text-zine-burntOrange/90 dark:text-zine-cream/90 leading-relaxed italic">
          {variant === 'full' ? (
            <>
              o quartinho é itinerante — toda edição rola num lugar diferente. tamo
              organizando uma <strong className="not-italic">baratona</strong> pra descobrir bares
              novos que combinem com a vibe. quer ajudar?{' '}
              <Link to="/novo-bar" className="underline font-bold not-italic hover:text-zine-burntOrange">
                indica um bar
              </Link>{' '}
              que voce curte, ou ja foi em algum dos indicados? deixa seu feedback (❤️ / 💀 + comentário) clicando em "ver e votar →" no card.
            </>
          ) : (
            <>
              indica um bar pra baratona — sua sugestão ajuda a gente a achar lugares novos. ja foi em algum?{' '}
              <Link to="/bares" className="underline font-bold not-italic hover:text-zine-burntOrange">
                ajuda avaliando
              </Link>.
            </>
          )}
        </div>
      </div>
    </ZineFrame>
  );
};

export default BaratonaIntro;
