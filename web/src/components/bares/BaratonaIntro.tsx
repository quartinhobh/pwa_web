import React from 'react';
import { Link } from 'react-router-dom';

export interface BaratonaIntroProps {
  variant?: 'full' | 'short';
}

export const BaratonaIntro: React.FC<BaratonaIntroProps> = ({ variant = 'full' }) => {
  return (
    <p className="font-body text-sm text-zine-burntOrange/80 dark:text-zine-cream/80 leading-relaxed italic">
      🍻{' '}
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
    </p>
  );
};

export default BaratonaIntro;
