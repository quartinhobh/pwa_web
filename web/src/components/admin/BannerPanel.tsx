import React, { useCallback, useEffect, useRef, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { LoadingState } from '@/components/common/LoadingState';
import { useIdToken } from '@/hooks/useIdToken';
import {
  fetchAllBanners,
  createBanner,
  updateBanner,
  uploadBannerImage,
  activateBanner,
  deactivateBanner,
  deleteBanner,
} from '@/services/api';
import HelperBox from '@/components/admin/HelperBox';
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

  // Single form — used for both create and edit. When `editingId` is set,
  // submit calls updateBanner; otherwise createBanner.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [altText, setAltText] = useState('');
  const [link, setLink] = useState('');
  const [routes, setRoutes] = useState<BannerRoute[]>(['home']);
  const [autoDismiss, setAutoDismiss] = useState('');
  const [reappearAfter, setReappearAfter] = useState('');
  const [saving, setSaving] = useState(false);

  // Pending-delete tracking — disables the row's delete button while the
  // request is in flight so a panicked double-click can't fire twice.
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!idToken) return;
    try {
      setBanners(await fetchAllBanners(idToken));
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => { void load(); }, [load]);

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
  };

  function resetForm() {
    setEditingId(null);
    setImageUrl('');
    setImageFile(null);
    setImagePreview(null);
    setAltText('');
    setLink('');
    setRoutes(['home']);
    setAutoDismiss('');
    setReappearAfter('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function loadForEdit(banner: Banner) {
    setEditingId(banner.id);
    setImageUrl(banner.imageUrl);
    setImageFile(null);
    setImagePreview(null);
    setAltText(banner.altText);
    setLink(banner.link ?? '');
    setRoutes(banner.routes);
    setAutoDismiss(banner.autoDismissSeconds != null ? String(banner.autoDismissSeconds) : '');
    setReappearAfter(banner.reappearAfterDismissMs != null ? String(Math.round(banner.reappearAfterDismissMs / 60000)) : '');
    if (fileRef.current) fileRef.current.value = '';
    // Scroll the form into view so the user notices the panel above the list
    // populated with the banner they clicked.
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  const hasImage = !!imageFile || !!imageUrl.trim();

  const handleSubmit = async () => {
    if (!idToken || !hasImage || !altText.trim()) return;
    setSaving(true);
    try {
      let finalUrl = imageUrl.trim();
      if (imageFile) {
        finalUrl = await uploadBannerImage(imageFile, idToken);
      }
      const seconds = autoDismiss.trim() ? parseInt(autoDismiss, 10) : null;
      const reappearMinutes = reappearAfter.trim() ? parseInt(reappearAfter, 10) : null;
      const reappearMs = reappearMinutes != null && !Number.isNaN(reappearMinutes) ? reappearMinutes * 60 * 1000 : null;
      const payload = {
        imageUrl: finalUrl,
        altText: altText.trim(),
        link: link.trim() || null,
        routes,
        autoDismissSeconds: Number.isNaN(seconds) ? null : seconds,
        reappearAfterDismissMs: reappearMs,
      };
      if (editingId) {
        await updateBanner(editingId, payload, idToken);
      } else {
        await createBanner(
          { ...payload, link: payload.link ?? undefined },
          idToken,
        );
      }
      resetForm();
      await load();
    } catch (err) {
      alert(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
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
    if (!idToken || deletingIds.has(id)) return;
    setDeletingIds((s) => new Set(s).add(id));
    try {
      await deleteBanner(id, idToken);
      setBanners((b) => b.filter((x) => x.id !== id));
      // If the user was editing the row they just deleted, clear the form.
      if (editingId === id) resetForm();
    } catch (err) {
      alert(`Erro ao apagar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  if (loading) return <LoadingState />;

  const isEditing = editingId !== null;

  return (
    <div className="space-y-4">
      <HelperBox>Crie e gerencie banners para exibir no site. Escolha a rota, imagem e tempo de exibição.</HelperBox>

      {/* Form — create OR edit, never both. */}
      <ZineFrame bg="cream">
        <div ref={formRef} className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl text-zine-burntOrange">
            {isEditing ? 'Editar banner' : 'Novo banner'}
          </h3>
          {isEditing && (
            <Button type="button" onClick={resetForm}>Cancelar edição</Button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {/* Image: upload or URL */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button type="button" onClick={() => fileRef.current?.click()}>
                {isEditing ? 'Trocar imagem' : 'Enviar imagem'}
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
            {(imagePreview ?? (isEditing && imageUrl)) && (
              <img
                src={imagePreview ?? imageUrl}
                alt="Preview"
                loading="lazy"
                className="w-full max-h-32 object-cover rounded border-2 border-zine-burntYellow"
              />
            )}
            {!imageFile && (
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); setImagePreview(null); }}
                placeholder="https://... (URL da imagem)"
                className={inputClass}
              />
            )}
            {imageFile && (
              <p className="font-body text-xs text-zine-burntOrange/60">{imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)</p>
            )}
          </div>
          <HelperBox>Texto alternativo descreve a imagem para leitores de tela e quando a imagem não carrega.</HelperBox>
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
          <HelperBox>Se preenchido, o banner fecha sozinho depois de N segundos. Deixe vazio para o usuário fechar manualmente.</HelperBox>
          <input
            type="number"
            value={autoDismiss}
            onChange={(e) => setAutoDismiss(e.target.value)}
            placeholder="Auto-fechar após N segundos (opcional)"
            className={inputClass}
            min={1}
          />
          <HelperBox>Após o usuário fechar o banner, tempo até ele reaparecer (deixe vazio para reaparecer na próxima visita).</HelperBox>
          <input
            type="number"
            value={reappearAfter}
            onChange={(e) => setReappearAfter(e.target.value)}
            placeholder="Reaparecer após N minutos (opcional)"
            className={inputClass}
            min={1}
          />
          <HelperBox>Marque em quais páginas o banner vai aparecer. Pode selecionar mais de uma.</HelperBox>
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
            onClick={() => void handleSubmit()}
            disabled={saving || !hasImage || !altText.trim()}
          >
            {saving ? '...' : isEditing ? 'Salvar alterações' : 'Criar banner'}
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
            {banners.map((banner) => {
              const isDeleting = deletingIds.has(banner.id);
              const isThisEditing = editingId === banner.id;
              return (
                <div
                  key={banner.id}
                  className={`flex gap-3 items-start border-b border-zine-burntOrange/20 pb-3 ${banner.isActive ? 'border-l-4 border-l-zine-burntOrange pl-2' : ''} ${isDeleting ? 'opacity-50 pointer-events-none' : ''} ${isThisEditing ? 'ring-4 ring-zine-burntYellow/60' : ''}`}
                >
                  <img
                    src={banner.imageUrl}
                    alt={banner.altText}
                    loading="lazy"
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
                      {isThisEditing && (
                        <span className="font-body text-xs px-1.5 py-0.5 rounded bg-zine-burntYellow text-zine-burntOrange">editando</span>
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
                    <Button type="button" onClick={() => { loadForEdit(banner); }}>editar</Button>
                    <Button type="button" onClick={() => void handleDelete(banner.id)} disabled={isDeleting}>
                      {isDeleting ? 'apagando...' : 'excluir'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ZineFrame>
      )}
    </div>
  );
};

export default BannerPanel;
