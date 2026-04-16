/**
 * RSVP Integration Tests — runs against Firebase Emulators + MailDev SMTP.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.test.yml up -d
 *
 * Run:
 *   # With `make up` running (emulators on host ports):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 \
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 \
 *   BREVO_API_KEY=test \
 *   BREVO_SENDER_EMAIL=test@quartinho.com \
 *   MAILDEV_URL=http://127.0.0.1:1080 \
 *   npx vitest run src/__tests__/integration/rsvp.integration.test.ts
 *
 *   # Or simply: make test-integration
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const MAILDEV_URL = process.env.MAILDEV_URL ?? 'http://127.0.0.1:1080';

// Skip if not running against emulators
const SKIP = !FIRESTORE_HOST;

describe.skipIf(SKIP)('RSVP Integration', () => {
  let adminDb: FirebaseFirestore.Firestore;

  beforeAll(async () => {
    // Dynamic import to avoid loading firebase outside emulator context
    const firebase = await import('../../config/firebase');
    adminDb = firebase.adminDb;
  });

  beforeEach(async () => {
    // Clear Firestore emulator data
    await fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/quartinho-test/databases/(default)/documents`, {
      method: 'DELETE',
    });
    // Clear MailDev emails
    await fetch(`${MAILDEV_URL}/email/all`, { method: 'DELETE' }).catch(() => {});
  });

  async function seedEvent(id: string, rsvpConfig?: Record<string, unknown>) {
    await adminDb.collection('events').doc(id).set({
      id,
      title: 'Quartinho #42 — OK Computer',
      date: '2026-05-15',
      startTime: '19:00',
      endTime: '21:00',
      status: 'upcoming',
      location: 'Rua Exemplo, 123',
      mbAlbumId: 'test',
      album: null,
      extras: { text: '', links: [], images: [] },
      spotifyPlaylistUrl: null,
      createdBy: 'admin1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(rsvpConfig ? { rsvp: rsvpConfig } : {}),
    });
  }

  async function seedUser(id: string, email: string, displayName: string) {
    await adminDb.collection('users').doc(id).set({
      id,
      email,
      displayName,
      username: null,
      role: 'user',
      linkedSessionId: null,
      avatarUrl: null,
      bio: null,
      socialLinks: [],
      favoriteAlbums: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  // ── Service layer tests ──────────────────────────────────────────

  it('submitRsvp confirms user and increments counter', async () => {
    const { submitRsvp, getRsvpSummary } = await import('../../services/rsvpService');

    await seedEvent('evt1', {
      enabled: true,
      capacity: 10,
      waitlistEnabled: true,
      plusOneAllowed: false,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    await seedUser('user1', 'u1@test.com', 'U1');
    const result = await submitRsvp('evt1', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
    });
    expect(result.entry.status).toBe('confirmed');

    const summary = await getRsvpSummary('evt1');
    expect(summary.confirmedCount).toBe(1);
  });

  it('submitRsvp with +1 increments counter by 2', async () => {
    const { submitRsvp, getRsvpSummary } = await import('../../services/rsvpService');

    await seedEvent('evt2', {
      enabled: true,
      capacity: 10,
      waitlistEnabled: true,
      plusOneAllowed: true,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    await submitRsvp('evt2', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
      plusOne: true, plusOneName: 'Maria',
    });

    const summary = await getRsvpSummary('evt2');
    expect(summary.confirmedCount).toBe(2);
  });

  it('waitlist when capacity is full', async () => {
    const { submitRsvp } = await import('../../services/rsvpService');

    await seedEvent('evt3', {
      enabled: true,
      capacity: 1,
      waitlistEnabled: true,
      plusOneAllowed: false,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    const r1 = await submitRsvp('evt3', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
    });
    expect(r1.entry.status).toBe('confirmed');

    const r2 = await submitRsvp('evt3', {
      type: 'firebase', uid: 'user2', email: 'u2@test.com', displayName: 'U2',
    });
    expect(r2.entry.status).toBe('waitlisted');
  });

  it('cancel promotes oldest waitlisted user', async () => {
    const { submitRsvp, cancelRsvp, getUserRsvp } = await import('../../services/rsvpService');

    await seedEvent('evt4', {
      enabled: true,
      capacity: 1,
      waitlistEnabled: true,
      plusOneAllowed: false,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    await submitRsvp('evt4', { type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1' });
    await submitRsvp('evt4', { type: 'firebase', uid: 'user2', email: 'u2@test.com', displayName: 'U2' });
    await submitRsvp('evt4', { type: 'firebase', uid: 'user3', email: 'u3@test.com', displayName: 'U3' });

    const cancelResult = await cancelRsvp('evt4', 'firebase:user1');
    expect(cancelResult.promotedEntryKey).toBe('firebase:user2');

    const user2Entry = await getUserRsvp('evt4', 'firebase:user2');
    expect(user2Entry?.status).toBe('confirmed');

    const user3Entry = await getUserRsvp('evt4', 'firebase:user3');
    expect(user3Entry?.status).toBe('waitlisted');
  });

  it('cancel with +1 frees 2 spots', async () => {
    const { submitRsvp, cancelRsvp, getRsvpSummary } = await import('../../services/rsvpService');

    await seedEvent('evt5', {
      enabled: true,
      capacity: 5,
      waitlistEnabled: false,
      plusOneAllowed: true,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    await submitRsvp('evt5', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
      plusOne: true, plusOneName: 'Guest',
    });
    const before = await getRsvpSummary('evt5');
    expect(before.confirmedCount).toBe(2);

    await cancelRsvp('evt5', 'firebase:user1');
    const after = await getRsvpSummary('evt5');
    expect(after.confirmedCount).toBe(0);
  });

  it('manual approval mode sets pending_approval', async () => {
    const { submitRsvp, approveOrReject, getUserRsvp } = await import('../../services/rsvpService');

    await seedEvent('evt6', {
      enabled: true,
      capacity: 10,
      waitlistEnabled: false,
      plusOneAllowed: false,
      approvalMode: 'manual',
      opensAt: null,
      closesAt: null,
    });

    const r = await submitRsvp('evt6', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
    });
    expect(r.entry.status).toBe('pending_approval');

    const approved = await approveOrReject('evt6', 'firebase:user1', 'confirmed');
    expect(approved.status).toBe('confirmed');

    const entry = await getUserRsvp('evt6', 'firebase:user1');
    expect(entry?.status).toBe('confirmed');
  });

  it('rejects invalid transition (already confirmed)', async () => {
    const { submitRsvp, approveOrReject } = await import('../../services/rsvpService');

    await seedEvent('evt7', {
      enabled: true,
      capacity: 10,
      waitlistEnabled: false,
      plusOneAllowed: false,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    await submitRsvp('evt7', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
    });

    await expect(
      approveOrReject('evt7', 'firebase:user1', 'confirmed'),
    ).rejects.toThrow('invalid_transition');
  });

  it('throws event_full when capacity reached and no waitlist', async () => {
    const { submitRsvp } = await import('../../services/rsvpService');

    await seedEvent('evt8', {
      enabled: true,
      capacity: 1,
      waitlistEnabled: false,
      plusOneAllowed: false,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    await submitRsvp('evt8', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
    });
    await expect(
      submitRsvp('evt8', {
        type: 'firebase', uid: 'user2', email: 'u2@test.com', displayName: 'U2',
      }),
    ).rejects.toThrow('event_full');
  });

  it('updatePlusOne adjusts counter correctly', async () => {
    const { submitRsvp, updatePlusOne, getRsvpSummary } = await import('../../services/rsvpService');

    await seedEvent('evt9', {
      enabled: true,
      capacity: 10,
      waitlistEnabled: false,
      plusOneAllowed: true,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    await submitRsvp('evt9', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
    });
    expect((await getRsvpSummary('evt9')).confirmedCount).toBe(1);

    await updatePlusOne('evt9', 'firebase:user1', true, 'Guest');
    expect((await getRsvpSummary('evt9')).confirmedCount).toBe(2);

    await updatePlusOne('evt9', 'firebase:user1', false, null);
    expect((await getRsvpSummary('evt9')).confirmedCount).toBe(1);
  });

  it('CSV export handles special characters', async () => {
    const { submitRsvp, getAdminList, exportCsv } = await import('../../services/rsvpService');

    await seedEvent('evt10', {
      enabled: true,
      capacity: 10,
      waitlistEnabled: false,
      plusOneAllowed: true,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    await seedUser('user-csv', 'csv@test.com', 'Maria "Mimi", Silva');
    await submitRsvp('evt10', {
      type: 'firebase', uid: 'user-csv', email: 'csv@test.com',
      displayName: 'Maria "Mimi", Silva',
      plusOne: true, plusOneName: 'João, o acompanhante',
    });

    const entries = await getAdminList('evt10');
    const csv = exportCsv(entries);

    expect(csv).toContain('"Maria ""Mimi"", Silva"');
    expect(csv).toContain('"João, o acompanhante"');
  });

  // ── Email template tests ──────────────────────────────────────────

  it('buildRsvpEmail interpolates variables and returns HTML', async () => {
    const { buildRsvpEmail } = await import('../../services/emailTemplateService');

    const result = await buildRsvpEmail('confirmation', {
      nome: 'Maria',
      evento: 'Quartinho #42',
      data: '2026-05-15',
      horario: '19:00',
    });

    expect(result).not.toBeNull();
    expect(result!.subject).toContain('Quartinho #42');
    expect(result!.bodyText).toContain('Maria');
    expect(result!.bodyText).toContain('Quartinho #42');
  });

  it('getAllTemplates returns 6 templates with defaults', async () => {
    const { getAllTemplates } = await import('../../services/emailTemplateService');

    const templates = await getAllTemplates();
    expect(templates).toHaveLength(10);
    expect(templates.map((t) => t.key)).toEqual([
      'confirmation', 'waitlist', 'promotion', 'reminder', 'venue_reveal', 'rejected',
      'role_invite', 'role_promotion', 'event_cancelled', 'event_broadcast',
    ]);
    expect(templates.every((t) => t.enabled)).toBe(true);
  });

  it('buildRsvpEmail returns null when template is disabled', async () => {
    const { updateTemplate, buildRsvpEmail } = await import('../../services/emailTemplateService');

    await updateTemplate('confirmation', { enabled: false }, 'admin1');

    const result = await buildRsvpEmail('confirmation', {
      nome: 'Maria',
      evento: 'Test',
      data: '2026-05-15',
      horario: '19:00',
    });

    expect(result).toBeNull();
  });

  it('updateTemplate persists changes', async () => {
    const { updateTemplate, getEffectiveTemplate } = await import('../../services/emailTemplateService');

    await updateTemplate('waitlist', { subject: 'Custom subject' }, 'admin1');

    const template = await getEffectiveTemplate('waitlist');
    expect(template.subject).toBe('Custom subject');
    expect(template.updatedBy).toBe('admin1');
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('throws rsvp_disabled when RSVP not enabled', async () => {
    const { submitRsvp } = await import('../../services/rsvpService');

    await seedEvent('evt-no-rsvp', {
      enabled: false,
      capacity: null,
      waitlistEnabled: false,
      plusOneAllowed: false,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    await expect(
      submitRsvp('evt-no-rsvp', {
        type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
      }),
    ).rejects.toThrow('rsvp_disabled');
  });

  it('throws rsvp_closed when outside time window', async () => {
    const { submitRsvp } = await import('../../services/rsvpService');

    await seedEvent('evt-closed', {
      enabled: true,
      capacity: null,
      waitlistEnabled: false,
      plusOneAllowed: false,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: Date.now() - 1000, // closed 1 second ago
    });

    await expect(
      submitRsvp('evt-closed', {
        type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
      }),
    ).rejects.toThrow('rsvp_closed');
  });

  it('throws already_rsvped on duplicate submission', async () => {
    const { submitRsvp } = await import('../../services/rsvpService');

    await seedEvent('evt-dup', {
      enabled: true,
      capacity: null,
      waitlistEnabled: false,
      plusOneAllowed: false,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    await submitRsvp('evt-dup', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
    });
    await expect(
      submitRsvp('evt-dup', {
        type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
      }),
    ).rejects.toThrow('already_rsvped');
  });

  it('allows re-RSVP after cancellation', async () => {
    const { submitRsvp, cancelRsvp } = await import('../../services/rsvpService');

    await seedEvent('evt-resubmit', {
      enabled: true,
      capacity: null,
      waitlistEnabled: false,
      plusOneAllowed: false,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    await submitRsvp('evt-resubmit', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
    });
    await cancelRsvp('evt-resubmit', 'firebase:user1');
    const r = await submitRsvp('evt-resubmit', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'U1',
    });
    expect(r.entry.status).toBe('confirmed');
  });

  it('exportPdf generates valid PDF with confirmed RSVPs', async () => {
    const { submitRsvp, getAdminList, exportPdf } = await import('../../services/rsvpService');

    await seedEvent('evt-pdf', {
      enabled: true,
      capacity: null,
      waitlistEnabled: false,
      plusOneAllowed: true,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    });

    // Submit multiple RSVPs
    await submitRsvp('evt-pdf', {
      type: 'firebase', uid: 'user1', email: 'u1@test.com', displayName: 'Alice Silva',
    });
    await submitRsvp('evt-pdf', {
      type: 'firebase', uid: 'user2', email: 'u2@test.com', displayName: 'Bob Santos', plusOne: true, plusOneName: 'Charlie',
    });
    await submitRsvp('evt-pdf', {
      type: 'guest', email: 'guest@test.com', displayName: 'Diana Costa',
    });

    // Get admin list
    const entries = await getAdminList('evt-pdf');
    expect(entries.length).toBeGreaterThanOrEqual(3);

    // Generate PDF
    const pdfBuffer = await exportPdf(entries, 'Quartinho #42 — Test Event', '2026-05-15');

    // Verify it's a valid PDF
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(100);

    // Check PDF signature
    const pdfSignature = pdfBuffer.slice(0, 4).toString('ascii');
    expect(pdfSignature).toBe('%PDF');

    // Verify content contains expected names
    const pdfText = pdfBuffer.toString('latin1');
    expect(pdfText).toContain('Alice');
    expect(pdfText).toContain('Bob');
    expect(pdfText).toContain('Diana');
  });
});
