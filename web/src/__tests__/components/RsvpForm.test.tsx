import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/services/api', () => ({
  submitRsvpGuest: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  auth: {},
}));

import * as api from '@/services/api';
import RsvpForm from '@/components/rsvp/RsvpForm';

const submitMock = api.submitRsvpGuest as unknown as ReturnType<typeof vi.fn>;

function fillAndSubmit(name = 'Ana', email = 'ana@x.com') {
  fireEvent.change(screen.getByLabelText('nome'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('email'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: /confirmar presença/i }));
}

describe('RsvpForm', () => {
  beforeEach(() => {
    submitMock.mockReset();
  });

  it('renders required inputs and submit button', () => {
    render(<RsvpForm eventId="e1" isOpen onClose={() => {}} />);
    expect(screen.getByLabelText('nome')).toBeInTheDocument();
    expect(screen.getByLabelText('email')).toBeInTheDocument();
    expect(screen.getByLabelText(/levar \+1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar presença/i })).toBeInTheDocument();
  });

  it('shows +1 name input only when +1 checked', () => {
    render(<RsvpForm eventId="e1" isOpen onClose={() => {}} />);
    expect(screen.queryByLabelText(/nome do acompanhante/i)).toBeNull();
    fireEvent.click(screen.getByLabelText(/levar \+1/i));
    expect(screen.getByLabelText(/nome do acompanhante/i)).toBeInTheDocument();
  });

  it('calls submitRsvpGuest and shows confirmed success state', async () => {
    submitMock.mockResolvedValue({
      entry: {
        status: 'confirmed',
        plusOne: false,
        plusOneName: null,
        email: 'ana@x.com',
        displayName: 'Ana',
        authMode: 'guest',
        createdAt: 1,
        updatedAt: 1,
      },
      entryKey: 'guest:hash',
    });

    render(<RsvpForm eventId="e1" isOpen onClose={() => {}} />);
    fillAndSubmit();

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith('e1', expect.objectContaining({
        email: 'ana@x.com',
        displayName: 'Ana',
      }));
    });
    const matches = await screen.findAllByText(/você está na lista/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows waitlisted success copy', async () => {
    submitMock.mockResolvedValue({
      entry: {
        status: 'waitlisted',
        plusOne: false,
        plusOneName: null,
        email: 'a@x.com',
        displayName: 'A',
        authMode: 'guest',
        createdAt: 1,
        updatedAt: 1,
      },
      entryKey: 'guest:abc',
    });
    render(<RsvpForm eventId="e1" isOpen onClose={() => {}} />);
    fillAndSubmit();
    expect(await screen.findByText(/tá na fila/i)).toBeInTheDocument();
  });

  it('maps event_full error to friendly message', async () => {
    submitMock.mockRejectedValue(new Error('event_full'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<RsvpForm eventId="e1" isOpen onClose={() => {}} />);
    fillAndSubmit();
    expect(await screen.findByText(/evento lotou/i)).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it('maps email_already_rsvped to friendly message', async () => {
    submitMock.mockRejectedValue(new Error('email_already_rsvped'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<RsvpForm eventId="e1" isOpen onClose={() => {}} />);
    fillAndSubmit();
    expect(await screen.findByText(/esse email já confirmou/i)).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it('shows generic message on unknown error', async () => {
    submitMock.mockRejectedValue(new Error('weird_backend_error'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<RsvpForm eventId="e1" isOpen onClose={() => {}} />);
    fillAndSubmit();
    expect(await screen.findByText(/não foi possível confirmar/i)).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it('calls onSuccess callback on submit success', async () => {
    submitMock.mockResolvedValue({
      entry: {
        status: 'confirmed',
        plusOne: false,
        plusOneName: null,
        email: 'a@x.com',
        displayName: 'A',
        authMode: 'guest',
        createdAt: 1,
        updatedAt: 1,
      },
      entryKey: 'guest:abc',
    });
    const onSuccess = vi.fn();
    render(<RsvpForm eventId="e1" isOpen onClose={() => {}} onSuccess={onSuccess} />);
    fillAndSubmit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });
});
