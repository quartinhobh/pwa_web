#!/bin/bash
# Reset dados de produção do Firebase — limpa Auth users + Firestore collections.
# Requer: firebase-tools + token no .github/secrets.env
#
# Uso: make reset-prod

set -euo pipefail

source .github/secrets.env

PROJECT="teste-qbh"
TOKEN="$FIREBASE_TOKEN"

echo "⚠️  Isso vai APAGAR todos os dados de produção do projeto $PROJECT"
echo "   - Todos os users do Firebase Auth"
echo "   - Todas as collections do Firestore"
echo ""
read -p "Tem certeza? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelado."
  exit 0
fi

echo ""
echo "→ Limpando Firestore..."
bunx firebase-tools firestore:delete --all-collections --project "$PROJECT" --token "$TOKEN" --force
echo "✓ Firestore limpo"

echo ""
echo "→ Nota: Firebase Auth users precisam ser deletados manualmente:"
echo "  https://console.firebase.google.com/project/$PROJECT/authentication/users"
echo "  (Seleciona todos → Delete)"
echo ""

echo "→ Limpando localStorage do browser..."
echo "  Abra https://$PROJECT.web.app → F12 → Console → localStorage.clear()"
echo ""

echo "✓ Reset completo. Agora:"
echo "  1. Delete os users no Firebase Console (link acima)"
echo "  2. Limpe localStorage no browser"
echo "  3. Acesse o app e logue com Google"
echo "  4. INITIAL_ADMIN_EMAIL no Render vai te promover a admin"
