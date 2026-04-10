/**
 * Sticker asset registry — filenames under web/public/stickers/ consumed by
 * the StickerLayer. Ordering is irrelevant; the spawner picks at random.
 */
export const stickerAssets = [
  'star-burst.svg',
  'heart.svg',
  'lightning.svg',
  'exclamation.svg',
  'spiral.svg',
] as const;

export type StickerAsset = typeof stickerAssets[number];
