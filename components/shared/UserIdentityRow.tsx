'use client';

import type { ReactNode } from 'react';
import { UserAvatar, type UserAvatarProps } from './UserAvatar';

export interface UserIdentityRowProps {
  avatarUrl?: string | null;
  displayName: string;
  username: string;
  badge?: ReactNode;
  subtitle?: ReactNode;
  size?: UserAvatarProps['size'];
  className?: string;
}

export function UserIdentityRow({
  avatarUrl,
  displayName,
  username,
  badge,
  subtitle,
  size = 'md',
  className = '',
}: UserIdentityRowProps) {
  const cleanHandle = username.replace(/^@+/, '');

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <UserAvatar
        avatarUrl={avatarUrl}
        displayName={displayName}
        username={cleanHandle}
        size={size}
      />
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-sans text-sm font-semibold text-foreground truncate">
            {displayName}
          </span>
          {badge}
        </div>
        <span className="font-sans text-xs text-muted-foreground truncate">
          @{cleanHandle}
        </span>
        {subtitle && (
          <span className="font-sans text-[11px] text-muted-foreground truncate mt-0.5">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
