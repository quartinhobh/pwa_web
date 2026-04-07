import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { fetchUserProfile, type UserProfile } from '@/services/api';
import { ZineFrame } from '@/components/common/ZineFrame';
import UserAvatar from '@/components/common/UserAvatar';

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  spotify: 'Spotify',
  twitter: 'Twitter',
  lastfm: 'Last.fm',
  letterboxd: 'Letterboxd',
};

/**
 * /user/:id — fetches profile by Firebase UID.
 * If the user has a username, redirects to /u/:username.
 * Otherwise renders the profile inline.
 */
const UserRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchUserProfile(id)
      .then(setProfile)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="font-body text-zine-burntOrange animate-pulse">Carregando...</span>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="text-center py-12">
        <p className="font-display text-xl text-zine-burntOrange">Usuário não encontrado</p>
      </div>
    );
  }

  if (profile.username) {
    return <Navigate to={`/u/${profile.username}`} replace />;
  }

  // No username — render inline profile
  return (
    <div className="space-y-4">
      <ZineFrame bg="cream">
        <div className="flex flex-col items-center text-center space-y-3 py-3">
          <UserAvatar src={profile.avatarUrl} name={profile.displayName} size="lg" />
          <h2 className="font-display text-2xl text-zine-burntOrange dark:text-zine-burntOrange-bright">
            {profile.displayName}
          </h2>
          {profile.bio && (
            <p className="font-body text-sm leading-relaxed max-w-sm">{profile.bio}</p>
          )}
          {profile.socialLinks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {profile.socialLinks.map((link) => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm text-zine-periwinkle hover:underline"
                >
                  {PLATFORM_LABELS[link.platform] ?? link.platform}
                </a>
              ))}
            </div>
          )}
        </div>
      </ZineFrame>
    </div>
  );
};

export default UserRedirect;
