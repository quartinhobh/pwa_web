import React, { useState } from 'react';
import type { AggregatedCredits } from '@/types';

export interface CreditsPanelProps {
  credits?: AggregatedCredits;
}

function creditRow(label: string, value?: string): React.ReactNode {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-zine-burntOrange/50 shrink-0">{label}</span>
      <span className="text-zine-burntOrange">{value}</span>
    </div>
  );
}

function genreBadge(name: string): React.ReactNode {
  return (
    <span
      key={name}
      className="inline-block bg-zine-burntYellow/20 dark:bg-zine-cream/20 text-zine-burntYellow dark:text-zine-cream text-xs px-1.5 py-0.5 rounded"
    >
      {name}
    </span>
  );
}

const ROLE_PT: Record<string, string> = {
  vocal: 'vocal',
  'background vocals': 'vocal de apoio',
  'lead vocals': 'vocal principal',
  guitar: 'guitarra',
  'acoustic guitar': 'violão',
  'electric guitar': 'guitarra',
  'bass guitar': 'baixo',
  bass: 'baixo',
  drums: 'bateria',
  'drums (drum set)': 'bateria',
  percussion: 'percussão',
  piano: 'piano',
  keyboard: 'teclado',
  synthesizer: 'sintetizador',
  organ: 'órgão',
  strings: 'cordas',
  violin: 'violino',
  cello: 'violoncelo',
  saxophone: 'saxofone',
  trumpet: 'trompete',
  trombone: 'trombone',
  flute: 'flauta',
  clarinet: 'clarinete',
  programming: 'programação',
  arranger: 'arranjo',
  'instrument arranger': 'arranjo',
  conductor: 'regência',
  producer: 'produção',
  'assistant producer': 'assistente de produção',
  engineer: 'engenharia de som',
  'assistant engineer': 'assistente de gravação',
  editor: 'edição',
  mix: 'mixagem',
  mixer: 'mixagem',
  recording: 'gravação',
  mastering: 'masterização',
  instrument: '',
};

function translateRole(role: string): string {
  return ROLE_PT[role.toLowerCase()] ?? role;
}

function isProductionRole(role: string): boolean {
  const r = role.toLowerCase();
  return (
    r.includes('producer') ||
    r.includes('engineer') ||
    r.includes('mix') ||
    r.includes('master') ||
    r.includes('record') ||
    r.includes('editor') ||
    r.includes('arranged by') ||
    r.includes('cover') ||
    r.includes('lacquer') ||
    r.includes('photography') ||
    r.includes('artwork') ||
    r.includes('design') ||
    r.includes('management') ||
    r.includes('manager') ||
    r.includes('booking') ||
    r.includes('promotion') ||
    r.includes('supervised') ||
    r.includes('director') ||
    r.includes('coordinator') ||
    r.includes('executive') ||
    r === 'conductor' ||
    r.includes('conductor')
  );
}

function performerRow(p: {
  name: string;
  instruments: string[];
  trackCount: number;
  totalTracks: number;
}): React.ReactNode {
  const roleStr = p.instruments
    .filter((i) => i !== 'instrument')
    .map(translateRole)
    .filter(Boolean)
    .join(', ');
  const cleanName = p.name.replace(/\s*\(\d+\)$/, '');

  return (
    <div key={p.name} className="flex items-baseline gap-2 text-sm">
      <span className="text-zine-burntOrange">{cleanName}</span>
      {roleStr && (
        <span className="text-zine-burntOrange/40 text-xs">{roleStr}</span>
      )}
    </div>
  );
}

export const CreditsPanel: React.FC<CreditsPanelProps> = ({
  credits: initialCredits,
}) => {
  const [open, setOpen] = useState(false);

  const credits = initialCredits;

  if (!credits) return null;

  const hasAlbumInfo =
    credits.label ||
    credits.releaseType ||
    credits.country ||
    credits.releaseYear ||
    (credits.genres && credits.genres.length > 0);
  const musicians = credits.performers.filter((p) =>
    p.instruments.some((r) => !isProductionRole(r)),
  );
  const production = credits.performers.filter((p) =>
    p.instruments.every((r) => isProductionRole(r)),
  );
  const hasPerformers = credits.performers && credits.performers.length > 0;

  if (!hasAlbumInfo && !hasPerformers) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between font-body text-sm text-zine-burntOrange/70 hover:text-zine-burntOrange transition-colors"
      >
        <span>ficha técnica</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 space-y-3 font-body text-sm">
          {hasAlbumInfo && (
            <div className="bg-zine-cream/40 dark:bg-zine-surface-dark/40 rounded p-3 space-y-1">
              <h3 className="font-display text-xs text-zine-burntYellow tracking-wider mb-2">
                disco
              </h3>
              {creditRow('lançamento', credits.releaseYear)}
              {creditRow('tipo', credits.releaseType)}
              {creditRow('país', credits.country?.toUpperCase())}
              {creditRow('gravadora', credits.label)}
              {creditRow('catálogo', credits.catalogNumber)}
              {credits.genres && credits.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {credits.genres.map((g) => genreBadge(g))}
                </div>
              )}
            </div>
          )}

          {musicians.length > 0 && (
            <div className="bg-zine-cream/40 dark:bg-zine-surface-dark/40 rounded p-3 space-y-1">
              <h3 className="font-display text-xs text-zine-burntYellow tracking-wider mb-2">
                músicos
              </h3>
              {musicians.map((p) => performerRow(p))}
            </div>
          )}

          {production.length > 0 && (
            <div className="bg-zine-cream/40 dark:bg-zine-surface-dark/40 rounded p-3 space-y-1">
              <h3 className="font-display text-xs text-zine-burntYellow tracking-wider mb-2">
                produção
              </h3>
              {production.map((p) => performerRow(p))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CreditsPanel;
