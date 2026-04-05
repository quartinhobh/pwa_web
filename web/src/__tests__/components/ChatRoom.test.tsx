import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatRoom } from '@/components/chat/ChatRoom';
import type { ChatMessage } from '@/types';

// Mock scrollIntoView which jsdom doesn't implement
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLElement.prototype as any).scrollIntoView = vi.fn();
});

describe('ChatRoom', () => {
  const mkMsg = (i: number, text: string): ChatMessage & { id: string } => ({
    id: `m${i}`,
    uid: `u${i}`,
    displayName: `User ${i}`,
    text,
    timestamp: i * 1000,
    isDeleted: false,
  });

  it('renders each message', () => {
    const messages = [mkMsg(1, 'first'), mkMsg(2, 'second'), mkMsg(3, 'third')];
    render(<ChatRoom messages={messages} />);
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
    expect(screen.getByText('third')).toBeInTheDocument();
  });

  it('scrolls to bottom when a new message arrives', () => {
    const messages = [mkMsg(1, 'one')];
    const { rerender } = render(<ChatRoom messages={messages} />);
    const spy = HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    spy.mockClear();
    rerender(<ChatRoom messages={[...messages, mkMsg(2, 'two')]} />);
    expect(spy).toHaveBeenCalled();
  });

  it('renders inside a ZineFrame (cream background)', () => {
    const { container } = render(<ChatRoom messages={[]} />);
    expect(container.innerHTML).toMatch(/bg-zine-cream/);
  });
});
