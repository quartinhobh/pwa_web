import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { sendEmail, sendBulk, wrapTemplate, getLimitsInfo, verifyUnsubscribeToken, DAILY_SEND_LIMIT, MONTHLY_SEND_LIMIT, MAX_GROUP_SIZE } from '../services/emailService';
import { getAllTemplates, updateTemplate } from '../services/emailTemplateService';
import type { EmailTemplateKey } from '../types';
import { adminDb } from '../config/firebase';

export const emailRouter: Router = Router();

// ─── Grupo reservado para desinscritos ──────────────────────────────
// ID fixo — usado automaticamente ao desinscrever.
const UNSUBSCRIBED_GROUP_ID = '__unsubscribed';

/**
 * GET /email/unsubscribe?email=xxx
 * Endpoint PÚBLICO (sem auth) — o usuário clica no link do email.
 * Marca newsletterOptIn=false e adiciona ao grupo de desinscritos.
 */
emailRouter.get(
  '/unsubscribe',
  async (req: Request, res: Response) => {
    const email = req.query.email as string | undefined;
    const token = req.query.token as string | undefined;
    if (!email) {
      // Sem email na query — mostra formulário para o usuário digitar
      res.send(unsubscribeFormHtml());
      return;
    }
    if (!token || !verifyUnsubscribeToken(email, token)) {
      // Token ausente ou inválido — mostra formulário para tentar novamente
      res.send(unsubscribeFormHtml());
      return;
    }
    try {
      const snap = await adminDb
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (snap.empty) {
        // Não revelar se o email existe ou não (privacidade)
        res.send(unsubscribeHtml('Pronto! Você foi removido da lista.'));
        return;
      }

      const userDoc = snap.docs[0]!;
      // Remove de todos os grupos e adiciona apenas ao grupo de desinscritos
      await userDoc.ref.update({
        newsletterOptIn: false,
        groups: [UNSUBSCRIBED_GROUP_ID],
        updatedAt: Date.now(),
      });

      res.send(unsubscribeHtml('Pronto! Você foi removido da lista de emails.'));
    } catch (err) {
      console.error('[email/unsubscribe]', err);
      res.status(500).send('Erro ao processar. Tente novamente.');
    }
  },
);

function unsubscribeHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Desinscrição</title></head>
<body style="margin:0;padding:40px;background:#f5f0e8;font-family:'Bitter',Georgia,serif;text-align:center;">
  <div style="max-width:400px;margin:0 auto;background:#FFFDF5;padding:32px;border:3px dashed #C1440E;border-radius:4px;">
    <h1 style="color:#C1440E;font-size:20px;">Quartinho</h1>
    <p style="color:#333;">${message}</p>
  </div>
</body></html>`;
}

function unsubscribeFormHtml(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cancelar inscrição</title></head>
<body style="margin:0;padding:40px;background:#f5f0e8;font-family:'Bitter',Georgia,serif;text-align:center;">
  <div style="max-width:400px;margin:0 auto;background:#FFFDF5;padding:32px;border:3px dashed #C1440E;border-radius:4px;">
    <h1 style="color:#C1440E;font-size:20px;">Quartinho</h1>
    <p style="color:#333;">Digite seu email para cancelar a inscrição:</p>
    <form method="GET" action="" style="margin-top:16px;">
      <input name="email" type="email" required placeholder="seu@email.com"
        style="padding:8px 12px;border:2px solid #C1440E;border-radius:4px;width:100%;max-width:280px;font-family:inherit;" />
      <br/>
      <button type="submit" style="margin-top:12px;padding:8px 24px;background:#C1440E;color:#FFFDF5;
        border:none;border-radius:4px;cursor:pointer;font-family:inherit;font-weight:bold;">
        Cancelar inscrição
      </button>
    </form>
  </div>
</body></html>`;
}

/** GET /email/limits — retorna limites e uso diário */
emailRouter.get(
  '/limits',
  requireAuth,
  requireRole('admin'),
  (_req: Request, res: Response) => {
    const info = getLimitsInfo();
    res.json({
      dailyLimit: DAILY_SEND_LIMIT,
      dailyRemaining: info.dailyRemaining,
      monthlyLimit: MONTHLY_SEND_LIMIT,
      monthlyRemaining: info.monthlyRemaining,
      maxGroupSize: MAX_GROUP_SIZE,
    });
  },
);

/** POST /email/send — send a single email (admin only) */
emailRouter.post(
  '/send',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { to, subject, html } = req.body as { to?: string; subject?: string; html?: string };
    if (!to || !subject || !html) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }
    try {
      await sendEmail(to, subject, wrapTemplate(html));
      res.json({ ok: true });
    } catch (err) {
      console.error('[email/send]', err);
      res.status(500).json({ error: 'send_failed' });
    }
  },
);

/** POST /email/newsletter — send newsletter with group filtering (admin only) */
emailRouter.post(
  '/newsletter',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { subject, html, includeGroups, excludeGroups } = req.body as {
      subject?: string;
      html?: string;
      includeGroups?: string[];
      excludeGroups?: string[];
    };
    if (!subject || !html) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }
    try {
      const snap = await adminDb
        .collection('users')
        .where('newsletterOptIn', '==', true)
        .get();

      let recipients = snap.docs.map((d) => ({
        email: d.data().email as string | null,
        groups: (d.data().groups as string[]) || [],
      }));

      if (includeGroups?.length) {
        recipients = recipients.filter((u) =>
          u.groups.some((g) => includeGroups.includes(g)),
        );
      }
      // Sempre excluir desinscritos + grupos selecionados pelo admin
      const allExcluded = [...(excludeGroups || []), UNSUBSCRIBED_GROUP_ID];
      recipients = recipients.filter((u) =>
        !u.groups.some((g) => allExcluded.includes(g)),
      );

      const emails = recipients.map((u) => u.email).filter(Boolean) as string[];
      if (!emails.length) {
        res.json({ ok: true, sentCount: 0 });
        return;
      }

      const sentCount = await sendBulk(emails, subject, wrapTemplate(html));

      await adminDb.collection('email_campaigns').add({
        subject,
        htmlContent: html,
        includeGroups: includeGroups || [],
        excludeGroups: excludeGroups || [],
        status: 'sent',
        sentAt: Date.now(),
        sentCount,
        createdAt: Date.now(),
      });

      res.json({ ok: true, sentCount });
    } catch (err) {
      console.error('[email/newsletter]', err);
      res.status(500).json({ error: 'newsletter_failed' });
    }
  },
);

// ── Contact Groups CRUD ──────────────────────────────────────────────

/** GET /email/groups — list all contact groups */
emailRouter.get(
  '/groups',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const snap = await adminDb.collection('contact_groups').orderBy('createdAt', 'desc').get();
      const groups = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({ groups });
    } catch (err) {
      console.error('[email/groups]', err);
      res.status(500).json({ error: 'list_groups_failed' });
    }
  },
);

/** POST /email/groups — create a contact group */
emailRouter.post(
  '/groups',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name) {
      res.status(400).json({ error: 'missing_name' });
      return;
    }
    try {
      const ref = await adminDb.collection('contact_groups').add({
        name,
        description: description || '',
        createdAt: Date.now(),
      });
      res.status(201).json({ id: ref.id, name, description: description || '' });
    } catch (err) {
      console.error('[email/groups]', err);
      res.status(500).json({ error: 'create_group_failed' });
    }
  },
);

/** DELETE /email/groups/:id — delete a contact group */
emailRouter.delete(
  '/groups/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      await adminDb.collection('contact_groups').doc(req.params.id!).delete();
      const usersSnap = await adminDb.collection('users').where('groups', 'array-contains', req.params.id!).get();
      const batch = adminDb.batch();
      for (const doc of usersSnap.docs) {
        const groups = (doc.data().groups as string[]).filter(g => g !== req.params.id!);
        batch.update(doc.ref, { groups });
      }
      await batch.commit();
      res.status(204).send();
    } catch (err) {
      console.error('[email/groups]', err);
      res.status(500).json({ error: 'delete_group_failed' });
    }
  },
);

/** GET /email/groups/:id/members — lista membros de um grupo */
emailRouter.get(
  '/groups/:id/members',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const snap = await adminDb
        .collection('users')
        .where('groups', 'array-contains', req.params.id!)
        .get();
      const members = snap.docs.map((d) => ({
        id: d.id,
        email: d.data().email as string | null,
        displayName: d.data().displayName as string,
      }));
      res.json({ members });
    } catch (err) {
      console.error('[email/groups/members]', err);
      res.status(500).json({ error: 'list_members_failed' });
    }
  },
);

/** POST /email/groups/:id/members — adiciona um usuário ao grupo */
emailRouter.post(
  '/groups/:id/members',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      res.status(400).json({ error: 'missing_userId' });
      return;
    }
    try {
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        res.status(404).json({ error: 'user_not_found' });
        return;
      }
      const currentGroups = (userSnap.data()!.groups as string[]) || [];
      if (currentGroups.includes(req.params.id!)) {
        res.json({ ok: true }); // já está no grupo
        return;
      }
      // Checar limite do grupo
      const membersSnap = await adminDb
        .collection('users')
        .where('groups', 'array-contains', req.params.id!)
        .count()
        .get();
      if (membersSnap.data().count >= MAX_GROUP_SIZE) {
        res.status(400).json({ error: 'group_full', message: `Limite de ${MAX_GROUP_SIZE} membros` });
        return;
      }
      await userRef.update({ groups: [...currentGroups, req.params.id!] });
      res.json({ ok: true });
    } catch (err) {
      console.error('[email/groups/members]', err);
      res.status(500).json({ error: 'add_member_failed' });
    }
  },
);

/** DELETE /email/groups/:groupId/members/:userId — remove um usuário do grupo */
emailRouter.delete(
  '/groups/:groupId/members/:userId',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const userRef = adminDb.collection('users').doc(req.params.userId!);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        res.status(404).json({ error: 'user_not_found' });
        return;
      }
      const currentGroups = (userSnap.data()!.groups as string[]) || [];
      await userRef.update({ groups: currentGroups.filter((g) => g !== req.params.groupId!) });
      res.json({ ok: true });
    } catch (err) {
      console.error('[email/groups/members]', err);
      res.status(500).json({ error: 'remove_member_failed' });
    }
  },
);

/** PUT /email/users/:id/groups — assign groups to a user */
emailRouter.put(
  '/users/:id/groups',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { groups } = req.body as { groups?: string[] };
    if (!Array.isArray(groups)) {
      res.status(400).json({ error: 'invalid_groups' });
      return;
    }
    try {
      // Verificar se algum grupo excederia o limite de membros
      for (const groupId of groups) {
        const membersSnap = await adminDb
          .collection('users')
          .where('groups', 'array-contains', groupId)
          .count()
          .get();
        const currentCount = membersSnap.data().count;
        if (currentCount >= MAX_GROUP_SIZE) {
          res.status(400).json({
            error: 'group_full',
            message: `Grupo atingiu o limite de ${MAX_GROUP_SIZE} membros`,
            groupId,
          });
          return;
        }
      }
      await adminDb.collection('users').doc(req.params.id!).update({ groups });
      res.json({ ok: true });
    } catch (err) {
      console.error('[email/users/groups]', err);
      res.status(500).json({ error: 'update_groups_failed' });
    }
  },
);

/** PUT /email/users/:id/newsletter — toggle newsletter opt-in */
emailRouter.put(
  '/users/:id/newsletter',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { optIn } = req.body as { optIn?: boolean };
    if (typeof optIn !== 'boolean') {
      res.status(400).json({ error: 'invalid_optIn' });
      return;
    }
    try {
      await adminDb.collection('users').doc(req.params.id!).update({ newsletterOptIn: optIn });
      res.json({ ok: true });
    } catch (err) {
      console.error('[email/users/newsletter]', err);
      res.status(500).json({ error: 'update_newsletter_failed' });
    }
  },
);

// ── Email Config (Firestore doc: email_config/settings) ─────────────
// Flags globais como desabilitar email automático de evento.

/** GET /email/config — retorna config de email */
emailRouter.get(
  '/config',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const doc = await adminDb.collection('email_config').doc('settings').get();
      const data = (doc.exists ? doc.data() : {}) as Record<string, unknown>;
      res.json({
        config: {
          autoEventEmail: (data.autoEventEmail as boolean | undefined) ?? true,
          pauseAllTransactional: (data.pauseAllTransactional as boolean | undefined) ?? false,
        },
      });
    } catch (err) {
      console.error('[email/config]', err);
      res.status(500).json({ error: 'get_config_failed' });
    }
  },
);

/** PUT /email/config — atualiza config de email */
emailRouter.put(
  '/config',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { autoEventEmail, pauseAllTransactional } = req.body as {
      autoEventEmail?: boolean;
      pauseAllTransactional?: boolean;
    };
    try {
      const patch: Record<string, unknown> = { updatedAt: Date.now() };
      if (typeof autoEventEmail === 'boolean') patch.autoEventEmail = autoEventEmail;
      if (typeof pauseAllTransactional === 'boolean') patch.pauseAllTransactional = pauseAllTransactional;
      await adminDb.collection('email_config').doc('settings').set(patch, { merge: true });
      res.json({ ok: true });
    } catch (err) {
      console.error('[email/config]', err);
      res.status(500).json({ error: 'update_config_failed' });
    }
  },
);

// ── Desinscritos ────────────────────────────────────────────────────

/** GET /email/unsubscribed — lista usuários desinscritos */
emailRouter.get(
  '/unsubscribed',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const snap = await adminDb
        .collection('users')
        .where('groups', 'array-contains', UNSUBSCRIBED_GROUP_ID)
        .get();
      const users = snap.docs.map((d) => ({
        id: d.id,
        email: d.data().email as string | null,
        displayName: d.data().displayName as string,
      }));
      res.json({ users });
    } catch (err) {
      console.error('[email/unsubscribed]', err);
      res.status(500).json({ error: 'list_unsubscribed_failed' });
    }
  },
);

/** POST /email/resubscribe/:id — reinscrever um usuário */
emailRouter.post(
  '/resubscribe/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const userRef = adminDb.collection('users').doc(req.params.id!);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        res.status(404).json({ error: 'user_not_found' });
        return;
      }
      const currentGroups = (userSnap.data()!.groups as string[]) || [];
      await userRef.update({
        newsletterOptIn: true,
        groups: currentGroups.filter((g) => g !== UNSUBSCRIBED_GROUP_ID),
        updatedAt: Date.now(),
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[email/resubscribe]', err);
      res.status(500).json({ error: 'resubscribe_failed' });
    }
  },
);

// ── Email Templates ──────────────────────────────────────────────────

/** GET /email/templates — list all 6 RSVP email templates */
emailRouter.get(
  '/templates',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const templates = await getAllTemplates();
      res.json({ templates });
    } catch (err) {
      console.error('[email/templates GET]', err);
      res.status(500).json({ error: 'list_templates_failed' });
    }
  },
);

/** PUT /email/templates/:key — update a RSVP email template */
emailRouter.put(
  '/templates/:key',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const key = req.params.key as EmailTemplateKey;
    const validKeys: EmailTemplateKey[] = ['confirmation', 'waitlist', 'promotion', 'reminder', 'venue_reveal', 'rejected', 'role_invite', 'role_promotion'];
    if (!validKeys.includes(key)) {
      res.status(400).json({ error: 'invalid_key' });
      return;
    }
    const { enabled, subject, body } = req.body as { enabled?: boolean; subject?: string; body?: string };
    const adminUid = req.user?.uid ?? 'unknown';
    try {
      const updated = await updateTemplate(key, { enabled, subject, body }, adminUid);
      res.json({ template: updated });
    } catch (err) {
      console.error('[email/templates PUT]', err);
      res.status(500).json({ error: 'update_template_failed' });
    }
  },
);

/** DELETE /email/templates/:key — restore template to defaults (deletes Firestore override) */
emailRouter.delete(
  '/templates/:key',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const key = req.params.key as EmailTemplateKey;
    const validKeys: EmailTemplateKey[] = ['confirmation', 'waitlist', 'promotion', 'reminder', 'venue_reveal', 'rejected', 'role_invite', 'role_promotion'];
    if (!validKeys.includes(key)) {
      res.status(400).json({ error: 'invalid_key' });
      return;
    }
    try {
      await adminDb.collection('emailTemplates').doc(key).delete();
      const { getAllTemplates: getAll } = await import('../services/emailTemplateService');
      const templates = await getAll();
      const restored = templates.find((t) => t.key === key);
      res.json({ template: restored });
    } catch (err) {
      console.error('[email/templates DELETE]', err);
      res.status(500).json({ error: 'restore_template_failed' });
    }
  },
);

/** GET /email/campaigns — list sent campaigns */
emailRouter.get(
  '/campaigns',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const snap = await adminDb
        .collection('email_campaigns')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      const campaigns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({ campaigns });
    } catch (err) {
      console.error('[email/campaigns]', err);
      res.status(500).json({ error: 'list_campaigns_failed' });
    }
  },
);
