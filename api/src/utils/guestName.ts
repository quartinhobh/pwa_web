// Guest name generator. Deterministic for a given seed; collision probability is acceptable
// at MVP scale (20 × 20 = 400 combinations).

const ANIMALS: readonly string[] = [
  'calopsita',
  'arara',
  'beija-flor',
  'tucunare',
  'jaguatirica',
  'capivara',
  'tamandua',
  'jabuti',
  'mico',
  'quati',
  'lontra',
  'lobo-guara',
  'onca',
  'anta',
  'peixe-boi',
  'boto',
  'garca',
  'curica',
  'pavao',
  'tucano',
  'sucuri',
  'piranha',
  'bicho-preguiça',
  'tatu',
  'preá',
  'cutia',
  'ouriço',
  'maritaca',
  'sabiá',
  'seriema',
  'caracara',
  'urubu',
  'jacu',
  'porco-espinho',
  'tapir',
  'veado',
  ' cervo',
  'raposa',
  ' esquilo',
  'hog-nosed',
  'skunk',
  'porcupine',
  'armadillo',
  'ocelot',
  'maned-wolf',
];

const MUSICIANS: readonly string[] = [
  'madonna',
  'prince',
  'bowie',
  'dylan',
  'caetano',
  'gilberto-gil',
  'elis-regina',
  'rita-lee',
  'chico-buarque',
  'cazuza',
  'renato-russo',
  'celia',
  'jorge-ben',
  'tim-maia',
  'maria-bethania',
  'gal-costa',
  'djavan',
  'ivan-lins',
  'milton-nascimento',
  'nara-leao',
];

/**
 * Generate a kebab-case guest name like `calopsita-bowie`.
 * If `seed` is provided, the result is deterministic.
 */
export function generateGuestName(seed?: number): string {
  const rand = seed === undefined ? Math.random() : pseudoRandom(seed);
  const animal = ANIMALS[Math.floor(rand * ANIMALS.length)];
  const rand2 = seed === undefined ? Math.random() : pseudoRandom(seed + 1);
  const musician = MUSICIANS[Math.floor(rand2 * MUSICIANS.length)];
  return `${animal}-${musician}`;
}

function pseudoRandom(seed: number): number {
  // Mulberry32
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (((t ^ (t >>> 14)) >>> 0) % 1_000_000) / 1_000_000;
}

export const GUEST_ANIMALS = ANIMALS;
export const GUEST_MUSICIANS = MUSICIANS;
