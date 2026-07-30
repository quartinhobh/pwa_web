// Venue Reveal policy — pure, deterministic evaluator.
// `eventDateMs` is parsed from YYYY-MM-DD as UTC midnight. The job runs at
// 09:00 America/Sao_Paulo, so for events whose local date crosses a UTC day
// boundary the revealed/days_until values will be off by at most one day;
// acceptable for an email-scheduling decision that already runs daily.

import type { VenueRevealContext, VenueRevealPolicy, VenueRevealResult } from '../types';

export function evaluateVenueReveal(
  policy: VenueRevealPolicy,
  ctx: VenueRevealContext,
): VenueRevealResult {
  switch (policy.mode) {
    case 'always':
      return { revealed: true, reason: 'always' };
    case 'days_before_event': {
      const daysUntil = (ctx.eventDateMs - ctx.nowMs) / 86_400_000;
      const revealed = daysUntil <= policy.days;
      return {
        revealed,
        reason: `days_until_event=${daysUntil.toFixed(2)} <= ${policy.days}`,
      };
    }
    case 'days_after_creation': {
      if (ctx.eventCreatedAtMs === null) {
        return { revealed: false, reason: 'created_at_unknown' };
      }
      const daysSince = (ctx.nowMs - ctx.eventCreatedAtMs) / 86_400_000;
      const revealed = daysSince >= policy.days;
      return {
        revealed,
        reason: `days_since_creation=${daysSince.toFixed(2)} >= ${policy.days}`,
      };
    }
    case 'after_n_previous_events': {
      const revealed = ctx.previousEventCount >= policy.count;
      return {
        revealed,
        reason: `previous_events=${ctx.previousEventCount} >= ${policy.count}`,
      };
    }
    case 'correlated': {
      if (policy.policies.length === 0) {
        if (policy.operator === 'or') return { revealed: false, reason: 'OR empty' };
        return { revealed: true, reason: 'AND empty (vacuous)' };
      }
      if (policy.operator === 'or') {
        for (const sub of policy.policies) {
          const r = evaluateVenueReveal(sub, ctx);
          if (r.revealed) {
            return { revealed: true, reason: `OR triggered: ${r.reason}` };
          }
        }
        return { revealed: false, reason: 'OR no branch triggered' };
      }
      for (const sub of policy.policies) {
        const r = evaluateVenueReveal(sub, ctx);
        if (!r.revealed) {
          return { revealed: false, reason: `AND failed: ${r.reason}` };
        }
      }
      return { revealed: true, reason: 'AND all passed' };
    }
  }
}

export function policyFromLegacy(
  venueRevealDaysBefore: number | undefined,
): VenueRevealPolicy {
  if (venueRevealDaysBefore === undefined) return { mode: 'always' };
  return { mode: 'days_before_event', days: venueRevealDaysBefore };
}

interface ResolveInput {
  venueRevealPolicy?: VenueRevealPolicy;
  venueRevealDaysBefore?: number;
  date: string;
  createdAt?: number;
  previousEventCount?: number;
}

export function resolveVenueReveal(event: ResolveInput): {
  policy: VenueRevealPolicy;
  ctx: VenueRevealContext;
  result: VenueRevealResult;
} {
  const policy = event.venueRevealPolicy ?? policyFromLegacy(event.venueRevealDaysBefore);
  const ctx: VenueRevealContext = {
    nowMs: Date.now(),
    eventDateMs: new Date(`${event.date}T00:00:00`).getTime(),
    eventCreatedAtMs: event.createdAt ?? null,
    previousEventCount: event.previousEventCount ?? 0,
  };
  const result = evaluateVenueReveal(policy, ctx);
  return { policy, ctx, result };
}