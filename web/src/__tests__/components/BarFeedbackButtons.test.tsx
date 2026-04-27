import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useBarFeedback', () => ({
  useBarFeedback: vi.fn(),
}));

import * as feedbackHook from '@/hooks/useBarFeedback';
import { BarFeedbackButtons } from '@/components/bares/BarFeedbackButtons';

const useBarFeedbackMock = feedbackHook.useBarFeedback as unknown as ReturnType<typeof vi.fn>;

const defaultHookResult = {
  likedCount: 3,
  dislikedCount: 1,
  userVote: null,
  handleVote: vi.fn(),
  handleRemoveVote: vi.fn(),
  loading: false,
  error: null,
};

beforeEach(() => {
  useBarFeedbackMock.mockReturnValue({ ...defaultHookResult });
  defaultHookResult.handleVote.mockReset();
  defaultHookResult.handleRemoveVote.mockReset();
});

describe('BarFeedbackButtons', () => {
  it('renders liked count and disliked count', () => {
    render(<BarFeedbackButtons barId="bar-1" idToken={null} firebaseUid={null} />);
    expect(screen.getByRole('button', { name: /curti.*3/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nao gostei.*1/i })).toBeInTheDocument();
  });

  it('when firebaseUid=null and no onRequestLogin: text "faca login pra votar" is visible', () => {
    render(<BarFeedbackButtons barId="bar-1" idToken={null} firebaseUid={null} />);
    expect(screen.getByText(/faca login pra votar/i)).toBeInTheDocument();
  });

  it('when firebaseUid=null and onRequestLogin provided: shows "entrar pra votar" button', () => {
    const onRequestLogin = vi.fn();
    render(
      <BarFeedbackButtons
        barId="bar-1"
        idToken={null}
        firebaseUid={null}
        onRequestLogin={onRequestLogin}
      />,
    );
    const loginBtn = screen.getByRole('button', { name: /entrar pra votar/i });
    expect(loginBtn).toBeInTheDocument();
    fireEvent.click(loginBtn);
    expect(onRequestLogin).toHaveBeenCalledOnce();
  });

  it('when firebaseUid present: clicking curti button calls handleVote("liked")', async () => {
    const handleVote = vi.fn().mockResolvedValue(undefined);
    useBarFeedbackMock.mockReturnValue({ ...defaultHookResult, handleVote });
    render(<BarFeedbackButtons barId="bar-1" idToken="tok" firebaseUid="uid-1" />);
    fireEvent.click(screen.getByRole('button', { name: /curti/i }));
    await waitFor(() => expect(handleVote).toHaveBeenCalledWith('liked'));
  });

  it('when userVote="liked": liked button has aria-pressed=true', () => {
    useBarFeedbackMock.mockReturnValue({ ...defaultHookResult, userVote: 'liked' });
    render(<BarFeedbackButtons barId="bar-1" idToken="tok" firebaseUid="uid-1" />);
    const likedBtn = screen.getByRole('button', { name: /curti/i });
    expect(likedBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('when userVote="liked": liked button has active styling (bg-zine-burntYellow)', () => {
    useBarFeedbackMock.mockReturnValue({ ...defaultHookResult, userVote: 'liked' });
    render(<BarFeedbackButtons barId="bar-1" idToken="tok" firebaseUid="uid-1" />);
    const likedBtn = screen.getByRole('button', { name: /curti/i });
    expect(likedBtn.className).toContain('bg-zine-burntYellow');
  });
});
