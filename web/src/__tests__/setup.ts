import '@testing-library/jest-dom/vitest';

// Bun injects a half-broken `localStorage` global into workers that lacks
// `.clear`/`.setItem`/`.getItem` and shadows jsdom's implementation.
// Replace it with a minimal in-memory Storage polyfill for tests.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const installStorage = (target: object, name: 'localStorage' | 'sessionStorage') => {
  Object.defineProperty(target, name, {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
};

installStorage(globalThis, 'localStorage');
installStorage(globalThis, 'sessionStorage');
if (typeof window !== 'undefined') {
  installStorage(window, 'localStorage');
  installStorage(window, 'sessionStorage');
}
