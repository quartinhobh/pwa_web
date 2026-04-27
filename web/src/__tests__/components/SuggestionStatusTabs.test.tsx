import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuggestionStatusTabs } from '@/components/bares/SuggestionStatusTabs';
import type { SuggestionStatus } from '@/types';

describe('SuggestionStatusTabs', () => {
  it('renders 3 tabs: "sugeridos", "curti", "nao gostei"', () => {
    render(<SuggestionStatusTabs activeStatus="suggested" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /sugeridos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /curti/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nao gostei/i })).toBeInTheDocument();
  });

  it('active tab ("suggested") has aria-pressed=true', () => {
    render(<SuggestionStatusTabs activeStatus="suggested" onChange={() => {}} />);
    const activeBtn = screen.getByRole('button', { name: /sugeridos/i });
    expect(activeBtn).toHaveAttribute('aria-pressed', 'true');
    const otherBtn = screen.getByRole('button', { name: /curti/i });
    expect(otherBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('active tab has active background class (bg-zine-burntYellow)', () => {
    render(<SuggestionStatusTabs activeStatus="suggested" onChange={() => {}} />);
    const activeBtn = screen.getByRole('button', { name: /sugeridos/i });
    expect(activeBtn.className).toContain('bg-zine-burntYellow');
    const otherBtn = screen.getByRole('button', { name: /curti/i });
    expect(otherBtn.className).not.toContain('bg-zine-burntYellow ');
  });

  it('clicking different tab calls onChange with correct SuggestionStatus', () => {
    const onChange = vi.fn();
    render(<SuggestionStatusTabs activeStatus="suggested" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /curti/i }));
    expect(onChange).toHaveBeenCalledWith('liked' as SuggestionStatus);
    fireEvent.click(screen.getByRole('button', { name: /nao gostei/i }));
    expect(onChange).toHaveBeenCalledWith('disliked' as SuggestionStatus);
  });

  it('when counts provided, shows "(N)" in tab label', () => {
    render(
      <SuggestionStatusTabs
        activeStatus="suggested"
        onChange={() => {}}
        counts={{ suggested: 5, liked: 2, disliked: 0 }}
      />,
    );
    expect(screen.getByRole('button', { name: /sugeridos \(5\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /curti \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nao gostei \(0\)/i })).toBeInTheDocument();
  });
});
