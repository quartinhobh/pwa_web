import React, { useEffect, useRef, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { useIdToken } from '@/hooks/useIdToken';
import {
  fetchAllBanners,
  createBanner,
  uploadBannerImage,
  activateBanner,
  deactivateBanner,
  deleteBanner,
} from '@/services/api';
import type { Banner, BannerRoute } from '@/types';

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange w-full';

const ALL_ROUTES: { value: BannerRoute; label: string }[] = [
  { value: 'home', label: 'Início (/)' },
  { value: 'profile', label: 'Perfil (/u/)' },
  { value: 'lojinha', label: 'Lojinha' },
  { value: 'chat', label: 'Chat' },
];

export const BannerPanel: React.FC = () => {
  const idToken = useIdToken();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [altText, setAltText] = useState('');
  const [link, setLink] = useState('');
  const [routes, setRoutes] = useState<BannerRoute[]>(['home']);
  const [autoDismiss, setAutoDismiss] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!idToken) return;
    try {
      setBanners(await fetchAllBanners(idToken));
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [idToken]);

  const handleRouteToggle = (route: BannerRoute) => {
    setRoutes((prev) =>
      prev.includes(route) ? prev.filter((r) => r !== route) : [...prev, route]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageUrl('');
  };

  const hasImage = !!imageFile || !!imageUrl.trim();

  const handleCreate = async () => {
    if (!idToken || !hasImage || !altText.trim()) return;
    setSaving(true);
    try {
      let finalUrl = imageUrl.trim();
      if (imageFile) {
        finalUrl = await uploadBannerImage(imageFile, idToken);
      }
      const seconds = autoDismiss.trim() ? parseInt(autoDismiss, 10) : null;
      await createBanner(
        {
          imageUrl: finalUrl,
          altText: altText.trim(),
          link: link.trim() || undefined,
          routes,
          autoDismissSeconds: Number.isNaN(seconds) ? null : seconds,
        },
        idToken,
      );
      setImageUrl(''); setImageFile(null); setImagePreview(null);
      setAltText(''); setLink(''); setRoutes(['home']); setAutoDismiss('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    if (!idToken) return;
    try {
      await activateBanner(id, idToken);
      await load();
    } catch { /* silent */ }
  };

  const handleDeactivate = async (id: string) => {
    if (!idToken) return;
    try {
      await deactivateBanner(id, idToken);
      await load();
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    if (!idToken) return;
    const prev = banners;
    setBanners((b) => b.filter((x) => x.id !== id));
    try { await deleteBanner(id, idToken); }
    catch { setBanners(prev); }
  };

  if (loading) {
    return <p className="font-body text-sm text-zine-burntOrange/60 animate-pulse">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Create form */}
      <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Novo Banner</h3>
        <div className="flex flex-col gap-2">
          {/* Image: upload or URL */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button type="button" onClick={() => fileRef.current?.click()}>
                Enviar imagem
              </Button>
              <span className="font-body text-xs text-zine-burntOrange/60">ou cole URL abaixo</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {imagePreview && (
              <img src={imagePreview} alt="Preview" className="w-full max-h-32 object-cover rounded border-2 border-zine-burntYellow" />
            )}
            {!imageFile && (
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); setImagePreview(null); }}
                placeholder="https://... (URL da imagem)"
                className={inputClass}
              />
            )}
            {imageFile && (
              <p className="font-body text-xs text-zine-burntOrange/60">{imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)</p>
            )}
          </div>
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Texto alternativo (acessibilidade)"
            className={inputClass}
          />
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link (opcional)"
            className={inputClass}
          />
          <input
            type="number"
            value={autoDismiss}
            onChange={(e) => setAutoDismiss(e.target.value)}
            placeholder="Auto-fechar após N segundos (opcional)"
            className={inputClass}
            min={1}
          />
          <div className="flex flex-wrap gap-3 py-1">
            {ALL_ROUTES.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-1.5 font-body text-sm text-zine-burntOrange dark:text-zine-cream cursor-pointer">
                <input
                  type="checkbox"
                  checked={routes.includes(value)}
                  onChange={() => handleRouteToggle(value)}
                  className="accent-zine-burntOrange"
                />
                {label}
              </label>
            ))}
          </div>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving || !hasImage || !altText.trim()}
          >
            {saving ? '...' : 'Criar banner'}
          </Button>
        </div>
      </ZineFrame>

      {/* Banners list */}
      {banners.length === 0 ? (
        <p className="font-body text-sm text-zine-burntOrange/60 italic">Nenhum banner cadastrado.</p>
      ) : (
        <ZineFrame bg="cream">
          <h3 className="font-display text-xl text-zine-burntOrange mb-3">Banners</h3>
          <div className="flex flex-col gap-3">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className={`flex gap-3 items-start border-b border-zine-burntOrange/20 pb-3 ${banner.isActive ? 'border-l-4 border-l-zine-burntOrange pl-2' : ''}`}
              >
                <img
                  src={banner.imageUrl}
                  alt={banner.altText}
                  className="w-24 h-14 object-cover rounded border-2 border-zine-burntYellow flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm text-zine-burntOrange dark:text-zine-cream truncate">{banner.altText}</p>
                  {banner.link && (
                    <p className="font-body text-xs text-zine-burntOrange/50 dark:text-zine-cream/50 truncate">{banner.link}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {banner.isActive && (
                      <span className="font-body text-xs px-1.5 py-0.5 rounded bg-zine-burntOrange text-zine-cream">ativo</span>
                    )}
                    {banner.routes.map((r) => (
                      <span key={r} className="font-body text-xs px-1.5 py-0.5 rounded border border-zine-burntYellow text-zine-burntOrange dark:text-zine-cream">{r}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {banner.isActive ? (
                    <Button type="button" onClick={() => void handleDeactivate(banner.id)}>desativar</Button>
                  ) : (
                    <Button type="button" onClick={() => void handleActivate(banner.id)}>ativar</Button>
                  )}
                  <Button type="button" onClick={() => void handleDelete(banner.id)}>excluir</Button>
                </div>
              </div>
            ))}
          </div>
        </ZineFrame>
      )}
    </div>
  );
};

export default BannerPanel;
