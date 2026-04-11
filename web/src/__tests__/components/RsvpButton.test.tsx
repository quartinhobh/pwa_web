import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/services/api', () => ({
  submitRsvpGuest: vi.fn().mockResolvedValue({
    entry: {
      status: 'confirmed',
      plusOne: false,
      plusOneName: null,
      email: 'x@y.com',
      displayName: 'X',
      authMode: 'guest',
      createdAt: 1,
      updatedAt: 1,
    },
    entryKey: 'guest:abc',
  }),
}));

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  auth: {},
}));

import { RsvpButton } from '@/components/rsvp/RsvpButton';
import type { RsvpConfig, RsvpSummary, RsvpEntry } from '@/types';

const baseConfig: RsvpConfig = {
  enabled: true,
  capacity: 30,
  waitlistEnabled: true,
  plusOneAllowed: false,
  approvalMode: 'auto',
  opensAt: null,
  closesAt: null,
};

const baseSummary: RsvpSummary = {
  confirmedCount: 5,
  waitlistCount: 0,
  capacity: 30,
  confirmedAvatars: [],
};

const confirmedEntry: RsvpEntry = {
  status: 'confirmed',
  plusOne: false,
  plusOneName: null,
  email: 'a@test.com',
  displayName: 'A',
  authMode: 'firebase',
  createdAt: 1,
  updatedAt: 1,
};

const waitlistedEntry: RsvpEntry = {
  status: 'waitlisted',
  plusOne: false,
  plusOneName: null,
  email: 'a@test.com',
  displayName: 'A',
  authMode: 'firebase',
  createdAt: 1,
  updatedAt: 1,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('RsvpButton', () => {
  it('shows "confirmar presença" button when open, authenticated, not full', () => {
    render(
      <RsvpButton
        config={baseConfig}
        summary={baseSummary}
        userEntry={null}
        isAuthenticated={true}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /confirmar presença/i })).toBeInTheDocument();
  });

  it('renders guest RsvpForm when not authenticated and eventId provided', () => {
    render(
      <RsvpButton
        config={baseConfig}
        summary={baseSummary}
        userEntry={null}
        isAuthenticated={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        eventId="evt-1"
      />,
    );
    expect(screen.getByLabelText('nome')).toBeInTheDocument();
    expect(screen.getByLabelText('email')).toBeInTheDocument();
  });

  it('shows configuração inválida when guest but no eventId', () => {
    render(
      <RsvpButton
        config={baseConfig}
        summary={baseSummary}
        userEntry={null}
        isAuthenticated={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/configuração inválida/i)).toBeInTheDocument();
  });

  it('shows "esgotado" when full and no waitlist', () => {
    render(
      <RsvpButton
        config={{ ...baseConfig, waitlistEnabled: false }}
        summary={{ ...baseSummary, confirmedCount: 30 }}
        userEntry={null}
        isAuthenticated={true}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('esgotado')).toBeInTheDocument();
  });

  it('shows "entrar na fila de espera" when full but waitlist enabled', () => {
    render(
      <RsvpButton
        config={{ ...baseConfig, waitlistEnabled: true }}
        summary={{ ...baseSummary, confirmedCount: 30 }}
        userEntry={null}
        isAuthenticated={true}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /entrar na fila de espera/i })).toBeInTheDocument();
  });

  it('shows "presença confirmada" + cancel button when user has confirmed entry', () => {
    render(
      <RsvpButton
        config={baseConfig}
        summary={baseSummary}
        userEntry={confirmedEntry}
        isAuthenticated={true}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('presença confirmada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('shows "na fila de espera" when user has waitlisted entry', () => {
    render(
      <RsvpButton
        config={baseConfig}
        summary={baseSummary}
        userEntry={waitlistedEntry}
        isAuthenticated={true}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('na fila de espera')).toBeInTheDocument();
  });

  it('shows "inscrições encerradas" when window closed (closesAt in the past)', () => {
    render(
      <RsvpButton
        config={{ ...baseConfig, closesAt: Date.now() - 10000 }}
        summary={baseSummary}
        userEntry={null}
        isAuthenticated={true}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/inscrições encerradas/i)).toBeInTheDocument();
  });

  it('calls onSubmit when button clicked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <RsvpButton
        config={baseConfig}
        summary={baseSummary}
        userEntry={null}
        isAuthenticated={true}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /confirmar presença/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  });

  it('calls onCancel when cancel clicked', async () => {
    const onCancel = vi.fn().mockResolvedValue(undefined);
    render(
      <RsvpButton
        config={baseConfig}
        summary={baseSummary}
        userEntry={confirmedEntry}
        isAuthenticated={true}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
  });

  it('shows opening date when opensAt is in the future', () => {
    const futureConfig = { ...baseConfig, opensAt: Date.now() + 86400000 }; // +1 day
    render(
      <RsvpButton
        config={futureConfig}
        summary={baseSummary}
        userEntry={null}
        isAuthenticated={true}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/inscrições abrem em/i)).toBeInTheDocument();
  });

  it('shows +1 checkbox when plusOneAllowed', () => {
    render(
      <RsvpButton
        config={{ ...baseConfig, plusOneAllowed: true }}
        summary={baseSummary}
        userEntry={null}
        isAuthenticated={true}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText(/levar \+1/i)).toBeInTheDocument();
  });
});
