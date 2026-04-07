import React, { useEffect, useState, useRef } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { useIdToken } from '@/hooks/useIdToken';
import {
  fetchAllLinks,
  createLink,
  updateLink,
  deleteLink,
  reorderLinks,
} from '@/services/api';
import type { LinkTreeItem } from '@/types';

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange w-full';

export const LinkTreePanel: React.FC = () => {
  const idToken = useIdToken();
  const [links, setLinks] = useState<LinkTreeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [emoji, setEmoji] = useState('');
  const [saving, setSaving] = useState(false);

  const dragIdx = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ idx: number; half: 'top' | 'bottom' } | null>(null);

  const load = async () => {
    if (!idToken) return;
    try {
      setLinks(await fetchAllLinks(idToken));
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [idToken]);

  const handleAdd = async () => {
    if (!idToken || !title.trim() || !url.trim()) return;
    setSaving(true);
    try {
      const link = await createLink({ title: title.trim(), url: url.trim(), emoji: emoji.trim() || undefined }, idToken);
      setLinks((prev) => [...prev, link]);
      setTitle(''); setUrl(''); setEmoji('');
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    if (!idToken) return;
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, active } : l));
    try { await updateLink(id, { active }, idToken); }
    catch { setLinks((prev) => prev.map((l) => l.id === id ? { ...l, active: !active } : l)); }
  };

  const handleDelete = async (id: string) => {
    if (!idToken) return;
    const prev = links;
    setLinks((l) => l.filter((x) => x.id !== id));
    try { await deleteLink(id, idToken); }
    catch { setLinks(prev); }
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
    setDropTarget({ idx, half });
  };

  const moveItem = async (fromIdx: number, insertAt: number) => {
    if (fromIdx === insertAt || !idToken) return;
    const next = [...links];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(insertAt, 0, moved!);
    setLinks(next);
    setDropTarget(null);
    dragIdx.current = null;
    try { await reorderLinks(next.map((l) => l.id), idToken); }
    catch { void load(); }
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx === null) { setDropTarget(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
    let insertAt = half === 'top' ? targetIdx : targetIdx + 1;
    if (fromIdx < insertAt) insertAt--;
    void moveItem(fromIdx, insertAt);
  };

  const handleEdgeDrop = (e: React.DragEvent, position: 'first' | 'last') => {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx === null) { setDropTarget(null); return; }
    const target = position === 'first'
      ? 0
      : (fromIdx < links.length ? links.length - 1 : links.length);
    void moveItem(fromIdx, target);
  };

  if (loading) {
    return <p className="font-body text-sm text-zine-burntOrange/60 animate-pulse">Carregando...</p>;
  }

  const dropZoneClass = (active: boolean) =>
    `rounded border-2 border-dashed transition-all ${active ? 'h-8 border-zine-burntOrange bg-zine-burntOrange/10' : 'h-2 border-transparent'}`;

  return (
    <div className="space-y-4">
      {/* Add form */}
      <ZineFrame bg="cream">
        <div className="flex flex-wrap gap-2">
          <input type="text" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="emoji" className={`${inputClass} !w-16 !p-1.5 text-center`} />
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className={`${inputClass} !w-auto flex-1 min-w-[100px] !p-1.5`} />
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={`${inputClass} !w-auto flex-1 min-w-[140px] !p-1.5`} />
          <Button type="button" onClick={() => void handleAdd()} disabled={saving || !title.trim() || !url.trim()}>
            {saving ? '...' : 'Adicionar'}
          </Button>
        </div>
      </ZineFrame>

      {/* Links list */}
      {links.length === 0 ? (
        <p className="font-body text-sm text-zine-burntOrange/60 italic">Nenhum link cadastrado.</p>
      ) : (
        <ZineFrame bg="cream">
          {/* Top drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDropTarget({ idx: -1, half: 'top' }); }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => handleEdgeDrop(e, 'first')}
            className={dropZoneClass(dropTarget?.idx === -1)}
          />

          {links.map((link, idx) => (
            <div key={link.id} className="relative py-0.5">
              {dropTarget?.idx === idx && dropTarget.half === 'top' && (
                <div className="absolute -top-px left-0 right-0 h-0.5 bg-zine-burntOrange rounded" />
              )}
              <div
                draggable
                onDragStart={() => { dragIdx.current = idx; }}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={() => { dragIdx.current = null; setDropTarget(null); }}
                className={`flex items-center gap-2 px-3 py-2 border-b border-zine-burntOrange/20 select-none ${!link.active ? 'opacity-40' : ''}`}
              >
                <span className="cursor-grab font-display text-lg text-zine-burntOrange/40 px-1 select-none">⠿</span>
                <span className="text-lg">{link.emoji || '🔗'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm text-zine-burntOrange dark:text-zine-cream truncate">{link.title}</p>
                  <p className="font-body text-xs text-zine-burntOrange/50 dark:text-zine-cream/50 truncate">{link.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggle(link.id, !link.active)}
                  className={`font-body text-xs px-2 py-0.5 rounded border ${
                    link.active
                      ? 'border-zine-mint dark:border-zine-mint-dark text-zine-mint dark:text-zine-mint-dark'
                      : 'border-zine-burntOrange/40 text-zine-burntOrange/60'
                  }`}
                >
                  {link.active ? 'ativo' : 'inativo'}
                </button>
                <Button type="button" onClick={() => void handleDelete(link.id)}>
                  excluir
                </Button>
              </div>
              {dropTarget?.idx === idx && dropTarget.half === 'bottom' && (
                <div className="absolute -bottom-px left-0 right-0 h-0.5 bg-zine-burntOrange rounded" />
              )}
            </div>
          ))}

          {/* Bottom drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDropTarget({ idx: links.length, half: 'top' }); }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => {
              e.preventDefault();
              const fromIdx = dragIdx.current;
              if (fromIdx === null || !idToken) { setDropTarget(null); return; }
              const next = [...links];
              const [moved] = next.splice(fromIdx, 1);
              next.push(moved!);
              setLinks(next);
              setDropTarget(null);
              dragIdx.current = null;
              void reorderLinks(next.map((l) => l.id), idToken).catch(() => { void load(); });
            }}
            className={dropZoneClass(dropTarget?.idx === links.length)}
          />
        </ZineFrame>
      )}
    </div>
  );
};

export default LinkTreePanel;
