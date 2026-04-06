import React from 'react';

type ZineBg = 'mint' | 'periwinkle' | 'cream' | 'burntYellow';

export interface ZineFrameProps {
  bg?: ZineBg;
  borderColor?: ZineBg;
  wobble?: boolean;
  className?: string;
  children: React.ReactNode;
}

// Light → dark background mapping. Dark variants preserve hue but lower
// luminance so the zine identity reads like "candlelit print".
const bgClassMap: Record<ZineBg, string> = {
  mint: 'bg-zine-mint dark:bg-zine-mint-dark',
  periwinkle: 'bg-zine-periwinkle dark:bg-zine-periwinkle-dark',
  cream: 'bg-zine-cream dark:bg-zine-surface-dark',
  burntYellow: 'bg-zine-burntYellow dark:bg-zine-burntYellow-bright',
};

// Borders stay light (cream) in both modes — they're the "paper" outlines.
// In dark mode they switch to a muted variant so they don't blow out.
const borderClassMap: Record<ZineBg, string> = {
  mint: 'border-zine-mint dark:border-zine-mint-dark',
  periwinkle: 'border-zine-periwinkle dark:border-zine-periwinkle-dark',
  cream: 'border-zine-cream dark:border-zine-cream/30',
  burntYellow: 'border-zine-burntYellow dark:border-zine-burntYellow-bright',
};

export const ZineFrame: React.FC<ZineFrameProps> = ({
  bg = 'mint',
  borderColor = 'cream',
  wobble = false,
  className = '',
  children,
}) => {
  return (
    <>
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: 'absolute' }}
      >
        <defs>
          <filter id="zine-wobble">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02"
              numOctaves="2"
              seed="4"
            />
            <feDisplacementMap in="SourceGraphic" scale="3" />
          </filter>
        </defs>
      </svg>
      <div
        className={[
          bgClassMap[bg],
          borderClassMap[borderColor],
          'border-4 p-4 relative min-w-0 max-w-full',
          wobble ? 'hover:wobble' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ filter: 'url(#zine-wobble)' }}
      >
        {children}
      </div>
    </>
  );
};

export default ZineFrame;
