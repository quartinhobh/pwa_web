import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/api', () => ({
  fetchUnsubscribed: vi.fn().mockResolvedValue([]),
  updateEmailConfig: vi.fn().mockResolvedValue(undefined),
  updateEmailTemplate: vi.fn(),
  resubscribeUser: vi.fn(),
}));

vi.mock('@/components/admin/HelperContext', () => ({
  useHelper: () => ({ helperOn: true, toggleHelper: vi.fn() }),
  HelperProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import React from 'react';
import { EmailConfigPanel } from '@/components/admin/NewsletterPanel';
import { updateEmailConfig, updateEmailTemplate } from '@/services/api';
import type { EmailTemplate } from '@/types';

function makeTemplate(key: EmailTemplate['key'], enabled: boolean): EmailTemplate {
  return {
    key,
    enabled,
    subject: `s-${key}`,
    body: `b-${key}`,
    updatedAt: 0,
    updatedBy: 'system',
  };
}

const ALL_TEMPLATES: EmailTemplate[] = [
  makeTemplate('confirmation', true),
  makeTemplate('waitlist', false),
  makeTemplate('promotion', true),
  makeTemplate('reminder', false),
  makeTemplate('venue_reveal', false),
  makeTemplate('rejected', false),
  makeTemplate('role_invite', true),
  makeTemplate('role_promotion', true),
];

beforeEach(() => {
  vi.clearAllMocks();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('EmailConfigPanel', () => {
  it('renders enabled/disabled summary with counts', () => {
    render(
      <EmailConfigPanel
        idToken="tok"
        initialConfig={{ autoEventEmail: true, pauseAllTransactional: false }}
        initialUnsubscribed={[]}
        templates={ALL_TEMPLATES}
        onTemplatesChange={vi.fn()}
        onGoToTemplates={vi.fn()}
      />,
    );

    // 4 enabled: confirmation, promotion, role_invite, role_promotion
    expect(screen.getByText(/4 habilitados/)).toBeInTheDocument();
    // 4 disabled
    expect(screen.getByText(/4 desabilitados/)).toBeInTheDocument();
    // Lists labels (both enabled and disabled)
    expect(screen.getByText(/confirmação de presença/)).toBeInTheDocument();
    expect(screen.getByText(/fila de espera/)).toBeInTheDocument();
  });

  it('renders master switch and persists toggle via updateEmailConfig', async () => {
    const user = userEvent.setup();
    render(
      <EmailConfigPanel
        idToken="tok"
        initialConfig={{ autoEventEmail: true, pauseAllTransactional: false }}
        initialUnsubscribed={[]}
        templates={ALL_TEMPLATES}
        onTemplatesChange={vi.fn()}
        onGoToTemplates={vi.fn()}
      />,
    );

    const pauseLabel = screen.getByText(/Pausar todos os envios transacionais/);
    const checkbox = pauseLabel.closest('label')!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    await user.click(checkbox);

    await waitFor(() => {
      expect(updateEmailConfig as Mock).toHaveBeenCalledWith(
        { pauseAllTransactional: true },
        'tok',
      );
    });
  });

  it('clicking "editar modelos" triggers onGoToTemplates', async () => {
    const user = userEvent.setup();
    const onGo = vi.fn();
    render(
      <EmailConfigPanel
        idToken="tok"
        initialConfig={{ autoEventEmail: true, pauseAllTransactional: false }}
        initialUnsubscribed={[]}
        templates={ALL_TEMPLATES}
        onTemplatesChange={vi.fn()}
        onGoToTemplates={onGo}
      />,
    );

    await user.click(screen.getByText(/editar modelos/));
    expect(onGo).toHaveBeenCalledTimes(1);
  });

  it('shows defaults banner when any RSVP template is enabled', () => {
    render(
      <EmailConfigPanel
        idToken="tok"
        initialConfig={{ autoEventEmail: true, pauseAllTransactional: false }}
        initialUnsubscribed={[]}
        templates={ALL_TEMPLATES}
        onTemplatesChange={vi.fn()}
        onGoToTemplates={vi.fn()}
      />,
    );
    expect(screen.getByText(/Novos defaults/)).toBeInTheDocument();
    expect(screen.getByText(/Desligar todos os RSVP agora/)).toBeInTheDocument();
  });

  it('hides defaults banner when all RSVP templates are disabled', () => {
    const allRsvpOff = ALL_TEMPLATES.map((t) =>
      ['confirmation','waitlist','promotion','reminder','venue_reveal','rejected'].includes(t.key)
        ? { ...t, enabled: false }
        : t,
    );
    render(
      <EmailConfigPanel
        idToken="tok"
        initialConfig={{ autoEventEmail: true, pauseAllTransactional: false }}
        initialUnsubscribed={[]}
        templates={allRsvpOff}
        onTemplatesChange={vi.fn()}
        onGoToTemplates={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Novos defaults/)).not.toBeInTheDocument();
  });

  it('bulk disable-all-RSVP calls updateEmailTemplate 6 times with enabled:false', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    (updateEmailTemplate as Mock).mockImplementation(async (key: string) => ({
      key, enabled: false, subject: 's', body: 'b', updatedAt: 1, updatedBy: 'u',
    }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <EmailConfigPanel
        idToken="tok"
        initialConfig={{ autoEventEmail: true, pauseAllTransactional: false }}
        initialUnsubscribed={[]}
        templates={ALL_TEMPLATES}
        onTemplatesChange={onChange}
        onGoToTemplates={vi.fn()}
      />,
    );

    await user.click(screen.getByText(/Desligar todos os RSVP agora/));

    await waitFor(() => {
      expect((updateEmailTemplate as Mock).mock.calls.length).toBe(6);
    });
    const calledKeys = (updateEmailTemplate as Mock).mock.calls.map((c) => c[0]).sort();
    expect(calledKeys).toEqual(
      ['confirmation','promotion','rejected','reminder','venue_reveal','waitlist'].sort(),
    );
    for (const call of (updateEmailTemplate as Mock).mock.calls) {
      expect(call[1]).toEqual({ enabled: false });
    }
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
