#!/bin/bash
# Promove um email a admin direto no Firestore de produção.
# Usa o Admin SDK via um script Node inline — não depende de UI.
#
# Uso: make admin EMAIL=afa7789@gmail.com

set -euo pipefail

EMAIL="${1:?Uso: $0 <email>}"

# Carrega env vars de produção
if [ -f api/.env.production ]; then
  set -a
  source api/.env.production
  set +a
fi

echo "→ Promovendo $EMAIL a admin no projeto $FIREBASE_PROJECT_ID..."

bun -e "
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\n'),
  }),
});

const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  const email = '$EMAIL';

  // Encontra o user por email
  let uid;
  try {
    const user = await auth.getUserByEmail(email);
    uid = user.uid;
    console.log('  uid:', uid);
  } catch {
    console.log('  User não encontrado no Auth. Criando invite...');
    // Cria um role_invite pra quando o user logar pela primeira vez
    await db.collection('role_invites').doc(email).set({ role: 'admin' });
    console.log('  ✓ Invite criado — user vira admin no próximo login');
    process.exit(0);
  }

  // Atualiza o doc existente
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log('  Doc users/' + uid + ' não existe. Criando invite...');
    await db.collection('role_invites').doc(email).set({ role: 'admin' });
    console.log('  ✓ Invite criado — user vira admin no próximo login');
  } else {
    await ref.update({ role: 'admin', updatedAt: Date.now() });
    console.log('  ✓ users/' + uid + ' role=admin');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
"
