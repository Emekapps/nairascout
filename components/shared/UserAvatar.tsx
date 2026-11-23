'use client';

import { useState } from 'react';

export interface UserAvatarProps {
  avatarUrl?: string | null;
  displayName: string;
  username?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

function getInitials(displayName: string, username?: string): string {
  const cleaned = displayName.trim();
  if (cleaned) {
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const fallback = (username || 'NS').replace(/^@+/, '').trim();
  return (fallback.slice(0, 2) || 'NS').toUpperCase();
}

export function UserAvatar({
  avatarUrl,
  displayName,
  username,
  size = 'md',
  className = '',
}: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const cleanUrl = avatarUrl?.trim() || null;
  const showImage = Boolean(cleanUrl && failedSrc !== cleanUrl);
  const initials = getInitials(displayName, username);

  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-primary text-primary-foreground border border-primary-border font-sans font-bold select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      {showImage && cleanUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cleanUrl}
          alt={displayName || username || 'User avatar'}
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(cleanUrl)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
