import { useEffect, useState } from 'react';
import ZineFrame from './ZineFrame';

/** Zine letter-case toggle — alternates capitalization on each tick. */
function toggleCase(str: string, phase: number): string {
  return str
    .split('')
    .map((c, j) => (j % 2 === phase % 2 ? c.toUpperCase() : c.toLowerCase()))
    .join('');
}

/**
 * LoadingState — animated zine-style text loader.
 * Default loader for admin panels, lazy route fallbacks, and list views where
 * a content-shaped skeleton would be dissonant.
 */
export function LoadingState() {
  const [text, setText] = useState('carregando');
  useEffect(() => {
    const base = 'carregando';
    let i = 0;
    const id = setInterval(() => {
      i++;
      setText(toggleCase(base, i));
    }, 350);
    return () => clearInterval(id);
  }, []);
  return (
    <ZineFrame bg="mint">
      <div data-testid="loading-text" className="text-center py-8">
        <h2 className="font-display text-2xl text-zine-cream mb-2">{text}…</h2>
      </div>
    </ZineFrame>
  );
}

/** Base animated skeleton block — used by content-shaped skeletons. */
export function SkeletonPulse({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-zine-burntOrange/10 border-2 border-zine-cream/20 ${className}`}
    />
  );
}

/**
 * EventDetailSkeleton — content-shaped loader for the Listen and EventDetail
 * pages. Mirrors the album + tracklist layout so the transition to the loaded
 * state is spatially stable, and includes a centered "carregando…" marker so
 * the zine personality is preserved.
 */
export function EventDetailSkeleton() {
  return (
    <ZineFrame bg="mint">
      <div data-testid="loading-skeleton" className="flex flex-col items-center gap-4 py-2">
        {/* Album cover placeholder */}
        <SkeletonPulse className="w-48 h-48 border-4 border-zine-cream/30" />

        {/* Title line */}
        <SkeletonPulse className="h-7 w-40 rounded-sm" />

        {/* Artist line */}
        <SkeletonPulse className="h-5 w-28 rounded-sm" />

        {/* Date/time bar */}
        <SkeletonPulse className="h-4 w-36 rounded-sm" />

        {/* Track list rows */}
        <div className="w-full flex flex-col gap-2 mt-2">
          <SkeletonPulse className="h-5 w-4/5 rounded-sm" />
          <SkeletonPulse className="h-5 w-3/4 rounded-sm" />
          <SkeletonPulse className="h-5 w-[88%] rounded-sm" />
          <SkeletonPulse className="h-5 w-2/3 rounded-sm" />
          <SkeletonPulse className="h-5 w-[76%] rounded-sm" />
          <SkeletonPulse className="h-5 w-[70%] rounded-sm" />
        </div>

        {/* Zine loading marker — no extra border, ZineFrame already frames us */}
        <p className="font-display text-base italic text-zine-cream/70 mt-3 tracking-wide">
          carregando…
        </p>
      </div>
    </ZineFrame>
  );
}
