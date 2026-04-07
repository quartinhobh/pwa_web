import React from 'react';

type AvatarSize = 'sm' | 'md' | 'lg';

interface UserAvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
}

const SIZES: Record<AvatarSize, number> = { sm: 28, md: 40, lg: 64 };

const PALETTE = [
  '#E8A42C', // burntYellow
  '#8B9FD4', // periwinkle
  '#98D9C2', // mint
  '#D97642', // burntOrange
  '#C4A6E0', // lavender
  '#E07878', // coral
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return (name[0] ?? '?').toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
}) => {
  const px = SIZES[size];
  const fontSize = Math.round(px * 0.4);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={px}
        height={px}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }

  const bg = PALETTE[hashName(name) % PALETTE.length];
  return (
    <div
      aria-label={name}
      className={`rounded-full shrink-0 flex items-center justify-center font-display text-zine-cream select-none ${className}`}
      style={{ width: px, height: px, fontSize, backgroundColor: bg }}
    >
      {getInitials(name)}
    </div>
  );
};

export default UserAvatar;
