import React, { useEffect, useRef, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { LoadingState } from '@/components/common/LoadingState';
import HelperBox from '@/components/admin/HelperBox';
import { fetchEmailTemplates, updateEmailTemplate, restoreEmailTemplate, sendTestEmail } from '@/services/api';
import type { EmailTemplate, EmailTemplateKey } from '@/types';

// ─── Static metadata ─────────────────────────────────────────────────

const TEMPLATE_NAMES: Record<EmailTemplateKey, string> = {
  confirmation: 'Confirmação de presença',
  waitlist: 'Entrada na fila de espera',
  promotion: 'Saiu da fila — confirmado!',
  reminder: 'Lembrete (dia anterior)',
  venue_reveal: 'Revelação do endereço',
  rejected: 'Inscrição recusada',
  role_invite: 'Convite de admin/moderador',
  role_promotion: 'Promoção a admin/moderador',
  event_cancelled: 'Evento cancelado',
  event_broadcast: 'Mensagem em massa (broadcast)',
};

const TEMPLATE_DESCRIPTIONS: Record<EmailTemplateKey, string> = {
  confirmation: 'Enviado quando alguém confirma presença',
  waitlist: 'Enviado quando entra na fila de espera',
  promotion: 'Enviado quando sai da fila e entra',
  reminder: 'Enviado 24h antes do evento',
  venue_reveal: 'Enviado N dias antes com o endereço (N configurado no evento)',
  rejected: 'Enviado quando admin recusa alguém',
  role_invite: 'Enviado quando admin convida alguém por email pra ser admin/moderador',
  role_promotion: 'Enviado quando admin promove um usuário existente a admin/moderador',
  event_cancelled: 'Enviado quando admin cancela um evento (broadcast aos RSVPs)',
  event_broadcast: 'Wrapper da mensagem em massa admin-authored pros RSVPs',
};

// Variables available per template
const BASE_VARS = ['{nome}', '{evento}', '{data}', '{horario}'];
const EXTRA_VARS: Partial<Record<EmailTemplateKey, string[]>> = {
  reminder: ['{local}'],
  venue_reveal: ['{local}'],
  role_invite: ['{role}', '{link}'],
  role_promotion: ['{role}', '{link}'],
  event_cancelled: ['{motivo}'],
  event_broadcast: ['{assunto}', '{corpo}'],
};
const OVERRIDE_VARS: Partial<Record<EmailTemplateKey, string[]>> = {
  role_invite: ['{nome}', '{role}', '{link}'],
  role_promotion: ['{nome}', '{role}', '{link}'],
  event_cancelled: ['{nome}', '{evento}', '{data}', '{motivo}'],
  event_broadcast: ['{nome}', '{evento}', '{assunto}', '{corpo}'],
};

// Sample data for live preview
const SAMPLE: Record<string, string> = {
  nome: 'Maria',
  evento: 'Quartinho #12',
  data: '15/05/2026',
  horario: '19h',
  local: 'Rua Exemplo, 123',
  role: 'administrador',
  link: 'https://quartinho.exemplo/admin',
};

function interpolate(str: string): string {
  return str.replace(/\{(\w+)\}/g, (_, v: string) => SAMPLE[v] ?? `{${v}}`);
}

// ─── Toggle pill ──────────────────────────────────────────────────────

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={[
      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors',
      checked
        ? 'bg-zine-burntOrange border-zine-burntOrange'
        : 'bg-zine-cream/50 border-zine-burntOrange/40',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    ].join(' ')}
  >
    <span
      className={[
        'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-5' : 'translate-x-1',
      ].join(' ')}
    />
  </button>
);

// ─── Editor view ──────────────────────────────────────────────────────

const TemplateEditor: React.FC<{
  template: EmailTemplate;
  onBack: () => void;
  onSaved: (t: EmailTemplate) => void;
  onToggle: (enabled: boolean) => Promise<void>;
  idToken: string | null;
}> = ({ template, onBack, onSaved, onToggle, idToken }) => {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = subject !== template.subject || body !== template.body;

  const vars = OVERRIDE_VARS[template.key] ?? [...BASE_VARS, ...(EXTRA_VARS[template.key] ?? [])];

  function handleBack() {
    if (isDirty && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    onBack();
  }

  function insertVar(v: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + v);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = body.slice(0, start) + v + body.slice(end);
    setBody(next);
    // Restore cursor after state update
    requestAnimationFrame(() => {
      el.selectionStart = start + v.length;
      el.selectionEnd = start + v.length;
      el.focus();
    });
  }

  async function handleSave() {
    if (!idToken) return;
    setSaving(true);
    try {
      const updated = await updateEmailTemplate(template.key, { subject, body }, idToken);
      onSaved(updated);
    } catch (err) {
      alert(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore() {
    if (!confirm('Restaurar o texto padrão? Isso apagará suas edições atuais neste template.')) return;
    if (!idToken) return;
    setSaving(true);
    try {
      const restored = await restoreEmailTemplate(template.key, idToken);
      setSubject(restored.subject);
      setBody(restored.body);
      onSaved(restored);
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!idToken) return;
    setTestStatus('sending');
    setTestError(null);
    try {
      await sendTestEmail(idToken, template.key, {
        email: testEmail.trim() || undefined,
        subjectOverride: subject,
        bodyOverride: body,
      });
      setTestStatus('sent');
      window.setTimeout(() => setTestStatus('idle'), 4000);
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : String(err));
      window.setTimeout(() => setTestStatus('idle'), 4000);
    }
  }

  const inputClass =
    'font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange w-full';

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={handleBack}
        className="font-body text-sm text-zine-burntOrange/70 underline text-left"
      >
        ← voltar
      </button>

      <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-1">
          {TEMPLATE_NAMES[template.key]}
        </h3>
        <p className="font-body text-xs text-zine-burntOrange/60 mb-3">
          {TEMPLATE_DESCRIPTIONS[template.key]}
        </p>

        {!template.enabled && (
          <div className="bg-zine-cream/50 border-2 border-dashed border-zine-burntOrange/30 px-3 py-2 mb-3 flex items-center justify-between gap-2 flex-wrap">
            <span className="font-body text-sm text-zine-burntOrange/60">
              este modelo está desativado — edições são salvas mas nada é enviado
            </span>
            <button
              type="button"
              onClick={() => void onToggle(true)}
              className="font-body text-sm text-zine-burntOrange underline shrink-0"
            >
              ativar
            </button>
          </div>
        )}

        <HelperBox>
          Edite o assunto e o corpo do email. Use as variáveis entre chaves para inserir dados do evento. Clique numa variável pra copiar no campo de texto.
        </HelperBox>

        {/* Variable chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {vars.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVar(v)}
              className="bg-zine-periwinkle/20 border border-zine-periwinkle text-zine-periwinkle px-2 py-0.5 text-xs cursor-pointer rounded font-body hover:bg-zine-periwinkle/40 transition-colors"
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="font-body text-xs text-zine-burntOrange/70 block mb-1">Assunto</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="font-body text-xs text-zine-burntOrange/70 block mb-1">Corpo do email</label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className={inputClass}
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="mt-4">
          <p className="font-body text-xs text-zine-burntOrange/60 mb-1">Preview (dados de exemplo)</p>
          <div className="bg-zine-mint/10 border-2 border-zine-mint/30 p-3 rounded">
            <p className="font-body text-xs text-zine-burntOrange/50 mb-1">
              <strong>Assunto:</strong> {interpolate(subject)}
            </p>
            <pre className="font-body text-sm text-zine-burntOrange whitespace-pre-wrap">
              {interpolate(body)}
            </pre>
          </div>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          <Button onClick={() => void handleSave()} disabled={saving || !isDirty}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
          <button
            type="button"
            onClick={() => void handleRestore()}
            disabled={saving}
            className="font-body text-sm text-zine-burntOrange/60 underline"
          >
            Restaurar padrão
          </button>
        </div>

        {/* Send test email */}
        <div className="mt-4 border-t-2 border-dashed border-zine-burntOrange/30 pt-3 flex flex-col gap-2">
          <p className="font-body text-xs text-zine-burntOrange/70">
            Envie um teste deste template (com o texto atual, mesmo não salvo) pro seu email.
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="(deixe em branco pra usar seu email)"
              className="font-body px-2 py-1 text-xs border-2 border-dashed border-zine-burntOrange/40 bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange flex-1 min-w-[200px]"
            />
            <button
              type="button"
              onClick={() => void handleSendTest()}
              disabled={testStatus === 'sending' || !idToken}
              className="font-body text-sm text-zine-burntOrange border-2 border-dashed border-zine-burntOrange/60 px-3 py-1 hover:bg-zine-burntOrange/10 disabled:opacity-50"
            >
              {testStatus === 'sending' ? 'enviando...' : 'enviar teste pro meu email'}
            </button>
          </div>
          {testStatus === 'sent' && (
            <p className="font-body text-xs text-zine-mint">enviado ✓ verifica sua caixa</p>
          )}
          {testStatus === 'error' && (
            <p className="font-body text-xs text-zine-burntOrange">
              não foi possível enviar{testError ? ` — ${testError}` : ''}
            </p>
          )}
        </div>
      </ZineFrame>
    </div>
  );
};

// ─── List view ────────────────────────────────────────────────────────

const TemplateList: React.FC<{
  templates: EmailTemplate[];
  onEdit: (t: EmailTemplate) => void;
  onToggle: (t: EmailTemplate, enabled: boolean) => void;
  toggling: string | null;
}> = ({ templates, onEdit, onToggle, toggling }) => (
  <div className="flex flex-col gap-3">
    <HelperBox>
      Esses emails são enviados automaticamente quando alguém confirma presença, entra na fila, etc. Você pode ligar/desligar cada um e editar o texto. Não se preocupe: se apagar tudo, os emails voltam pro texto padrão.
    </HelperBox>
    {templates.map((t) => (
      <ZineFrame key={t.key} bg="cream">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-display text-zine-burntOrange font-bold text-base">
              {TEMPLATE_NAMES[t.key]}
            </p>
            <p className="font-body text-xs text-zine-burntOrange/60 mt-0.5">
              {TEMPLATE_DESCRIPTIONS[t.key]}
            </p>
            {!t.enabled && (
              <span className="inline-block mt-1 bg-zine-cream/50 border border-zine-burntOrange/30 text-zine-burntOrange/60 font-body text-xs px-2 py-0.5 rounded">
                desativado — não envia
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Toggle
              checked={t.enabled}
              onChange={(v) => onToggle(t, v)}
              disabled={toggling === t.key}
            />
            <button
              type="button"
              onClick={() => onEdit(t)}
              className="font-body text-sm text-zine-burntOrange/70 underline"
            >
              editar
            </button>
          </div>
        </div>
      </ZineFrame>
    ))}
  </div>
);

// ─── Main panel ───────────────────────────────────────────────────────

export const EmailTemplatesPanel: React.FC<{
  idToken: string | null;
  initialTemplates?: EmailTemplate[];
  onTemplatesChange?: (next: EmailTemplate[]) => void;
}> = ({ idToken, initialTemplates, onTemplatesChange }) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates ?? []);
  const [loading, setLoading] = useState(!initialTemplates);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (initialTemplates) {
      setTemplates(initialTemplates);
      return;
    }
    if (!idToken) return;
    void fetchEmailTemplates(idToken)
      .then((t) => {
        setTemplates(t);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar os modelos');
        setLoading(false);
      });
  }, [idToken, initialTemplates]);

  function applyUpdate(updated: EmailTemplate) {
    setTemplates((prev) => {
      const next = prev.map((x) => (x.key === updated.key ? updated : x));
      onTemplatesChange?.(next);
      return next;
    });
  }

  async function handleToggle(t: EmailTemplate, enabled: boolean) {
    if (!idToken) return;
    setToggling(t.key);
    try {
      const updated = await updateEmailTemplate(t.key, { enabled }, idToken);
      applyUpdate(updated);
      if (editing?.key === updated.key) setEditing(updated);
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setToggling(null);
    }
  }

  function handleSaved(updated: EmailTemplate) {
    applyUpdate(updated);
    setEditing(updated);
  }

  if (loading) return <LoadingState />;
  if (error) return <p className="font-body text-zine-burntOrange p-4">{error}</p>;

  if (editing) {
    return (
      <TemplateEditor
        template={editing}
        onBack={() => setEditing(null)}
        onSaved={handleSaved}
        onToggle={(v) => handleToggle(editing, v)}
        idToken={idToken}
      />
    );
  }

  return (
    <TemplateList
      templates={templates}
      onEdit={setEditing}
      onToggle={(t, v) => void handleToggle(t, v)}
      toggling={toggling}
    />
  );
};

export default EmailTemplatesPanel;
