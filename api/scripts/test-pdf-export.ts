/**
 * Test PDF export functionality end-to-end.
 *
 * Prerequisites:
 *   - Firebase emulator running on :9099, :8080, :9000, :9199
 *   - API server running on :3001
 *
 * Run:
 *   FIRESTORE_EMULATOR_HOST=localhost:8085 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   bun run scripts/test-pdf-export.ts
 */

import 'dotenv/config';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const API_URL = 'http://localhost:3001';
const PROJECT_ID = 'quartinho-dev';

type SignInWithCustomTokenResponse = {
  idToken: string;
  refreshToken?: string;
  expiresIn?: string;
  isNewUser?: boolean;
};

// Initialize Firebase Admin SDK against emulator
initializeApp({
  projectId: PROJECT_ID,
});

const auth = getAuth();
const db = getFirestore();

async function testPdfExport() {
  console.log('🧪 Testing PDF Export...\n');

  try {
    // Generate unique email for this test run
    const timestamp = Date.now();

    // 1. Create a test admin user
    console.log('1️⃣  Creating test admin user...');
    const adminUser = await auth.createUser({
      email: `admin-${timestamp}@test.local`,
      password: 'testpass123',
      displayName: 'Test Admin',
    });
    console.log(`   ✓ Created user: ${adminUser.uid}`);

    // 2. Promote user to admin
    console.log('2️⃣  Promoting user to admin...');
    await db.collection('users').doc(adminUser.uid).set({
      id: adminUser.uid,
      email: `admin-${timestamp}@test.local`,
      displayName: 'Test Admin',
      role: 'admin',
      username: null,
      linkedSessionId: null,
      avatarUrl: null,
      bio: null,
      socialLinks: [],
      favoriteAlbums: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    console.log('   ✓ User promoted to admin');

    // 3. Create test event
    console.log('3️⃣  Creating test event with RSVP...');
    const eventId = 'test-pdf-event';
    await db.collection('events').doc(eventId).set({
      id: eventId,
      title: 'Quartinho #99 — Test Event',
      date: '2026-04-16',
      startTime: '20:00',
      endTime: '22:00',
      status: 'upcoming',
      location: 'Test Location',
      mbAlbumId: 'test',
      album: null,
      extras: { text: '', links: [], images: [] },
      spotifyPlaylistUrl: null,
      rsvp: {
        enabled: true,
        capacity: 100,
        waitlistEnabled: true,
        plusOneAllowed: true,
        approvalMode: 'auto',
        opensAt: null,
        closesAt: null,
      },
      createdBy: 'system',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    console.log(`   ✓ Event created: ${eventId}`);

    // 4. Create test RSVP entries
    console.log('4️⃣  Creating test RSVP entries...');
    await db.collection('rsvps').doc(eventId).set({
      entries: {
        'firebase:user1': {
          status: 'confirmed',
          email: 'user1@test.local',
          displayName: 'Alice Silva',
          registeredAt: Date.now(),
        },
        'firebase:user2': {
          status: 'confirmed',
          email: 'user2@test.local',
          displayName: 'Bob Santos',
          plusOneName: 'Charlie',
          registeredAt: Date.now(),
        },
        'guest:abc123': {
          status: 'confirmed',
          email: 'guest@test.local',
          displayName: 'Diana Costa',
          registeredAt: Date.now(),
        },
      },
      confirmedCount: 3,
      waitlistCount: 0,
      updatedAt: Date.now(),
    });
    console.log('   ✓ RSVP entries created');

    // 5. Get auth token for admin
    console.log('5️⃣  Getting auth token...');
    const customToken = await auth.createCustomToken(adminUser.uid);
    console.log('   ✓ Custom token created');

    // 6. Exchange custom token for ID token
    console.log('6️⃣  Exchanging for ID token...');
    const tokenResponse = await fetch(
      'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=test',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = (await tokenResponse.json()) as SignInWithCustomTokenResponse;
    const idToken = tokenData.idToken;
    console.log('   ✓ ID token obtained');

    // 7. Call PDF export endpoint
    console.log('7️⃣  Calling PDF export endpoint...');
    const pdfResponse = await fetch(
      `${API_URL}/events/${eventId}/rsvp/admin/export-pdf`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      }
    );

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      throw new Error(`PDF export failed: ${pdfResponse.status} - ${errorText}`);
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    console.log(`   ✓ PDF generated: ${pdfBuffer.length} bytes`);

    // 8. Verify PDF
    console.log('8️⃣  Verifying PDF...');
    const pdfSignature = pdfBuffer.slice(0, 4).toString('ascii');
    if (pdfSignature !== '%PDF') {
      throw new Error(`Invalid PDF signature: ${pdfSignature}`);
    }
    console.log('   ✓ Valid PDF signature');

    // Verify content
    const pdfText = pdfBuffer.toString('latin1');
    const expectedNames = ['Alice', 'Bob', 'Diana'];
    for (const name of expectedNames) {
      if (!pdfText.includes(name)) {
        throw new Error(`Missing expected name in PDF: ${name}`);
      }
    }
    console.log('   ✓ All expected names found in PDF');

    // Save PDF for manual inspection
    const fs = await import('fs');
    fs.writeFileSync('/tmp/test-export.pdf', pdfBuffer);
    console.log('   ✓ PDF saved to /tmp/test-export.pdf');

    console.log('\n✅ PDF Export test PASSED!\n');
  } catch (error) {
    console.error('\n❌ PDF Export test FAILED!');
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

testPdfExport();
