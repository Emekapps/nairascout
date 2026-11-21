'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from '@/lib/supabase/client';

async function provisionPostgreSqlProfile(payload?: {
  displayName?: string;
  username?: string;
  locationState?: string;
  referralEventId?: string | null;
  referralScoutUsername?: string | null;
}) {
  const res = await fetch('/api/auth/provision', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'NairaScout',
    },
    body: JSON.stringify(payload ?? {}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Could not provision your PostgreSQL Scout record.');
  }
  return data;
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [error, setError] = useState<string | null>(null);
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
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }

      await provisionPostgreSqlProfile();
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
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email',
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      await provisionPostgreSqlProfile();
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C665E] hover:text-[#111814]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to Marketplace
          </Link>
          <span className="font-display text-lg font-bold text-[#111814]">NairaScout</span>
        </div>

        <div className="bg-white border border-[#E4E4DE] rounded-xl p-7 space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#111814]">
              Sign In to NairaScout
            </h1>
            <p className="mt-1 text-xs text-[#5C665E]">
              One primary identity across Scout referrals, Seller operations, and your Wallet.
            </p>
          </div>

          {!supabaseConfigured && (
            <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs text-[#92400E]">
              Supabase Auth environment variables are missing. Configure{' '}
              <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span>,{' '}
              <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>, and{' '}
              <span className="font-mono">DATABASE_URL</span> to enable live authentication.
            </div>
          )}

          <div className="flex items-center gap-1 p-1 bg-[#EFEFE9] rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('otp');
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md cursor-pointer ${
                mode === 'otp' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
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
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md cursor-pointer ${
                mode === 'password' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
              Password
            </button>
          </div>

          {error && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#B91C1C]">
              {error}
            </div>
          )}

          {info && (
            <div className="p-3 bg-[#F3F8F6] border border-[#CBE2D8] rounded-lg text-xs text-[#0B6E4F]">
              {info}
            </div>
          )}

          {mode === 'otp' ? (
            otpStep === 'request' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp-email" className="block text-xs font-medium text-[#4B554E] mb-1">
                    Email Address
                  </label>
                  <input
                    id="otp-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || !supabaseConfigured}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Sending Code...' : 'Send Email Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp-code" className="block text-xs font-medium text-[#4B554E] mb-1">
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
                    className="w-full px-3.5 py-2.5 font-mono text-sm border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-50 cursor-pointer"
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
                    className="px-3.5 py-2.5 text-xs font-medium border border-[#D8D8D0] rounded-lg text-[#4B554E] cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label htmlFor="pw-email" className="block text-xs font-medium text-[#4B554E] mb-1">
                  Email Address
                </label>
                <input
                  id="pw-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
                />
              </div>
              <div>
                <label htmlFor="pw-pass" className="block text-xs font-medium text-[#4B554E] mb-1">
                  Password
                </label>
                <input
                  id="pw-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F]"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !supabaseConfigured}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#111814] rounded-lg hover:bg-[#26332B] disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Signing In...' : 'Sign In with Password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-[#5C665E]">
          New to NairaScout?{' '}
          <Link href="/auth/register" className="font-semibold text-[#0B6E4F] hover:underline">
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
        await provisionPostgreSqlProfile({
          displayName: displayName.trim(),
          username: username.trim() || undefined,
          locationState,
          referralEventId: refEvent.trim() || null,
          referralScoutUsername: refScout.trim() || null,
        });
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
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: signupCode.trim(),
        type: 'signup',
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      await provisionPostgreSqlProfile({
        displayName: displayName.trim(),
        username: username.trim() || undefined,
        locationState,
        referralEventId: refEvent.trim() || null,
        referralScoutUsername: refScout.trim() || null,
      });
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C665E] hover:text-[#111814]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to Marketplace
          </Link>
          <span className="font-display text-lg font-bold text-[#111814]">NairaScout</span>
        </div>

        <div className="bg-white border border-[#E4E4DE] rounded-xl p-7 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-[#0B6E4F] text-xs font-semibold uppercase tracking-wider">
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              Free Scout Registration
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-[#111814]">
              Create Your Primary Identity
            </h1>
            <p className="mt-1 text-xs text-[#5C665E]">
              Every user starts with a free Scout account. Seller capabilities can be activated
              later under the same identity.
            </p>
          </div>

          {!supabaseConfigured && (
            <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs text-[#92400E]">
              Supabase Auth environment variables are missing. Configure{' '}
              <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span>,{' '}
              <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>, and{' '}
              <span className="font-mono">DATABASE_URL</span> before registering accounts.
            </div>
          )}

          {(capturedRefEvent || capturedRefScout) && (
            <div className="p-3 bg-[#F3F8F6] border border-[#CBE2D8] rounded-lg text-xs text-[#0B6E4F] flex items-start gap-2">
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
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#B91C1C]">
              {error}
            </div>
          )}

          {info && (
            <div className="p-3 bg-[#F3F8F6] border border-[#CBE2D8] rounded-lg text-xs text-[#0B6E4F]">
              {info}
            </div>
          )}

          {awaitingOtp ? (
            <form onSubmit={handleVerifySignupCode} className="space-y-4">
              <div>
                <label htmlFor="signup-code" className="block text-xs font-medium text-[#4B554E] mb-1">
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
                  className="w-full px-3.5 py-2.5 font-mono text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Provisioning...' : 'Verify & Provision Scout Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setAwaitingOtp(false)}
                  className="px-3.5 py-2.5 text-xs border border-[#D8D8D0] rounded-lg text-[#4B554E] cursor-pointer"
                >
                  Back
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label htmlFor="reg-name" className="block text-xs font-medium text-[#4B554E] mb-1">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Chukwuemeka Osei"
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-user" className="block text-xs font-medium text-[#4B554E] mb-1">
                    Scout Username
                  </label>
                  <input
                    id="reg-user"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="emeka_lagos"
                    className="w-full px-3 py-2 font-mono text-sm border border-[#D8D8D0] rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="reg-state" className="block text-xs font-medium text-[#4B554E] mb-1">
                    State
                  </label>
                  <select
                    id="reg-state"
                    value={locationState}
                    onChange={(e) => setLocationState(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg bg-white"
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
                <label htmlFor="reg-email" className="block text-xs font-medium text-[#4B554E] mb-1">
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="reg-pass" className="block text-xs font-medium text-[#4B554E] mb-1">
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
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>

              <div className="pt-2 border-t border-[#ECECE6] grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-ref" className="block text-[11px] font-medium text-[#5C665E] mb-1">
                    Referrer Handle (Optional)
                  </label>
                  <input
                    id="reg-ref"
                    type="text"
                    value={refScout}
                    onChange={(e) => setRefScout(e.target.value)}
                    placeholder="amara_okafor"
                    className="w-full px-2.5 py-1.5 font-mono text-xs border border-[#D8D8D0] rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="reg-ev" className="block text-[11px] font-medium text-[#5C665E] mb-1">
                    Referral Event ID (Optional)
                  </label>
                  <input
                    id="reg-ev"
                    type="text"
                    value={refEvent}
                    onChange={(e) => setRefEvent(e.target.value)}
                    placeholder="UUID"
                    className="w-full px-2.5 py-1.5 font-mono text-xs border border-[#D8D8D0] rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !supabaseConfigured}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Creating Account...' : 'Create Free Scout Account'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-[#5C665E]">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-[#0B6E4F] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
