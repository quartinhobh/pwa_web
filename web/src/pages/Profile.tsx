import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updatePassword, type User as FirebaseUser } from 'firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { useSessionStore } from '@/store/sessionStore';
import { fetchCurrentUser, updateMyProfile, uploadAvatar, searchMusicBrainz, type MbSearchResult } from '@/services/api';
import type { FavoriteAlbum, SocialLink, SocialPlatform } from '@/types';
import { ZineFrame } from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import UserAvatar from '@/components/common/UserAvatar';

const PLATFORMS: { key: SocialPlatform; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
  { key: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/user/...' },
  { key: 'twitter', label: 'Twitter', placeholder: 'https://twitter.com/...' },
  { key: 'lastfm', label: 'Last.fm', placeholder: 'https://last.fm/user/...' },
  { key: 'letterboxd', label: 'Letterboxd', placeholder: 'https://letterboxd.com/...' },
];

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const store = useSessionStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(store.displayName ?? '');
  const [username, setUsername] = useState(store.username ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState<Record<SocialPlatform, string>>({
    instagram: '', spotify: '', twitter: '', lastfm: '', letterboxd: '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(store.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Favorite albums
  const [favoriteAlbums, setFavoriteAlbums] = useState<FavoriteAlbum[]>([]);
  const [albumPickerSlot, setAlbumPickerSlot] = useState<number | null>(null);
  const [albumQuery, setAlbumQuery] = useState('');
  const [albumResults, setAlbumResults] = useState<MbSearchResult[]>([]);
  const [albumSearching, setAlbumSearching] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Password change — separate flow
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const isEmailUser = user?.providerData?.some((p) => p.providerId === 'password') ?? false;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    const load = async () => {
      try {
        const idToken = await user?.getIdToken();
        if (!idToken) return;
        const me = await fetchCurrentUser(idToken);
        setDisplayName(me.displayName);
        setUsername(me.username ?? '');
        setBio(me.bio ?? '');
        setAvatarPreview(me.avatarUrl);
        const linkMap: Record<SocialPlatform, string> = {
          instagram: '', spotify: '', twitter: '', lastfm: '', letterboxd: '',
        };
        for (const l of me.socialLinks ?? []) {
          linkMap[l.platform] = l.url;
        }
        setLinks(linkMap);
        setFavoriteAlbums(me.favoriteAlbums ?? []);
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    };
    void load();
  }, [isAuthenticated, navigate, user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // Album search debounce
  useEffect(() => {
    if (albumQuery.length < 2) { setAlbumResults([]); return; }
    setAlbumSearching(true);
    const timer = setTimeout(() => {
      searchMusicBrainz(albumQuery)
        .then(setAlbumResults)
        .catch(() => setAlbumResults([]))
        .finally(() => setAlbumSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [albumQuery]);

  const handleAlbumSelect = (result: MbSearchResult) => {
    if (albumPickerSlot === null) return;
    const album: FavoriteAlbum = {
      mbId: result.id,
      title: result.title,
      artistCredit: result.artistCredit,
      coverUrl: result.coverUrl,
    };
    setFavoriteAlbums((prev) => {
      const next = [...prev];
      if (albumPickerSlot < next.length) {
        next[albumPickerSlot] = album;
      } else {
        next.push(album);
      }
      return next;
    });
    setAlbumPickerSlot(null);
    setAlbumQuery('');
    setAlbumResults([]);
  };

  const handleAlbumRemove = (idx: number) => {
    setFavoriteAlbums((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAlbumDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setFavoriteAlbums((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved!);
      return next;
    });
    setDragIdx(null);
  };

  const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const errors: string[] = [];
    let avatarOk = true;

    try {
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error('Sessão expirada. Faça login novamente.');

      // 1) Avatar (independent — failure doesn't block the rest)
      if (avatarFile) {
        if (!ALLOWED_TYPES.has(avatarFile.type)) {
          errors.push('Foto: formato inválido. Use JPG, PNG ou WebP.');
          avatarOk = false;
        } else if (avatarFile.size > MAX_AVATAR_SIZE) {
          errors.push(`Foto: arquivo muito grande (${(avatarFile.size / 1024 / 1024).toFixed(1)} MB). Máximo 2 MB.`);
          avatarOk = false;
        } else {
          try {
            const url = await uploadAvatar(avatarFile, idToken);
            setAvatarPreview(url);
            setAvatarFile(null);
            store.setUser({ ...store, userId: store.firebaseUid!, avatarUrl: url, displayName: store.displayName ?? '', email: store.email, role: store.role });
          } catch (err) {
            avatarOk = false;
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('invalid_mime')) {
              errors.push('Foto: formato não aceito. Use JPG, PNG ou WebP.');
            } else if (msg.includes('file_required')) {
              errors.push('Foto: arquivo não recebido. Tente novamente.');
            } else {
              errors.push('Foto: falha no envio. Tente novamente.');
            }
          }
        }
      }

      // 2) Profile data (always attempted)
      try {
        const socialLinks: SocialLink[] = PLATFORMS
          .filter((p) => links[p.key].trim())
          .map((p) => ({ platform: p.key, url: links[p.key].trim() }));

        const usernameToSend = username.trim() === '' ? null : username.trim().toLowerCase();
        await updateMyProfile({ displayName, bio, socialLinks, username: usernameToSend, favoriteAlbums }, idToken);
        setUsernameError(null);

        store.setUser({
          userId: store.firebaseUid!,
          email: store.email,
          displayName,
          username: usernameToSend,
          role: store.role,
          avatarUrl: avatarPreview,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('username_taken')) {
          setUsernameError('Esse username já está em uso.');
          errors.push('Username já está em uso.');
        } else if (msg.includes('username_invalid')) {
          setUsernameError('3-20 caracteres: letras minúsculas, números, _ ou -');
          errors.push('Username inválido.');
        } else {
          errors.push('Perfil: falha ao salvar. Tente novamente.');
        }
      }

      if (errors.length === 0) {
        setMessage({ type: 'ok', text: 'Perfil salvo!' });
      } else if (errors.length === 1 && !avatarOk && errors[0].startsWith('Foto:')) {
        // Only avatar failed
        setMessage({ type: 'err', text: `${errors[0]} O restante do perfil foi salvo.` });
      } else {
        setMessage({ type: 'err', text: errors.join(' ') });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.';
      setMessage({ type: 'err', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'err', text: 'A senha precisa ter pelo menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'err', text: 'As senhas não coincidem.' });
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(user as FirebaseUser, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setPasswordMsg({ type: 'ok', text: 'Senha alterada!' });
    } catch {
      setPasswordMsg({ type: 'err', text: 'Falha ao alterar senha. Faça login novamente e tente de novo.' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex justify-center py-12">
        <span className="font-body text-zine-burntOrange animate-pulse">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-zine-burntOrange dark:text-zine-burntOrange-bright">
          Meu perfil
        </h2>
        {username && (
          <Link
            to={`/u/${username}`}
            className="font-body text-sm text-zine-periwinkle hover:underline"
          >
            Ver meu perfil
          </Link>
        )}
      </div>

      <ZineFrame bg="cream">
        <div className="space-y-3">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <UserAvatar src={avatarPreview} name={displayName || 'U'} size="lg" />
            <div>
              <Button type="button" onClick={() => fileRef.current?.click()}>
                Trocar foto
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <p className="font-body text-xs text-zine-burntOrange/60 mt-1">
                JPG, PNG ou WebP. Máx 2 MB.
              </p>
            </div>
          </div>

          {/* Nome */}
          <label className="block">
            <span className="font-display text-sm text-zine-burntOrange dark:text-zine-burntOrange-bright">
              Nome
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="mt-1 block w-full border-4 border-zine-burntYellow dark:border-zine-burntYellow-bright bg-transparent font-body px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zine-burntOrange"
            />
          </label>

          {/* Username */}
          <label className="block">
            <span className="font-display text-sm text-zine-burntOrange dark:text-zine-burntOrange-bright">
              Username
            </span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-zine-burntOrange/40">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                  setUsernameError(null);
                }}
                maxLength={20}
                placeholder="seu-username"
                className="block w-full border-4 border-zine-burntYellow dark:border-zine-burntYellow-bright bg-transparent font-body px-3 py-2 pl-8 focus:outline-none focus:ring-2 focus:ring-zine-burntOrange"
              />
            </div>
            {usernameError ? (
              <span className="font-body text-xs text-red-600 dark:text-red-400">{usernameError}</span>
            ) : (
              <span className="font-body text-xs text-zine-burntOrange/60">
                3-20 caracteres. Letras, números, _ ou -. <br /> Ficaria p/ acessar como: {username && `quartinhobh.com/u/${username}`}
              </span>
            )}
          </label>

          {/* Bio */}
          <label className="block">
            <span className="font-display text-sm text-zine-burntOrange dark:text-zine-burntOrange-bright">
              Bio
            </span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={3}
              className="mt-1 block w-full border-4 border-zine-burntYellow dark:border-zine-burntYellow-bright bg-transparent font-body px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-zine-burntOrange"
            />
            <span className="font-body text-xs text-zine-burntOrange/60">
              {bio.length}/200
            </span>
          </label>

          {/* Social Links */}
          <fieldset>
            <legend className="font-display text-sm text-zine-burntOrange dark:text-zine-burntOrange-bright mb-2">
              Links
            </legend>
            <div className="space-y-2">
              {PLATFORMS.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <span className="font-body text-xs w-20 shrink-0 text-right">
                    {p.label}
                  </span>
                  <input
                    type="url"
                    value={links[p.key]}
                    onChange={(e) => setLinks((prev) => ({ ...prev, [p.key]: e.target.value }))}
                    placeholder={p.placeholder}
                    className="flex-1 border-4 border-zine-burntYellow/50 dark:border-zine-burntYellow-bright/50 bg-transparent font-body text-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-zine-burntOrange"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          {/* Álbuns Favoritos */}
          <fieldset>
            <legend className="font-display text-sm text-zine-burntOrange dark:text-zine-burntOrange-bright mb-2">
              Álbuns Favoritos
            </legend>
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => {
                const album = favoriteAlbums[idx];
                return (
                  <div
                    key={idx}
                    className="relative aspect-square"
                    draggable={!!album}
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleAlbumDrop(idx)}
                  >
                    {album ? (
                      <>
                        <img
                          src={album.coverUrl ?? ''}
                          alt={album.title}
                          className="w-full h-full object-cover rounded-md border-2 border-zine-burntYellow/30 cursor-grab"
                          onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                        />
                        <button
                          type="button"
                          onClick={() => handleAlbumRemove(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-700"
                          title="Remover"
                        >
                          &times;
                        </button>
                        <p className="font-body text-[10px] leading-tight mt-1 truncate text-zine-burntOrange/80" title={`${album.title} — ${album.artistCredit}`}>
                          {album.title}
                        </p>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setAlbumPickerSlot(idx); setAlbumQuery(''); setAlbumResults([]); }}
                        className="w-full h-full rounded-md border-2 border-dashed border-zine-burntYellow/40 flex items-center justify-center hover:border-zine-burntOrange/60 transition-colors"
                      >
                        <span className="text-2xl text-zine-burntOrange/30">+</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Album picker */}
            {albumPickerSlot !== null && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={albumQuery}
                    onChange={(e) => setAlbumQuery(e.target.value)}
                    placeholder="Buscar álbum ou artista..."
                    autoFocus
                    className="flex-1 border-4 border-zine-burntYellow dark:border-zine-burntYellow-bright bg-transparent font-body text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zine-burntOrange"
                  />
                  <button
                    type="button"
                    onClick={() => { setAlbumPickerSlot(null); setAlbumQuery(''); setAlbumResults([]); }}
                    className="font-body text-sm text-zine-burntOrange/60 underline hover:text-zine-burntOrange"
                  >
                    Cancelar
                  </button>
                </div>
                {albumSearching && (
                  <p className="font-body text-xs text-zine-burntOrange/60 animate-pulse">Buscando...</p>
                )}
                {albumResults.length > 0 && (
                  <ul className="border-2 border-zine-burntYellow/30 rounded max-h-48 overflow-y-auto divide-y divide-zine-burntYellow/20">
                    {albumResults
                      .filter((r) => !favoriteAlbums.some((a) => a.mbId === r.id))
                      .map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => handleAlbumSelect(r)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-zine-burntYellow/10 text-left"
                          >
                            {r.coverUrl && (
                              <img src={r.coverUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-body text-sm truncate">{r.title}</p>
                              <p className="font-body text-xs text-zine-burntOrange/60 truncate">{r.artistCredit}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </fieldset>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            {message && (
              <span
                className={`font-body text-sm ${message.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                role="alert"
              >
                {message.text}
              </span>
            )}
          </div>
        </div>
      </ZineFrame>

      {/* Alterar senha — seção separada */}
      {isEmailUser && (
        <ZineFrame bg="cream">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm text-zine-burntOrange dark:text-zine-burntOrange-bright">
                Senha
              </span>
              {!showPasswordForm && (
                <Button type="button" onClick={() => { setShowPasswordForm(true); setPasswordMsg(null); }}>
                  Trocar senha
                </Button>
              )}
            </div>

            {showPasswordForm && (
              <div className="space-y-3">
                <label className="block">
                  <span className="font-body text-xs text-zine-burntOrange/80">Nova senha</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    className="mt-1 block w-full border-4 border-zine-burntYellow dark:border-zine-burntYellow-bright bg-transparent font-body px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zine-burntOrange"
                  />
                </label>
                <label className="block">
                  <span className="font-body text-xs text-zine-burntOrange/80">Confirmar nova senha</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    placeholder="Repita a senha"
                    className="mt-1 block w-full border-4 border-zine-burntYellow dark:border-zine-burntYellow-bright bg-transparent font-body px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zine-burntOrange"
                  />
                </label>
                <div className="flex items-center gap-3">
                  <Button type="button" onClick={() => void handlePasswordChange()} disabled={savingPassword}>
                    {savingPassword ? 'Salvando...' : 'Salvar senha'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); setPasswordMsg(null); }}
                    className="font-body text-sm text-zine-burntOrange/60 underline hover:text-zine-burntOrange"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {passwordMsg && (
              <span
                className={`font-body text-sm ${passwordMsg.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                role="alert"
              >
                {passwordMsg.text}
              </span>
            )}
          </div>
        </ZineFrame>
      )}
    </div>
  );
};

export default Profile;
