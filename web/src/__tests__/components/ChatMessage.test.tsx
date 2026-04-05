import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from '@/components/chat/ChatMessage';

describe('ChatMessage', () => {
  const base = {
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

    // relative timestamp rendered
    expect(screen.getByTestId('chat-message-time').textContent).toBeTruthy();
  });

  it('uses cream divider border', () => {
    const { container } = render(<ChatMessage message={base} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/border-b/);
    expect(root.className).toMatch(/zine-cream/);
  });
});
