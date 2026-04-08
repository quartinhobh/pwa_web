import ZineFrame from './ZineFrame';

/** Base animated skeleton block */
export function SkeletonPulse({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-zine-burntOrange/10 border-2 border-zine-cream/20 ${className}`}
    />
  );
}

/** Skeleton screen matching the Listen page layout */
export function LoadingState() {
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
      </div>
    </ZineFrame>
  );
}
