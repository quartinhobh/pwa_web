import { adminDb } from '../config/firebase';
import type { EmailTemplateKey, EmailTemplate } from '../types';

// ─── Default templates (used as fallback when Firestore has no override) ────

interface TemplateDefault {
  subject: string;
  body: string;
  description: string;
}

const DEFAULTS: Record<EmailTemplateKey, TemplateDefault> = {
  confirmation: {
    subject: 'tá confirmado! 🎶 {evento}',
    body: 'Oi {nome}!\n\nSua presença em {evento} ({data}, {horario}) está confirmada.\n\nNos vemos lá!',
    description: 'Enviado quando alguém confirma presença',
  },
  waitlist: {
    subject: 'tá na fila — {evento}',
    body: 'Oi {nome}!\n\nO {evento} ({data}) lotou, mas você está na fila de espera. Se abrir vaga, você recebe outro email.',
    description: 'Enviado quando entra na fila de espera',
  },
  promotion: {
    subject: 'abriu vaga! 🎉 {evento}',
    body: 'Oi {nome}!\n\nAbriu uma vaga no {evento} ({data}, {horario}) e você saiu da fila! Sua presença está confirmada.',
    description: 'Enviado quando sai da fila e entra',
  },
  reminder: {
    subject: 'amanhã tem! {evento}',
    body: 'Oi {nome}!\n\nLembrete: amanhã tem {evento}!\n\nHorário: {horario}\nLocal: {local}\n\nNos vemos lá!',
    description: 'Enviado 24h antes do evento',
  },
  venue_reveal: {
    subject: 'o endereço é... 📍 {evento}',
    body: 'Oi {nome}!\n\nO local do {evento} ({data}) foi revelado:\n\n{local}\n\nAnota aí!',
    description: 'Enviado 3 dias antes com o endereço',
  },
  rejected: {
    subject: 'dessa vez não rolou — {evento}',
    body: 'Oi {nome}!\n\nInfelizmente sua presença no {evento} ({data}) não foi aprovada dessa vez. Mas fique ligado nos próximos eventos!',
    description: 'Enviado quando admin recusa alguém',
  },
};

export const EMAIL_TEMPLATE_DESCRIPTIONS: Record<EmailTemplateKey, string> = Object.fromEntries(
  (Object.keys(DEFAULTS) as EmailTemplateKey[]).map((k) => [k, DEFAULTS[k].description]),
) as Record<EmailTemplateKey, string>;

export const ALL_KEYS: EmailTemplateKey[] = [
  'confirmation',
  'waitlist',
  'promotion',
  'reminder',
  'venue_reveal',
  'rejected',
];

function buildDefault(key: EmailTemplateKey): EmailTemplate {
  const d = DEFAULTS[key];
  return {
    key,
    enabled: true,
    subject: d.subject,
    body: d.body,
    updatedAt: 0,
    updatedBy: 'system',
  };
}

/** Fetch a single template from Firestore. Returns null if not stored yet. */
export async function getTemplate(key: EmailTemplateKey): Promise<EmailTemplate | null> {
  const doc = await adminDb.collection('emailTemplates').doc(key).get();
  if (!doc.exists) return null;
  return { key, ...doc.data() } as EmailTemplate;
}

/** Return stored template if exists, else the hardcoded default. */
export async function getEffectiveTemplate(key: EmailTemplateKey): Promise<EmailTemplate> {
  const stored = await getTemplate(key);
  return stored ?? buildDefault(key);
}

/** Return all 6 templates, merging Firestore data with defaults. */
export async function getAllTemplates(): Promise<EmailTemplate[]> {
  const snap = await adminDb.collection('emailTemplates').get();
  const stored = new Map<string, EmailTemplate>();
  for (const doc of snap.docs) {
    stored.set(doc.id, { key: doc.id as EmailTemplateKey, ...doc.data() } as EmailTemplate);
  }
  return ALL_KEYS.map((key) => stored.get(key) ?? buildDefault(key));
}

/** Upsert a template in Firestore. */
export async function updateTemplate(
  key: EmailTemplateKey,
  patch: { enabled?: boolean; subject?: string; body?: string },
  adminUid: string,
): Promise<EmailTemplate> {
  const existing = await getEffectiveTemplate(key);
  const updated: Omit<EmailTemplate, 'key'> = {
    enabled: patch.enabled ?? existing.enabled,
    subject: patch.subject ?? existing.subject,
    body: patch.body ?? existing.body,
    updatedAt: Date.now(),
    updatedBy: adminUid,
  };
  await adminDb.collection('emailTemplates').doc(key).set(updated, { merge: true });
  return { key, ...updated };
}

// ─── buildRsvpEmail — unified entry point for all RSVP emails ────────

/**
 * Build a transactional RSVP email using the effective template (Firestore or default).
 * Returns null when the template is disabled (caller should skip sending).
 */
export async function buildRsvpEmail(
  key: EmailTemplateKey,
  variables: Record<string, string>,
): Promise<{ subject: string; bodyText: string } | null> {
  const template = await getEffectiveTemplate(key);
  if (!template.enabled) return null;

  function interpolate(str: string): string {
    return str.replace(/\{(\w+)\}/g, (_, v: string) => variables[v] ?? `{${v}}`);
  }

  return {
    subject: interpolate(template.subject),
    bodyText: interpolate(template.body),
  };
}
