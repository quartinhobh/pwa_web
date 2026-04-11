import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  getAuth: vi.fn(() => ({})),
}));

vi.mock('@/services/firebase', () => ({
  auth: {},
}));

import * as firebaseAuth from 'firebase/auth';
import GuestUpsellModal from '@/components/rsvp/GuestUpsellModal';

const createMock = firebaseAuth.createUserWithEmailAndPassword as unknown as ReturnType<typeof vi.fn>;

describe('GuestUpsellModal', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('renders password form with prefilled email', () => {
    render(
      <GuestUpsellModal isOpen={true} onClose={vi.fn()} email="ana@x.com" displayName="Ana" />,
    );
    const emailInput = screen.getByLabelText('email') as HTMLInputElement;
    expect(emailInput.value).toBe('ana@x.com');
    expect(emailInput.disabled).toBe(true);
    expect(screen.getByLabelText('senha')).toBeInTheDocument();
    expect(screen.getByLabelText('confirmar senha')).toBeInTheDocument();
  });

  it('shows mismatch error when passwords differ', async () => {
    render(
      <GuestUpsellModal isOpen={true} onClose={vi.fn()} email="a@x.com" displayName="A" />,
    );
    fireEvent.change(screen.getByLabelText('senha'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('confirmar senha'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByText(/senhas não batem/i)).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('calls createUserWithEmailAndPassword with email+password on valid submit', async () => {
    createMock.mockResolvedValue({ user: { uid: 'new' } });
    render(
      <GuestUpsellModal isOpen={true} onClose={vi.fn()} email="a@x.com" displayName="A" />,
    );
    fireEvent.change(screen.getByLabelText('senha'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('confirmar senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(expect.anything(), 'a@x.com', '123456');
    });
    expect(await screen.findByText(/conta criada/i)).toBeInTheDocument();
  });

  it('maps auth/email-already-in-use to friendly message', async () => {
    const err = Object.assign(new Error('exists'), { code: 'auth/email-already-in-use' });
    createMock.mockRejectedValue(err);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <GuestUpsellModal isOpen={true} onClose={vi.fn()} email="a@x.com" displayName="A" />,
    );
    fireEvent.change(screen.getByLabelText('senha'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('confirmar senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByText(/já tem conta/i)).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it('shows generic error on unknown failure', async () => {
    createMock.mockRejectedValue(new Error('boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <GuestUpsellModal isOpen={true} onClose={vi.fn()} email="a@x.com" displayName="A" />,
    );
    fireEvent.change(screen.getByLabelText('senha'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('confirmar senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByText(/não foi possível criar/i)).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <GuestUpsellModal isOpen={true} onClose={onClose} email="a@x.com" displayName="A" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /fica pra próxima/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
