import React, { useEffect, useRef, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';
import {
  updatePixConfig,
  createProduct,
  importProductsCsv,
  deleteShopProduct,
  reorderProducts,
} from '@/services/api';
import { useShopData } from '@/hooks/useShopData';
import HelperBox from '@/components/admin/HelperBox';
import type { Product } from '@/types';

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange w-full';

function formatPrice(c: number): string {
  return `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
}

/** Wait for Firebase Auth to rehydrate, then get token. */
function getToken(): Promise<string | null> {
  if (auth.currentUser) return auth.currentUser.getIdToken();
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user ? user.getIdToken() : null);
    });
    setTimeout(() => { unsub(); resolve(null); }, 5000);
  });
}

export interface ShopPanelProps {
  idToken: string | null;
  mode?: 'products' | 'pix' | 'all';
}

export const ShopPanel: React.FC<ShopPanelProps> = ({ idToken, mode = 'all' }) => {
  const { products, pix, refresh } = useShopData(idToken);
  const [pixLocal, setPixLocal] = useState(pix);
  const [pixSaved, setPixSaved] = useState(false);

  // Sync local pix state when cache updates
  useEffect(() => {
    setPixLocal(pix);
  }, [pix]);

  const [emoji, setEmoji] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [csvText, setCsvText] = useState('');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  async function savePix() {
    const token = await getToken();
    if (!token) return;
    await updatePixConfig(pixLocal, token);
    setPixSaved(true);
    setTimeout(() => setPixSaved(false), 3000);
  }

  const [feedback, setFeedback] = useState<string | null>(null);

  async function addProduct() {
    setFeedback(null);
    if (!name.trim()) { setFeedback('nome obrigatório'); return; }
    // Normalize price: accept "25", "25,00", "25.00", "R$ 25,00", "R$25"
    const cleaned = price.replace(/[R$\s]/gi, '').replace(',', '.').trim();
    let cents = Math.round(parseFloat(cleaned || '0') * 100);
    // If user typed raw centavos like "1500" (no decimal), detect: >10000 cents = likely centavos
    if (cleaned && !cleaned.includes('.') && cents > 10000) cents = Math.round(parseFloat(cleaned));
    if (!cents || cents <= 0 || isNaN(cents)) { setFeedback('preço inválido (ex: 25,00)'); return; }
    const token = await getToken();
    if (!token) { setFeedback('não autenticado — faça login primeiro'); return; }
    try {
      await createProduct({ emoji, name, description: desc, price: cents }, token);
      setEmoji(''); setName(''); setDesc(''); setPrice('');
      setFeedback('✓ produto adicionado');
      await refresh();
    } catch (err) {
      setFeedback(`erro: ${(err as Error).message}`);
    }
  }

  async function handleImport() {
    const token = await getToken();
    if (!token || !csvText.trim()) return;
    await importProductsCsv(csvText, token);
    setCsvText('');
    await refresh();
  }

  async function handleDelete(id: string) {
    if (deletingIds.has(id)) return;
    const token = await getToken();
    if (!token) return;
    setDeletingIds((s) => new Set(s).add(id));
    try {
      await deleteShopProduct(id, token);
      await refresh();
    } catch (err) {
      alert(`Erro ao apagar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  const showPix = mode === 'pix' || mode === 'all';
  const showProducts = mode === 'products' || mode === 'all';

  return (
    <div className="flex flex-col gap-4">
      {showPix && <HelperBox>Configure os dados de PIX para recebimento de pagamentos. <br /> Vai gerar QRCODE na lojinha.</HelperBox>}
      {showProducts && <HelperBox>Adicione, edite e remova produtos da lojinha. Arraste para reordenar.</HelperBox>}
      {/* PIX Config */}
      {showPix && <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Configuração PIX</h3>
        <div className="flex flex-col gap-2">
          <input
            placeholder="Chave PIX (CPF, email, telefone, aleatória)"
            value={pixLocal.key}
            onChange={(e) => setPixLocal({ ...pixLocal, key: e.target.value })}
            className={inputClass}
          />
          <input
            placeholder="Nome beneficiário (max 25)"
            maxLength={25}
            value={pixLocal.beneficiary}
            onChange={(e) => setPixLocal({ ...pixLocal, beneficiary: e.target.value })}
            className={inputClass}
          />
          <input
            placeholder="Cidade (max 15)"
            maxLength={15}
            value={pixLocal.city}
            onChange={(e) => setPixLocal({ ...pixLocal, city: e.target.value })}
            className={inputClass}
          />
          <Button onClick={() => void savePix()}>salvar PIX</Button>
          {pixSaved && <span className="font-body text-sm text-green-700">Pix Salvo</span>}
        </div>
      </ZineFrame>}

      {/* Add product */}
      {showProducts && <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Adicionar produto</h3>
        <HelperBox>Digite o preço em reais (ex: 25,00). O emoji aparece do lado do nome na lojinha.</HelperBox>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[60px_1fr] gap-2">
            <input placeholder="emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} className={inputClass} />
            <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <input placeholder="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} />
          <input placeholder="Preço (ex: 25,00)" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
          <Button onClick={() => void addProduct()}>adicionar</Button>
          {feedback && (
            <p className={`font-body text-sm ${feedback.startsWith('✓') ? 'text-zine-mint-dark' : 'text-zine-burntOrange'}`}>
              {feedback}
            </p>
          )}
        </div>
      </ZineFrame>}

      {/* CSV import */}
      {showProducts && <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Importar CSV</h3>
        <HelperBox>Cole vários produtos de uma vez. O preço é em centavos (ex: 1500 = R$15,00). Uma linha por produto.</HelperBox>
        <p className="font-body text-xs text-zine-burntOrange/60 mb-2">
          Formato: emoji,nome,descrição,preço(centavos) — uma linha por produto
        </p>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={4}
          placeholder="🍺,Cerveja artesanal,IPA local,1500&#10;👕,Camiseta Quartinho,Tamanho único,3500"
          className={inputClass}
        />
        <Button onClick={() => void handleImport()} className="mt-2">importar</Button>
      </ZineFrame>}

      {/* Product list — drag to reorder */}
      {showProducts && <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">
          Produtos ({products.length})
        </h3>
        {products.length === 0 ? (
          <p className="font-body text-zine-burntOrange/60 italic">Nenhum produto.</p>
        ) : (
          <SortableProductList
            products={products}
            onReorder={async (reordered) => {
              await refresh();
              const token = await getToken();
              if (token) {
                await reorderProducts(reordered.map((p) => p.id), token);
              }
            }}
            onDelete={handleDelete}
            deletingIds={deletingIds}
          />
        )}
      </ZineFrame>}
    </div>
  );
};

// ── Drag handle (zine-style: wobbly dots instead of straight lines) ────

function DragHandle() {
  return (
    <span
      aria-label="arrastar"
      className="cursor-grab active:cursor-grabbing select-none text-zine-burntYellow font-display text-lg leading-none px-1"
      style={{ filter: 'url(#zine-wobble)' }}
    >
      ⁞⁞
    </span>
  );
}

// ── Sortable product row ───────────────────────────────────────────────

function SortableProductItem({
  product,
  onDelete,
  isDeleting,
  idx,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  product: Product;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  idx: number;
  dropTarget: { idx: number; half: 'top' | 'bottom' } | null;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
}) {
  const isDropTop = dropTarget?.idx === idx && dropTarget.half === 'top';
  const isDropBottom = dropTarget?.idx === idx && dropTarget.half === 'bottom';

  return (
    <li
      draggable={!isDeleting}
      onDragStart={onDragStart}
      onDragOver={(e) => { if (!isDeleting) onDragOver(e, idx); }}
      onDrop={(e) => { if (!isDeleting) onDrop(e, idx); }}
      onDragEnd={onDragEnd}
      className={`flex items-center justify-between gap-3 border-b border-zine-burntOrange/20 pb-2 relative ${isDeleting ? 'pointer-events-none opacity-50' : ''}`}
    >
      {isDropTop && (
        <div className="absolute -top-1 left-0 right-0 h-1 bg-zine-burntOrange rounded-full" />
      )}
      <div className="touch-none shrink-0 cursor-grab">
        <DragHandle />
      </div>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {product.emoji && <span className="text-xl">{product.emoji}</span>}
        <div className="flex flex-col min-w-0">
          <span className="font-display text-zine-burntOrange dark:text-zine-cream text-sm truncate">
            {product.name}
          </span>
          {product.description && (
            <span className="font-body text-xs text-zine-burntOrange/60 dark:text-zine-cream/60 truncate">
              {product.description}
            </span>
          )}
          <span className="font-body text-xs text-zine-burntYellow">
            {formatPrice(product.price)}
          </span>
        </div>
      </div>
      <Button onClick={() => void onDelete(product.id)} disabled={isDeleting}>
        {isDeleting ? 'apagando...' : 'apagar'}
      </Button>
      {isDropBottom && (
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-zine-burntOrange rounded-full" />
      )}
    </li>
  );
}

// ── Sortable product list with native DnD ─────────────────────────────

function SortableProductList({
  products,
  onReorder,
  onDelete,
  deletingIds,
}: {
  products: Product[];
  onReorder: (reordered: Product[]) => void;
  onDelete: (id: string) => void;
  deletingIds: Set<string>;
}) {
  const dragIdx = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ idx: number; half: 'top' | 'bottom' } | null>(null);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
    setDropTarget({ idx, half });
  };

  const moveItem = async (fromIdx: number, insertAt: number) => {
    if (fromIdx === insertAt) return;
    const next = [...products];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(insertAt, 0, moved!);
    setDropTarget(null);
    dragIdx.current = null;
    await onReorder(next);
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
    const target = position === 'first' ? 0 : (fromIdx < products.length ? products.length - 1 : products.length);
    void moveItem(fromIdx, target);
  };

  return (
    <ul className="flex flex-col gap-0">
      {/* Top edge drop zone */}
      <li
        onDragOver={(e) => { e.preventDefault(); setDropTarget({ idx: 0, half: 'top' }); }}
        onDrop={(e) => handleEdgeDrop(e, 'first')}
        onDragEnd={() => { dragIdx.current = null; setDropTarget(null); }}
        className={`h-3 -mb-1 ${dropTarget?.idx === 0 && dropTarget.half === 'top' ? 'bg-zine-burntOrange/30' : ''}`}
      />
      {products.map((p, idx) => (
        <SortableProductItem
          key={p.id}
          product={p}
          onDelete={onDelete}
          isDeleting={deletingIds.has(p.id)}
          idx={idx}
          dropTarget={dropTarget}
          onDragStart={() => { dragIdx.current = idx; }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={() => { dragIdx.current = null; setDropTarget(null); }}
        />
      ))}
      {/* Bottom edge drop zone */}
      <li
        onDragOver={(e) => { e.preventDefault(); setDropTarget({ idx: products.length, half: 'bottom' }); }}
        onDrop={(e) => handleEdgeDrop(e, 'last')}
        onDragEnd={() => { dragIdx.current = null; setDropTarget(null); }}
        className={`h-3 -mt-1 ${dropTarget?.idx === products.length && dropTarget.half === 'bottom' ? 'bg-zine-burntOrange/30' : ''}`}
      />
    </ul>
  );
}

export default ShopPanel;
