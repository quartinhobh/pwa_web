import React, { useEffect, useState } from 'react';

/**
 * BeforeInstallPromptEvent — non-standard but widely supported event fired by
 * Chromium browsers when the PWA install criteria are met. Not in lib.dom.d.ts,
 * so we declare the shape we actually use.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt: () => Promise<void>;
}

const DISMISS_KEY = 'quartinho:install-dismissed';

/**
 * InstallPrompt — custom Add-to-Home-Screen banner (Section 11).
 *
 * - Listens for `beforeinstallprompt`, stashes it, shows a zine-styled banner.
 * - User can accept (native prompt) or dismiss (suppressed via localStorage).
 * - Hidden entirely on browsers that don't fire the event (iOS Safari, etc.)
 *   so the UI never shows a dead button.
 */
export const InstallPrompt: React.FC = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(DISMISS_KEY) === '1') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installed = () => setVisible(false);
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const accept = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
      setVisible(false);
    }
  };

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // private mode — fail silently
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="install-prompt-title"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-[640px] bg-zine-periwinkle border-4 border-zine-cream p-4 font-body text-zine-cream shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p id="install-prompt-title" className="font-display text-xl leading-tight">
            instala o quartinho
          </p>
          <p className="text-sm mt-1">
            coloca na tela inicial pra abrir rapidinho e funcionar offline.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={accept}
          className="flex-1 bg-zine-burntYellow text-zine-cream font-bold italic px-4 py-2 border-4 border-zine-cream hover:bg-zine-burntOrange"
        >
          bora
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="px-4 py-2 border-4 border-zine-cream text-zine-cream hover:bg-zine-mint hover:text-zine-burntOrange"
        >
          agora não
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
