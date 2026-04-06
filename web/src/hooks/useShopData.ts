import { useCallback, useEffect, useState } from 'react';
import {
  fetchProducts,
  fetchPixConfig,
} from '@/services/api';
import { useApiCache } from '@/store/apiCache';
import type { Product, PixConfig } from '@/types';

export interface UseShopDataResult {
  products: Product[];
  pix: PixConfig;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

interface ShopCacheData {
  products: Product[];
  pix: PixConfig;
}

const SHOP_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchShopData(token: string | null): Promise<ShopCacheData> {
  const [prods, cfg] = await Promise.all([
    token
      ? fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/shop/products/all`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()).then((b: { products: Product[] }) => b.products)
      : fetchProducts(),
    fetchPixConfig(),
  ]);
  return { products: prods ?? [], pix: cfg ?? { key: '', beneficiary: '', city: '' } };
}

const DEFAULT_DATA: ShopCacheData = { products: [], pix: { key: '', beneficiary: '', city: '' } };

export function useShopData(token: string | null): UseShopDataResult {
  const cache = useApiCache();
  const cacheKey = 'shop:data';

  const cached = cache.get<ShopCacheData>(cacheKey, SHOP_TTL);
  const [data, setData] = useState<ShopCacheData>(cached ?? DEFAULT_DATA);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);

    const run = async () => {
      try {
        const result = await fetchShopData(token);
        if (!cancelled) {
          cache.set(cacheKey, result);
          setData(result);
        }
      } catch {
        // keep current data on error
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [token, cache, cacheKey]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetchShopData(token);
      cache.set(cacheKey, result);
      setData(result);
    } catch {
      // keep current data on error
    } finally {
      setRefreshing(false);
    }
  }, [token, cache, cacheKey]);

  return {
    products: data.products,
    pix: data.pix,
    loading: false,
    refreshing,
    refresh,
  };
}
