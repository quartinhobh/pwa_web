# Deployment — Quartinho

## Pré-requisitos

### Contas necessárias (todas gratuitas)

| Plataforma | Pra quê | Criar conta em |
|---|---|---|
| **Firebase** (Google) | Auth, Firestore, RTDB, Storage, Hosting | https://console.firebase.google.com |
| **Render** | API backend (Express) | https://render.com |
| **GitHub** | Código + CI/CD + secrets | https://github.com |

### Ferramentas locais

```bash
# macOS
brew install bun gh

# Login nas ferramentas
gh auth login                      # GitHub CLI
bunx firebase-tools login          # Firebase CLI (interativo, abre browser)
```

---

## Passo 1 — Firebase (one-time)

### 1.1 Criar projeto
1. https://console.firebase.google.com → **Add project**
2. Nome: `quartinho` (ou o que quiser)
3. Desabilita Google Analytics (não precisa)

### 1.2 Criar bancos de dados
Cada um precisa ser criado **manualmente** no Console:

| Serviço | Onde | Modo | Região |
|---|---|---|---|
| **Firestore** | Firestore Database → Create database | Production mode | `southamerica-east1` (SP) |
| **Realtime Database** | Realtime Database → Create database | Locked mode | mais próxima |
| **Storage** | Storage → Get started | Production mode | mesma região |

### 1.3 Ativar provedores de login
Firebase Console → **Authentication** → **Sign-in method** → ative:
- ✅ **Anonymous**
- ✅ **Google** (configure o email de suporte)
- ✅ **Email/Password**

> Sem isso, o login falha com `auth/configuration-not-found`.

### 1.4 Service Account Key
Firebase Console → **Project Settings** → **Service accounts** →
**Generate new private key** → salva o JSON.

Esse arquivo contém:
- `project_id` → vai em `FIREBASE_PROJECT_ID`
- `client_email` → vai em `FIREBASE_CLIENT_EMAIL`
- `private_key` → vai em `FIREBASE_PRIVATE_KEY` (manter os `\n`)

> **NUNCA commite esse arquivo.** Ele dá acesso total ao projeto.

### 1.5 Registrar Web App
Firebase Console → **Project Settings** → **General** → **Your apps** →
**Add app** (ícone Web `</>`) → copie o config object:

```json
{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"...","databaseURL":"..."}
```

Esse JSON vai em `VITE_FIREBASE_CONFIG`.

### 1.6 Gerar Firebase CI Token
```bash
bunx firebase-tools login:ci
# Abre browser → loga → cola o token que aparece
```

O token vai em `FIREBASE_TOKEN` (GitHub secret + `.github/secrets.env`).

---

## Passo 2 — Render (API)

### 2.1 Criar Web Service
1. https://render.com → **New Web Service** → conecta o repo GitHub
2. Configure:

| Campo | Valor |
|---|---|
| Root Directory | *(vazio — raiz do repo)* |
| Runtime | Node |
| Build Command | `bun install` |
| Start Command | `bun run api/src/index.ts` |
| Instance Type | Free |
| Health Check Path | `/health` |
| Auto-Deploy | Off |

### 2.2 Environment Variables no Render
Render dashboard → teu service → **Environment** → adiciona:

| Variável | Valor | Onde encontrar |
|---|---|---|
| `NODE_ENV` | `production` | fixo |
| `PORT` | `3001` | fixo |
| `FIREBASE_PROJECT_ID` | `teste-qbh` | service account JSON → `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-...@teste-qbh.iam...` | service account JSON → `client_email` |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | service account JSON → `private_key` (com `\n`) |
| `FIREBASE_DATABASE_URL` | `https://teste-qbh-default-rtdb.firebaseio.com` | Firebase Console → RTDB → URL no topo |
| `FIREBASE_STORAGE_BUCKET` | `teste-qbh.firebasestorage.app` | Firebase Console → Storage → URL |
| `INITIAL_ADMIN_EMAIL` | `seu-email@gmail.com` | seu email Google (remover depois!) |
| `MUSICBRAINZ_USER_AGENT` | `Quartinho/1.0 (email@dominio.com)` | qualquer email de contato |
| `GENIUS_ACCESS_TOKEN` | *(opcional)* | https://genius.com/api-clients |

### 2.3 Deploy Hook (pra CI/CD)
Render → teu service → **Settings** → rola até **Deploy Hook** → copia a URL.
Essa URL vai em `RENDER_DEPLOY_HOOK` (GitHub secret).

### 2.4 Manual Deploy
Render → teu service → **Manual Deploy** → Deploy latest commit.
Espera ficar "Live". Testa: `curl https://<teu-service>.onrender.com/health`

> **Nota**: Render free dorme após 15min sem requests. Primeiro acesso
> pode demorar ~30s pra acordar.

---

## Passo 3 — GitHub Secrets

### 3.1 Criar arquivo local

```bash
cp .github/secrets.env.example .github/secrets.env
```

Preenche `.github/secrets.env`:

```env
RENDER_DEPLOY_HOOK=https://api.render.com/deploy/srv-xxx?key=yyy
FIREBASE_PROJECT_ID=teste-qbh
FIREBASE_TOKEN=1//0hxxxx (output do login:ci)
VITE_API_URL=https://teu-service.onrender.com
VITE_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"...","databaseURL":"..."}
```

### 3.2 Setar no GitHub

```bash
brew install gh         # se não tiver
gh auth login           # se não tiver logado
gh secret set -f .github/secrets.env
```

Ou manualmente: GitHub repo → Settings → Secrets and variables → Actions → New repository secret (um pra cada).

---

## Passo 4 — Deploy do Frontend

### 4.1 Criar `web/.env.production`

```bash
cp web/.env.production.example web/.env.production
```

Preenche:
```env
VITE_API_URL=https://teu-service.onrender.com
VITE_FIREBASE_CONFIG={"apiKey":"...","projectId":"...","etc":"..."}
```

### 4.2 Aplicar Security Rules

```bash
source .github/secrets.env
bunx firebase-tools deploy --only firestore:rules,database:rules,storage:rules \
    --project teste-qbh --token "$FIREBASE_TOKEN"
```

### 4.3 Build + Deploy

```bash
make deploy
# ou manualmente:
source .github/secrets.env
bun run --filter=web build
bunx firebase-tools deploy --only hosting --project teste-qbh --token "$FIREBASE_TOKEN"
```

App fica em: `https://<project-id>.web.app`

---

## Passo 5 — Primeiro Admin

### Opção A: via Makefile (recomendado)

```bash
make admin EMAIL=seu-email@gmail.com
```

Isso edita diretamente o Firestore de produção. Se o user já logou,
seta `role: admin`. Se nunca logou, cria um `role_invite` que é
consumido no próximo login.

Depois: abre o app → F12 → Console → `localStorage.clear()` →
recarrega → loga com Google.

### Opção B: via INITIAL_ADMIN_EMAIL

1. Sete `INITIAL_ADMIN_EMAIL=seu-email@gmail.com` no Render (env vars)
2. Faça Manual Deploy
3. Delete seu user do Firestore (se já existir):
   Firebase Console → Firestore → collection `users` → delete o doc
4. Abra o app → logue com Google → backend cria doc com `role: admin`
5. **REMOVA** `INITIAL_ADMIN_EMAIL` do Render

### Opção C: manual no Firebase Console

1. Firebase Console → Firestore → collection `users`
2. Encontre o doc com seu email
3. Edite o campo `role` de `user` pra `admin`
4. No app: F12 → `localStorage.clear()` → recarrega

---

## Passo 6 — Reset de produção

```bash
make reset-prod
```

Isso limpa todas as collections do Firestore. Users do Auth precisam
ser deletados manualmente no Firebase Console → Authentication → Users.

No browser: F12 → Console → `localStorage.clear()`

---

## Passo 7 — Deploy automático (CI/CD)

Deploy dispara quando cria uma tag `v*`:

```bash
git tag v1.0.0
git push --tags
```

O workflow `.github/workflows/deploy.yml`:
1. Chama o Render Deploy Hook (redeploy da API)
2. Builda o frontend com as secrets
3. Deploy pro Firebase Hosting

---

## Comandos úteis

```bash
make deploy          # Build web + deploy Firebase Hosting
make deploy-rules    # Aplica security rules (Firestore/RTDB/Storage)
make admin EMAIL=x   # Promove email a admin no Firestore de produção
make reset-prod      # DESTRUTIVO: limpa Firestore de produção
make up              # Dev local: sobe emulator + api + web (Docker)
make seed            # Dev local: popula emulator com dados de teste
make test-all        # Lint + typecheck + unit tests + emulator tests
make e2e             # Playwright E2E (24 testes)
```

---

## Checklist primeiro deploy

- [ ] Conta Firebase criada
- [ ] Projeto Firebase criado
- [ ] Firestore / RTDB / Storage criados (manualmente no Console)
- [ ] Auth providers ativados (Anonymous + Google + Email)
- [ ] Service account key gerada e salva localmente
- [ ] Web app registrada no Firebase (config JSON copiado)
- [ ] Firebase CI token gerado (`bunx firebase-tools login:ci`)
- [ ] Conta Render criada
- [ ] Render Web Service criado com env vars
- [ ] Render `/health` retorna 200
- [ ] Deploy Hook copiado do Render
- [ ] GitHub secrets setados (`gh secret set -f .github/secrets.env`)
- [ ] `web/.env.production` preenchido
- [ ] Security rules aplicadas (`make deploy-rules`)
- [ ] Frontend deployed (`make deploy`)
- [ ] Admin promovido (`make admin EMAIL=...`)
- [ ] Logou no app e vê botão "admin" no header
- [ ] Removeu `INITIAL_ADMIN_EMAIL` do Render
- [ ] Testou no celular (PWA install)

---

## Troubleshooting

| Problema | Causa | Fix |
|---|---|---|
| Login falha com `auth/configuration-not-found` | Providers não ativados | Firebase Console → Auth → Sign-in method |
| API retorna 503 | Render free dormiu | Espera ~30s, reload |
| CORS errors no browser | API crashando (error antes do CORS middleware) | Checa logs do Render |
| `trust proxy` error nos logs | Falta `app.set('trust proxy', 1)` | Já fixado no código |
| Firestore vazio após login | Service account sem permissão | Verifica `FIREBASE_PRIVATE_KEY` no Render |
| Admin não aparece | Doc `users/:uid` com `role: user` | `make admin EMAIL=...` |
| `bun: script not found` no Render | Start Command errado | Deve ser `bun run api/src/index.ts` |
