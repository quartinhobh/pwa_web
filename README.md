# Quartinho

<p align="center">
  <img src="resources/zine.png" alt="Quartinho" width="200" />
</p>

Clube de escuta coletiva — PWA retro-zine pra ouvir discos inteiros em grupo,
conversar em tempo real e votar favoritos. Monorepo Bun/Turbo com React +
Express + Firebase.

## Stack

- **web/** — React 18 + TypeScript + Vite + Tailwind, PWA via `vite-plugin-pwa`
  (Workbox). Router: `react-router-dom`. Estado: `zustand`.
- **api/** — Express + Firebase Admin SDK (Auth + Firestore + RTDB).
- **Cloudflare R2** — uploads de fotos (free tier, S3-compatible).
- **firebase/** — security rules (Firestore, RTDB, Storage).
- **Firebase Emulator Suite** via Docker Compose para dev/CI.
- **Playwright** para E2E; **Vitest** para unit tests.

Identidade visual (Phase 4) definida em `.claude/ROADMAP.md` §13 — paleta
`zine.*`, tipografia self-hosted (Alfa Slab One + Bitter), frame-within-frame
via SVG `feTurbulence`.

## Quickstart — dev local com Docker (recomendado)

Pré-requisitos: Bun ≥ 1.1, Docker.

```bash
git clone https://github.com/quartinhobh/pwa_web quartinho && cd quartinho

bun install

# Sobe emulators + API + Web em background
make up

# Popula o emulator com admin + evento de teste
cp .env.seed.example .env.seed
$EDITOR .env.seed                 # coloca email/senha (min 12 chars)
make seed

# App em http://localhost:5173 · API em http://localhost:3001
# Emulator UI em http://localhost:4000
```

## Quickstart — dev local nativo (sem Docker)

Pré-requisitos: Bun ≥ 1.1, Java (só se rodar emulator fora do container).
```bash
git clone https://github.com/quartinhobh/pwa_web quartinho && cd quartinho

bun install

# 1. Sobe o Firebase Emulator Suite (docker-compose)
bun run emulators:up

# 2. Popula o emulator com admin + evento de teste
cp .env.seed.example .env.seed
$EDITOR .env.seed                 # coloca email/senha (min 12 chars)
bun run seed

# 3. Roda API (watch) e web em paralelo — shells separados
bun run --filter=api dev
VITE_USE_EMULATOR=true bun run --filter=web dev

# App em http://localhost:5173 · API em http://localhost:3001
# Emulator UI em http://localhost:4000
```

Dev-login para E2E ou para pular Google popup: visite
`http://localhost:5173/__dev-login?email=<seu>&password=<senha>&next=/admin`.
A rota só é montada quando `import.meta.env.DEV` é true.

## Comandos

### Make (Docker)

| Comando      | O que faz                                                    |
|--------------|--------------------------------------------------------------|
| `make up`    | Sobe emulators + API + Web (Docker, background)             |
| `make down`  | Para todos os containers                                     |
| `make seed`  | Popula emulator com admin + evento de teste                 |
| `make logs`  | Tail logs de todos os containers                             |

### Bun

| Comando                                     | O que faz                                                    |
|---------------------------------------------|--------------------------------------------------------------|
| `bun run lint`                              | ESLint em `api` + `web`                                      |
| `bun run typecheck`                         | `tsc --noEmit` em todos os workspaces                        |
| `bun run test`                              | Vitest (unit) em `api` + `web`                               |
| `bun run build`                             | Build de produção do web + tsc do api                        |
| `bun run test:emulators`                    | Roda os testes de integração contra o emulator               |
| `bun run --filter=web e2e:install`          | Baixa os navegadores Playwright                              |
| `bun run --filter=web e2e`                  | Roda os testes E2E (sobe o vite dev server automaticamente)  |

## Testes

- **API unit** — `bun run --filter=api test` (sem emulator; testes gated por
  `FIRESTORE_EMULATOR_HOST` são skipados).
- **API integração** — `bun run test:emulators` (requer emulators:up). 62
  testes cobrem auth, events, votes, chat moderation, photos, lyrics,
  musicbrainz.
- **Web unit** — `bun run --filter=web test` (Vitest + Testing Library).
  79 testes.
- **E2E Playwright** — `bun run --filter=web e2e`. Auth flows usam a rota
  `/__dev-login` pra evitar o Google popup; rode `bun run seed` antes.

## Estrutura

```
quartinho/
├── api/                     # Express + Firebase Admin
│   ├── src/
│   │   ├── config/firebase.ts    # credential resolution (emulator | SA | env)
│   │   ├── middleware/           # auth, rate-limit, role-check
│   │   ├── routes/               # auth, events, votes, photos, moderation, lyrics
│   │   ├── services/             # domain logic (eventService, voteService, photoService → R2)
│   │   └── __tests__/            # vitest — some gated on FIRESTORE_EMULATOR_HOST
│   └── scripts/seed.ts      # dev-only emulator seeder
├── web/                     # React 18 + Vite PWA
│   ├── public/
│   │   ├── fonts/           # Alfa Slab One + Bitter (OFL, self-hosted)
│   │   ├── offline.html     # PWA offline fallback
│   │   └── pwa-*.png        # manifest icons
│   ├── src/
│   │   ├── components/      # common/, layout/, events/, chat/, voting/, admin/
│   │   ├── pages/           # Listen, Archive, EventDetail, LiveChat, Admin, DevLogin
│   │   ├── hooks/           # useAuth, useVotes, useChat, useLyrics, ...
│   │   ├── services/        # api.ts, firebase.ts
│   │   └── store/           # zustand sessionStore
│   └── e2e/                 # Playwright specs
├── firebase/                # security rules (Firestore/RTDB/Storage)
├── docs/                    # api-spec, emulators, deployment
├── .claude/ROADMAP.md       # full product spec (do not blindly trust for current state)
└── docker-compose.yml       # Firebase Emulator Suite
```

## Deploy

Veja [`docs/deployment.md`](docs/deployment.md).

## Segurança

- `private_key.json`, `.env`, `.env.local`, `.env.seed`, `.env.production` —
  todos gitignored. **Nunca** commite credenciais.
- `api/src/middleware/auth.ts` verifica ID tokens Firebase em toda rota
  `requireAuth`. Projetos e `aud` são checados pelo SDK.
- Rate limiting via `express-rate-limit` em rotas de escrita (`writeLimiter`).
- `seed.ts` se recusa a rodar sem `FIRESTORE_EMULATOR_HOST` e exige senha
  mínima de 12 chars.
- `/__dev-login` só é montado em DEV; production builds removem a rota.
- Firestore/Storage/RTDB rules em `firebase/*.rules` — revisar antes de ir pra
  produção.
