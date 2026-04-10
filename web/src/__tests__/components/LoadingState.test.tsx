import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  EventDetailSkeleton,
  LoadingState,
  SkeletonPulse,
} from '@/components/common/LoadingState';

describe('LoadingState', () => {
  it('renders animated zine text loader', () => {
    render(<LoadingState />);
    expect(screen.getByTestId('loading-text')).toBeInTheDocument();
  });

  it('shows the carregando label', () => {
    render(<LoadingState />);
    // Text case toggles, so match case-insensitively with the ellipsis.
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(
      /carregando…/i,
    );
  });
});

describe('EventDetailSkeleton', () => {
  it('renders skeleton with data-testid="loading-skeleton"', () => {
    render(<EventDetailSkeleton />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('contains animated pulse elements', () => {
    const { container } = render(<EventDetailSkeleton />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('includes the carregando zine marker', () => {
    render(<EventDetailSkeleton />);
    expect(screen.getByText(/carregando…/i)).toBeInTheDocument();
  });
});

describe('SkeletonPulse', () => {
  it('renders with animate-pulse class', () => {
    const { container } = render(<SkeletonPulse />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('applies additional className', () => {
    const { container } = render(<SkeletonPulse className="w-48 h-48" />);
    expect(container.firstChild).toHaveClass('w-48', 'h-48');
  });
});
