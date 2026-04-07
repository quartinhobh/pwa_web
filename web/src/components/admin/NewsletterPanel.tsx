import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { LoadingState } from '@/components/common/LoadingState';
import { useIdToken } from '@/hooks/useIdToken';
import {
  fetchContactGroups,
  createContactGroup,
  deleteContactGroup,
  fetchGroupMembers,
  addGroupMember,
  removeGroupMember,
  fetchUsers,
  sendNewsletter,
  sendSingleEmail,
  fetchCampaigns,
  fetchEmailLimits,
  fetchEmailConfig,
  updateEmailConfig,
  fetchUnsubscribed,
  resubscribeUser,
  type ContactGroup,
  type GroupMember,
  type EmailCampaign,
  type EmailLimits,
  type UnsubscribedUser,
} from '@/services/api';
import HelperBox from '@/components/admin/HelperBox';
import type { User } from '@/types';

const inputClass =
  'font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange w-full';

type Mode = 'newsletter' | 'single' | 'groups' | 'history' | 'config';

export const NewsletterPanel: React.FC = () => {
  const idToken = useIdToken();
  const [mode, setMode] = useState<Mode>('newsletter');
  const [limits, setLimits] = useState<EmailLimits | null>(null);

  useEffect(() => {
    if (!idToken) return;
    void fetchEmailLimits(idToken).then(setLimits);
  }, [idToken]);

  return (
    <div className="flex flex-col gap-4">
      <HelperBox>Envie emails, gerencie grupos de distribuição e acompanhe o histórico de campanhas.</HelperBox>
      {limits && (
        <div className="font-body text-sm text-zine-burntOrange/70 dark:text-zine-cream/70 bg-zine-cream dark:bg-zine-surface-dark border-2 border-dashed border-zine-burntYellow rounded px-3 py-2">
          Hoje: <strong>{limits.dailyRemaining}/{limits.dailyLimit}</strong>
          &nbsp;·&nbsp;Mês: <strong>{limits.monthlyRemaining}/{limits.monthlyLimit}</strong>
          &nbsp;·&nbsp;Máx. por grupo: <strong>{limits.maxGroupSize}</strong>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {([
          ['newsletter', 'Newsletter'],
          ['single', 'Email avulso'],
          ['groups', 'Grupos'],
          ['history', 'Histórico'],
          ['config', 'Config'],
        ] as [Mode, string][]).map(([m, label]) => (
          <Button
            key={m}
            onClick={() => setMode(m)}
            className={mode === m ? 'ring-4 ring-zine-burntOrange' : ''}
          >
            {label}
          </Button>
        ))}
      </div>

      {mode === 'newsletter' && <NewsletterForm idToken={idToken} />}
      {mode === 'single' && <SingleEmailForm idToken={idToken} />}
      {mode === 'groups' && <GroupsManager idToken={idToken} />}
      {mode === 'history' && <CampaignHistory idToken={idToken} />}
      {mode === 'config' && <EmailConfigPanel idToken={idToken} />}
    </div>
  );
};

// ── Newsletter Form ──────────────────────────────────────────────────

const NewsletterForm: React.FC<{ idToken: string | null }> = ({ idToken }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [includeGroups, setIncludeGroups] = useState<string[]>([]);
  const [excludeGroups, setExcludeGroups] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    void fetchContactGroups(idToken).then(setGroups);
  }, [idToken]);

  function toggleGroup(id: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(id) ? list.filter((g) => g !== id) : [...list, id]);
  }

  function getTargetDescription(): string {
    if (includeGroups.length === 0 && excludeGroups.length === 0) {
      return 'todos os inscritos na newsletter';
    }
    const parts: string[] = [];
    if (includeGroups.length > 0) {
      const names = includeGroups.map((id) => groups.find((g) => g.id === id)?.name ?? id);
      parts.push(`incluindo: ${names.join(', ')}`);
    } else {
      parts.push('todos os inscritos');
    }
    if (excludeGroups.length > 0) {
      const names = excludeGroups.map((id) => groups.find((g) => g.id === id)?.name ?? id);
      parts.push(`excluindo: ${names.join(', ')}`);
    }
    return parts.join(' · ');
  }

  async function handleSend() {
    if (!idToken || !subject || !body) return;

    const target = getTargetDescription();
    if (!confirm(`Enviar newsletter para: ${target}?\n\nAssunto: ${subject}`)) return;

    setSending(true);
    try {
      const result = await sendNewsletter(
        { subject, html: body, includeGroups, excludeGroups },
        idToken,
      );
      alert(`Enviado para ${result.sentCount} pessoa(s)!`);
      setSubject('');
      setBody('');
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <ZineFrame bg="cream">
      <h3 className="font-display text-xl text-zine-burntOrange mb-3">Enviar Newsletter</h3>
      <HelperBox>Escreva o assunto e o corpo do email. Use os grupos para filtrar quem recebe: "incluir" envia só para esses grupos, "excluir" remove esses grupos do envio.</HelperBox>
      <div className="flex flex-col gap-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Assunto"
          className={inputClass}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Conteúdo do email (aceita HTML/usa chatpgt p/isso)"
          rows={8}
          className={inputClass}
        />

        {/* Destinatários */}
        <div className="flex flex-col gap-2">
          <span className="font-body text-sm text-zine-burntOrange font-bold">
            Enviar para:
          </span>

          {groups.length === 0 ? (
            <p className="font-body text-sm text-zine-burntOrange/70 italic">
              Todos os inscritos (nenhum grupo criado ainda)
            </p>
          ) : (
            <>
              <span className="font-body text-xs text-zine-burntOrange/70">
                Incluir (vazio = todos os inscritos):
              </span>
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-1 font-body text-sm text-zine-burntOrange">
                    <input
                      type="checkbox"
                      checked={includeGroups.includes(g.id)}
                      onChange={() => toggleGroup(g.id, includeGroups, setIncludeGroups)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
              <span className="font-body text-xs text-zine-burntOrange/70">
                Excluir:
              </span>
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-1 font-body text-sm text-zine-burntOrange">
                    <input
                      type="checkbox"
                      checked={excludeGroups.includes(g.id)}
                      onChange={() => toggleGroup(g.id, excludeGroups, setExcludeGroups)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Resumo do envio */}
          <div className="font-body text-sm text-zine-burntOrange bg-zine-burntYellow/10 border-2 border-dashed border-zine-burntYellow rounded px-3 py-2">
            Destino: <strong>{getTargetDescription()}</strong>
          </div>
        </div>

        <Button onClick={() => void handleSend()} disabled={sending || !subject || !body}>
          {sending ? 'Enviando...' : 'Enviar Newsletter'}
        </Button>
      </div>
    </ZineFrame>
  );
};

// ── Single Email Form ────────────────────────────────────────────────

const SingleEmailForm: React.FC<{ idToken: string | null }> = ({ idToken }) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!idToken || !to || !subject || !body) return;
    setSending(true);
    try {
      await sendSingleEmail({ to, subject, html: body }, idToken);
      alert('Email enviado!');
      setTo('');
      setSubject('');
      setBody('');
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <ZineFrame bg="cream">
      <h3 className="font-display text-xl text-zine-burntOrange mb-3">Email avulso</h3>
      <div className="flex flex-col gap-3">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Destinatário"
          className={inputClass}
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Assunto"
          className={inputClass}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Conteúdo (aceita HTML/usa chatpgt p/isso)"
          rows={6}
          className={inputClass}
        />
        <Button onClick={() => void handleSend()} disabled={sending || !to || !subject || !body}>
          {sending ? 'Enviando...' : 'Enviar'}
        </Button>
      </div>
    </ZineFrame>
  );
};

// ── Groups Manager ───────────────────────────────────────────────────

const GroupsManager: React.FC<{ idToken: string | null }> = ({ idToken }) => {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  async function refresh() {
    if (!idToken) return;
    setGroups(await fetchContactGroups(idToken));
  }

  useEffect(() => {
    void refresh();
  }, [idToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken || !name) return;
    try {
      await createContactGroup(name, desc, idToken);
      setName('');
      setDesc('');
      await refresh();
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDelete(id: string) {
    if (!idToken) return;
    if (!confirm('Remover grupo? Membros não serão removidos da newsletter.')) return;
    await deleteContactGroup(id, idToken);
    if (openGroupId === id) setOpenGroupId(null);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <HelperBox>Grupos permitem segmentar os envios de email. Crie grupos (ex: "VIPs", "Imprensa") e adicione membros. Na hora de enviar a newsletter, escolha incluir ou excluir grupos específicos.</HelperBox>
      {/* Criar grupo */}
      <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Grupos de contato</h3>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do grupo"
            required
            className={inputClass}
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Descrição (opcional)"
            className={inputClass}
          />
          <Button type="submit">Criar</Button>
        </form>
        {groups.length === 0 ? (
          <p className="font-body italic text-zine-burntOrange/70">Nenhum grupo.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((g) => (
              <li key={g.id} className="border-b border-zine-burntOrange/30 pb-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setOpenGroupId(openGroupId === g.id ? null : g.id)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span className="font-body text-zine-burntOrange/60 text-xs">
                      {openGroupId === g.id ? '▼' : '▶'}
                    </span>
                    <span className="font-display text-zine-burntOrange">{g.name}</span>
                    {g.description && (
                      <span className="font-body text-xs text-zine-burntOrange/70">{g.description}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(g.id)}
                    className="text-zine-burntOrange/60 underline text-xs font-body shrink-0"
                  >
                    remover
                  </button>
                </div>
                {openGroupId === g.id && (
                  <GroupMembers groupId={g.id} idToken={idToken} />
                )}
              </li>
            ))}
          </ul>
        )}
      </ZineFrame>
    </div>
  );
};

// ── Group Members (expandido dentro de um grupo) ────────────────────

const PAGE_SIZE_OPTIONS = [25, 50, 100, 300];

const GroupMembers: React.FC<{ groupId: string; idToken: string | null }> = ({ groupId, idToken }) => {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  async function refresh() {
    if (!idToken) return;
    const [m, u] = await Promise.all([
      fetchGroupMembers(groupId, idToken),
      fetchUsers(idToken),
    ]);
    setMembers(m);
    setAllUsers(u);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, [groupId, idToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRemove(userId: string) {
    if (!idToken) return;
    await removeGroupMember(groupId, userId, idToken);
    await refresh();
  }

  async function handleAddSelected() {
    if (!idToken || selected.size === 0) return;
    setAdding(true);
    try {
      for (const userId of selected) {
        await addGroupMember(groupId, userId, idToken);
      }
      setSelected(new Set());
      setShowAdd(false);
      setSearch('');
      setPage(0);
      await refresh();
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <LoadingState />;

  const memberIds = new Set(members.map((m) => m.id));

  // Usuários que NÃO estão no grupo, filtrados por busca
  const searchLower = search.toLowerCase();
  const available = allUsers.filter((u) => {
    if (memberIds.has(u.id)) return false;
    if (!search) return true;
    return (
      (u.email?.toLowerCase().includes(searchLower)) ||
      (u.displayName?.toLowerCase().includes(searchLower))
    );
  });

  const totalPages = Math.ceil(available.length / pageSize);
  const paged = available.slice(page * pageSize, (page + 1) * pageSize);
  const allPagedIds = paged.map((u) => u.id);
  const allPagedSelected = allPagedIds.length > 0 && allPagedIds.every((id) => selected.has(id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPagedSelected) {
        allPagedIds.forEach((id) => next.delete(id));
      } else {
        allPagedIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  return (
    <div className="mt-3 ml-5 flex flex-col gap-2">
      {/* Membros atuais */}
      <div className="font-body text-xs text-zine-burntOrange/60 font-bold">
        {members.length} membro(s)
      </div>
      {members.length > 0 && (
        <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <span className="font-body text-sm text-zine-burntOrange truncate">
                {m.displayName} <span className="text-zine-burntOrange/50">{m.email ?? ''}</span>
              </span>
              <button
                type="button"
                onClick={() => void handleRemove(m.id)}
                className="text-zine-burntOrange/40 hover:text-zine-burntOrange text-xs font-body shrink-0"
                title="Remover do grupo"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Adicionar membros */}
      {!showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="font-body text-xs text-zine-burntOrange/60 underline text-left"
        >
          + adicionar membros
        </button>
      ) : (
        <div className="flex flex-col gap-2 border-2 border-dashed border-zine-burntYellow rounded p-3 mt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-body text-xs text-zine-burntOrange font-bold">
              Adicionar ao grupo ({available.length} disponíveis)
            </span>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setSearch(''); setSelected(new Set()); setPage(0); }}
              className="font-body text-xs text-zine-burntOrange/40 underline"
            >
              fechar
            </button>
          </div>

          {/* Busca */}
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Filtrar por nome ou email..."
            className={inputClass + ' !text-sm !py-1.5'}
          />

          {/* Por página */}
          <div className="flex items-center gap-2 font-body text-xs text-zine-burntOrange/60">
            <span>Por página:</span>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setPageSize(n); setPage(0); }}
                className={`px-1.5 py-0.5 rounded ${pageSize === n ? 'bg-zine-burntYellow text-zine-cream font-bold' : 'underline'}`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Lista com checkboxes */}
          {paged.length > 0 && (
            <>
              <label className="flex items-center gap-2 font-body text-xs text-zine-burntOrange font-bold border-b border-zine-burntOrange/20 pb-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allPagedSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
                Marcar todos da página ({paged.length})
              </label>
              <ul className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
                {paged.map((u) => (
                  <li key={u.id}>
                    <label className="flex items-center gap-2 font-body text-sm text-zine-burntOrange cursor-pointer hover:bg-zine-burntYellow/10 px-1 py-0.5 rounded">
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="w-4 h-4 shrink-0"
                      />
                      <span className="truncate">
                        {u.displayName} <span className="text-zine-burntOrange/50">{u.email ?? ''}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          {available.length === 0 && (
            <p className="font-body text-xs text-zine-burntOrange/50 italic">
              {search ? 'Nenhum usuário encontrado.' : 'Todos os usuários já estão no grupo.'}
            </p>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between font-body text-xs text-zine-burntOrange/60">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="underline disabled:opacity-30 disabled:no-underline"
              >
                anterior
              </button>
              <span>{page + 1} / {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="underline disabled:opacity-30 disabled:no-underline"
              >
                próxima
              </button>
            </div>
          )}

          {/* Botão confirmar */}
          {selected.size > 0 && (
            <Button onClick={() => void handleAddSelected()} disabled={adding}>
              {adding ? 'Adicionando...' : `Adicionar ${selected.size} selecionado(s)`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Campaign History ─────────────────────────────────────────────────

const CampaignHistory: React.FC<{ idToken: string | null }> = ({ idToken }) => {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);

  useEffect(() => {
    if (!idToken) return;
    void fetchCampaigns(idToken).then(setCampaigns);
  }, [idToken]);

  return (
    <ZineFrame bg="cream">
      <h3 className="font-display text-xl text-zine-burntOrange mb-3">Histórico de envios</h3>
      {campaigns.length === 0 ? (
        <p className="font-body italic text-zine-burntOrange/70">Nenhum envio ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.map((c) => (
            <li key={c.id} className="flex items-center justify-between border-b border-zine-burntOrange/30 pb-2">
              <div className="flex flex-col">
                <span className="font-display text-zine-burntOrange">{c.subject}</span>
                <span className="font-body text-xs text-zine-burntOrange/70">
                  {new Date(c.sentAt).toLocaleDateString('pt-BR')} · {c.sentCount} enviado(s)
                </span>
              </div>
              <span className="font-body text-xs text-zine-burntOrange/50">{c.status}</span>
            </li>
          ))}
        </ul>
      )}
    </ZineFrame>
  );
};

// ── Email Config + Desinscritos ──────────────────────────────────────

const EmailConfigPanel: React.FC<{ idToken: string | null }> = ({ idToken }) => {
  const [autoEventEmail, setAutoEventEmail] = useState(true);
  const [unsubscribed, setUnsubscribed] = useState<UnsubscribedUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!idToken) return;
    try {
      const [config, unsubs] = await Promise.all([
        fetchEmailConfig(idToken),
        fetchUnsubscribed(idToken),
      ]);
      setAutoEventEmail(config.autoEventEmail);
      setUnsubscribed(unsubs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [idToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggleAutoEmail() {
    if (!idToken) return;
    const next = !autoEventEmail;
    setAutoEventEmail(next);
    await updateEmailConfig({ autoEventEmail: next }, idToken);
  }

  async function handleResubscribe(userId: string) {
    if (!idToken) return;
    if (!confirm('Reinscrever este usuário na newsletter?')) return;
    await resubscribeUser(userId, idToken);
    await refresh();
  }

  if (loading) return <LoadingState />;
  if (error) return <p className="font-body text-red-600">Erro: {error}</p>;

  return (
    <>
      <HelperBox>Aqui você configura o envio automático de emails e vê quem se desinscreveu da newsletter. Usuários desinscritos não recebem mais emails, mas você pode reinscrevê-los manualmente.</HelperBox>
      <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Configurações</h3>
        <label className="flex items-center gap-3 font-body text-zine-burntOrange cursor-pointer">
          <input
            type="checkbox"
            checked={autoEventEmail}
            onChange={() => void handleToggleAutoEmail()}
            className="w-5 h-5"
          />
          <div>
            <span className="font-bold">Email automático de próximo evento</span>
            <p className="text-xs text-zine-burntOrange/60">
              Quando ativado, envia automaticamente um email para todos os inscritos quando um novo evento é criado.
            </p>
          </div>
        </label>
      </ZineFrame>

      <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">
          Desinscritos ({unsubscribed.length})
        </h3>
        {unsubscribed.length === 0 ? (
          <p className="font-body italic text-zine-burntOrange/70">Nenhum desinscrito.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unsubscribed.map((u) => (
              <li key={u.id} className="flex items-center justify-between border-b border-zine-burntOrange/30 pb-2">
                <div className="flex flex-col">
                  <span className="font-display text-zine-burntOrange">{u.displayName}</span>
                  <span className="font-body text-xs text-zine-burntOrange/70">
                    {u.email ?? 'sem email'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleResubscribe(u.id)}
                  className="text-zine-burntOrange/60 underline text-xs font-body"
                >
                  reinscrever
                </button>
              </li>
            ))}
          </ul>
        )}
      </ZineFrame>
    </>
  );
};

export default NewsletterPanel;
