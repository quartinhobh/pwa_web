// Unit tests for requireAuth — focused on the email_verified enforcement
// added during the auth hardening pass. Mocks firebase-admin so these run
// without emulator.

import { afterEach, describe, expect, it, vi } from 'vitest';

const verifyIdTokenMock = vi.fn();

vi.mock('../config/firebase', () => ({
  adminAuth: {
    verifyIdToken: (...args: unknown[]) => verifyIdTokenMock(...args),
  },
}));

import { requireAuth } from '../middleware/auth';
import type { Request, Response } from 'express';

function mkRes() {
  const res: Partial<Response> & { _status?: number; _json?: unknown } = {};
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res as Response;
  });
  res.json = vi.fn((body: unknown) => {
    res._json = body;
    return res as Response;
  });
  return res as Response & { _status?: number; _json?: unknown };
}

function mkReq(token: string | null): Request {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return { headers } as unknown as Request;
}

describe('requireAuth — email verification enforcement', () => {
  afterEach(() => {
    verifyIdTokenMock.mockReset();
  });

  it('rejects unverified password-provider tokens with 401 email_not_verified', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      uid: 'u1',
      email_verified: false,
      firebase: { sign_in_provider: 'password' },
    });
    const req = mkReq('tok');
    const res = mkRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'email_not_verified' });
  });

  it('allows verified password-provider tokens', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      uid: 'u2',
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    });
    const req = mkReq('tok');
    const res = mkRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res._status).toBeUndefined();
  });

  it('allows unverified google-provider tokens (OAuth is trusted)', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      uid: 'u3',
      email_verified: false,
      firebase: { sign_in_provider: 'google.com' },
    });
    const req = mkReq('tok');
    const res = mkRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects missing token with 401 missing_token', async () => {
    const req = mkReq(null);
    const res = mkRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'missing_token' });
  });

  it('rejects invalid token with 401 invalid_token', async () => {
    verifyIdTokenMock.mockRejectedValueOnce(new Error('bad'));
    const req = mkReq('tok');
    const res = mkRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'invalid_token' });
  });
});
