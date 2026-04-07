import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProfileByUsername, type UserProfile } from '@/services/api';
import { ZineFrame } from '@/components/common/ZineFrame';
import UserAvatar from '@/components/common/UserAvatar';

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  spotify: 'Spotify',
  twitter: 'Twitter',
  lastfm: 'Last.fm',
  letterboxd: 'Letterboxd',
};

export const PublicProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    fetchProfileByUsername(username)
      .then(setProfile)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="font-body text-zine-burntOrange animate-pulse">Carregando...</span>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="font-display text-xl text-zine-burntOrange">Usuário não encontrado</p>
        <p className="font-body text-sm text-zine-burntOrange/60">
          O perfil @{username} não existe.
        </p>
        <Link to="/" className="font-body text-sm text-zine-periwinkle hover:underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ZineFrame bg="cream">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <UserAvatar src={profile.avatarUrl} name={profile.displayName} size="lg" />

          <div>
            <h2 className="font-display text-2xl text-zine-burntOrange dark:text-zine-burntOrange-bright">
              {profile.displayName}
            </h2>
            {profile.username && (
              <p className="font-body text-sm text-zine-burntOrange/60">@{profile.username}</p>
            )}
          </div>

          {profile.bio && (
            <p className="font-body text-sm leading-relaxed max-w-sm">
              {profile.bio}
            </p>
          )}

          {profile.socialLinks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {profile.socialLinks.map((link) => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm text-zine-periwinkle dark:text-zine-periwinkle hover:underline"
                >
                  {PLATFORM_LABELS[link.platform] ?? link.platform}
                </a>
              ))}
            </div>
          )}
        </div>
      </ZineFrame>

      {/* Álbuns Favoritos */}
      {profile.favoriteAlbums.length > 0 && (
        <ZineFrame bg="cream">
          <div className="space-y-3">
            <h3 className="font-display text-sm text-zine-burntOrange dark:text-zine-burntOrange-bright text-center">
              Álbuns Favoritos
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {profile.favoriteAlbums.map((album) => (
                <div key={album.mbId} className="space-y-1">
                  <div className="aspect-square">
                    <img
                      src={album.coverUrl ?? ''}
                      alt={album.title}
                      className="w-full h-full object-cover rounded-md"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <p className="font-body text-xs leading-tight truncate text-center" title={album.title}>
                    {album.title}
                  </p>
                  <p className="font-body text-[10px] text-zine-burntOrange/60 truncate text-center" title={album.artistCredit}>
                    {album.artistCredit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </ZineFrame>
      )}
    </div>
  );
};

export default PublicProfile;
