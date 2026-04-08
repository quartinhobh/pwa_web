// emailTemplateService tests.
// Pure-function and Firestore-mocked tests run unconditionally.
// Tests that require actual Firestore are gated behind FIRESTORE_EMULATOR_HOST.

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mock Firestore via the firebase config module ────────────────────────────

const mockDocGet = vi.fn();
const mockCollectionGet = vi.fn();
const mockDocSet = vi.fn();

vi.mock('../config/firebase', () => {
  const makeDoc = (id: string, data?: Record<string, unknown>) => ({
    exists: !!data,
    id,
    data: () => data,
  });

  const makeDocRef = (id: string, storedData?: Record<string, unknown>) => ({
    get: () => Promise.resolve(mockDocGet(id) ?? makeDoc(id, storedData)),
    set: (...args: unknown[]) => Promise.resolve(mockDocSet(id, ...args)),
  });

  return {
    adminDb: {
      collection: () => ({
        doc: (id: string) => makeDocRef(id),
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
} from '../services/emailTemplateService';
import type { EmailTemplateKey } from '../types';

beforeEach(() => {
  vi.resetAllMocks();
});

// ── DEFAULTS structure ────────────────────────────────────────────────────────

describe('ALL_KEYS', () => {
  it('contains all 6 template keys', () => {
    const expected: EmailTemplateKey[] = [
      'confirmation',
      'waitlist',
      'promotion',
      'reminder',
      'venue_reveal',
      'rejected',
    ];
    expect(ALL_KEYS).toEqual(expected);
  });
});

describe('EMAIL_TEMPLATE_DESCRIPTIONS', () => {
  it('has a description for all 6 keys', () => {
    const keys: EmailTemplateKey[] = [
      'confirmation',
      'waitlist',
      'promotion',
      'reminder',
      'venue_reveal',
      'rejected',
    ];
    for (const key of keys) {
      expect(EMAIL_TEMPLATE_DESCRIPTIONS[key]).toBeTruthy();
      expect(typeof EMAIL_TEMPLATE_DESCRIPTIONS[key]).toBe('string');
    }
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
  it('returns 6 templates using defaults when collection is empty', async () => {
    mockCollectionGet.mockReturnValue({ docs: [] });

    const result = await getAllTemplates();

    expect(result).toHaveLength(6);
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

    expect(result).toHaveLength(6);
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
