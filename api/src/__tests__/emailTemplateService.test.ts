// emailTemplateService tests.
// Pure-function and Firestore-mocked tests run unconditionally.
// Tests that require actual Firestore are gated behind FIRESTORE_EMULATOR_HOST.

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mock Firestore via the firebase config module ────────────────────────────

const mockDocGet = vi.fn();
const mockCollectionGet = vi.fn();
const mockDocSet = vi.fn();
// Per-collection doc getter: allows tests to mock template + config separately.
const mockDocGetByCollection: Record<string, (id: string) => unknown> = {};

vi.mock('../config/firebase', () => {
  const makeDoc = (id: string, data?: Record<string, unknown>) => ({
    exists: !!data,
    id,
    data: () => data,
  });

  const makeDocRef = (collectionName: string, id: string, storedData?: Record<string, unknown>) => ({
    get: () => {
      const scoped = mockDocGetByCollection[collectionName];
      if (scoped) return Promise.resolve(scoped(id));
      return Promise.resolve(mockDocGet(id) ?? makeDoc(id, storedData));
    },
    set: (...args: unknown[]) => Promise.resolve(mockDocSet(id, ...args)),
  });

  return {
    adminDb: {
      collection: (collectionName: string) => ({
        doc: (id: string) => makeDocRef(collectionName, id),
        get: () => Promise.resolve(mockCollectionGet()),
      }),
    },
    adminAuth: {},
  };
});

import {
  ALL_KEYS,
  EMAIL_TEMPLATE_DESCRIPTIONS,
  getAllTemplates,
  getEffectiveTemplate,
  updateTemplate,
  buildRsvpEmail,
  buildRawTemplate,
  isTemplateSendable,
  interpolate,
} from '../services/emailTemplateService';
import type { EmailTemplateKey } from '../types';

beforeEach(() => {
  vi.resetAllMocks();
  for (const k of Object.keys(mockDocGetByCollection)) delete mockDocGetByCollection[k];
});

// Helper: wires the mocked Firestore so that template reads and email_config reads
// return distinct payloads, matching how isTemplateSendable calls both collections.
function wireTemplateAndConfig(opts: {
  templateEnabled: boolean;
  pauseAllTransactional: boolean;
}) {
  mockDocGetByCollection.emailTemplates = () => ({
    exists: true,
    data: () => ({
      enabled: opts.templateEnabled,
      subject: 'subj',
      body: 'body {nome}',
      updatedAt: 0,
      updatedBy: 'system',
    }),
  });
  mockDocGetByCollection.email_config = () => ({
    exists: true,
    data: () => ({
      autoEventEmail: true,
      pauseAllTransactional: opts.pauseAllTransactional,
    }),
  });
}

// ── DEFAULTS structure ────────────────────────────────────────────────────────

describe('ALL_KEYS', () => {
  it('contains all template keys including event_cancelled and event_broadcast', () => {
    const expected: EmailTemplateKey[] = [
      'confirmation',
      'waitlist',
      'promotion',
      'reminder',
      'venue_reveal',
      'rejected',
      'role_invite',
      'role_promotion',
      'event_cancelled',
      'event_broadcast',
    ];
    expect(ALL_KEYS).toEqual(expected);
  });
});

describe('EMAIL_TEMPLATE_DESCRIPTIONS', () => {
  it('has a description for all keys', () => {
    const keys: EmailTemplateKey[] = [
      'confirmation',
      'waitlist',
      'promotion',
      'reminder',
      'venue_reveal',
      'rejected',
      'role_invite',
      'role_promotion',
      'event_cancelled',
      'event_broadcast',
    ];
    for (const key of keys) {
      expect(EMAIL_TEMPLATE_DESCRIPTIONS[key]).toBeTruthy();
      expect(typeof EMAIL_TEMPLATE_DESCRIPTIONS[key]).toBe('string');
    }
  });
});

describe('event_cancelled / event_broadcast respect master switch', () => {
  it('event_cancelled returns false when master switch is on (not in CRITICAL_KEYS)', async () => {
    wireTemplateAndConfig({ templateEnabled: true, pauseAllTransactional: true });
    expect(await isTemplateSendable('event_cancelled')).toBe(false);
  });

  it('event_broadcast returns false when master switch is on (not in CRITICAL_KEYS)', async () => {
    wireTemplateAndConfig({ templateEnabled: true, pauseAllTransactional: true });
    expect(await isTemplateSendable('event_broadcast')).toBe(false);
  });

  it('event_cancelled returns true when master switch off and template enabled', async () => {
    wireTemplateAndConfig({ templateEnabled: true, pauseAllTransactional: false });
    expect(await isTemplateSendable('event_cancelled')).toBe(true);
  });
});

// ── getEffectiveTemplate — returns defaults when Firestore has no doc ─────────

describe('getEffectiveTemplate', () => {
  it('returns default template when Firestore has no stored doc', async () => {
    // mockDocGet returns undefined → doc.exists = false via the mock
    mockDocGet.mockReturnValue({ exists: false, data: () => undefined });

    const result = await getEffectiveTemplate('confirmation');

    expect(result.key).toBe('confirmation');
    expect(result.enabled).toBe(true);
    expect(result.subject).toContain('{evento}');
    expect(result.body).toContain('{nome}');
  });

  it('returns stored template when Firestore has a doc', async () => {
    mockDocGet.mockReturnValue({
      exists: true,
      data: () => ({
        enabled: false,
        subject: 'custom subject',
        body: 'custom body',
        updatedAt: 999,
        updatedBy: 'admin-uid',
      }),
    });

    const result = await getEffectiveTemplate('confirmation');

    expect(result.key).toBe('confirmation');
    expect(result.enabled).toBe(false);
    expect(result.subject).toBe('custom subject');
    expect(result.body).toBe('custom body');
  });
});

// ── getAllTemplates — merges Firestore + defaults ──────────────────────────────

describe('getAllTemplates', () => {
  it('returns templates using defaults when collection is empty', async () => {
    mockCollectionGet.mockReturnValue({ docs: [] });

    const result = await getAllTemplates();

    expect(result).toHaveLength(ALL_KEYS.length);
    expect(result.map((t) => t.key)).toEqual(ALL_KEYS);
  });

  it('merges stored docs with defaults', async () => {
    mockCollectionGet.mockReturnValue({
      docs: [
        {
          id: 'confirmation',
          data: () => ({
            enabled: false,
            subject: 'stored subject',
            body: 'stored body',
            updatedAt: 1,
            updatedBy: 'admin',
          }),
        },
      ],
    });

    const result = await getAllTemplates();

    expect(result).toHaveLength(ALL_KEYS.length);
    const confirmation = result.find((t) => t.key === 'confirmation');
    expect(confirmation?.enabled).toBe(false);
    expect(confirmation?.subject).toBe('stored subject');

    // Other keys use defaults
    const waitlist = result.find((t) => t.key === 'waitlist');
    expect(waitlist?.enabled).toBe(true);
  });
});

// ── updateTemplate ────────────────────────────────────────────────────────────

describe('updateTemplate', () => {
  it('merges patch with existing template and writes to Firestore', async () => {
    // getEffectiveTemplate will use default (doc.exists = false)
    mockDocGet.mockReturnValue({ exists: false, data: () => undefined });
    mockDocSet.mockResolvedValue(undefined);

    const result = await updateTemplate('confirmation', { subject: 'new subject' }, 'uid-123');

    expect(result.key).toBe('confirmation');
    expect(result.subject).toBe('new subject');
    // body should remain from default
    expect(result.body).toContain('{nome}');
    expect(result.updatedBy).toBe('uid-123');
    expect(result.updatedAt).toBeGreaterThan(0);
  });

  it('can toggle enabled flag', async () => {
    mockDocGet.mockReturnValue({ exists: false, data: () => undefined });
    mockDocSet.mockResolvedValue(undefined);

    const result = await updateTemplate('waitlist', { enabled: false }, 'uid-123');

    expect(result.enabled).toBe(false);
  });
});

// ── buildRsvpEmail — interpolation and disabled guard ────────────────────────

describe('buildRsvpEmail', () => {
  it('returns null when template is disabled', async () => {
    mockDocGet.mockReturnValue({
      exists: true,
      data: () => ({
        enabled: false,
        subject: 'subj',
        body: 'body',
        updatedAt: 0,
        updatedBy: 'system',
      }),
    });

    const result = await buildRsvpEmail('confirmation', { nome: 'Ana', evento: 'Q#1', data: '01/01', horario: '19h' });

    expect(result).toBeNull();
  });

  it('replaces {nome}, {evento}, {data}, {horario} in subject and body', async () => {
    mockDocGet.mockReturnValue({ exists: false, data: () => undefined });

    const result = await buildRsvpEmail('confirmation', {
      nome: 'Carlos',
      evento: 'Quartinho #5',
      data: '10/06/2026',
      horario: '20h',
    });

    expect(result).not.toBeNull();
    expect(result?.subject).toContain('Quartinho #5');
    expect(result?.bodyText).toContain('Carlos');
    expect(result?.bodyText).toContain('Quartinho #5');
    expect(result?.bodyText).toContain('10/06/2026');
    expect(result?.bodyText).toContain('20h');
  });

  it('replaces {local} for reminder template', async () => {
    mockDocGet.mockReturnValue({ exists: false, data: () => undefined });

    const result = await buildRsvpEmail('reminder', {
      nome: 'Bia',
      evento: 'Q#3',
      data: '05/05/2026',
      horario: '19h',
      local: 'Rua das Flores, 10',
    });

    expect(result).not.toBeNull();
    expect(result?.bodyText).toContain('Rua das Flores, 10');
  });

  it('leaves unresolved variables in place when variable not provided', async () => {
    mockDocGet.mockReturnValue({ exists: false, data: () => undefined });

    const result = await buildRsvpEmail('reminder', {
      nome: 'Bia',
      evento: 'Q#3',
      data: '05/05',
      horario: '19h',
      // local not provided
    });

    expect(result?.bodyText).toContain('{local}');
  });

  it('returns subject and bodyText strings when template is enabled', async () => {
    mockDocGet.mockReturnValue({ exists: false, data: () => undefined });

    const result = await buildRsvpEmail('confirmation', {
      nome: 'X',
      evento: 'Y',
      data: 'Z',
      horario: 'W',
    });

    expect(result).not.toBeNull();
    expect(typeof result?.subject).toBe('string');
    expect(typeof result?.bodyText).toBe('string');
  });
});

// ── interpolate — standalone exported helper ────────────────────────────

describe('interpolate', () => {
  it('replaces {var} from map', () => {
    expect(interpolate('oi {nome}!', { nome: 'Ana' })).toBe('oi Ana!');
  });
  it('leaves unknown vars in place', () => {
    expect(interpolate('oi {nome}, local: {local}', { nome: 'Ana' })).toBe('oi Ana, local: {local}');
  });
});

// ── buildRawTemplate — bypasses master switch + enabled flag ─────────────

describe('buildRawTemplate', () => {
  it('renders even when template is disabled', async () => {
    wireTemplateAndConfig({ templateEnabled: false, pauseAllTransactional: true });
    const result = await buildRawTemplate('confirmation', {
      nome: 'Teste',
      evento: 'E',
      data: 'D',
      horario: 'H',
    });
    expect(result).not.toBeNull();
    expect(result?.bodyText).toContain('Teste');
  });

  it('interpolates sample variables in subject and body', async () => {
    mockDocGet.mockReturnValue({ exists: false, data: () => undefined });
    const result = await buildRawTemplate('confirmation', {
      nome: 'Você',
      evento: 'Quartinho #42',
      data: 'qui',
      horario: '20h',
    });
    expect(result?.subject).toContain('Quartinho #42');
    expect(result?.bodyText).toContain('Você');
  });
});

// ── isTemplateSendable — master switch + template.enabled + role_* exception ──

describe('isTemplateSendable', () => {
  it('returns false when master switch is on and template is enabled (non-critical)', async () => {
    wireTemplateAndConfig({ templateEnabled: true, pauseAllTransactional: true });
    expect(await isTemplateSendable('confirmation')).toBe(false);
  });

  it('returns true when master switch is off and template is enabled', async () => {
    wireTemplateAndConfig({ templateEnabled: true, pauseAllTransactional: false });
    expect(await isTemplateSendable('confirmation')).toBe(true);
  });

  it('returns false when master switch is off but template is disabled', async () => {
    wireTemplateAndConfig({ templateEnabled: false, pauseAllTransactional: false });
    expect(await isTemplateSendable('confirmation')).toBe(false);
  });

  it('role_invite ignores master switch (sends when template is enabled)', async () => {
    wireTemplateAndConfig({ templateEnabled: true, pauseAllTransactional: true });
    expect(await isTemplateSendable('role_invite')).toBe(true);
  });

  it('role_promotion ignores master switch (sends when template is enabled)', async () => {
    wireTemplateAndConfig({ templateEnabled: true, pauseAllTransactional: true });
    expect(await isTemplateSendable('role_promotion')).toBe(true);
  });

  it('role_invite still blocked when its own template is disabled', async () => {
    wireTemplateAndConfig({ templateEnabled: false, pauseAllTransactional: false });
    expect(await isTemplateSendable('role_invite')).toBe(false);
  });
});
