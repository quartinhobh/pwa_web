import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchUserProfile, type UserProfile } from '@/services/api';
import UserAvatar from '@/components/common/UserAvatar';

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  spotify: 'Spotify',
  twitter: 'Twitter',
  lastfm: 'Last.fm',
  letterboxd: 'Letterboxd',
};

interface ProfilePopoverProps {
  uid: string;
  displayName: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

export const ProfilePopover: React.FC<ProfilePopoverProps> = (props) => {
  const { uid, anchorRect, onClose } = props;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUserProfile(uid).then(setProfile).catch(() => setError(true));
  }, [uid]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const top = anchorRect.bottom + 4;
  const left = Math.min(anchorRect.left, window.innerWidth - 260);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-60 border-4 border-zine-cream dark:border-zine-cream/30 bg-zine-cream dark:bg-zine-surface-dark p-3 shadow-lg"
      style={{ top, left }}
    >
      {error ? (
        <p className="font-body text-sm text-zine-burntOrange">Perfil não encontrado</p>
      ) : !profile ? (
        <p className="font-body text-sm animate-pulse text-zine-burntOrange">...</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <UserAvatar src={profile.avatarUrl} name={profile.displayName} size="md" />
            <div className="min-w-0">
              <p className="font-display text-sm text-zine-burntOrange dark:text-zine-burntOrange-bright truncate">
                {profile.displayName}
              </p>
              {profile.username && (
                <p className="font-body text-xs text-zine-burntOrange/50">@{profile.username}</p>
              )}
              <p className="font-body text-xs text-zine-burntOrange/60 capitalize">
                {profile.role}
              </p>
            </div>
          </div>

          {profile.bio && (
            <p className="font-body text-xs leading-relaxed line-clamp-3">
              {profile.bio}
            </p>
          )}

          {profile.username && (
            <Link
              to={`/u/${profile.username}`}
              onClick={onClose}
              className="font-body text-xs text-zine-periwinkle hover:underline"
            >
              Ver perfil completo
            </Link>
          )}

          {profile.socialLinks.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {profile.socialLinks.map((link) => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-xs text-zine-periwinkle dark:text-zine-periwinkle hover:underline"
                >
                  {PLATFORM_LABELS[link.platform] ?? link.platform}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfilePopover;
