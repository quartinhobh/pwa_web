import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  OAuthProvider: vi.fn(() => ({ addScope: vi.fn() })),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(),
  connectAuthEmulator: vi.fn(),
  onAuthStateChanged: vi.fn(() => () => {}),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/services/firebase', () => ({
  firebaseApp: {},
  auth: {},
  firestore: {},
  realtimeDb: {},
  storage: {},
}));

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signInWithGoogle: vi.fn(),
    signInWithEmail: (...args: unknown[]) => mockSignIn(...args),
    signUpWithEmail: (...args: unknown[]) => mockSignUp(...args),
  }),
}));

import * as firebaseAuth from 'firebase/auth';
import { LoginModal, mapAuthError } from '@/components/auth/LoginModal';

const sendResetMock = firebaseAuth.sendPasswordResetEmail as unknown as ReturnType<typeof vi.fn>;

describe('LoginModal — forgot password', () => {
  beforeEach(() => {
    sendResetMock.mockClear();
    sendResetMock.mockResolvedValue(undefined);
  });

  it('shows "esqueceu a senha?" link in login view and transitions to forgot view', () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /entrar com email/i }));

    const link = screen.getByRole('button', { name: /esqueceu a senha/i });
    expect(link).toBeInTheDocument();

    fireEvent.click(link);

    expect(screen.getByRole('button', { name: /enviar link de recuperação/i })).toBeInTheDocument();
    // signup button should NOT be visible in forgot view
    expect(screen.queryByRole('button', { name: /criar conta nova/i })).toBeNull();
  });

  it('does NOT show "esqueceu a senha?" in signup view', () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /entrar com email/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta nova/i }));

    expect(screen.queryByRole('button', { name: /esqueceu a senha/i })).toBeNull();
  });

  it('submits forgot form and shows privacy-preserving success message', async () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /entrar com email/i }));
    fireEvent.click(screen.getByRole('button', { name: /esqueceu a senha/i }));

    fireEvent.change(screen.getByLabelText('email'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar link de recuperação/i }));

    await waitFor(() => {
      expect(sendResetMock).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        expect.objectContaining({ url: expect.stringContaining('/reset-password') }),
      );
    });

    expect(await screen.findByText(/se o email existir/i)).toBeInTheDocument();
  });

  it('shows generic error on failure without exposing firebase details', async () => {
    sendResetMock.mockRejectedValueOnce(new Error('Firebase: auth/user-not-found'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<LoginModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /entrar com email/i }));
    fireEvent.click(screen.getByRole('button', { name: /esqueceu a senha/i }));

    fireEvent.change(screen.getByLabelText('email'), {
      target: { value: 'nope@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar link de recuperação/i }));

    expect(await screen.findByText(/não foi possível enviar agora/i)).toBeInTheDocument();
    expect(screen.queryByText(/auth\/user-not-found/i)).toBeNull();
    errSpy.mockRestore();
  });
});

describe('mapAuthError', () => {
  it('signin collapses every code to a generic message', () => {
    expect(mapAuthError('auth/wrong-password', 'signin')).toBe('email ou senha incorretos');
    expect(mapAuthError('auth/user-not-found', 'signin')).toBe('email ou senha incorretos');
    expect(mapAuthError('', 'signin')).toBe('email ou senha incorretos');
  });

  it('signup maps weak-password to the 8-char hint', () => {
    expect(mapAuthError('auth/weak-password', 'signup')).toMatch(/8 caracteres/);
  });

  it('signup maps invalid-email', () => {
    expect(mapAuthError('auth/invalid-email', 'signup')).toBe('email inválido');
  });

  it('signup hides email-already-in-use behind a generic message', () => {
    expect(mapAuthError('auth/email-already-in-use', 'signup')).toBe(
      'não foi possível criar conta com esses dados',
    );
  });
});

describe('LoginModal — signup flow hardening', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockSignUp.mockReset();
  });

  it('blocks signup submit when password < 8 chars with a friendly message', async () => {
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /entrar com email/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta nova/i }));

    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'u@ex.com' } });
    const pw = screen.getByLabelText('password') as HTMLInputElement;
    // Native minLength would also block, but remove the attribute so our JS guard runs.
    pw.removeAttribute('minLength');
    fireEvent.change(pw, { target: { value: 'short' } });
    fireEvent.submit(pw.closest('form') as HTMLFormElement);

    expect(await screen.findByText(/8 caracteres/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows verification-sent screen after successful signup', async () => {
    mockSignUp.mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(<LoginModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /entrar com email/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta nova/i }));

    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'u@ex.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'abcdefgh' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByText(/enviamos um link de verificação/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('maps firebase signup error to generic message (no raw code leak)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSignUp.mockRejectedValueOnce(
      Object.assign(new Error('Firebase: auth/email-already-in-use'), {
        code: 'auth/email-already-in-use',
      }),
    );
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /entrar com email/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta nova/i }));

    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'u@ex.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'abcdefgh' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByText(/não foi possível criar conta/i)).toBeInTheDocument();
    expect(screen.queryByText(/email-already-in-use/)).toBeNull();
    errSpy.mockRestore();
  });

  it('maps signin failure to generic "email ou senha incorretos"', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSignIn.mockRejectedValueOnce(
      Object.assign(new Error('Firebase: auth/wrong-password'), {
        code: 'auth/wrong-password',
      }),
    );
    render(<LoginModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /entrar com email/i }));

    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'u@ex.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'whatever' } });
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByText(/email ou senha incorretos/i)).toBeInTheDocument();
    expect(screen.queryByText(/wrong-password/)).toBeNull();
    errSpy.mockRestore();
  });
});
