import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import { useShopData } from '@/hooks/useShopData';
import type { PixConfig } from '@/types';

function formatPrice(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * Generates a PIX BRCode payload (EMV standard) for a static QR code.
 * No fixed amount — payer enters the value in their bank app.
 */
function pixPayload(config: PixConfig): string {
  const tlv = (id: string, val: string) =>
    `${id}${val.length.toString().padStart(2, '0')}${val}`;

  const merchantAccount =
    tlv('00', 'br.gov.bcb.pix') + tlv('01', config.key);

  let payload =
    tlv('00', '01') + // format indicator
    tlv('01', '12') + // static QR
    tlv('26', merchantAccount) +
    tlv('52', '0000') + // merchant category (not applicable)
    tlv('53', '986') + // BRL
    // no tag 54 = no fixed amount
    tlv('58', 'BR') +
    tlv('59', config.beneficiary.slice(0, 25)) +
    tlv('60', config.city.slice(0, 15)) +
    tlv('62', tlv('05', '***')); // additional data

  // CRC16 (tag 63, placeholder)
  payload += '6304';
  const crc = crc16(payload);
  return payload + crc;
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function CopyButton({ text, label = 'copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="font-body text-sm px-3 py-1 bg-zine-burntOrange text-zine-cream rounded-sm transition-colors hover:bg-zine-burntOrange/80"
    >
      {copied ? 'copiado!' : label}
    </button>
  );
}

function PixQrCode({ config }: { config: PixConfig }) {
  const [src, setSrc] = useState<string | null>(null);
  const payload = pixPayload(config);

  useEffect(() => {
    void import('qrcode')
      .then((mod) => mod.default ?? mod)
      .then((QRCode) =>
        QRCode.toDataURL(payload, { width: 256, margin: 2 }),
      )
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [payload]);

  return (
    <div className="flex flex-col items-center gap-3">
      {src ? (
        <img src={src} alt="QR Code PIX" className="w-48 h-48" />
      ) : (
        <div className="w-48 h-48 bg-zine-cream dark:bg-zine-surface-dark border-4 border-dashed border-zine-burntYellow flex items-center justify-center font-body text-zine-burntOrange/50 text-sm">
          gerando QR…
        </div>
      )}
      <div className="flex flex-col gap-2">
        {config.key && <CopyButton text={config.key} label="copiar chave PIX" />}
        <CopyButton text={payload} label="copiar código QR" />
      </div>
    </div>
  );
}

export const Shop: React.FC = () => {
  const { products, pix } = useShopData(null);

  const hasPix = !!pix.key;
  if (products.length === 0 && !hasPix) {
    return (
      <main className="p-4">
        <ZineFrame bg="mint">
          <div className="text-center py-8">
            <h2 className="font-display text-2xl text-zine-cream mb-2">lojinha</h2>
            <p className="font-body text-zine-cream">em breve.</p>
          </div>
        </ZineFrame>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <h2 className="font-display text-2xl text-zine-burntOrange dark:text-zine-cream text-center">
        lojinha
      </h2>

      {products.length > 0 && (
        <div className="flex flex-col gap-3">
          {products.map((p) => (
            <ZineFrame key={p.id} bg="cream" borderColor="burntYellow">
              <div className="flex items-start gap-3">
                {p.emoji && (
                  <span className="text-3xl shrink-0">{p.emoji}</span>
                )}
                {p.imageUrl && (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="w-16 h-16 object-cover border-2 border-zine-cream shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg text-zine-burntOrange dark:text-zine-cream">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="font-body text-sm text-zine-burntOrange/70 dark:text-zine-cream/70">
                      {p.description}
                    </p>
                  )}
                </div>
                <span className="font-display text-lg text-zine-burntYellow shrink-0">
                  {formatPrice(p.price)}
                </span>
              </div>
            </ZineFrame>
          ))}
        </div>
      )}

      {hasPix && (
        <ZineFrame bg="periwinkle">
          <h3 className="font-display text-xl text-zine-cream text-center mb-3">
            pagar com PIX
          </h3>
          <PixQrCode config={pix} />
        </ZineFrame>
      )}
    </main>
  );
};

export default Shop;
