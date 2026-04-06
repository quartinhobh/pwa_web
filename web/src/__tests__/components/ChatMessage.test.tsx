import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatMessage } from '@/components/chat/ChatMessage';

describe('ChatMessage', () => {
  const base = {
    id: 'm1',
    uid: 'u1',
    displayName: 'Alice',
    text: 'hello world',
    timestamp: Date.now() - 60_000,
    isDeleted: false,
  };

  it('renders displayName, text, and a timestamp', () => {
    render(<ChatMessage message={base} />);
    const name = screen.getByText('Alice');
    expect(name).toBeInTheDocument();
    expect(name.className).toMatch(/font-display/);
    expect(name.className).toMatch(/zine-burntYellow/);

    const text = screen.getByText('hello world');
    expect(text).toBeInTheDocument();
    expect(text.className).toMatch(/font-body/);

    expect(screen.getByTestId('chat-message-time').textContent).toBeTruthy();
  });

  it('uses cream divider border', () => {
    const { container } = render(<ChatMessage message={base} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/border-b/);
    expect(root.className).toMatch(/zine-cream/);
  });

  it('does not render delete button when canModerate is false', () => {
    render(<ChatMessage message={base} onDelete={vi.fn()} />);
    expect(screen.queryByTestId('chat-delete-btn')).not.toBeInTheDocument();
  });

  it('renders delete button for moderators and opens confirm modal', async () => {
    const onDelete = vi.fn(async () => {});
    render(
      <ChatMessage message={base} canModerate onDelete={onDelete} />,
    );
    const btn = screen.getByTestId('chat-delete-btn');
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn);
    const reasonInput = await screen.findByTestId('chat-mod-reason');
    await userEvent.type(reasonInput, 'spam');
    await userEvent.click(screen.getByTestId('chat-mod-confirm'));
    expect(onDelete).toHaveBeenCalledWith('m1', 'spam');
  });

  it('renders [mensagem apagada] placeholder when isDeleted', () => {
    render(
      <ChatMessage
        message={{ ...base, isDeleted: true }}
        canModerate
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/mensagem apagada/)).toBeInTheDocument();
    // delete button hidden once already deleted
    expect(screen.queryByTestId('chat-delete-btn')).not.toBeInTheDocument();
  });
});
