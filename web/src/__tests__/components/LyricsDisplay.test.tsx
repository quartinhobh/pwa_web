import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LyricsDisplay } from '@/components/events/LyricsDisplay';

describe('LyricsDisplay', () => {
  it('renders lyrics with preserved whitespace', () => {
    const lyrics = 'line one\nline two\n\nverse two';
    render(<LyricsDisplay lyrics={lyrics} />);
    const node = screen.getByLabelText('lyrics');
    expect(node.textContent).toBe(lyrics);
    expect(node.className).toContain('whitespace-pre-wrap');
    expect(node.className).toContain('font-body');
    expect(node.className).toContain('text-zine-cream');
  });

  it('renders "Letra não encontrada" when lyrics are null', () => {
    render(<LyricsDisplay lyrics={null} />);
    expect(screen.getByText('Letra não encontrada')).toBeInTheDocument();
  });

  it('renders loading message when loading', () => {
    render(<LyricsDisplay lyrics={null} loading />);
    expect(screen.getByText('Carregando letra...')).toBeInTheDocument();
  });
});
