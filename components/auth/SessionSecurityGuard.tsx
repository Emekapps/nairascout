'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// NS-AUT-004: 30-minute idle timeout & 7-day absolute session lifetime
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ABSOLUTE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const KEY_LAST_ACTIVITY = 'ns_last_activity';
const KEY_SESSION_STARTED = 'ns_session_started_at';
const KEY_SESSION_USER = 'ns_session_user_id';

function clearSessionMarkers() {
  try {
    localStorage.removeItem(KEY_LAST_ACTIVITY);
    localStorage.removeItem(KEY_SESSION_STARTED);
    localStorage.removeItem(KEY_SESSION_USER);
  } catch {
    // ignore storage errors
  }
}

export function SessionSecurityGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const signingOutRef = useRef(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let disposed = false;

    const touchActivity = () => {
      try {
        const now = Date.now();
        const prev = Number(localStorage.getItem(KEY_LAST_ACTIVITY) || 0);
        if (now - prev >= 15_000) {
          localStorage.setItem(KEY_LAST_ACTIVITY, String(now));
        }
      } catch {
        // ignore storage errors
      }
    };

    const forceExpire = async (reason: 'idle_timeout' | 'session_expired') => {
      if (signingOutRef.current || disposed) return;
      signingOutRef.current = true;
      clearSessionMarkers();
      try {
        await supabase.auth.signOut();
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'NairaScout',
          },
          body: JSON.stringify({ action: 'logout' }),
        }).catch(() => undefined);
      } finally {
        if (!pathname?.startsWith('/auth/login')) {
          router.replace(`/auth/login?reason=${reason}`);
        }
      }
    };

    const evaluateSession = async () => {
      if (disposed || signingOutRef.current) return;
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user) {
        clearSessionMarkers();
        return;
      }

      const now = Date.now();
      try {
        const trackedUser = localStorage.getItem(KEY_SESSION_USER);
        if (trackedUser !== session.user.id) {
          localStorage.setItem(KEY_SESSION_USER, session.user.id);
          localStorage.setItem(KEY_SESSION_STARTED, String(now));
          localStorage.setItem(KEY_LAST_ACTIVITY, String(now));
          return;
        }

        const startedAt = Number(localStorage.getItem(KEY_SESSION_STARTED) || 0) || now;
        const lastActivity = Number(localStorage.getItem(KEY_LAST_ACTIVITY) || 0) || now;

        if (!localStorage.getItem(KEY_SESSION_STARTED)) {
          localStorage.setItem(KEY_SESSION_STARTED, String(now));
        }
        if (!localStorage.getItem(KEY_LAST_ACTIVITY)) {
          localStorage.setItem(KEY_LAST_ACTIVITY, String(now));
        }

        if (now - startedAt > ABSOLUTE_LIFETIME_MS) {
          await forceExpire('session_expired');
          return;
        }
        if (now - lastActivity > IDLE_TIMEOUT_MS) {
          await forceExpire('idle_timeout');
          return;
        }
      } catch {
        // ignore storage errors
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const now = Date.now();
      if (event === 'SIGNED_OUT' || !session?.user) {
        signingOutRef.current = false;
        clearSessionMarkers();
        return;
      }
      if (event === 'SIGNED_IN') {
        signingOutRef.current = false;
        try {
          localStorage.setItem(KEY_SESSION_USER, session.user.id);
          localStorage.setItem(KEY_SESSION_STARTED, String(now));
          localStorage.setItem(KEY_LAST_ACTIVITY, String(now));
        } catch {
          // ignore
        }
      }
    });

    evaluateSession();

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'scroll',
      'touchstart',
    ];
    for (const evt of activityEvents) {
      window.addEventListener(evt, touchActivity, { passive: true });
    }
    const interval = window.setInterval(evaluateSession, 30_000);

    return () => {
      disposed = true;
      authListener.subscription.unsubscribe();
      for (const evt of activityEvents) {
        window.removeEventListener(evt, touchActivity);
      }
      window.clearInterval(interval);
    };
  }, [pathname, router]);

  return null;
}
