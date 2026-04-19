import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  fetchAdminRsvpList: vi.fn(),
  approveRejectRsvp: vi.fn(),
  exportRsvpCsv: vi.fn(),
  adminCancelRsvp: vi.fn(),
  moveRsvpToWaitlist: vi.fn(),
}));

import { RsvpPanel } from '@/components/admin/RsvpPanel';
import {
  fetchAdminRsvpList,
  approveRejectRsvp,
  adminCancelRsvp,
  moveRsvpToWaitlist,
} from '@/services/api';
import type { AdminRsvpEntry } from '@/types';

const makeMocks = () => ({
  fetchAdminRsvpList: fetchAdminRsvpList as Mock,
  approveRejectRsvp: approveRejectRsvp as Mock,
  adminCancelRsvp: adminCancelRsvp as Mock,
  moveRsvpToWaitlist: moveRsvpToWaitlist as Mock,
});

const confirmedEntry: AdminRsvpEntry = {
  entryKey: 'firebase:u1',
  userId: 'u1',
  displayName: 'Alice',
  email: 'alice@example.com',
  authMode: 'firebase',
  avatarUrl: null,
  status: 'confirmed',
  plusOne: false,
  plusOneName: null,
  createdAt: 1000000,
  updatedAt: 1000000,
};

const pendingEntry: AdminRsvpEntry = {
  entryKey: 'firebase:u2',
  userId: 'u2',
  displayName: 'Bruno',
  email: 'bruno@example.com',
  authMode: 'firebase',
  avatarUrl: null,
  status: 'pending_approval',
  plusOne: false,
  plusOneName: null,
  createdAt: 1000000,
  updatedAt: 1000000,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('RsvpPanel', () => {
  it('shows loading state initially, then renders entries after fetch', async () => {
    const { fetchAdminRsvpList: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue({ entries: [confirmedEntry], capacity: null });

    render(<RsvpPanel eventId="evt1" idToken="tok" />);

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getAllByText('Alice')[0]).toBeInTheDocument());
    expect(mockFetch).toHaveBeenCalledWith('evt1', 'tok');
  });

  it('shows "Nenhum registro." when no entries', async () => {
    const { fetchAdminRsvpList: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue({ entries: [], capacity: null });

    render(<RsvpPanel eventId="evt1" idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Nenhum registro.')).toBeInTheDocument());
  });

  it('filter tabs work — clicking "Confirmados" filters to confirmed only', async () => {
    const { fetchAdminRsvpList: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue({ entries: [confirmedEntry, pendingEntry], capacity: null });

    render(<RsvpPanel eventId="evt1" idToken="tok" />);

    await waitFor(() => expect(screen.getAllByText('Alice')[0]).toBeInTheDocument());
    expect(screen.getAllByText('Bruno')[0]).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmados' }));

    expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
    expect(screen.queryAllByText('Bruno').length).toBe(0);
  });

  it('renders authMode badges for guest vs firebase entries', async () => {
    const guestEntry: AdminRsvpEntry = {
      ...confirmedEntry,
      entryKey: 'guest:abc',
      userId: 'guest:abc',
      displayName: 'Carla',
      email: 'carla@example.com',
      authMode: 'guest',
    };
    const { fetchAdminRsvpList: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue({ entries: [confirmedEntry, guestEntry], capacity: null });

    render(<RsvpPanel eventId="evt1" idToken="tok" />);

    await waitFor(() => expect(screen.getAllByText('Alice')[0]).toBeInTheDocument());
    expect(screen.getByTestId('authmode-badge-u1')).toHaveTextContent('conta');
    expect(screen.getByTestId('authmode-badge-guest:abc')).toHaveTextContent('convidado');
  });

  it('shows approve/reject buttons for pending_approval entries', async () => {
    const { fetchAdminRsvpList: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue({ entries: [pendingEntry], capacity: null });

    render(<RsvpPanel eventId="evt1" idToken="tok" />);

    await waitFor(() => expect(screen.getAllByText('Bruno')[0]).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /aprovar/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /recusar/i })[0]).toBeInTheDocument();
  });

  it('calls approveRejectRsvp when approve button clicked', async () => {
    const { fetchAdminRsvpList: mockFetch, approveRejectRsvp: mockAction } = makeMocks();
    mockFetch.mockResolvedValue({ entries: [pendingEntry], capacity: null });
    mockAction.mockResolvedValue({ entry: { ...pendingEntry, status: 'confirmed' } });

    render(<RsvpPanel eventId="evt1" idToken="tok" />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: /aprovar/i })[0]).toBeInTheDocument());

    await userEvent.click(screen.getAllByRole('button', { name: /aprovar/i })[0]);

    await waitFor(() =>
      expect(mockAction).toHaveBeenCalledWith('evt1', 'firebase:u2', 'confirmed', 'tok'),
    );
  });

  it('search filters entries by name (case-insensitive substring)', async () => {
    const { fetchAdminRsvpList: mockFetch } = makeMocks();
    const maria: AdminRsvpEntry = {
      ...confirmedEntry,
      entryKey: 'firebase:u3',
      userId: 'u3',
      displayName: 'Maria',
      email: 'maria@example.com',
    };
    mockFetch.mockResolvedValue({
      entries: [confirmedEntry, pendingEntry, maria],
      capacity: null,
    });

    render(<RsvpPanel eventId="evt1" idToken="tok" />);

    await waitFor(() => expect(screen.getAllByText('Alice')[0]).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText(/buscar/i), 'ma');

    expect(screen.getAllByText('Maria')[0]).toBeInTheDocument();
    expect(screen.queryAllByText('Alice').length).toBe(0);
    expect(screen.queryAllByText('Bruno').length).toBe(0);
  });

  it('clicking Nome header toggles sort direction', async () => {
    const { fetchAdminRsvpList: mockFetch } = makeMocks();
    const alice: AdminRsvpEntry = { ...confirmedEntry, displayName: 'Alice', createdAt: 1 };
    const zelda: AdminRsvpEntry = {
      ...confirmedEntry,
      entryKey: 'firebase:u9',
      userId: 'u9',
      displayName: 'Zelda',
      createdAt: 2,
    };
    mockFetch.mockResolvedValue({ entries: [alice, zelda], capacity: null });

    render(<RsvpPanel eventId="evt1" idToken="tok" />);

    await waitFor(() => expect(screen.getAllByText('Alice')[0]).toBeInTheDocument());

    const header = screen.getByText(/Nome/i);
    await userEvent.click(header);
    expect(header.textContent).toContain('▲');
    await userEvent.click(header);
    expect(header.textContent).toContain('▼');
  });

  it('bulk approve calls approveRejectRsvp for each selected approvable entry', async () => {
    const { fetchAdminRsvpList: mockFetch, approveRejectRsvp: mockAction } = makeMocks();
    const p1: AdminRsvpEntry = { ...pendingEntry, entryKey: 'firebase:a', userId: 'a', displayName: 'A' };
    const p2: AdminRsvpEntry = { ...pendingEntry, entryKey: 'firebase:b', userId: 'b', displayName: 'B' };
    mockFetch.mockResolvedValue({ entries: [p1, p2], capacity: null });
    mockAction.mockResolvedValue({ entry: { ...pendingEntry, status: 'confirmed' } });
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<RsvpPanel eventId="evt1" idToken="tok" />);

    await waitFor(() => expect(screen.getAllByText('A')[0]).toBeInTheDocument());

    await userEvent.click(screen.getAllByLabelText('selecionar A')[0]);
    await userEvent.click(screen.getAllByLabelText('selecionar B')[0]);

    const bulkBtn = screen.getByRole('button', { name: /aprovar \(2\)/i });
    await userEvent.click(bulkBtn);

    await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(2));
    expect(mockAction).toHaveBeenCalledWith('evt1', 'firebase:a', 'confirmed', 'tok');
    expect(mockAction).toHaveBeenCalledWith('evt1', 'firebase:b', 'confirmed', 'tok');
  });

  it('remover confirmed calls adminCancelRsvp after confirm', async () => {
    const { fetchAdminRsvpList: mockFetch, adminCancelRsvp: mockCancel } = makeMocks();
    mockFetch.mockResolvedValue({ entries: [confirmedEntry], capacity: null });
    mockCancel.mockResolvedValue({ promotedEntryKey: null });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<RsvpPanel eventId="evt1" idToken="tok" />);

    await waitFor(() => expect(screen.getAllByText('Alice')[0]).toBeInTheDocument());

    await userEvent.click(screen.getAllByRole('button', { name: /remover/i })[0]);

    await waitFor(() =>
      expect(mockCancel).toHaveBeenCalledWith('tok', 'evt1', 'firebase:u1'),
    );
  });

  it('renders counter with N/capacity and progress bar width', async () => {
    const { fetchAdminRsvpList: mockFetch } = makeMocks();
    // 1 confirmed (no plus-one) + capacity 10 → 10% width
    mockFetch.mockResolvedValue({ entries: [confirmedEntry], capacity: 10 });

    render(<RsvpPanel eventId="evt1" idToken="tok" />);

    await waitFor(() => expect(screen.getAllByText('Alice')[0]).toBeInTheDocument());

    const counter = screen.getByTestId('rsvp-counter');
    expect(counter.textContent).toContain('1');
    expect(counter.textContent).toContain('/ 10');

    const bar = screen.getByTestId('rsvp-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('10%');
  });
});
