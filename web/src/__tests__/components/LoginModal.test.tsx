import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  OAuthProvider: vi.fn(() => ({ addScope: vi.fn() })),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
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

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signInWithGoogle: vi.fn(),
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
  }),
}));

import * as firebaseAuth from 'firebase/auth';
import { LoginModal } from '@/components/auth/LoginModal';

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
