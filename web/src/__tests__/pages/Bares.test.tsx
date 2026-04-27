import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useBarSuggestions', () => ({
  useBarSuggestions: vi.fn(),
}));

vi.mock('@/store/sessionStore', () => ({
  useSessionStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ firebaseUid: null, role: 'guest' }),
  ),
}));

vi.mock('@/hooks/useIdToken', () => ({
  useIdToken: vi.fn().mockReturnValue(null),
}));

// BarFeedbackButtons uses useBarFeedback — mock it to keep test self-contained
vi.mock('@/hooks/useBarFeedback', () => ({
  useBarFeedback: vi.fn(() => ({
    likedCount: 0,
    dislikedCount: 0,
    userVote: null,
    handleVote: vi.fn(),
    handleRemoveVote: vi.fn(),
    loading: false,
    error: null,
  })),
}));

// Mock LoginModal to avoid complex auth dependencies in page test
vi.mock('@/components/auth/LoginModal', () => ({
  default: () => null,
  LoginModal: () => null,
}));

import * as barSuggestionsHook from '@/hooks/useBarSuggestions';
import Bares from '@/pages/Bares';
import type { PublicBarSuggestion } from '@/types';

const useBarSuggestionsMock = barSuggestionsHook.useBarSuggestions as unknown as ReturnType<
  typeof vi.fn
>;

const makeBars = (): PublicBarSuggestion[] => [
  {
    id: 'bar-1',
    name: 'Bar do Samba',
    address: 'Rua A, 1',
    instagram: null,
    isClosed: false,
    hasSoundSystem: true,
    suggestedByUid: null,
    suggestedByEmail: null,
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: 'bar-2',
    name: 'Bar da Esquina',
    address: null,
    instagram: null,
    isClosed: false,
    hasSoundSystem: false,
    suggestedByUid: null,
    suggestedByEmail: null,
    createdAt: 1001,
    updatedAt: 1001,
  },
];

beforeEach(() => {
  useBarSuggestionsMock.mockReturnValue({
    bars: makeBars(),
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
});

describe('Bares page', () => {
  it('renders heading "bares"', () => {
    render(
      <MemoryRouter>
        <Bares />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /bares/i })).toBeInTheDocument();
  });

  it('renders bar cards for each bar in mock data', async () => {
    render(
      <MemoryRouter>
        <Bares />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Bar do Samba')).toBeInTheDocument();
      expect(screen.getByText('Bar da Esquina')).toBeInTheDocument();
    });
  });

  it('each card contains a "ver detalhes" link to /bar/:id', async () => {
    render(
      <MemoryRouter>
        <Bares />
      </MemoryRouter>,
    );
    await waitFor(() => {
      const links = screen.getAllByRole('link');
      const barLinks = links.filter((l) => l.getAttribute('href')?.startsWith('/bar/'));
      expect(barLinks.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('"indicar bar" button is present', () => {
    render(
      <MemoryRouter>
        <Bares />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /indicar bar/i })).toBeInTheDocument();
  });
});
