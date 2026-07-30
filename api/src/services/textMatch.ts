// Title and artist-name normalization shared across services that merge
// credit data from heterogeneous sources (MusicBrainz, Discogs, Genius,
// etc.). Each source decorates titles slightly differently ("- Live",
// "(feat. X)", "(Ao Vivo)", "(Remastered 2017)"), and artist credits mix
// conventions (MusicBrainz joins with "&", users type "e"/"and"). One
// normalize home keeps matches stable across services.

const DIACRITICS = /[̀-ͯ]/g;
const WHITESPACE = /\s+/g;

// Tail fragments stripped by normalizeTitle. "feat" and "with" optionally
// consume following content so "(feat. Tom Jobim)" collapses fully.
const TITLE_TAIL_KEYWORDS =
  'ao vivo|live|in concert|feat(?:\\.\\s+[^)]+)?|with\\s+[^)]+' +
  '|remaster(?:ed)?(?:\\s+\\d{4})?|remix|bonus(?:\\s+track)?' +
  '|alternate(?:\\s+take)?|demo(?:\\s+version)?|mono|stereo' +
  '|single(?:\\s+version)?|edit|extended(?:\\s+version)?|instrumental' +
  '|acoustic(?:\\s+version)?|radio\\s+edit';
// Two tail forms:
//  1. dash  " - keyword"        — no trailing close paren
//  2. paren "(keyword)"          — both brackets present
// The negative lookahead in (1) prevents the dash form from eating the
// " - remaster" half of "(1995 - Remaster)"; YEAR_REMASTER_PAREN handles
// that full-paren shape separately.
const TITLE_TAIL_DASH_REGEX = new RegExp(
  `\\s*[-–]\\s*(?:${TITLE_TAIL_KEYWORDS})(?![^()]*\\))\\s*$`,
  'i',
);
const TITLE_TAIL_PAREN_REGEX = new RegExp(
  `\\s*\\(\\s*(?:${TITLE_TAIL_KEYWORDS})\\s*\\)\\s*$`,
  'i',
);
// Discogs/MB sometimes tag reissues as "(1995 - Remaster)" — full paren
// removal, not a tail.
const YEAR_REMASTER_PAREN = /\(\s*\d{4}\s*[-–]\s*remaster\s*\)/i;

/**
 * Normalize a song title for fuzzy comparison across credit sources.
 * Pipeline: NFD → strip combining diacritics → lowercase → collapse
 * whitespace → trim → strip common parenthetical/dash tails ("- Live",
 * "(feat. X)", "(Ao Vivo)", "(Remastered 2017)"). Loops up to three
 * times so compound tails like "Song (Remastered) - Live" collapse fully.
 */
export function normalizeTitle(s: string): string {
  let out = s
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(WHITESPACE, ' ')
    .trim();
  for (let i = 0; i < 3; i++) {
    const next = out
      .replace(TITLE_TAIL_DASH_REGEX, '')
      .replace(TITLE_TAIL_PAREN_REGEX, '')
      .replace(YEAR_REMASTER_PAREN, '')
      .trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * Normalize an artist-name string for comparison. Preserves hyphens and
 * internal spaces; never strips parentheticals — "Foo & Bar" must stay
 * distinct from "Foo" so we don't merge two credited artists.
 */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(WHITESPACE, ' ')
    .trim();
}

/**
 * Compare two titles for match. Non-strict (default) compares the
 * fully-normalized strings for equality. Strict splits into whitespace
 * tokens and requires the smaller token set to be a subset of the larger
 * one — tolerates minor word reorder / extra annotation tokens. Either
 * side empty means no match.
 */
export function titleMatches(
  a: string,
  b: string,
  opts: { strict?: boolean } = {},
): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (!opts.strict) return na === nb;
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  const [smaller, larger] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  for (const t of smaller) {
    if (!larger.has(t)) return false;
  }
  return true;
}

/**
 * Stable cache key for lyrics lookups: artist (name-normalized) joined to
 * title (title-normalized) with a dash. Title tails are stripped so
 * "Song" and "Song - Live" share a slot when their lyrics are the same.
 */
export function songKey(artist: string, title: string): string {
  return `${normalizeName(artist)}-${normalizeTitle(title)}`;
}
