'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { SessionSecurityGuard } from '@/components/auth/SessionSecurityGuard';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SessionSecurityGuard />
      {children}
    </NextThemesProvider>
  );
}
