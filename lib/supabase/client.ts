import { createBrowserClient } from '@supabase/ssr';

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createSupabaseBrowserClient() {
  if (!isSupabaseBrowserConfigured()) {
    return null;
  }

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: isHttps
        ? {
            sameSite: 'none',
            secure: true,
            path: '/',
          }
        : {
            sameSite: 'lax',
            path: '/',
          },
    }
  );
}
