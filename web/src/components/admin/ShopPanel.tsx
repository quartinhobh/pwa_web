import React, { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';
import {
  fetchProducts,
  fetchPixConfig,
  updatePixConfig,
  createProduct,
  importProductsCsv,
  deleteShopProduct,
  reorderProducts,
} from '@/services/api';
import type { Product, PixConfig } from '@/types';

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange w-full';

function formatPrice(c: number): string {
  return `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
}

/** Wait for Firebase Auth to rehydrate, then get token. */
function getToken(): Promise<string | null> {
  if (auth.currentUser) return auth.currentUser.getIdToken();
  // Auth hasn't rehydrated from IndexedDB yet — wait for it.
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user ? user.getIdToken() : null);
    });
    // Timeout after 5s to not hang forever.
    setTimeout(() => { unsub(); resolve(null); }, 5000);
  });
}

export interface ShopPanelProps {
  idToken: string | null;
  mode?: 'products' | 'pix' | 'all';
}

export const ShopPanel: React.FC<ShopPanelProps> = ({ mode = 'all' }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [pix, setPix] = useState<PixConfig>({ key: '', beneficiary: '', city: '' });
  const [loading, setLoading] = useState(true);

  // New product form
  const [emoji, setEmoji] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [csvText, setCsvText] = useState('');

  async function refresh() {
    try {
      const token = await getToken();
      const [prods, cfg] = await Promise.all([
        token
          ? fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/shop/products/all`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then((r) => r.json()).then((b: { products: Product[] }) => b.products)
          : fetchProducts(),
        fetchPixConfig(),
      ]);
      setProducts(prods ?? []);
      if (cfg) setPix(cfg);
    } catch { /* */ }
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);  

  async function savePix() {
    const token = await getToken();
    if (!token) return;
    await updatePixConfig(pix, token);
    alert('PIX salvo!');
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
    const token = await getToken();
    if (!token) return;
    await deleteShopProduct(id, token);
    await refresh();
  }

  if (loading) return <p className="font-body text-zine-burntOrange">carregando…</p>;

  const showPix = mode === 'pix' || mode === 'all';
  const showProducts = mode === 'products' || mode === 'all';

  return (
    <div className="flex flex-col gap-4">
      {/* PIX Config */}
      {showPix && <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Configuração PIX</h3>
        <div className="flex flex-col gap-2">
          <input
            placeholder="Chave PIX (CPF, email, telefone, aleatória)"
            value={pix.key}
            onChange={(e) => setPix({ ...pix, key: e.target.value })}
            className={inputClass}
          />
          <input
            placeholder="Nome beneficiário (max 25)"
            maxLength={25}
            value={pix.beneficiary}
            onChange={(e) => setPix({ ...pix, beneficiary: e.target.value })}
            className={inputClass}
          />
          <input
            placeholder="Cidade (max 15)"
            maxLength={15}
            value={pix.city}
            onChange={(e) => setPix({ ...pix, city: e.target.value })}
            className={inputClass}
          />
          <Button onClick={() => void savePix()}>salvar PIX</Button>
        </div>
      </ZineFrame>}

      {/* Add product */}
      {showProducts && <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Adicionar produto</h3>
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
              setProducts(reordered);
              const token = await getToken();
              if (token) {
                await reorderProducts(reordered.map((p) => p.id), token);
              }
            }}
            onDelete={handleDelete}
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
}: {
  product: Product;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-3 border-b border-zine-burntOrange/20 pb-2"
    >
      <div {...attributes} {...listeners} className="touch-none shrink-0">
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
      <Button onClick={() => void onDelete(product.id)}>apagar</Button>
    </li>
  );
}

// ── Sortable product list with DnD context ─────────────────────────────

function SortableProductList({
  products,
  onReorder,
  onDelete,
}: {
  products: Product[];
  onReorder: (reordered: Product[]) => void;
  onDelete: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = products.findIndex((p) => p.id === active.id);
    const newIdx = products.findIndex((p) => p.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(products, oldIdx, newIdx));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {products.map((p) => (
            <SortableProductItem key={p.id} product={p} onDelete={onDelete} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export default ShopPanel;
