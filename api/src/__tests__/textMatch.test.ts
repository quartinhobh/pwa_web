// Tests for the shared title/name normalization in api/src/services/textMatch.ts.

import { describe, expect, it } from 'vitest';
import { normalizeName, normalizeTitle, songKey, titleMatches } from '../services/textMatch';

describe('normalizeTitle', () => {
  it('lowercases and strips combining diacritics', () => {
    expect(normalizeTitle('Construção')).toBe('construcao');
    expect(normalizeTitle('Café Tacvba')).toBe('cafe tacvba');
    expect(normalizeTitle('Não')).toBe('nao');
  });

  it('collapses leading, trailing and internal whitespace', () => {
    expect(normalizeTitle('  Song   Title  ')).toBe('song title');
    expect(normalizeTitle('A\tB\nC')).toBe('a b c');
  });

  it('strips trailing " - Live" dash tail', () => {
    expect(normalizeTitle('Song - Live')).toBe('song');
    expect(normalizeTitle('Song – live')).toBe('song');
  });

  it('strips trailing "(feat. X)" parenthetical tail', () => {
    expect(normalizeTitle('Song (feat. Tom Jobim)')).toBe('song');
    expect(normalizeTitle('Song (feat. X & Y)')).toBe('song');
  });

  it('strips trailing "(Ao Vivo)" Portuguese parenthetical', () => {
    expect(normalizeTitle('Song (Ao Vivo)')).toBe('song');
  });

  it('strips "(Remastered YYYY)" parenthetical tail', () => {
    expect(normalizeTitle('Song (Remastered 2017)')).toBe('song');
    expect(normalizeTitle('Song (Remaster 2009)')).toBe('song');
  });

  it('strips full "(YYYY - Remaster)" parenthetical', () => {
    expect(normalizeTitle('Song (1995 - Remaster)')).toBe('song');
  });

  it('collapses compound tails like "(Remastered) - Live"', () => {
    expect(normalizeTitle('Song (Remastered) - Live')).toBe('song');
  });

  it('does not strip content that is not a known tail keyword', () => {
    expect(normalizeTitle('Foo (Bar)')).toBe('foo (bar)');
    expect(normalizeTitle('Foo - Bar')).toBe('foo - bar');
  });
});

describe('normalizeName', () => {
  it('preserves hyphens', () => {
    expect(normalizeName('AC-DC')).toBe('ac-dc');
    expect(normalizeName('Foo-Bar')).toBe('foo-bar');
  });

  it('does not strip parenthetical tails (artist credits stay whole)', () => {
    expect(normalizeName('Foo (Bar)')).toBe('foo (bar)');
  });

  it('strips diacritics and collapses whitespace', () => {
    expect(normalizeName('  Café   Tacvba  ')).toBe('cafe tacvba');
  });
});

describe('titleMatches', () => {
  it('non-strict returns true on exact equality after normalize', () => {
    expect(titleMatches('Construção', 'Construção')).toBe(true);
    expect(titleMatches('Song (Live)', 'Song (Live)')).toBe(true);
  });

  it('non-strict returns false when normalized forms differ', () => {
    expect(titleMatches('Construção', 'Other Song')).toBe(false);
  });

  it('strict returns true when the smaller token set is contained in the larger one', () => {
    expect(titleMatches('Foo Bar', 'Foo Bar Baz', { strict: true })).toBe(true);
    expect(titleMatches('Foo Bar Baz', 'Foo Bar', { strict: true })).toBe(true);
    expect(titleMatches('Foo Bar', 'Foo Bar', { strict: true })).toBe(true);
  });

  it('strict returns false when token sets do not overlap', () => {
    expect(titleMatches('Foo', 'Bar', { strict: true })).toBe(false);
  });

  it('returns false when either side normalizes to empty', () => {
    expect(titleMatches('', 'Song')).toBe(false);
    expect(titleMatches('Song', '')).toBe(false);
  });
});

describe('songKey', () => {
  it('is stable across NFD / case variants', () => {
    expect(songKey('Café Tacvba', 'María')).toBe(songKey('Cafe Tacvba', 'Maria'));
    expect(songKey('Café Tacvba', 'María')).toBe('cafe tacvba-maria');
  });

  it('treats "Song" and "Song (Live)" as the same cache slot (tail stripped)', () => {
    expect(songKey('Artist', 'Song (Live)')).toBe(songKey('Artist', 'Song'));
  });

  it('treats different artists as different cache slots even with same title', () => {
    expect(songKey('Artist One', 'Song')).not.toBe(songKey('Artist Two', 'Song'));
  });
});
