import React from 'react';
import { useBanner } from '@/hooks/useBanner';

export const BannerDisplay: React.FC = () => {
  const { banner, visible, dismiss } = useBanner();

  if (!visible || !banner) return null;

  const content = (
    <div className="relative mx-auto max-w-[640px] px-4">
      <img
        src={banner.imageUrl}
        alt={banner.altText}
        className="w-full object-cover rounded border-4 border-zine-cream dark:border-zine-cream/30"
        style={{ maxHeight: 200 }}
      />
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(); }}
        className="absolute top-2 right-6 w-7 h-7 flex items-center justify-center bg-zine-burntOrange/80 text-zine-cream rounded-full text-sm font-bold hover:bg-zine-burntOrange"
        aria-label="Fechar banner"
      >
        ×
      </button>
    </div>
  );

  return (
    <div className="py-2">
      {banner.link ? (
        <a href={banner.link} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
};

export default BannerDisplay;
