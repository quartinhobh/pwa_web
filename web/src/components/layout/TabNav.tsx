import React from 'react';
import { NavLink } from 'react-router-dom';

interface Tab {
  to: string;
  label: string;
}

const TABS: Tab[] = [
  { to: '/', label: 'ouvir' },
  { to: '/archive', label: 'arquivo' },
  { to: '/locais', label: 'locais' },
];

/**
 * TabNav — primary navigation using the photo-strip grid (Section 13.7).
 * Cells separated by 1px cream dividers, no gap. Active tab fills with
 * burntYellow background.
 */
export const TabNav: React.FC = () => {
  return (
    <nav className="bg-zine-cream dark:bg-zine-surface-dark border-b-4 border-zine-cream dark:border-zine-cream/30">
      <div
        className="mx-auto max-w-[640px] grid font-body text-base"
        style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}
      >
        {TABS.map((tab, i) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              [
                'text-center px-4 py-3',
                i < TABS.length - 1 ? 'border-r-2 border-zine-burntYellow' : '',
                isActive
                  ? 'bg-zine-burntYellow text-zine-cream font-bold italic'
                  : 'text-zine-burntOrange hover:bg-zine-mint',
              ]
                .filter(Boolean)
                .join(' ')
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default TabNav;
