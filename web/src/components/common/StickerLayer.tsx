import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useStickerSpawner } from '@/hooks/useStickerSpawner';
import { useConfettiBurst, ConfettiLayer } from '@/components/common/Confetti';

/**
 * StickerLayer — floats decorative stickers over the whole app. Renders a
 * transparent, pointer-events-none overlay that's above normal content but
 * below the global grain overlay (z-9999). Each sticker is an accessible
 * button; clicking (or activating via keyboard) triggers a falling animation
 * and the element is removed after the animation completes.
 *
 * Mounted once in App.tsx.
 */
export default function StickerLayer() {
  const { stickers, dismiss } = useStickerSpawner();
  const { particles, burst } = useConfettiBurst();
  const prevStickerCountRef = useRef(0);

  useEffect(() => {
    if (stickers.length > prevStickerCountRef.current && stickers.length > 0) {
      const lastSticker = stickers[stickers.length - 1];
      burst(lastSticker.leftPct, lastSticker.topPct);
    }
    prevStickerCountRef.current = stickers.length;
  }, [stickers, burst]);

  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none z-[60]"
        aria-hidden="false"
        data-testid="sticker-layer"
      >
        {stickers.map((s) => {
          const style = {
            top: `${s.topPct.toString()}%`,
            left: `${s.leftPct.toString()}%`,
            touchAction: 'manipulation',
            '--sticker-rot': `${s.rotationDeg.toString()}deg`,
          } as CSSProperties;
          return (
            <button
              key={s.id}
              type="button"
              aria-label="dismiss sticker"
              onClick={() => { dismiss(s.id); }}
              className={`sticker ${s.falling ? 'sticker-fall' : 'sticker-spawn'} absolute pointer-events-auto p-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-zine-burntOrange/70 rounded-sm`}
              style={style}
            >
              <img
                src={`/stickers/${s.asset}`}
                alt=""
                draggable={false}
                className="block w-[88px] h-[88px] sm:w-[112px] sm:h-[112px] select-none"
                style={{
                  filter:
                    'drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(2px 2px 0 #fff) drop-shadow(-2px 2px 0 #fff) drop-shadow(2px -2px 0 #fff) drop-shadow(-2px -2px 0 #fff) drop-shadow(3px 3px 0 rgba(0,0,0,0.35))',
                }}
              />
            </button>
          );
        })}
      </div>
      <ConfettiLayer particles={particles} />
    </>
  );
}
