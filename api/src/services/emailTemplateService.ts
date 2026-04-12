import { adminDb } from '../config/firebase';
import type { EmailTemplateKey, EmailTemplate } from '../types';

// Templates que ignoram o master switch pauseAllTransactional — ops críticos de admin.
const CRITICAL_KEYS: readonly EmailTemplateKey[] = ['role_invite', 'role_promotion'];

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
    description: 'Enviado N dias antes com o endereço (N configurado no evento)',
  },
  rejected: {
    subject: 'dessa vez não rolou — {evento}',
    body: 'Oi {nome}!\n\nInfelizmente sua presença no {evento} ({data}) não foi aprovada dessa vez. Mas fique ligado nos próximos eventos!',
    description: 'Enviado quando admin recusa alguém',
  },
  role_invite: {
    subject: 'convite: você é {role} no Quartinho BH',
    body: 'Oi {nome}!\n\nVocê recebeu acesso de {role} no Quartinho BH.\n\nPra ativar, basta fazer login no painel:\n{link}\n\nUse sua conta Google ou email+senha pra entrar. Seus privilégios já estarão ativos.',
    description: 'Enviado quando admin convida alguém por email pra ser admin/moderador',
  },
  role_promotion: {
    subject: 'você agora é {role} no Quartinho BH!',
    body: 'Oi {nome}!\n\nVocê foi promovido a {role} do Quartinho BH.\n\nAcesse o painel:\n{link}',
    description: 'Enviado quando admin promove um usuário existente a admin/moderador',
  },
  event_cancelled: {
    subject: 'evento cancelado: {evento}',
    body: 'Oi {nome},\n\nInfelizmente o {evento} ({data}) foi cancelado.\n\nMotivo: {motivo}\n\nDesculpa pelo transtorno — a gente avisa quando tiver a próxima.',
    description: 'Enviado quando admin cancela um evento (broadcast pra confirmados e waitlist)',
  },
  event_broadcast: {
    subject: '{assunto}',
    body: 'Oi {nome},\n\n{corpo}\n\n— Quartinho ({evento})',
    description: 'Wrapper pra mensagem em massa admin-authored pros RSVPs de um evento',
  },
};

/** Simple `{var}` interpolation used by email templates. */
export function interpolate(str: string, variables: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (_, v: string) => variables[v] ?? `{${v}}`);
}

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
  'role_invite',
  'role_promotion',
  'event_cancelled',
  'event_broadcast',
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

/** Read the global email config (pauseAllTransactional, etc.). */
export async function getEmailConfig(): Promise<{ autoEventEmail: boolean; pauseAllTransactional: boolean }> {
  const doc = await adminDb.collection('email_config').doc('settings').get();
  const data = doc.exists ? (doc.data() as Record<string, unknown>) : {};
  return {
    autoEventEmail: (data.autoEventEmail as boolean | undefined) ?? true,
    pauseAllTransactional: (data.pauseAllTransactional as boolean | undefined) ?? false,
  };
}

/**
 * Decide if a template key is sendable right now, combining:
 *   - global pauseAllTransactional master switch (except CRITICAL_KEYS)
 *   - individual template.enabled flag
 */
export async function isTemplateSendable(key: EmailTemplateKey): Promise<boolean> {
  const template = await getEffectiveTemplate(key);
  if (!template.enabled) return false;
  if (CRITICAL_KEYS.includes(key)) return true;
  const config = await getEmailConfig();
  if (config.pauseAllTransactional) return false;
  return true;
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
  if (!(await isTemplateSendable(key))) return null;
  const template = await getEffectiveTemplate(key);

  return {
    subject: interpolate(template.subject, variables),
    bodyText: interpolate(template.body, variables),
  };
}

/**
 * Build a template identical to buildRsvpEmail but bypasses isTemplateSendable
 * (master switch + enabled flag). Used for admin "send test" flows — always renders.
 * Returns null only if the key has no template at all (shouldn't happen for ALL_KEYS).
 */
export async function buildRawTemplate(
  key: EmailTemplateKey,
  variables: Record<string, string>,
): Promise<{ subject: string; bodyText: string } | null> {
  const template = await getEffectiveTemplate(key);
  if (!template) return null;
  return {
    subject: interpolate(template.subject, variables),
    bodyText: interpolate(template.body, variables),
  };
}
