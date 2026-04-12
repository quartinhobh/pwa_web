import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  fetchEmailTemplates: vi.fn(),
  updateEmailTemplate: vi.fn(),
  restoreEmailTemplate: vi.fn(),
  sendTestEmail: vi.fn(),
}));

// HelperBox reads from HelperContext — mock so helper text is always visible
vi.mock('@/components/admin/HelperContext', () => ({
  useHelper: () => ({ helperOn: true, toggleHelper: vi.fn() }),
  HelperProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import React from 'react';
import { EmailTemplatesPanel } from '@/components/admin/EmailTemplatesPanel';
import { fetchEmailTemplates, updateEmailTemplate, sendTestEmail } from '@/services/api';
import type { EmailTemplate } from '@/types';

const makeMocks = () => ({
  fetchEmailTemplates: fetchEmailTemplates as Mock,
  updateEmailTemplate: updateEmailTemplate as Mock,
});

function makeTemplate(key: EmailTemplate['key'], overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    key,
    enabled: true,
    subject: `subject for ${key}`,
    body: `body for ${key}`,
    updatedAt: 0,
    updatedBy: 'system',
    ...overrides,
  };
}

const ALL_KEYS: EmailTemplate['key'][] = [
  'confirmation',
  'waitlist',
  'promotion',
  'reminder',
  'venue_reveal',
  'rejected',
];

const allTemplates: EmailTemplate[] = ALL_KEYS.map((k) => makeTemplate(k));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('EmailTemplatesPanel', () => {
  it('renders all 6 template cards after loading', async () => {
    const { fetchEmailTemplates: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue(allTemplates);

    render(<EmailTemplatesPanel idToken="tok" />);

    // wait for loading to finish
    await waitFor(() => expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument());

    // Each template card has a unique display name
    expect(screen.getByText('Confirmação de presença')).toBeInTheDocument();
    expect(screen.getByText('Entrada na fila de espera')).toBeInTheDocument();
    expect(screen.getByText('Saiu da fila — confirmado!')).toBeInTheDocument();
    expect(screen.getByText('Lembrete (dia anterior)')).toBeInTheDocument();
    expect(screen.getByText('Revelação do endereço')).toBeInTheDocument();
    expect(screen.getByText('Inscrição recusada')).toBeInTheDocument();
  });

  it('shows template name and description for each card', async () => {
    const { fetchEmailTemplates: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue(allTemplates);

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Confirmação de presença')).toBeInTheDocument());

    expect(screen.getByText('Enviado quando alguém confirma presença')).toBeInTheDocument();
    expect(screen.getByText('Enviado quando entra na fila de espera')).toBeInTheDocument();
  });

  it('toggle calls updateEmailTemplate with enabled: false when turned off', async () => {
    const { fetchEmailTemplates: mockFetch, updateEmailTemplate: mockUpdate } = makeMocks();
    mockFetch.mockResolvedValue([makeTemplate('confirmation', { enabled: true })]);
    mockUpdate.mockResolvedValue(makeTemplate('confirmation', { enabled: false }));

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Confirmação de presença')).toBeInTheDocument());

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith('confirmation', { enabled: false }, 'tok'),
    );
  });

  it('toggle calls updateEmailTemplate with enabled: true when turned on', async () => {
    const { fetchEmailTemplates: mockFetch, updateEmailTemplate: mockUpdate } = makeMocks();
    mockFetch.mockResolvedValue([makeTemplate('confirmation', { enabled: false })]);
    mockUpdate.mockResolvedValue(makeTemplate('confirmation', { enabled: true }));

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Confirmação de presença')).toBeInTheDocument());

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith('confirmation', { enabled: true }, 'tok'),
    );
  });

  it('clicking "editar" shows the editor view with subject and body fields', async () => {
    const { fetchEmailTemplates: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue([makeTemplate('confirmation')]);

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Confirmação de presença')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'editar' }));

    // The editor renders an input (subject) and a textarea (body)
    const textboxes = screen.getAllByRole('textbox');
    // subject input + body textarea = at least 2
    expect(textboxes.length).toBeGreaterThanOrEqual(2);
    // The back button is only visible in editor view
    expect(screen.getByText(/← voltar/i)).toBeInTheDocument();
  });

  it('clicking "← voltar" returns to list view', async () => {
    const { fetchEmailTemplates: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue([makeTemplate('confirmation')]);

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Confirmação de presença')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'editar' }));

    // editor is visible — textboxes rendered
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(2);

    await userEvent.click(screen.getByText(/← voltar/i));

    // back to list — edit button visible again, textboxes gone
    expect(screen.getByRole('button', { name: 'editar' })).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('variable chips are shown in editor for base variables', async () => {
    const { fetchEmailTemplates: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue([makeTemplate('confirmation')]);

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Confirmação de presença')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'editar' }));

    expect(screen.getByRole('button', { name: '{nome}' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '{evento}' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '{data}' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '{horario}' })).toBeInTheDocument();
  });

  it('editor shows {local} chip for reminder template', async () => {
    const { fetchEmailTemplates: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue([makeTemplate('reminder')]);

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Lembrete (dia anterior)')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'editar' }));

    expect(screen.getByRole('button', { name: '{local}' })).toBeInTheDocument();
  });

  it('preview section replaces variables with sample data', async () => {
    const { fetchEmailTemplates: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue([
      makeTemplate('confirmation', { subject: 'Olá {nome}!', body: 'Evento: {evento}' }),
    ]);

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Confirmação de presença')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'editar' }));

    // Preview section should show interpolated values
    expect(screen.getByText(/Olá Maria!/)).toBeInTheDocument();
    expect(screen.getByText(/Evento: Quartinho #12/)).toBeInTheDocument();
  });

  it('"Salvar" button calls updateEmailTemplate with current subject and body', async () => {
    const { fetchEmailTemplates: mockFetch, updateEmailTemplate: mockUpdate } = makeMocks();
    const template = makeTemplate('confirmation', {
      subject: 'original subject',
      body: 'original body',
    });
    mockFetch.mockResolvedValue([template]);
    mockUpdate.mockResolvedValue({ ...template, subject: 'new subject', body: 'new body' });

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Confirmação de presença')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'editar' }));

    // Subject is the first textbox, body textarea is the second
    const [subjectInput, bodyInput] = screen.getAllByRole('textbox');
    await userEvent.clear(subjectInput);
    await userEvent.type(subjectInput, 'new subject');

    await userEvent.clear(bodyInput);
    await userEvent.type(bodyInput, 'new body');

    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        'confirmation',
        { subject: 'new subject', body: 'new body' },
        'tok',
      ),
    );
  });

  it('"Restaurar padrão" shows confirm dialog', async () => {
    const { fetchEmailTemplates: mockFetch } = makeMocks();
    mockFetch.mockResolvedValue([makeTemplate('confirmation')]);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Confirmação de presença')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'editar' }));

    await userEvent.click(screen.getByText(/restaurar padrão/i));

    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('"enviar teste pro meu email" calls sendTestEmail with current subject/body overrides', async () => {
    const { fetchEmailTemplates: mockFetch } = makeMocks();
    const mockSend = sendTestEmail as Mock;
    mockFetch.mockResolvedValue([
      makeTemplate('confirmation', { subject: 'subj', body: 'body text' }),
    ]);
    mockSend.mockResolvedValue({ sentTo: 'admin@test.com', sentAt: 123 });

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Confirmação de presença')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'editar' }));

    await userEvent.click(screen.getByRole('button', { name: /enviar teste pro meu email/i }));

    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith('tok', 'confirmation', {
        email: undefined,
        subjectOverride: 'subj',
        bodyOverride: 'body text',
      }),
    );

    await waitFor(() =>
      expect(screen.getByText(/verifica sua caixa/i)).toBeInTheDocument(),
    );
  });

  it('send test shows error message when api fails', async () => {
    const { fetchEmailTemplates: mockFetch } = makeMocks();
    const mockSend = sendTestEmail as Mock;
    mockFetch.mockResolvedValue([makeTemplate('confirmation')]);
    mockSend.mockRejectedValue(new Error('boom'));

    render(<EmailTemplatesPanel idToken="tok" />);

    await waitFor(() => expect(screen.getByText('Confirmação de presença')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'editar' }));
    await userEvent.click(screen.getByRole('button', { name: /enviar teste pro meu email/i }));

    await waitFor(() => expect(screen.getByText(/não foi possível enviar/i)).toBeInTheDocument());
  });

  it('does not fetch when idToken is null', () => {
    const { fetchEmailTemplates: mockFetch } = makeMocks();

    render(<EmailTemplatesPanel idToken={null} />);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
