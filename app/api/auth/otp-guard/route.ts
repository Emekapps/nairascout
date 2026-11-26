import { NextRequest, NextResponse } from 'next/server';
import { verifyMutationOrigin } from '@/lib/auth/session';

const OTP_RESEND_COOLDOWN_MS = 60_000;
const OTP_VALIDITY_WINDOW_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

interface OtpState {
  lastSentAt: number;
  windowStartedAt: number;
  failedAttempts: number;
}

const globalForOtp = globalThis as unknown as {
  __nsOtpGuardStore?: Map<string, OtpState>;
};

function getOtpStore(): Map<string, OtpState> {
  if (!globalForOtp.__nsOtpGuardStore) {
    globalForOtp.__nsOtpGuardStore = new Map<string, OtpState>();
  }
  return globalForOtp.__nsOtpGuardStore;
}

// NS-AUT-002: Enforce 60-second resend cooldown, 10-minute OTP validity, and max 5 failed attempts
export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = String(body?.action || '');
    const email = String(body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }

    const store = getOtpStore();
    const now = Date.now();
    const current = store.get(email);

    if (action === 'request') {
      if (current && now - current.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil(
          (OTP_RESEND_COOLDOWN_MS - (now - current.lastSentAt)) / 1000
        );
        return NextResponse.json(
          {
            error: `Please wait ${retryAfterSeconds}s before requesting a new verification code.`,
            retryAfterSeconds,
          },
          { status: 429 }
        );
      }

      store.set(email, {
        lastSentAt: now,
        windowStartedAt: now,
        failedAttempts: 0,
      });

      return NextResponse.json({
        ok: true,
        cooldownSeconds: 60,
        validityMinutes: 10,
        maxAttempts: OTP_MAX_ATTEMPTS,
      });
    }

    if (action === 'attempt_check') {
      if (
        current &&
        now - current.windowStartedAt <= OTP_VALIDITY_WINDOW_MS &&
        current.failedAttempts >= OTP_MAX_ATTEMPTS
      ) {
        return NextResponse.json(
          {
            error:
              'Maximum 5 verification attempts reached for this code. Request a new 6-digit code.',
            locked: true,
            attemptsRemaining: 0,
          },
          { status: 429 }
        );
      }
      return NextResponse.json({
        ok: true,
        locked: false,
        attemptsRemaining: current
          ? Math.max(0, OTP_MAX_ATTEMPTS - current.failedAttempts)
          : OTP_MAX_ATTEMPTS,
      });
    }

    if (action === 'attempt_failed') {
      const next: OtpState =
        !current || now - current.windowStartedAt > OTP_VALIDITY_WINDOW_MS
          ? { lastSentAt: current?.lastSentAt ?? now, windowStartedAt: now, failedAttempts: 1 }
          : { ...current, failedAttempts: current.failedAttempts + 1 };

      store.set(email, next);
      const locked = next.failedAttempts >= OTP_MAX_ATTEMPTS;
      return NextResponse.json(
        {
          ok: !locked,
          locked,
          attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - next.failedAttempts),
          error: locked
            ? 'Maximum 5 verification attempts reached for this code. Request a new 6-digit code.'
            : undefined,
        },
        { status: locked ? 429 : 200 }
      );
    }

    if (action === 'attempt_succeeded') {
      store.delete(email);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported OTP guard action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid OTP guard request.' }, { status: 400 });
  }
}
