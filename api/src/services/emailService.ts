import { createHmac } from 'crypto';

// Brevo (ex-Sendinblue) transactional email service.
// Plano gratuito: 300 emails/dia, sem domínio próprio obrigatório.
//
// ─── LIMITES (fácil de alterar quando migrar para plano pago) ────────
// DAILY_SEND_LIMIT: máximo de emails enviados por dia (Brevo free = 300)
// MAX_GROUP_SIZE: máximo de contatos por grupo de newsletter
// Quando contratar plano pago ou domínio próprio, basta alterar aqui.
// ─────────────────────────────────────────────────────────────────────

/** Limite diário de envios — Brevo free tier = 300/dia */
export const DAILY_SEND_LIMIT = 300;

/** Limite mensal de envios — Brevo free tier = 9.000/mês */
export const MONTHLY_SEND_LIMIT = 9_000;

/** Tamanho máximo de um grupo de contatos */
export const MAX_GROUP_SIZE = 300;

// ─── Unsubscribe HMAC tokens ─────────────────────────────────────────

function getUnsubscribeSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? process.env.BREVO_API_KEY ?? 'dev-secret';
}

export function generateUnsubscribeToken(email: string): string {
  return createHmac('sha256', getUnsubscribeSecret()).update(email).digest('hex').slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  return generateUnsubscribeToken(email) === token;
}

const BREVO_API_URL = 'https://api.brevo.com/v3';

interface BrevoEmailPayload {
  sender: { name: string; email: string };
  to: { email: string; name?: string }[];
  bcc?: { email: string }[];
  subject: string;
  htmlContent: string;
}

async function brevoRequest(path: string, body: unknown): Promise<unknown> {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY not set');

  const res = await fetch(`${BREVO_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// Sender: usa email pessoal verificado no Brevo (sem domínio próprio).
// Quando tiver domínio, basta trocar BREVO_SENDER_EMAIL no .env.
function getSender() {
  const email = process.env.BREVO_SENDER_EMAIL;
  if (!email) throw new Error('BREVO_SENDER_EMAIL not set — use seu email verificado no Brevo');
  return {
    name: process.env.BREVO_SENDER_NAME ?? 'Quartinho',
    email,
  };
}

// ─── Controle de envios (diário + mensal) ───────────────────────────
// Contadores em memória — resetam quando o processo reinicia.
// Para persistência real, trocar por Firestore counters.
let dailySentCount = 0;
let dailyResetDate = new Date().toDateString();
let monthlySentCount = 0;
let monthlyResetMonth = new Date().getMonth();

function checkLimits(count: number): void {
  const now = new Date();
  const today = now.toDateString();
  const currentMonth = now.getMonth();

  if (today !== dailyResetDate) {
    dailySentCount = 0;
    dailyResetDate = today;
  }
  if (currentMonth !== monthlyResetMonth) {
    monthlySentCount = 0;
    monthlyResetMonth = currentMonth;
  }

  if (dailySentCount + count > DAILY_SEND_LIMIT) {
    throw new Error(
      `Limite diário de ${DAILY_SEND_LIMIT} emails atingido. ` +
      `Já enviados hoje: ${dailySentCount}. Tentando enviar: ${count}.`,
    );
  }
  if (monthlySentCount + count > MONTHLY_SEND_LIMIT) {
    throw new Error(
      `Limite mensal de ${MONTHLY_SEND_LIMIT} emails atingido. ` +
      `Já enviados este mês: ${monthlySentCount}. Tentando enviar: ${count}.`,
    );
  }

  // Reserve the quota immediately (atomic check-and-increment)
  dailySentCount += count;
  monthlySentCount += count;
}

function decrementCounts(count: number): void {
  dailySentCount = Math.max(0, dailySentCount - count);
  monthlySentCount = Math.max(0, monthlySentCount - count);
}

/** Retorna limites e uso atual. */
export function getLimitsInfo() {
  const now = new Date();
  const today = now.toDateString();
  const currentMonth = now.getMonth();

  let daily = dailySentCount;
  let monthly = monthlySentCount;

  if (today !== dailyResetDate) daily = 0;
  if (currentMonth !== monthlyResetMonth) monthly = 0;

  return {
    dailyRemaining: Math.max(0, DAILY_SEND_LIMIT - daily),
    monthlyRemaining: Math.max(0, MONTHLY_SEND_LIMIT - monthly),
  };
}

/** Send a single transactional email. */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  checkLimits(1);
  const payload: BrevoEmailPayload = {
    sender: getSender(),
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };
  try {
    await brevoRequest('/smtp/email', payload);
  } catch (err) {
    decrementCounts(1);
    throw err;
  }
}

/**
 * Send bulk emails via BCC — uma única chamada à API.
 * Ninguém vê o email dos outros. Brevo aceita até 2000 bcc por chamada.
 */
export async function sendBulk(
  recipients: string[],
  subject: string,
  html: string,
): Promise<number> {
  if (!recipients.length) return 0;
  checkLimits(recipients.length);
  const sender = getSender();

  const BCC_BATCH_SIZE = 2000;
  let sent = 0;
  try {
    for (let i = 0; i < recipients.length; i += BCC_BATCH_SIZE) {
      const batch = recipients.slice(i, i + BCC_BATCH_SIZE);
      const payload: BrevoEmailPayload = {
        sender,
        to: [{ email: sender.email }],
        bcc: batch.map((email) => ({ email })),
        subject,
        htmlContent: html,
      };
      await brevoRequest('/smtp/email', payload);
      sent += batch.length;
    }
  } catch (err) {
    const remaining = recipients.length - sent;
    decrementCounts(remaining);
    throw err;
  }
  return sent;
}

// ─── Design tokens do site (tailwind.config.js) ────────────────────
// Cores: periwinkle=#8B9FD4, cream=#F5F5DC, burntYellow=#E8A42C,
//        burntOrange=#D97642, mint=#98D9C2
// Fontes: Alfa Slab One (display), Bitter (body), fallback Georgia
// Border: 4px solid cream (como ZineFrame)
// ────────────────────────────────────────────────────────────────────

const COLORS = {
  periwinkle: '#8B9FD4',
  cream: '#F5F5DC',
  burntYellow: '#E8A42C',
  burntOrange: '#D97642',
  mint: '#98D9C2',
  text: '#1A1A1A',
  textMuted: '#5a5a5a',
} as const;

// Logo PNG hospedado no Firebase Hosting (96x96).
// SVG inline não funciona em Gmail/Outlook — PNG via <img> é o padrão.
// Se mudar o domínio, atualizar FRONTEND_URL no .env.
function getLogoUrl(): string {
  const frontendUrl = process.env.FRONTEND_URL ?? 'https://teste-qbh.web.app';
  return `${frontendUrl}/logo-email.png`;
}

// ─── Template helpers ───────────────────────────────────────────────
// Mobile-first, HTML simples, funciona em Gmail/Outlook/Apple Mail.
// Espelha o visual do site: header periwinkle, body cream, footer mint,
// borders cream 4px, fontes Bitter/Georgia.

function getUrls() {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  return { apiUrl, frontendUrl };
}

/** Header compartilhado — periwinkle bg, logo + nome (igual ao Header.tsx) */
function emailHeader(): string {
  const logoUrl = getLogoUrl();
  return `
    <div style="background:${COLORS.periwinkle};padding:16px 24px;text-align:center;border-bottom:4px solid ${COLORS.cream};">
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <img src="${logoUrl}" alt="Quartinho" width="44" height="44" style="display:block;border:0;" />
          </td>
          <td style="vertical-align:middle;">
            <span style="color:${COLORS.cream};font-size:24px;font-weight:bold;letter-spacing:0.5px;font-family:Georgia,serif;">
              Quartinho
            </span>
          </td>
        </tr>
      </table>
    </div>`;
}

/** Footer compartilhado — mint bg (igual ao Footer.tsx) */
function emailFooter(opts: { unsubscribe?: boolean; recipientEmail?: string } = {}): string {
  const { apiUrl } = getUrls();
  let unsubscribeUrl = `${apiUrl}/email/unsubscribe`;
  if (opts.recipientEmail) {
    const token = generateUnsubscribeToken(opts.recipientEmail);
    unsubscribeUrl = `${apiUrl}/email/unsubscribe?email=${encodeURIComponent(opts.recipientEmail)}&token=${token}`;
  }

  return `
    <div style="background:${COLORS.mint};padding:14px 24px;text-align:center;border-top:4px solid ${COLORS.cream};">
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;width:100%;">
        <tr>
          <td style="text-align:left;font-size:12px;color:${COLORS.cream};font-family:Georgia,serif;">
            quartinho &middot; desde 2023
          </td>
          <td style="text-align:right;font-size:12px;font-family:Georgia,serif;">
            <a href="https://www.instagram.com/quartinhobh/" style="color:${COLORS.cream};text-decoration:underline;">@quartinhobh</a>
          </td>
        </tr>
        ${opts.unsubscribe ? `
        <tr>
          <td colspan="2" style="text-align:center;padding-top:8px;">
            <a href="${unsubscribeUrl}" style="font-size:11px;color:${COLORS.cream};opacity:0.7;text-decoration:underline;">
              Cancelar inscrição
            </a>
          </td>
        </tr>` : ''}
      </table>
    </div>`;
}

/**
 * Template completo com header + body + footer (com unsubscribe).
 * Usar para newsletters e emails gerais.
 */
export function wrapTemplate(body: string, recipientEmail?: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.cream};">
  <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->
  <div style="max-width:600px;margin:0 auto;background:${COLORS.cream};font-family:'Bitter',Georgia,serif;">
    ${emailHeader()}
    <div style="padding:24px;color:${COLORS.text};line-height:1.6;font-size:16px;border-left:4px solid ${COLORS.cream};border-right:4px solid ${COLORS.cream};">
      ${body}
    </div>
    ${emailFooter({ unsubscribe: true, recipientEmail })}
  </div>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}

/**
 * Template transacional (sem unsubscribe) — convites, promoções, etc.
 */
export function wrapTransactionalTemplate(body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.cream};">
  <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->
  <div style="max-width:600px;margin:0 auto;background:${COLORS.cream};font-family:'Bitter',Georgia,serif;">
    ${emailHeader()}
    <div style="padding:24px;color:${COLORS.text};line-height:1.6;font-size:16px;">
      ${body}
    </div>
    ${emailFooter()}
  </div>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}

