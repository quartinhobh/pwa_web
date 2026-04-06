# Deployment — Quartinho

Target stack:

- **Frontend (web/)** → Firebase Hosting
- **API (api/)** → Render (free Web Service)
- **Firebase services** → Auth + Firestore + Realtime DB + Storage

```bash
  git tag v1.0.0 && git push --tags
```

---

## 1. Firebase project setup (one-time)

1. Create the project: https://console.firebase.google.com → **Add project**.
2. Enable services: **Authentication** (Anonymous + Google + Email),
   **Firestore Database**, **Realtime Database**, **Storage**.
3. Generate a service account key: **Project Settings → Service accounts →
   Generate new private key**. Save the JSON somewhere safe — you'll paste
   fields from it into GitHub Secrets and Koyeb env vars. **Never commit it.**
4. Apply security rules from this repo:
   ```bash
   bunx firebase-tools deploy --only firestore:rules,database,storage:rules \
       --project <your-project-id>
   ```
5. Register a **Web app** in the project settings and copy the config object
   (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId,
   databaseURL). You'll use it as `VITE_FIREBASE_CONFIG`.

---

## 2. Render — API service

### Setup (one-time)

1. Render dashboard → **New Web Service** → connect GitHub repo
2. Configure:
   - **Root Directory**: *(empty — repo root)*
   - **Runtime**: Node
   - **Build Command**: `bun install`
   - **Start Command**: `bun run api/src/index.ts`
   - **Instance Type**: Free
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: Off (deploy via tags or manual)
3. Environment variables — fill from `api/.env.production.example`:
   - `NODE_ENV=production`
   - `PORT=3001`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (keep the `\n` literals)
   - `FIREBASE_DATABASE_URL`
   - `FIREBASE_STORAGE_BUCKET`
   - `INITIAL_ADMIN_EMAIL` (first login with this email becomes admin;
     remove after first successful login)
   - `MUSICBRAINZ_USER_AGENT`
   - `GENIUS_ACCESS_TOKEN` (optional)
4. Deploy. API URL will be `https://<service>.onrender.com`

### CI/CD via tags

`.github/workflows/deploy.yml` triggers on `v*` tags and calls the
Render Deploy Hook to redeploy. Set `RENDER_DEPLOY_HOOK` as a GitHub
secret (found in Render → Service → Settings → Deploy Hook).

---

## 3. Firebase Hosting — web

### Manual deploy from your machine

```bash
# One-time
bunx firebase-tools login

# Build against production env
cp web/.env.production.example web/.env.production
$EDITOR web/.env.production     # paste VITE_FIREBASE_CONFIG + VITE_API_URL
bun run --filter=web build

# Deploy
bunx firebase-tools deploy --only hosting --project <your-project-id>
```

### GitHub Actions auto-deploy

The existing `.github/workflows/deploy.yml` builds and pushes to Firebase
Hosting on every push to `main`. Configure the secrets below.

---

## 4. GitHub Secrets required

Set these at **Repo → Settings → Secrets and variables → Actions**.

| Secret name                | Used by                | Source                                       |
|----------------------------|------------------------|----------------------------------------------|
| `RENDER_DEPLOY_HOOK`       | `deploy-api` job       | Render → Service → Settings → Deploy Hook     |
| `FIREBASE_PROJECT_ID`      | `deploy-api`, hosting  | Service account JSON → `project_id`          |
| `FIREBASE_CLIENT_EMAIL`    | `deploy-api`           | Service account JSON → `client_email`        |
| `FIREBASE_PRIVATE_KEY`     | `deploy-api`           | Service account JSON → `private_key` (keep `\n`) |
| `FIREBASE_TOKEN`           | `deploy-frontend`      | `firebase login:ci` or service account JSON contents |
| `VITE_FIREBASE_CONFIG`     | web build              | Firebase web app config as one-line JSON     |
| `VITE_API_URL`             | web build              | Koyeb service public URL                     |

---

## 5. First-deployment checklist

- [ ] Firebase project created, services enabled
- [ ] Security rules deployed (`firebase deploy --only firestore:rules,...`)
- [ ] Service account JSON generated and stored locally (not in git)
- [ ] Koyeb service created, env vars set, service healthy
- [ ] `INITIAL_ADMIN_EMAIL` set to your email for first login
- [ ] Log in once via the Google popup — your user doc now has `role: admin`
- [ ] Remove `INITIAL_ADMIN_EMAIL` from Koyeb (prevents accidental promotion
      of future users with that same email)
- [ ] Firebase Hosting configured, `VITE_FIREBASE_CONFIG` + `VITE_API_URL`
      baked into the prod build
- [ ] PWA install tested on a real mobile device
- [ ] `/admin` reachable only when logged in as the admin account

---

## 6. Rollback

- **Frontend** — `bunx firebase-tools hosting:clone <site>:live <site>:previous`
  or use the Firebase Hosting dashboard's version history to re-publish a
  previous release.
- **API** — Koyeb keeps deployment history per service; re-promote the
  previous deployment from the dashboard. Env vars are versioned along with
  it.

---

## 7. Monitoring

Not wired yet. Recommended next steps once the MVP is live:

- **Frontend** — Firebase Performance Monitoring (already available on the
  same project, just init the SDK).
- **API** — Koyeb metrics + structured logs; consider Sentry for error
  tracking.
- **Alerting** — Firebase Crashlytics for the PWA (optional).
