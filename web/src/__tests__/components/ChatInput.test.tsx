import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '@/components/chat/ChatInput';

describe('ChatInput', () => {
  it('disables send button when empty', () => {
    render(<ChatInput onSend={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /send/i });
    expect(btn).toBeDisabled();
  });

  it('calls onSend on click and clears input', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByPlaceholderText(/mensagem/i) as HTMLInputElement;
    await user.type(input, 'hi there');
    const btn = screen.getByRole('button', { name: /send/i });
    expect(btn).not.toBeDisabled();
    await user.click(btn);
    expect(onSend).toHaveBeenCalledWith('hi there');
    expect(input.value).toBe('');
  });

  it('submits on Enter key', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByPlaceholderText(/mensagem/i);
    await user.type(input, 'yo{Enter}');
    expect(onSend).toHaveBeenCalledWith('yo');
  });

  it('renders the zine Button primitive', () => {
    render(<ChatInput onSend={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /send/i });
    // Button primitive uses burntYellow background
    expect(btn.className).toMatch(/zine-burntYellow/);
  });
});
