import { useEffect, useState } from 'react';
import { useServiceWorker } from '@/hooks/useServiceWorker';

declare const __APP_VERSION__: string;

const VERSION_KEY = 'quartinho:app-version';

/**
 * UpdatePrompt — shows a banner when a new service worker is waiting.
 * The user clicks to activate the update and reload.
 */
export const UpdatePrompt: React.FC = () => {
  const { needRefresh, updateServiceWorker } = useServiceWorker();
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    localStorage.setItem(VERSION_KEY, __APP_VERSION__);
  }, []);

  const handleUpdate = () => {
    setUpdating(true);
    updateServiceWorker(true);
  };

  if (!needRefresh || updating) return null;

  return (
    <div
      role="alert"
      className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-[640px] bg-zine-periwinkle border-4 border-zine-cream p-4 font-body text-zine-cream shadow-lg"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="font-display text-xl leading-tight">
            tem versão nova!
          </p>
          <p className="text-sm mt-1">
            clica pra atualizar e ver as novidades.
          </p>
        </div>
        <button
          type="button"
          onClick={handleUpdate}
          className="bg-zine-burntYellow text-zine-cream font-bold italic px-4 py-2 border-4 border-zine-cream hover:bg-zine-burntOrange whitespace-nowrap"
        >
          atualizar
        </button>
      </div>
    </div>
  );
};

export default UpdatePrompt;
