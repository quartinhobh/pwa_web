# Firebase Emulator Suite (Docker)

Java is not required locally. The emulators run inside Docker using
`andreysenov/firebase-tools:latest-node-20`, which ships with a preinstalled JRE.

## Start / Stop

```bash
# Start emulators in the background
bun run emulators:up

# Tail logs
bun run emulators:logs

# Stop emulators
bun run emulators:down
```

The emulator UI is available at http://localhost:4000 once the container is healthy.

## Ports

| Emulator  | Port |
|-----------|------|
| Auth      | 9099 |
| Firestore | 8080 |
| RTDB      | 9000 |
| Storage   | 9199 |
| UI        | 4000 |
| Hub       | 4400 |

## Run API tests against the emulators

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 \
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
FIREBASE_DATABASE_EMULATOR_HOST=localhost:9000 \
FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 \
bun run --filter=api test
```

Or use the convenience script:

```bash
bun run test:emulators
```

## Data persistence

Emulator state is exported to `.firebase-data/` on container exit and imported
on the next start. This directory is gitignored. Delete it to start with a clean
slate:

```bash
rm -rf .firebase-data
```

## Fallback (requires JDK installed locally)

```bash
bun run emulators
```
