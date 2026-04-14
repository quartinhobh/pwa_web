import type { RsvpSummary } from '@/types';

interface RsvpStatusProps {
  summary: RsvpSummary;
  isAdmin?: boolean;
}

export const RsvpStatus: React.FC<RsvpStatusProps> = ({ summary, isAdmin = false }) => {
  const { confirmedCount, capacity, waitlistCount, confirmedAvatars } = summary;
  const hasCapacity = capacity !== null;
  const spotsLeft = hasCapacity ? capacity - confirmedCount : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Capacity bar — only admins see counts */}
      {isAdmin && (
        <div className="flex items-center justify-between font-body text-sm text-zine-burntOrange">
          <span className="font-bold">
            {confirmedCount}{hasCapacity ? `/${capacity}` : ''} confirmado{confirmedCount !== 1 ? 's' : ''}
          </span>
          {spotsLeft !== null && spotsLeft > 0 && (
            <span className="text-zine-burntOrange/60 italic">
              {spotsLeft} vaga{spotsLeft !== 1 ? 's' : ''} restante{spotsLeft !== 1 ? 's' : ''}
            </span>
          )}
          {spotsLeft !== null && spotsLeft <= 0 && (
            <span className="text-zine-burntOrange font-bold italic">esgotado</span>
          )}
        </div>
      )}

      {/* Progress bar — only admins see it */}
      {isAdmin && hasCapacity && (
        <div className="h-2 bg-zine-cream dark:bg-zine-cream/20 border-2 border-zine-burntOrange/30 overflow-hidden">
          <div
            className="h-full bg-zine-mint dark:bg-zine-mint-dark transition-all duration-300"
            style={{ width: `${Math.min(100, (confirmedCount / capacity) * 100)}%` }}
          />
        </div>
      )}

      {/* Avatar row */}
      {confirmedAvatars.length > 0 && (
        <div className="flex items-center gap-1">
          {confirmedAvatars.map((u) => (
            <div
              key={u.id}
              title={u.displayName}
              className="w-7 h-7 rounded-full border-2 border-zine-cream dark:border-zine-cream/30 bg-zine-periwinkle dark:bg-zine-periwinkle-dark overflow-hidden flex-shrink-0"
            >
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt={u.displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="flex items-center justify-center w-full h-full text-xs text-zine-cream font-bold">
                  {u.displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          ))}
          {confirmedCount > confirmedAvatars.length && (
            <span className="text-xs text-zine-burntOrange/60 font-body ml-1">
              +{confirmedCount - confirmedAvatars.length}
            </span>
          )}
        </div>
      )}

      {/* Waitlist count */}
      {waitlistCount > 0 && (
        <span className="text-xs text-zine-burntOrange/60 font-body italic">
          {waitlistCount} na fila de espera
        </span>
      )}
    </div>
  );
};

export default RsvpStatus;
