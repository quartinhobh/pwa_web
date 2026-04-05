import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLyrics } from '@/hooks/useLyrics';

function mockFetchJson(body: unknown, ok = true, status = 200): void {
  globalThis.fetch = vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLyrics', () => {
  it('fetches lyrics from api and returns lyrics + source', async () => {
    mockFetchJson({ lyrics: 'la la', source: 'lyrics.ovh', cached: false });

    const { result } = renderHook(() => useLyrics('Artist', 'Title'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.lyrics).toBe('la la');
    expect(result.current.source).toBe('lyrics.ovh');
    expect(result.current.error).toBeNull();
  });

  it('handles null (not found) as a non-error state', async () => {
    mockFetchJson({ lyrics: null, source: null, cached: false });

    const { result } = renderHook(() => useLyrics('A', 'T'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.lyrics).toBeNull();
    expect(result.current.source).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when artist or title is null', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;

    const { result } = renderHook(() => useLyrics(null, 'T'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(spy).not.toHaveBeenCalled();
    expect(result.current.lyrics).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    mockFetchJson({}, false, 500);

    const { result } = renderHook(() => useLyrics('A', 'T'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBeNull();
    expect(result.current.lyrics).toBeNull();
  });
});
