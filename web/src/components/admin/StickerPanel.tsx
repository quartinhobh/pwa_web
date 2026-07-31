import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import HelperBox, { NoticeBanner } from '@/components/admin/HelperBox';
import { LoadingState } from '@/components/common/LoadingState';
import { useIdToken } from '@/hooks/useIdToken';
import { useApiCache } from '@/store/apiCache';
import { stickerAssets } from '@/data/stickers';
import {
  fetchStickerConfig,
  updateStickerConfig as apiUpdateStickerConfig,
} from '@/services/api';
import type { StickerConfig } from '@/types';

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange w-full';

export const StickerPanel: React.FC = () => {
  const idToken = useIdToken();
  const [config, setConfig] = useState<StickerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    void fetchStickerConfig()
      .then(setConfig)
      .finally(() => { setLoading(false); });
  }, []);

  function update<K extends keyof StickerConfig>(key: K, value: StickerConfig[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  }

  function toggleAsset(asset: string) {
    setConfig((c) => {
      if (!c) return c;
      const has = c.enabledAssets.includes(asset);
      return {
        ...c,
        enabledAssets: has
          ? c.enabledAssets.filter((a) => a !== asset)
          : [...c.enabledAssets, asset],
      };
    });
  }

  async function handleSave() {
    if (!config || !idToken) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await apiUpdateStickerConfig(
        {
          enabled: config.enabled,
          maxConcurrent: config.maxConcurrent,
          spawnMinSeconds: config.spawnMinSeconds,
          spawnMaxSeconds: config.spawnMaxSeconds,
          maxBeforeCooldown: config.maxBeforeCooldown,
          cooldownHours: config.cooldownHours,
          enabledAssets: config.enabledAssets,
        },
        idToken,
      );
      setConfig(updated);
      // Invalidate the persisted cache so the next pageload (or other tab)
      // pulls the fresh values instead of the 1h-old snapshot.
      useApiCache.getState().invalidate('stickerConfig:global');
      setSavedAt(Date.now());
    } catch (err) {
      setError(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function handleResetCooldown() {
    setError(null);
    setOk(null);
    try {
      localStorage.removeItem('qbh:stickerCooldown');
      setOk('Cooldown local resetado. Recarregue a página pra ver os stickers voltarem.');
    } catch {
      setError('Não foi possível acessar o localStorage.');
    }
  }

  if (loading || !config) return <LoadingState />;

  return (
    <div className="space-y-4">
      <NoticeBanner kind="error" message={error} onDismiss={() => setError(null)} />
      <NoticeBanner kind="ok" message={ok} onDismiss={() => setOk(null)} />
      <HelperBox>
        Aqui você controla os stickers que flutuam pela tela. A ideia é que sejam uma surpresa, então valores baixos e intervalos longos funcionam melhor. Salve no fim pra aplicar pra todo mundo (a próxima visita já pega).
      </HelperBox>

      <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Comportamento</h3>
        <div className="flex flex-col gap-4">
          <HelperBox>
            <strong>Ligado/Desligado:</strong> kill switch geral. Se desligar, ninguém vê stickers.
          </HelperBox>
          <label className="flex items-center gap-3 font-body text-zine-burntOrange dark:text-zine-cream cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
              className="w-5 h-5 accent-zine-burntOrange"
            />
            <span>Stickers ligados</span>
          </label>

          <HelperBox>
            <strong>Máximo na tela:</strong> quantos stickers podem aparecer ao mesmo tempo. 1–2 deixa raro e gostoso, 5+ vira poluição.
          </HelperBox>
          <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
            <span>Máximo na tela ao mesmo tempo</span>
            <input
              type="number"
              min={0}
              max={20}
              value={config.maxConcurrent}
              onChange={(e) => update('maxConcurrent', Number(e.target.value))}
              className={inputClass}
            />
          </label>

          <HelperBox>
            <strong>Intervalo de aparição:</strong> entre cada sticker novo, espera um tempo aleatório entre min e max segundos. Quanto maior o intervalo, mais raro e surpresa.
          </HelperBox>
          <div className="grid grid-cols-2 gap-3">
            <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
              <span>Intervalo mínimo (segundos)</span>
              <input
                type="number"
                min={1}
                value={config.spawnMinSeconds}
                onChange={(e) => update('spawnMinSeconds', Number(e.target.value))}
                className={inputClass}
              />
            </label>
            <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
              <span>Intervalo máximo (segundos)</span>
              <input
                type="number"
                min={1}
                value={config.spawnMaxSeconds}
                onChange={(e) => update('spawnMaxSeconds', Number(e.target.value))}
                className={inputClass}
              />
            </label>
          </div>

          <HelperBox>
            <strong>Limite e cooldown:</strong> depois que o usuário viu N stickers numa visita, eles param de aparecer e só voltam depois de X horas. Isso evita que vire trilho. <em>Coloque limite = 0 pra desativar o cooldown.</em>
          </HelperBox>
          <div className="grid grid-cols-2 gap-3">
            <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
              <span>Limite por sessão</span>
              <input
                type="number"
                min={0}
                value={config.maxBeforeCooldown}
                onChange={(e) => update('maxBeforeCooldown', Number(e.target.value))}
                className={inputClass}
              />
            </label>
            <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
              <span>Cooldown (horas)</span>
              <input
                type="number"
                min={0}
                value={config.cooldownHours}
                onChange={(e) => update('cooldownHours', Number(e.target.value))}
                className={inputClass}
              />
            </label>
          </div>
        </div>
      </ZineFrame>

      <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Quais sticker podem aparecer</h3>
        <HelperBox>
          Marque só os que você quer ver. Desmarcados nunca aparecem. Útil pra desativar um que ficou estranho sem precisar deletar o arquivo.
        </HelperBox>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
          {stickerAssets.map((asset) => {
            const enabled = config.enabledAssets.includes(asset);
            return (
              <label
                key={asset}
                className="flex items-center gap-2 font-body text-sm text-zine-burntOrange dark:text-zine-cream cursor-pointer p-2 border-2 border-zine-burntYellow/40 hover:border-zine-burntOrange"
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleAsset(asset)}
                  className="accent-zine-burntOrange"
                />
                <img src={`/stickers/${asset}`} alt="" className="w-8 h-8" />
                <span className="truncate">{asset.replace('.svg', '')}</span>
              </label>
            );
          })}
        </div>
      </ZineFrame>

      <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Ações</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'salvando...' : 'Salvar configuração'}
          </Button>
          <Button type="button" onClick={handleResetCooldown}>
            Resetar meu cooldown local
          </Button>
          {savedAt && (
            <span className="font-body text-xs text-zine-burntOrange/60">
              salvo às {new Date(savedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <HelperBox>
          O <strong>resetar cooldown</strong> só afeta o seu navegador — útil pra testar os ajustes sem esperar as horas de cooldown passarem.
        </HelperBox>
      </ZineFrame>
    </div>
  );
};

export default StickerPanel;
