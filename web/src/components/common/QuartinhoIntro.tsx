import React from 'react';
import ZineFrame from '@/components/common/ZineFrame';

const INTRO_TEXT =
  'se você ainda não conhece o quartinho, somos um evento mensal que ouve discos de música brasileira por belo horizonte. o evento é gratuito, e pra participar é só confirmar sua presença abaixo e saber o local!';

export interface QuartinhoIntroProps {
  compact?: boolean;
}

/**
 * QuartinhoIntro — shared "what is Quartinho" banner used by Listen (with an
 * upcoming/live event), Listen (with no current event), and Archive. The
 * compact variant trims padding so the intro reads as a sub-banner on the
 * archive page where the "Arquivo" heading already takes primary weight.
 */
export const QuartinhoIntro: React.FC<QuartinhoIntroProps> = ({ compact = false }) => (
  <ZineFrame
    bg="cream"
    borderColor="burntYellow"
    className={compact ? '!p-3' : undefined}
  >
    <p className="font-body text-zine-burntOrange text-center leading-relaxed">
      {INTRO_TEXT}
    </p>
  </ZineFrame>
);

export default QuartinhoIntro;
