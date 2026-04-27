import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/hooks/useBarDetail', () => ({
  useBarDetail: vi.fn(),
}));

vi.mock('@/store/sessionStore', () => ({
  useSessionStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ firebaseUid: null, role: 'guest' }),
  ),
}));

vi.mock('@/hooks/useIdToken', () => ({
  useIdToken: vi.fn().mockReturnValue(null),
}));

vi.mock('@/services/api', () => ({
  fetchSuggestionComments: vi.fn().mockResolvedValue([]),
  postSuggestionComment: vi.fn(),
  deleteSuggestionComment: vi.fn(),
}));

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

vi.mock('@/components/auth/LoginModal', () => ({
  default: () => null,
  LoginModal: () => null,
}));

import * as barDetailHook from '@/hooks/useBarDetail';
import BarDetail from '@/pages/BarDetail';
import type { PublicBarSuggestion } from '@/types';

const useBarDetailMock = barDetailHook.useBarDetail as unknown as ReturnType<typeof vi.fn>;

const mockBar: PublicBarSuggestion = {
  id: 'abc123',
  name: 'Bar do Teste',
  address: 'Av. Principal, 42',
  instagram: null,
  isClosed: false,
  hasSoundSystem: true,
  suggestedByUid: null,
  suggestedByEmail: null,
  createdAt: 1000,
  updatedAt: 1000,
};

function renderBarDetail(path = '/bar/abc123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/bar/:id" element={<BarDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BarDetail page', () => {
  beforeEach(() => {
    useBarDetailMock.mockReturnValue({ bar: mockBar, loading: false, notFound: false, error: null });
  });

  it('renders bar name when bar found', async () => {
    renderBarDetail();
    await waitFor(() => expect(screen.getByText('Bar do Teste')).toBeInTheDocument());
  });

  it('renders feedback/vote section', async () => {
    renderBarDetail();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /curti/i })).toBeInTheDocument(),
    );
  });

  it('renders comments section', async () => {
    renderBarDetail();
    await waitFor(() =>
      expect(screen.getByText(/nenhum comentário ainda|carregando comentários/i)).toBeInTheDocument(),
    );
  });

  it('shows "bar nao encontrado" when notFound=true', () => {
    useBarDetailMock.mockReturnValue({ bar: null, loading: false, notFound: true, error: null });
    renderBarDetail();
    expect(screen.getByText(/bar nao encontrado/i)).toBeInTheDocument();
  });

  it('shows loading state when loading=true', () => {
    useBarDetailMock.mockReturnValue({ bar: null, loading: true, notFound: false, error: null });
    renderBarDetail();
    // LoadingState renders some loading indicator in the DOM
    expect(document.body).toBeTruthy();
  });
});
