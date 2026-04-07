import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSessionStore } from '@/store/sessionStore';
import LoginModal from '@/components/auth/LoginModal';
import UserAvatar from '@/components/common/UserAvatar';

const THEME_KEY = 'quartinho:theme';

function getInitialDark(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const Header: React.FC = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const role = useSessionStore((s) => s.role);
  const isAdminOrMod = role === 'admin' || role === 'moderator';
  const [loginOpen, setLoginOpen] = useState(false);
  const [dark, setDark] = useState(getInitialDark);

  const applyTheme = useCallback((isDark: boolean) => {
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  useEffect(() => { applyTheme(dark); }, [dark, applyTheme]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem(THEME_KEY, next ? 'dark' : 'light'); } catch { /* */ }
  };

  return (
    <>
      <header className="header-cq bg-zine-periwinkle dark:bg-zine-periwinkle-dark border-b-4 border-zine-cream dark:border-zine-cream/30">
        <div className="mx-auto max-w-[640px] px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo.svg" alt="Quartinho" className="h-9 w-9 shrink-0" />
            <h1
              className={`brand-name font-display text-zine-cream tracking-wide${isAdminOrMod ? ' brand-name--admin' : ''}`}
              style={{ fontSize: 'clamp(1rem, 4vw, 1.875rem)' }}
            >
              Quartinho
            </h1>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={dark ? 'modo claro' : 'modo escuro'}
              className="font-body text-lg text-zine-cream leading-none shrink-0"
              title={dark ? 'modo claro' : 'modo escuro'}
            >
              {dark ? '☀' : '☾'}
            </button>
            <Link
              to="/lojinha"
              className="font-body font-bold text-sm text-zine-cream hover:text-zine-burntYellow shrink-0"
            >
              lojinha
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/profile" className="flex items-center gap-1.5 hover:opacity-80">
                  <UserAvatar
                    src={useSessionStore.getState().avatarUrl}
                    name={user?.displayName ?? user?.email ?? 'U'}
                    size="sm"
                  />
                  <span className="font-body text-sm text-zine-cream truncate max-w-[80px] sm:max-w-[120px]">
                    {user?.displayName ?? user?.email ?? ''}
                  </span>
                </Link>
                {isAdminOrMod && (
                  <Link
                    to="/admin"
                    className="font-body font-bold text-sm text-zine-burntYellow border-2 border-zine-burntYellow px-2 py-1 hover:bg-zine-burntYellow hover:text-zine-cream shrink-0"
                  >
                    admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="font-body text-sm text-zine-cream border-2 border-zine-cream dark:border-zine-cream/30 px-2 py-1 hover:bg-zine-burntOrange shrink-0"
                >
                  sair
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="font-body font-bold text-sm text-zine-cream border-2 border-zine-cream dark:border-zine-cream/30 px-3 py-1 hover:bg-zine-burntYellow shrink-0"
              >
                entrar
              </button>
            )}
          </nav>
        </div>
      </header>
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
};

export default Header;
