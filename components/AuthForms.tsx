'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from '@/lib/supabase/client';
import { ThemeToggle } from './layout/ThemeToggle';

async function provisionPostgreSqlProfile(
  payload?: {
    displayName?: string;
    username?: string;
    locationState?: string;
    referralEventId?: string | null;
    referralScoutUsername?: string | null;
  },
  accessToken?: string | null
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'NairaScout',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch('/api/auth/provision', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload ?? {}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Could not provision your PostgreSQL Scout record.');
  }
  return data;
}

export function LoginForm({ initialError = null }: { initialError?: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supabaseConfigured = isSupabaseBrowserConfigured();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }

      await provisionPostgreSqlProfile(undefined, data.session?.access_token);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    setBusy(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (otpError) {
        setError(otpError.message);
        return;
      }
      setInfo(`Verification code sent to ${email.trim()}. Check your inbox and enter the 6-digit OTP below.`);
      setOtpStep('verify');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email',
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      await provisionPostgreSqlProfile(undefined, data.session?.access_token);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to Marketplace
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-brand font-extrabold text-xl tracking-tight text-foreground">
              NairaScout
            </span>
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-2xl p-7 space-y-6">
          <div>
            <h1 className="font-sans text-2xl font-bold text-foreground">
              Sign In to NairaScout
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              One primary identity across Scout referrals, Seller operations, and your Wallet.
            </p>
          </div>

          {!supabaseConfigured && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-300">
              Supabase Auth environment variables are missing. Configure{' '}
              <span className="font-sans">NEXT_PUBLIC_SUPABASE_URL</span>,{' '}
              <span className="font-sans">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>, and{' '}
              <span className="font-sans">DATABASE_URL</span> to enable live authentication.
            </div>
          )}

          <div className="flex items-center gap-1 p-1 bg-muted rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('otp');
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg cursor-pointer ${
                mode === 'otp'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail className="w-3.5 h-3.5" aria-hidden="true" />
              Email OTP
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('password');
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg cursor-pointer ${
                mode === 'password'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
              Password
            </button>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive">
              {error}
            </div>
          )}

          {info && (
            <div className="p-3 bg-accent border border-border rounded-xl text-xs text-accent-foreground">
              {info}
            </div>
          )}

          {mode === 'otp' ? (
            otpStep === 'request' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp-email" className="block text-xs font-medium text-muted-foreground mb-1">
                    Email Address
                  </label>
                  <input
                    id="otp-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || !supabaseConfigured}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Sending Code...' : 'Send Email Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp-code" className="block text-xs font-medium text-muted-foreground mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="otp-code"
                    type="text"
                    required
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter code from email"
                    className="w-full px-3.5 py-2.5 font-sans text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('request');
                      setOtpCode('');
                      setInfo(null);
                    }}
                    className="px-3.5 py-2.5 text-xs font-medium border border-border rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label htmlFor="pw-email" className="block text-xs font-medium text-muted-foreground mb-1">
                  Email Address
                </label>
                <input
                  id="pw-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                />
              </div>
              <div>
                <label htmlFor="pw-pass" className="block text-xs font-medium text-muted-foreground mb-1">
                  Password
                </label>
                <input
                  id="pw-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !supabaseConfigured}
                className="w-full py-2.5 px-4 text-xs font-semibold text-commerce-foreground bg-commerce rounded-xl hover:bg-commerce/90 disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Signing In...' : 'Sign In with Password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          New to NairaScout?{' '}
          <Link href="/auth/register" className="font-semibold text-success hover:underline">
            Create your free Scout account
          </Link>
        </p>
      </div>
    </div>
  );
}

interface RegisterFormProps {
  capturedRefEvent: string | null;
  capturedRefScout: string | null;
}

export function RegisterForm({ capturedRefEvent, capturedRefScout }: RegisterFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [locationState, setLocationState] = useState('Lagos');
  const [refScout, setRefScout] = useState(capturedRefScout || '');
  const [refEvent, setRefEvent] = useState(capturedRefEvent || '');
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [signupCode, setSignupCode] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supabaseConfigured = isSupabaseBrowserConfigured();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            display_name: displayName.trim(),
            username: username.trim() || undefined,
            location_state: locationState,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        await provisionPostgreSqlProfile(
          {
            displayName: displayName.trim(),
            username: username.trim() || undefined,
            locationState,
            referralEventId: refEvent.trim() || null,
            referralScoutUsername: refScout.trim() || null,
          },
          data.session.access_token
        );
        router.push('/');
        router.refresh();
        return;
      }

      setInfo(
        `Confirmation email sent to ${email.trim()}. Enter the verification code from your email or click the confirmation link to complete PostgreSQL provisioning.`
      );
      setAwaitingOtp(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifySignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: signupCode.trim(),
        type: 'signup',
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      await provisionPostgreSqlProfile(
        {
          displayName: displayName.trim(),
          username: username.trim() || undefined,
          locationState,
          referralEventId: refEvent.trim() || null,
          referralScoutUsername: refScout.trim() || null,
        },
        data.session?.access_token
      );
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to Marketplace
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-brand font-extrabold text-xl tracking-tight text-foreground">
              NairaScout
            </span>
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-2xl p-7 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-success font-sans text-xs font-semibold uppercase tracking-wider">
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              Free Scout Registration
            </div>
            <h1 className="mt-1 font-sans text-2xl font-bold text-foreground">
              Create Your Primary Identity
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Every user starts with a free Scout account. Seller capabilities can be activated
              later under the same identity.
            </p>
          </div>

          {!supabaseConfigured && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-300">
              Supabase Auth environment variables are missing. Configure{' '}
              <span className="font-sans">NEXT_PUBLIC_SUPABASE_URL</span>,{' '}
              <span className="font-sans">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>, and{' '}
              <span className="font-sans">DATABASE_URL</span> before registering accounts.
            </div>
          )}

          {(capturedRefEvent || capturedRefScout) && (
            <div className="p-3 bg-accent border border-border rounded-xl text-xs text-accent-foreground flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Referral Attribution Captured</p>
                <p>
                  {capturedRefEvent ? `Event ${capturedRefEvent}` : ''}{' '}
                  {capturedRefScout ? `Referrer @${capturedRefScout}` : ''} — will be permanently
                  locked in your PostgreSQL ancestry record upon signup.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive">
              {error}
            </div>
          )}

          {info && (
            <div className="p-3 bg-accent border border-border rounded-xl text-xs text-accent-foreground">
              {info}
            </div>
          )}

          {awaitingOtp ? (
            <form onSubmit={handleVerifySignupCode} className="space-y-4">
              <div>
                <label htmlFor="signup-code" className="block text-xs font-medium text-muted-foreground mb-1">
                  Email Confirmation Code
                </label>
                <input
                  id="signup-code"
                  type="text"
                  required
                  maxLength={8}
                  value={signupCode}
                  onChange={(e) => setSignupCode(e.target.value)}
                  placeholder="Enter code from email"
                  className="w-full px-3.5 py-2.5 font-sans text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Provisioning...' : 'Verify & Provision Scout Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setAwaitingOtp(false)}
                  className="px-3.5 py-2.5 text-xs border border-border rounded-xl text-muted-foreground cursor-pointer"
                >
                  Back
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label htmlFor="reg-name" className="block text-xs font-medium text-muted-foreground mb-1">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Chukwuemeka Osei"
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-user" className="block text-xs font-medium text-muted-foreground mb-1">
                    Scout Username
                  </label>
                  <input
                    id="reg-user"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="emeka_lagos"
                    className="w-full px-3 py-2 font-sans text-sm bg-background text-foreground border border-input rounded-xl"
                  />
                </div>
                <div>
                  <label htmlFor="reg-state" className="block text-xs font-medium text-muted-foreground mb-1">
                    State
                  </label>
                  <select
                    id="reg-state"
                    value={locationState}
                    onChange={(e) => setLocationState(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2 text-sm border border-input rounded-xl bg-background text-foreground"
                  >
                    <option value="Lagos">Lagos</option>
                    <option value="Abuja">Abuja (FCT)</option>
                    <option value="Port Harcourt">Rivers (PH)</option>
                    <option value="Kano">Kano</option>
                    <option value="Ibadan">Oyo (Ibadan)</option>
                    <option value="Enugu">Enugu</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-xs font-medium text-muted-foreground mb-1">
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>

              <div>
                <label htmlFor="reg-pass" className="block text-xs font-medium text-muted-foreground mb-1">
                  Password (min 8 characters)
                </label>
                <input
                  id="reg-pass"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>

              <div className="pt-2 border-t border-border grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-ref" className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Referrer Handle (Optional)
                  </label>
                  <input
                    id="reg-ref"
                    type="text"
                    value={refScout}
                    onChange={(e) => setRefScout(e.target.value)}
                    placeholder="amara_okafor"
                    className="w-full px-2.5 py-1.5 font-sans text-xs bg-background text-foreground border border-input rounded-xl"
                  />
                </div>
                <div>
                  <label htmlFor="reg-ev" className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Referral Event ID (Optional)
                  </label>
                  <input
                    id="reg-ev"
                    type="text"
                    value={refEvent}
                    onChange={(e) => setRefEvent(e.target.value)}
                    placeholder="UUID"
                    className="w-full px-2.5 py-1.5 font-sans text-xs bg-background text-foreground border border-input rounded-xl"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !supabaseConfigured}
                className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Creating Account...' : 'Create Free Scout Account'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-success hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
