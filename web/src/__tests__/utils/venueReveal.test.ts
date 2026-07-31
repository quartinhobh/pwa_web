import { describe, expect, it } from 'vitest';
import {
  evaluateVenueReveal,
  policyFromLegacy,
  resolveVenueReveal,
} from '@/utils/venueReveal';
import type {
  VenueRevealContext,
  VenueRevealPolicy,
} from '@/types';

const T = Date.UTC(2026, 4, 15);
const day = (offset: number): number => T + offset * 86_400_000;

function ctx(over: Partial<VenueRevealContext> = {}): VenueRevealContext {
  return {
    nowMs: T,
    eventDateMs: day(0),
    eventCreatedAtMs: T,
    previousEventCount: 0,
    ...over,
  };
}

describe('evaluateVenueReveal', () => {
  it('always → revealed true', () => {
    const r = evaluateVenueReveal({ mode: 'always' }, ctx());
    expect(r).toEqual({ revealed: true, reason: 'always' });
  });

  describe('days_before_event', () => {
    it('boundary: daysUntil === N → revealed', () => {
      const r = evaluateVenueReveal(
        { mode: 'days_before_event', days: 7 },
        ctx({ nowMs: day(-7) }),
      );
      expect(r.revealed).toBe(true);
      expect(r.reason).toBe('days_until_event=7.00 <= 7');
    });

    it('daysUntil === N+1 → not revealed', () => {
      const r = evaluateVenueReveal(
        { mode: 'days_before_event', days: 7 },
        ctx({ nowMs: day(-8) }),
      );
      expect(r.revealed).toBe(false);
    });

    it('daysUntil === N-1 → revealed', () => {
      const r = evaluateVenueReveal(
        { mode: 'days_before_event', days: 7 },
        ctx({ nowMs: day(-6) }),
      );
      expect(r.revealed).toBe(true);
    });

    it('days=0: same day → revealed; next day → not', () => {
      const same = evaluateVenueReveal(
        { mode: 'days_before_event', days: 0 },
        ctx({ nowMs: T }),
      );
      const next = evaluateVenueReveal(
        { mode: 'days_before_event', days: 0 },
        ctx({ nowMs: day(-1) }),
      );
      expect(same.revealed).toBe(true);
      expect(next.revealed).toBe(false);
    });
  });

  describe('days_after_creation', () => {
    it('createdAt=T-5, now=T, days=3 → revealed', () => {
      const r = evaluateVenueReveal(
        { mode: 'days_after_creation', days: 3 },
        ctx({ eventCreatedAtMs: day(-5) }),
      );
      expect(r.revealed).toBe(true);
      expect(r.reason).toBe('days_since_creation=5.00 >= 3');
    });

    it('createdAt=T-1, days=3 → not revealed', () => {
      const r = evaluateVenueReveal(
        { mode: 'days_after_creation', days: 3 },
        ctx({ eventCreatedAtMs: day(-1) }),
      );
      expect(r.revealed).toBe(false);
    });

    it('null createdAt → revealed false, created_at_unknown', () => {
      const r = evaluateVenueReveal(
        { mode: 'days_after_creation', days: 3 },
        ctx({ eventCreatedAtMs: null }),
      );
      expect(r).toEqual({ revealed: false, reason: 'created_at_unknown' });
    });
  });

  describe('after_n_previous_events', () => {
    it('count=3, previousEventCount=3 → revealed', () => {
      const r = evaluateVenueReveal(
        { mode: 'after_n_previous_events', count: 3 },
        ctx({ previousEventCount: 3 }),
      );
      expect(r.revealed).toBe(true);
      expect(r.reason).toBe('previous_events=3 >= 3');
    });

    it('count=3, previousEventCount=2 → not revealed', () => {
      const r = evaluateVenueReveal(
        { mode: 'after_n_previous_events', count: 3 },
        ctx({ previousEventCount: 2 }),
      );
      expect(r.revealed).toBe(false);
    });
  });

  describe('correlated OR', () => {
    const policy: VenueRevealPolicy = {
      mode: 'correlated',
      operator: 'or',
      policies: [
        { mode: 'days_before_event', days: 7 },
        { mode: 'after_n_previous_events', count: 99 },
      ],
    };

    it('first branch triggers', () => {
      const r = evaluateVenueReveal(policy, ctx({ nowMs: day(-7) }));
      expect(r.revealed).toBe(true);
      expect(r.reason.startsWith('OR triggered: ')).toBe(true);
    });

    it('second branch triggers when first fails', () => {
      const r = evaluateVenueReveal(
        policy,
        ctx({ nowMs: day(-8), previousEventCount: 99 }),
      );
      expect(r.revealed).toBe(true);
      expect(r.reason).toContain('previous_events=99');
    });

    it('neither triggers', () => {
      const r = evaluateVenueReveal(policy, ctx({ nowMs: day(-8) }));
      expect(r).toEqual({ revealed: false, reason: 'OR no branch triggered' });
    });

    it('empty policies → OR false', () => {
      const r = evaluateVenueReveal(
        { mode: 'correlated', operator: 'or', policies: [] },
        ctx(),
      );
      expect(r).toEqual({ revealed: false, reason: 'OR empty' });
    });
  });

  describe('correlated AND', () => {
    it('all pass → revealed, AND all passed', () => {
      const r = evaluateVenueReveal(
        {
          mode: 'correlated',
          operator: 'and',
          policies: [
            { mode: 'days_before_event', days: 7 },
            { mode: 'after_n_previous_events', count: 2 },
          ],
        },
        ctx({ nowMs: day(-7), previousEventCount: 2 }),
      );
      expect(r.revealed).toBe(true);
      expect(r.reason).toBe('AND all passed');
    });

    it('one fails → not revealed, first failing reason', () => {
      const r = evaluateVenueReveal(
        {
          mode: 'correlated',
          operator: 'and',
          policies: [
            { mode: 'days_before_event', days: 7 },
            { mode: 'after_n_previous_events', count: 99 },
          ],
        },
        ctx({ nowMs: day(-7), previousEventCount: 2 }),
      );
      expect(r.revealed).toBe(false);
      expect(r.reason.startsWith('AND failed: ')).toBe(true);
    });

    it('empty policies → AND true (vacuous)', () => {
      const r = evaluateVenueReveal(
        { mode: 'correlated', operator: 'and', policies: [] },
        ctx(),
      );
      expect(r).toEqual({ revealed: true, reason: 'AND empty (vacuous)' });
    });
  });
});

describe('policyFromLegacy', () => {
  it('undefined → always', () => {
    expect(policyFromLegacy(undefined)).toEqual({ mode: 'always' });
  });
  it('7 → days_before_event with days=7', () => {
    expect(policyFromLegacy(7)).toEqual({ mode: 'days_before_event', days: 7 });
  });
  it('0 → days_before_event with days=0', () => {
    expect(policyFromLegacy(0)).toEqual({ mode: 'days_before_event', days: 0 });
  });
});

describe('resolveVenueReveal', () => {
  it('legacy venueRevealDaysBefore=7 → days_before_event N=7', () => {
    const r = resolveVenueReveal({
      date: '2026-05-15',
      venueRevealDaysBefore: 7,
    });
    expect(r.policy).toEqual({ mode: 'days_before_event', days: 7 });
    expect(r.result.revealed).toBe(true);
  });

  it('explicit venueRevealPolicy={mode:always} → revealed', () => {
    const r = resolveVenueReveal({
      date: '2026-05-15',
      venueRevealPolicy: { mode: 'always' },
    });
    expect(r.policy).toEqual({ mode: 'always' });
    expect(r.result).toEqual({ revealed: true, reason: 'always' });
  });

  it('missing createdAt → null eventCreatedAtMs', () => {
    const r = resolveVenueReveal({
      date: '2026-05-15',
      venueRevealPolicy: { mode: 'days_after_creation', days: 0 },
    });
    expect(r.ctx.eventCreatedAtMs).toBeNull();
    expect(r.result.revealed).toBe(false);
    expect(r.result.reason).toBe('created_at_unknown');
  });

  it('default previousEventCount is 0', () => {
    const r = resolveVenueReveal({
      date: '2026-05-15',
      venueRevealPolicy: { mode: 'after_n_previous_events', count: 1 },
    });
    expect(r.ctx.previousEventCount).toBe(0);
    expect(r.result.revealed).toBe(false);
  });

  it('venueRevealPolicy wins over legacy venueRevealDaysBefore', () => {
    const r = resolveVenueReveal({
      date: '2026-05-15',
      venueRevealDaysBefore: 7,
      venueRevealPolicy: { mode: 'always' },
    });
    expect(r.policy).toEqual({ mode: 'always' });
  });
});
