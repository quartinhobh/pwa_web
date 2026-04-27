import React, { useEffect, useState } from 'react';
import { fetchLinkTree } from '@/services/api';
import { ZineFrame } from '@/components/common/ZineFrame';
import { LoadingState } from '@/components/common/LoadingState';
import type { LinkTreeItem } from '@/types';

const cardBgs = ['mint', 'burntYellow', 'periwinkle'] as const;

export const Links: React.FC = () => {
  const [links, setLinks] = useState<LinkTreeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLinkTree()
      .then(setLinks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <main className="flex flex-col items-center gap-4 max-w-[640px] mx-auto">
      <ZineFrame bg="mint">
        <h2 className="font-display text-2xl text-zine-cream text-center">
          Links
        </h2>
      </ZineFrame>

      {links.length === 0 ? (
        <ZineFrame bg="cream">
          <p className="font-body text-sm text-zine-burntOrange/60 text-center italic">
            Nenhum link no momento.
          </p>
        </ZineFrame>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          {links.map((link, i) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <ZineFrame
                bg={cardBgs[i % cardBgs.length]}
                wobble
                className="text-center transition-transform duration-150 group-hover:scale-[1.02] group-active:scale-[0.98]"
              >
                <span className="text-2xl">{link.emoji || '🔗'}</span>
                <span className="ml-3 font-display text-base text-zine-cream dark:text-zine-cream">
                  {link.title}
                </span>
              </ZineFrame>
            </a>
          ))}
        </div>
      )}
    </main>
  );
};

export default Links;
