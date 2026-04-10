#!/usr/bin/env bash
# check-indexes — local wrapper that starts the Firebase emulators via
# docker-compose, runs the API integration tests (which exercise every
# composite Firestore query we care about), then calls firestore-index-gen
# in --check mode to fail if firebase/firestore.indexes.json is out of
# sync with what the emulator observed.
#
# Usage: bun run --filter=api check-indexes
#
# CI does the equivalent inline in .github/workflows/ci.yml — this script
# exists so a solo dev can run the same check locally without ceremony.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "[check-indexes] starting Firebase emulators via docker compose..."
docker compose up -d firebase-emulators

cleanup() {
  echo "[check-indexes] stopping emulators..."
  docker compose down >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Wait for Firestore to be reachable on the host-mapped port.
for i in {1..30}; do
  if curl -sf http://127.0.0.1:8085/ >/dev/null 2>&1; then
    echo "[check-indexes] emulator ready after ${i}s"
    break
  fi
  sleep 2
done

echo "[check-indexes] running integration tests to populate query log..."
(cd api && bun run test:integration)

# Generate a temp firebase.json that points fig at the host-mapped port 8085
# (the committed firebase.json uses 8080 which only works inside the container).
# fig resolves `indexes` relative to the config file's directory via path.join,
# which mangles absolute paths, so we copy the indexes file next to the temp
# config and use a plain filename.
TMP_DIR=$(mktemp -d)
cp firebase/firestore.indexes.json "$TMP_DIR/firestore.indexes.json"
cat > "$TMP_DIR/firebase.json" <<JSON
{
  "firestore": {
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "firestore": { "port": 8085 }
  }
}
JSON

echo "[check-indexes] checking firestore.indexes.json against emulator report..."
bunx firestore-index-gen --projectId quartinho-dev --config "$TMP_DIR/firebase.json" --check
