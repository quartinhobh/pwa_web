import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  connectAuthEmulator: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  firebaseApp: {},
  auth: {},
  firestore: {},
  realtimeDb: {},
  storage: {},
}));

import * as firebaseAuth from 'firebase/auth';
import ResetPassword from '@/pages/ResetPassword';

const verifyMock = firebaseAuth.verifyPasswordResetCode as unknown as ReturnType<typeof vi.fn>;
const confirmMock = firebaseAuth.confirmPasswordReset as unknown as ReturnType<typeof vi.fn>;

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResetPassword page', () => {
  beforeEach(() => {
    verifyMock.mockReset();
    confirmMock.mockReset();
  });

  it('shows expired message when oobCode is missing', async () => {
    renderAt('/reset-password');
    expect(await screen.findByText(/link expirado/i)).toBeInTheDocument();
  });

  it('shows expired message when verify fails', async () => {
    verifyMock.mockRejectedValueOnce(new Error('invalid'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderAt('/reset-password?mode=resetPassword&oobCode=bad');
    expect(await screen.findByText(/link expirado/i)).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it('shows form, validates match + min length, and confirms reset', async () => {
    verifyMock.mockResolvedValueOnce('user@example.com');
    confirmMock.mockResolvedValueOnce(undefined);

    renderAt('/reset-password?mode=resetPassword&oobCode=good');

    const newPw = await screen.findByLabelText('nova senha');
    const confirmPw = screen.getByLabelText('confirmar senha');
    const submit = screen.getByRole('button', { name: /redefinir senha/i });

    // Mismatch
    fireEvent.change(newPw, { target: { value: 'abcdef' } });
    fireEvent.change(confirmPw, { target: { value: 'ghijkl' } });
    fireEvent.click(submit);
    expect(await screen.findByText(/não batem/i)).toBeInTheDocument();
    expect(confirmMock).not.toHaveBeenCalled();

    // Successful
    fireEvent.change(confirmPw, { target: { value: 'abcdef' } });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(expect.anything(), 'good', 'abcdef');
    });
    expect(await screen.findByText(/senha redefinida/i)).toBeInTheDocument();
  });
});
