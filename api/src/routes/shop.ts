import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import {
  getPixConfig,
  setPixConfig,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  reorderProducts,
} from '../services/shopService';

export const shopRouter: Router = Router();

// ── Public ──────────────────────────────────────────────────────────────

shopRouter.get('/products', async (_req: Request, res: Response) => {
  try {
    const products = await listProducts(true);
    res.status(200).json({ products });
  } catch (err) {
    console.error('[GET /shop/products]', err);
    res.status(500).json({ error: 'list_products_failed' });
  }
});

shopRouter.get('/pix', async (_req: Request, res: Response) => {
  try {
    const config = await getPixConfig();
    res.status(200).json({ config });
  } catch (err) {
    console.error('[GET /shop/pix]', err);
    res.status(500).json({ error: 'get_pix_failed' });
  }
});

// ── Admin ───────────────────────────────────────────────────────────────

shopRouter.put(
  '/pix',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    const beneficiary = typeof body?.beneficiary === 'string' ? body.beneficiary.trim().slice(0, 25) : '';
    const city = typeof body?.city === 'string' ? body.city.trim().slice(0, 15) : '';
    // All empty = clear PIX config. Otherwise all required.
    const allEmpty = !key && !beneficiary && !city;
    if (!allEmpty && (!key || !beneficiary || !city)) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }
    try {
      const config = await setPixConfig({ key, beneficiary, city });
      res.status(200).json({ config });
    } catch {
      res.status(500).json({ error: 'set_pix_failed' });
    }
  },
);

shopRouter.get(
  '/products/all',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const products = await listProducts(false);
      res.status(200).json({ products });
    } catch {
      res.status(500).json({ error: 'list_products_failed' });
    }
  },
);

shopRouter.post(
  '/products',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    const emoji = typeof body?.emoji === 'string' ? body.emoji.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const price = typeof body?.price === 'number' ? body.price : 0;
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : null;
    if (!name || price <= 0) {
      res.status(400).json({ error: 'invalid_product' });
      return;
    }
    try {
      const product = await createProduct({ emoji, name, description, price, imageUrl });
      res.status(201).json({ product });
    } catch {
      res.status(500).json({ error: 'create_product_failed' });
    }
  },
);

// Reorder products
shopRouter.put(
  '/products/reorder',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids as string[] : [];
    if (ids.length === 0) { res.status(400).json({ error: 'empty_ids' }); return; }
    try {
      await reorderProducts(ids);
      res.status(200).json({ ok: true });
    } catch { res.status(500).json({ error: 'reorder_failed' }); }
  },
);

// CSV bulk import: emoji,name,description,price (centavos)
shopRouter.post(
  '/products/import',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    if (!csv.trim()) {
      res.status(400).json({ error: 'empty_csv' });
      return;
    }
    try {
      const lines = csv.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const created = [];
      for (const line of lines) {
        const [emoji, name, description, priceStr] = line.split(',').map((s: string) => s.trim());
        const price = parseInt(priceStr ?? '0', 10);
        if (!name || price <= 0) continue;
        const product = await createProduct({
          emoji: emoji ?? '',
          name,
          description: description ?? '',
          price,
          imageUrl: null,
        });
        created.push(product);
      }
      res.status(201).json({ imported: created.length, products: created });
    } catch {
      res.status(500).json({ error: 'import_failed' });
    }
  },
);

shopRouter.put(
  '/products/:id',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const updated = await updateProduct(req.params.id!, req.body ?? {});
      if (!updated) { res.status(404).json({ error: 'not_found' }); return; }
      res.status(200).json({ product: updated });
    } catch {
      res.status(500).json({ error: 'update_product_failed' });
    }
  },
);

shopRouter.delete(
  '/products/:id',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const ok = await deleteProduct(req.params.id!);
      if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'delete_product_failed' });
    }
  },
);
