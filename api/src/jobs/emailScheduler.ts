import cron from 'node-cron';
import { adminDb } from '../config/firebase';
import { buildRsvpEmail } from '../services/emailTemplateService';
import { sendEmail, wrapTransactionalTemplate } from '../services/emailService';
import type { Event, EmailTemplateKey, RsvpDoc, User } from '../types';

export interface EventWithFlags extends Event {
  reminderEmailSent?: boolean;
  venueRevealEmailSent?: boolean;
}

export type SchedulerAction =
  | { kind: 'reminder'; event: EventWithFlags }
  | { kind: 'venue_reveal'; event: EventWithFlags };

/**
 * Pure decision: given an event and the current date (YYYY-MM-DD local),
 * return the email actions that should be dispatched right now. Reminder
 * fires when today is exactly 1 day before the event; venue_reveal fires
 * when today is exactly N days before (N = venueRevealDaysBefore ?? 7).
 * Already-sent flags short-circuit so the job is idempotent day-to-day.
 */
export function decideActions(event: EventWithFlags, todayISO: string): SchedulerAction[] {
  const actions: SchedulerAction[] = [];
  const daysUntil = daysBetween(todayISO, event.date);
  if (daysUntil < 0) return actions;

  if (!event.reminderEmailSent && daysUntil === 1) {
    actions.push({ kind: 'reminder', event });
  }
  const revealN = event.venueRevealDaysBefore ?? 7;
  if (!event.venueRevealEmailSent && daysUntil === revealN) {
    actions.push({ kind: 'venue_reveal', event });
  }
  return actions;
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00`).getTime();
  const to = new Date(`${toISO}T00:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return -1;
  return Math.round((to - from) / 86_400_000);
}

async function confirmedRecipients(eventId: string): Promise<{ email: string; displayName: string }[]> {
  const rsvpSnap = await adminDb.collection('rsvps').doc(eventId).get();
  if (!rsvpSnap.exists) return [];
  const doc = rsvpSnap.data() as RsvpDoc;
  const confirmedIds = Object.entries(doc.entries)
    .filter(([, e]) => e.status === 'confirmed')
    .map(([id]) => id);
  if (!confirmedIds.length) return [];

  const out: { email: string; displayName: string }[] = [];
  for (let i = 0; i < confirmedIds.length; i += 10) {
    const batch = confirmedIds.slice(i, i + 10);
    const snap = await adminDb
      .collection('users')
      .where('__name__', 'in', batch)
      .get();
    for (const d of snap.docs) {
      const u = d.data() as User;
      if (u.email) out.push({ email: u.email, displayName: u.displayName ?? 'você' });
    }
  }
  return out;
}

async function dispatchAction(action: SchedulerAction): Promise<void> {
  const ev = action.event;
  const key: EmailTemplateKey = action.kind;
  const recipients = await confirmedRecipients(ev.id);
  if (!recipients.length) {
    await markSent(ev.id, action.kind);
    return;
  }

  let anySent = false;
  for (const r of recipients) {
    try {
      const result = await buildRsvpEmail(key, {
        nome: r.displayName,
        evento: ev.title,
        data: ev.date,
        horario: ev.startTime,
        local: ev.location ?? '',
      });
      if (!result) {
        // Template disabled — still mark as sent to avoid re-enqueueing on next run.
        anySent = true;
        break;
      }
      const html = wrapTransactionalTemplate(`<p>${result.bodyText.replace(/\n/g, '<br>')}</p>`);
      await sendEmail(r.email, result.subject, html);
      anySent = true;
    } catch (err) {
      console.error(`[emailScheduler] ${key} failed for ${r.email} on event ${ev.id}:`, err);
    }
  }

  if (anySent) await markSent(ev.id, action.kind);
}

async function markSent(eventId: string, kind: SchedulerAction['kind']): Promise<void> {
  const field = kind === 'reminder' ? 'reminderEmailSent' : 'venueRevealEmailSent';
  await adminDb.collection('events').doc(eventId).update({ [field]: true });
}

async function loadUpcomingEvents(todayISO: string): Promise<EventWithFlags[]> {
  const snap = await adminDb.collection('events').where('date', '>=', todayISO).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventWithFlags));
}

/** Run one scan (exported for manual/testing use). */
export async function runEmailScheduler(now: Date = new Date()): Promise<void> {
  const todayISO = now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  try {
    const events = await loadUpcomingEvents(todayISO);
    for (const ev of events) {
      const actions = decideActions(ev, todayISO);
      for (const action of actions) {
        await dispatchAction(action);
      }
    }
  } catch (err) {
    console.error('[emailScheduler] scan failed:', err);
  }
}

/** Schedule the daily scan at 09:00 America/Sao_Paulo. */
export function startEmailScheduler(): void {
  cron.schedule('0 9 * * *', () => {
    void runEmailScheduler();
  }, { timezone: 'America/Sao_Paulo' });
  console.log('[emailScheduler] scheduled daily 09:00 America/Sao_Paulo');
}

