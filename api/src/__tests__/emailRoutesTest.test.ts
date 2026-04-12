// Unit tests for POST /email/templates/:key/test route.
// Mocks emailService + roleCheck/auth + firebase so nothing hits the network.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── mocks ────────────────────────────────────────────────────────────

const mockSendEmail = vi.fn();
const mockWrapTemplate = vi.fn((html: string) => `<wrapped>${html}</wrapped>`);

vi.mock('../services/emailService', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  sendBulk: vi.fn(),
  wrapTemplate: (html: string) => mockWrapTemplate(html),
  getLimitsInfo: () => ({ dailyRemaining: 100, monthlyRemaining: 1000 }),
  verifyUnsubscribeToken: () => true,
  DAILY_SEND_LIMIT: 300,
  MONTHLY_SEND_LIMIT: 9000,
  MAX_GROUP_SIZE: 50,
}));

vi.mock('../config/firebase', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false, data: () => undefined }),
        set: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        update: () => Promise.resolve(),
      }),
      get: () => Promise.resolve({ docs: [] }),
    }),
  },
  adminAuth: {},
}));

// Control vars for auth/role mocks
let currentUser: { uid: string; email?: string } | null = null;
let currentRole: 'admin' | 'user' | null = null;

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!currentUser) {
      res.status(401).json({ error: 'missing_token' });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).user = currentUser;
    next();
  },
  optionalAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware/roleCheck', () => ({
  requireRole: () => (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (currentRole !== 'admin') {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  },
}));

// Import router AFTER mocks are set
import { emailRouter } from '../routes/email';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/email', emailRouter);
  return app;
}

beforeEach(() => {
  mockSendEmail.mockReset();
  mockWrapTemplate.mockClear();
  currentUser = { uid: 'admin-uid', email: 'admin@test.com' };
  currentRole = 'admin';
});

describe('POST /email/templates/:key/test', () => {
  it('rejects invalid key with 400', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/email/templates/not_a_key/test')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_key');
  });

  it('rejects non-admin with 403', async () => {
    currentRole = 'user';
    const app = buildApp();
    const res = await request(app)
      .post('/email/templates/confirmation/test')
      .send({});
    expect(res.status).toBe(403);
  });

  it('returns 400 no_recipient when no email and user has no email', async () => {
    currentUser = { uid: 'admin-uid' }; // no email
    const app = buildApp();
    const res = await request(app)
      .post('/email/templates/confirmation/test')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_recipient');
  });

  it('sends using admin email when body.email omitted and returns sentTo', async () => {
    mockSendEmail.mockResolvedValue(undefined);
    const app = buildApp();
    const res = await request(app)
      .post('/email/templates/confirmation/test')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.sentTo).toBe('admin@test.com');
    expect(typeof res.body.sentAt).toBe('number');
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [to, subject] = mockSendEmail.mock.calls[0]!;
    expect(to).toBe('admin@test.com');
    expect(subject).toMatch(/^\[TESTE\]/);
  });

  it('accepts body.email override', async () => {
    mockSendEmail.mockResolvedValue(undefined);
    const app = buildApp();
    const res = await request(app)
      .post('/email/templates/confirmation/test')
      .send({ email: 'other@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.sentTo).toBe('other@test.com');
  });

  it('accepts subjectOverride and bodyOverride and interpolates sample vars', async () => {
    mockSendEmail.mockResolvedValue(undefined);
    const app = buildApp();
    const res = await request(app)
      .post('/email/templates/confirmation/test')
      .send({
        subjectOverride: 'custom {nome}',
        bodyOverride: 'linha 1\nlinha 2 {evento}',
      });
    expect(res.status).toBe(200);
    const [, subject, html] = mockSendEmail.mock.calls[0]!;
    expect(subject).toContain('custom Você (teste)');
    expect(html).toContain('linha 1<br>linha 2');
    expect(html).toContain('Pink Floyd');
  });

  it('returns 500 send_failed when sendEmail throws', async () => {
    mockSendEmail.mockRejectedValue(new Error('brevo down'));
    const app = buildApp();
    const res = await request(app)
      .post('/email/templates/confirmation/test')
      .send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('send_failed');
  });
});
