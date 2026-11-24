'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import {
  NIGERIAN_STATES_SEED,
  type NigerianStateSeed,
} from '@/lib/constants/nigeria-and-categories';
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from '@/lib/supabase/client';
import { ThemeToggle } from '../layout/ThemeToggle';

export async function provisionPostgreSqlProfile(
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

interface RegisterWizardProps {
  capturedRefEvent: string | null;
  capturedRefScout: string | null;
  initialStates?: NigerianStateSeed[];
}

const STEP_META = [
  { step: 1, title: 'Full Name' },
  { step: 2, title: 'Username' },
  { step: 3, title: 'Email Address' },
  { step: 4, title: 'State' },
  { step: 5, title: 'Password' },
  { step: 6, title: 'Referral Attribution' },
] as const;

const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

export function RegisterWizard({
  capturedRefEvent,
  capturedRefScout,
  initialStates,
}: RegisterWizardProps) {
  const router = useRouter();

  const [step, setStep] = useState<number>(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [locationState, setLocationState] = useState('Lagos');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [refScout, setRefScout] = useState(capturedRefScout || '');
  const [refEvent, setRefEvent] = useState(capturedRefEvent || '');

  const [states, setStates] = useState<NigerianStateSeed[]>(
    initialStates && initialStates.length > 0 ? initialStates : NIGERIAN_STATES_SEED
  );

  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string | null;
  }>({ checking: false, available: null, message: null });

  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [signupCode, setSignupCode] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supabaseConfigured = isSupabaseBrowserConfigured();

  useEffect(() => {
    if (initialStates && initialStates.length > 0) return;
    let active = true;
    fetch('/api/states')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && Array.isArray(data?.states) && data.states.length > 0) {
          setStates(data.states);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [initialStates]);

  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed || !USERNAME_REGEX.test(trimmed)) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-username?username=${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();
        if (cancelled) return;
        setUsernameStatus({
          checking: false,
          available: Boolean(data?.available),
          message: data?.available
            ? `@${data.normalized} is available`
            : data?.reason || 'This username is already taken.',
        });
      } catch {
        if (!cancelled) {
          setUsernameStatus({ checking: false, available: null, message: null });
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  const validateCurrentStep = (): string | null => {
    if (step === 1) {
      if (displayName.trim().length < 2) {
        return 'Please enter your full name (at least 2 characters).';
      }
      return null;
    }
    if (step === 2) {
      const trimmed = username.trim().toLowerCase();
      if (!USERNAME_REGEX.test(trimmed)) {
        return 'Enter a valid username (3–24 lowercase letters, numbers, or underscores).';
      }
      if (usernameStatus.checking) {
        return 'Checking username availability, please wait a moment.';
      }
      if (usernameStatus.available === false) {
        return usernameStatus.message || 'Please choose an available username.';
      }
      return null;
    }
    if (step === 3) {
      const trimmedEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return 'Please enter a valid email address.';
      }
      return null;
    }
    if (step === 4) {
      if (!locationState.trim()) {
        return 'Please select your Nigerian state.';
      }
      return null;
    }
    if (step === 5) {
      if (password.length < 8) {
        return 'Password must be at least 8 characters.';
      }
      return null;
    }
    return null;
  };

  const handleNext = () => {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setDirection(1);
    setStep((prev) => Math.min(6, prev + 1));
  };

  const handleBack = () => {
    setError(null);
    setDirection(-1);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 6) {
      handleNext();
      return;
    }

    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(
        'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      );
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();
    setBusy(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            display_name: displayName.trim(),
            username: normalizedUsername || undefined,
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
            username: normalizedUsername || undefined,
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

    const normalizedUsername = username.trim().toLowerCase();
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
          username: normalizedUsername || undefined,
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
              Create Your Account
            </h1>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Every user starts with a free Scout Account. You can activate Seller capabilities later
              under the same account.
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
            <div
              role="alert"
              className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive"
            >
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
                <label
                  htmlFor="signup-code"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
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
            <form onSubmit={handleRegister} className="space-y-5">
              {/* Step Indicator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-sans font-semibold text-foreground">
                    Step {step} of 6
                  </span>
                  <span className="font-sans text-muted-foreground">
                    {STEP_META[step - 1].title}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5" aria-hidden="true">
                  {STEP_META.map((s) => (
                    <div
                      key={s.step}
                      className={`h-1.5 rounded-full transition-colors duration-200 ${
                        s.step <= step ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Sliding Wizard Viewport */}
              <div className="overflow-hidden min-h-[120px]">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    initial={{ x: direction > 0 ? 48 : -48, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: direction > 0 ? -48 : 48, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-3"
                  >
                    {step === 1 && (
                      <div>
                        <label
                          htmlFor="reg-name"
                          className="block text-xs font-medium text-muted-foreground mb-1.5"
                        >
                          Full Name
                        </label>
                        <input
                          id="reg-name"
                          type="text"
                          autoFocus
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g., Chukwuemeka Osei"
                          className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                        />
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          Displayed alongside your username on your public Scout profile.
                        </p>
                      </div>
                    )}

                    {step === 2 && (
                      <div>
                        <label
                          htmlFor="reg-user"
                          className="block text-xs font-medium text-muted-foreground mb-1.5"
                        >
                          Username
                        </label>
                        <input
                          id="reg-user"
                          type="text"
                          autoFocus
                          value={username}
                          onChange={(e) => {
                            const nextVal = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                            setUsername(nextVal);
                            if (!nextVal) {
                              setUsernameStatus({
                                checking: false,
                                available: null,
                                message: null,
                              });
                            } else if (!USERNAME_REGEX.test(nextVal)) {
                              setUsernameStatus({
                                checking: false,
                                available: false,
                                message: 'Use 3–24 lowercase letters, numbers, or underscores.',
                              });
                            } else {
                              setUsernameStatus({
                                checking: true,
                                available: null,
                                message: 'Checking availability...',
                              });
                            }
                          }}
                          placeholder="emeka_lagos"
                          className="w-full px-3.5 py-2.5 font-sans text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                        />
                        <div className="mt-1.5 min-h-[18px] flex items-center gap-1.5 text-[11px]">
                          {usernameStatus.checking ? (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                              {usernameStatus.message}
                            </span>
                          ) : usernameStatus.available === true ? (
                            <span className="inline-flex items-center gap-1 text-success font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              {usernameStatus.message}
                            </span>
                          ) : usernameStatus.available === false ? (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              {usernameStatus.message}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              3–24 lowercase letters, numbers, or underscores.
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {step === 3 && (
                      <div>
                        <label
                          htmlFor="reg-email"
                          className="block text-xs font-medium text-muted-foreground mb-1.5"
                        >
                          Email Address
                        </label>
                        <input
                          id="reg-email"
                          type="email"
                          autoFocus
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                        />
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          Used for Email OTP login, verification notices, and account recovery.
                        </p>
                      </div>
                    )}

                    {step === 4 && (
                      <div>
                        <label
                          htmlFor="reg-state"
                          className="block text-xs font-medium text-muted-foreground mb-1.5"
                        >
                          State
                        </label>
                        <select
                          id="reg-state"
                          value={locationState}
                          onChange={(e) => setLocationState(e.target.value)}
                          className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-input rounded-xl bg-background text-foreground focus:outline-none focus:border-ring"
                        >
                          {states.map((st) => (
                            <option key={st.code} value={st.name}>
                              {st.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          All 36 Nigerian states and FCT are supported for local discovery.
                        </p>
                      </div>
                    )}

                    {step === 5 && (
                      <div>
                        <label
                          htmlFor="reg-pass"
                          className="block text-xs font-medium text-muted-foreground mb-1.5"
                        >
                          Password (min 8 characters)
                        </label>
                        <div className="relative">
                          <input
                            id="reg-pass"
                            type={showPassword ? 'text' : 'password'}
                            autoFocus
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Create a strong password"
                            className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <Eye className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          Use at least 8 characters. You can also sign in via Email OTP anytime.
                        </p>
                      </div>
                    )}

                    {step === 6 && (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Optional: enter who referred you if it was not captured automatically.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label
                              htmlFor="reg-ref"
                              className="block text-xs font-medium text-muted-foreground mb-1"
                            >
                              Referrer Handle (Optional)
                            </label>
                            <input
                              id="reg-ref"
                              type="text"
                              value={refScout}
                              onChange={(e) => setRefScout(e.target.value)}
                              placeholder="amara_okafor"
                              className="w-full px-3 py-2 font-sans text-xs bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="reg-ev"
                              className="block text-xs font-medium text-muted-foreground mb-1"
                            >
                              Referral Event ID (Optional)
                            </label>
                            <input
                              id="reg-ev"
                              type="text"
                              value={refEvent}
                              onChange={(e) => setRefEvent(e.target.value)}
                              placeholder="UUID"
                              className="w-full px-3 py-2 font-sans text-xs bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-2.5 pt-2 border-t border-border">
                {step > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleBack}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold border border-border rounded-xl bg-background text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    Back
                  </button>
                )}

                {step < 6 ? (
                  <button
                    type="submit"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
                  >
                    Next
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={busy || !supabaseConfigured}
                    className="flex-1 py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Creating Account...' : 'Create Free Scout Account'}
                  </button>
                )}
              </div>
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
