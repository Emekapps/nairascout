'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import type {
  InvitationPolicy,
  NairaScoutSnapshot,
  VerificationCategory,
} from '@/lib/nairascout-store';
import { formatKoboToNaira } from '@/lib/commission-engine';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ThemeToggle } from './layout/ThemeToggle';

interface SettingsViewProps {
  initialSnapshot: NairaScoutSnapshot;
}

type SettingsTab = 'profile' | 'privacy' | 'verification' | 'lifecycle';

const CATEGORIES = [
  'Home & Craft',
  'Kitchen & Pantry',
  'Audio & Tech',
  'Beauty & Botanicals',
  'Fashion & Leather',
];

export default function SettingsView({ initialSnapshot }: SettingsViewProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<NairaScoutSnapshot>(initialSnapshot);
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const scout = snapshot.activeScout;

  // Profile fields
  const [displayName, setDisplayName] = useState(scout?.displayName || '');
  const [username, setUsername] = useState(scout?.handle || '');
  const [bio, setBio] = useState(scout?.bio || '');
  const [locationState, setLocationState] = useState(scout?.city || 'Lagos');
  const [preferredCategories, setPreferredCategories] = useState<string[]>(
    scout?.preferredCategories || []
  );
  const [profileVisibility, setProfileVisibility] = useState<'PUBLIC' | 'NETWORK_ONLY'>(
    scout?.profileVisibility || 'PUBLIC'
  );

  // Privacy fields
  const [invitationPolicy, setInvitationPolicy] = useState<InvitationPolicy>(
    scout?.invitePolicy || 'EVERYONE'
  );
  const [muteReferrals, setMuteReferrals] = useState<boolean>(scout?.muteReferrals || false);

  // Verification submission fields
  const [verifCat, setVerifCat] = useState<VerificationCategory>('IDENTITY');
  const [docName, setDocName] = useState('national-id-nin.pdf');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [bankSummary, setBankSummary] = useState(scout?.bankSummary || '');

  // Lifecycle closure confirmation
  const [closeReason, setCloseReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [appealTarget, setAppealTarget] = useState<{
    targetType: 'VERIFICATION' | 'RESTRICTION';
    targetRecordId: string;
    label: string;
  } | null>(null);
  const [appealReason, setAppealReason] = useState('');

  if (!snapshot.authenticated || !scout) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-2xl max-w-md w-full p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-foreground mx-auto" aria-hidden="true" />
          <h1 className="font-sans text-2xl font-bold text-foreground">
            Sign In to Access Account Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your Scout profile, Scouts List privacy controls, verification documents, and
            account lifecycle.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90"
            >
              Sign In
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold text-foreground border border-border rounded-xl"
            >
              Back to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const patchSettings = async (body: Record<string, unknown>, okMessage: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Could not save settings.' });
        return;
      }
      if (data.snapshot) setSnapshot(data.snapshot);
      setFeedback({ type: 'ok', message: okMessage });
    } finally {
      setBusy(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setPreferredCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleCloseAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText.trim().toUpperCase() !== 'CLOSE MY ACCOUNT') return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ action: 'close_account', reason: closeReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Account closure failed.' });
        return;
      }
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      router.push('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCloseSeller = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ action: 'close_seller', reason: closeReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Seller closure failed.' });
        return;
      }
      if (data.snapshot) setSnapshot(data.snapshot);
      setFeedback({
        type: 'ok',
        message: 'Track 1 Seller capabilities closed. Your Scout identity and wallet remain operational.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealTarget || !appealReason.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({
          action: 'submit_appeal',
          targetType: appealTarget.targetType,
          targetRecordId: appealTarget.targetRecordId,
          appealReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Failed to submit appeal.' });
        return;
      }
      if (data.snapshot) setSnapshot(data.snapshot);
      setAppealTarget(null);
      setAppealReason('');
      setFeedback({
        type: 'ok',
        message: 'Appeal submitted for independent Appeals Officer review.',
      });
    } finally {
      setBusy(false);
    }
  };

  const openOrdersCount = snapshot.orders.filter(
    (o) => o.fulfilmentStatus !== 'Delivered' && o.fulfilmentStatus !== 'Refunded'
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card/85 backdrop-blur-md border-b border-border sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to NairaScout Workspace
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-sans text-xs text-muted-foreground">@{scout.handle}</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="font-sans text-2xl md:text-3xl font-bold text-foreground">
              Account Settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Primary Identity: <span className="font-sans">{scout.email}</span> · Account Status:{' '}
              <strong className="font-sans text-foreground">{scout.accountStatus}</strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-xl text-xs font-semibold">
            {(
              [
                { id: 'profile', label: 'Profile' },
                { id: 'privacy', label: 'Privacy & Referrals' },
                { id: 'verification', label: 'Verification & Banking' },
                { id: 'lifecycle', label: 'Account Lifecycle' },
              ] as { id: SettingsTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setFeedback(null);
                }}
                className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  tab === t.id
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`p-3.5 rounded-xl border text-xs font-medium ${
              feedback.type === 'ok'
                ? 'bg-accent border-border text-accent-foreground'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {tab === 'profile' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              patchSettings(
                {
                  section: 'profile',
                  displayName,
                  username,
                  bio,
                  locationState,
                  preferredCategories,
                  profileVisibility,
                },
                'Scout profile updated.'
              );
            }}
            className="bg-card border border-border rounded-2xl p-6 space-y-5 max-w-2xl"
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-foreground" aria-hidden="true" />
              <h2 className="font-sans text-lg font-bold text-foreground">
                Public Scout Profile
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 font-sans text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Location State
                </label>
                <input
                  type="text"
                  value={locationState}
                  onChange={(e) => setLocationState(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Profile Visibility
                </label>
                <select
                  value={profileVisibility}
                  onChange={(e) =>
                    setProfileVisibility(
                      e.target.value === 'NETWORK_ONLY' ? 'NETWORK_ONLY' : 'PUBLIC'
                    )
                  }
                  className="w-full px-3 py-2 text-sm border border-input rounded-xl bg-background text-foreground"
                >
                  <option value="PUBLIC">Public Sanitized Directory</option>
                  <option value="NETWORK_ONLY">Scouts List &amp; Network Only</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Preferred Categories</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const active = preferredCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 text-xs rounded-xl border cursor-pointer ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary-border'
                          : 'bg-background text-muted-foreground border-border'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
            >
              {busy ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        )}

        {tab === 'privacy' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                patchSettings(
                  {
                    section: 'privacy',
                    invitationPolicy,
                    muteReferrals,
                    profileVisibility,
                  },
                  'Privacy and referral preferences saved.'
                );
              }}
              className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 space-y-5"
            >
              <h2 className="font-sans text-lg font-bold text-foreground">
                Scouts List &amp; Referral Controls
              </h2>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-muted-foreground">
                  Who can send you Scouts List invitations?
                </label>
                <select
                  value={invitationPolicy}
                  onChange={(e) => setInvitationPolicy(e.target.value as InvitationPolicy)}
                  className="w-full px-3 py-2 text-sm border border-input rounded-xl bg-background text-foreground"
                >
                  <option value="EVERYONE">EVERYONE — Any active Scout can invite you</option>
                  <option value="CONTACTS_ONLY">
                    CONTACTS_ONLY — Only Scouts sharing a mutual contact
                  </option>
                  <option value="NOBODY">NOBODY — Disable all incoming Scouts List invites</option>
                </select>
              </div>

              <label className="flex items-start gap-3 p-4 bg-muted/50 border border-border rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={muteReferrals}
                  onChange={(e) => setMuteReferrals(e.target.checked)}
                  className="mt-0.5 accent-foreground"
                />
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Mute Incoming Product Referrals</p>
                  <p className="text-muted-foreground mt-0.5">
                    When enabled, other Scouts cannot dispatch new product referral cards to your
                    inbox. Your permanent ancestry links remain unaffected.
                  </p>
                </div>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
              >
                {busy ? 'Saving...' : 'Save Privacy Preferences'}
              </button>
            </form>

            <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-sans text-lg font-bold text-foreground">
                Blocked Users ({snapshot.blockedUsers.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Blocked accounts cannot view your directory entry, send invitations, or refer
                products to you.
              </p>

              {snapshot.blockedUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">You have not blocked any users.</p>
              ) : (
                <div className="divide-y divide-border">
                  {snapshot.blockedUsers.map((b) => (
                    <div key={b.userId} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{b.displayName}</p>
                        <p className="font-sans text-xs text-muted-foreground">@{b.username}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          patchSettings(
                            { section: 'unblock', targetUserId: b.userId },
                            `Unblocked @${b.username}.`
                          )
                        }
                        className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg text-foreground hover:bg-muted cursor-pointer"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'verification' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-success" aria-hidden="true" />
                <h2 className="font-sans text-lg font-bold text-foreground">
                  Verification Records
                </h2>
              </div>

              <div className="divide-y divide-border">
                {scout.verifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">
                    No verification submissions yet. Submit Identity or Bank details on the right.
                  </p>
                ) : (
                  scout.verifications.map((v) => (
                    <div key={v.id} className="py-3.5 first:pt-0 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-sans font-semibold text-foreground">{v.category}</span>
                        <span
                          className={`font-sans font-semibold ${
                            v.status === 'VERIFIED'
                              ? 'text-success'
                              : v.status === 'REJECTED' || v.status === 'REVOKED'
                                ? 'text-destructive'
                                : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                      {v.reviewerNotes && (
                        <p className="text-xs text-muted-foreground">
                          Reviewer Note: {v.reviewerNotes}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-sans text-[11px] text-muted-foreground">
                          {v.evidencePaths.join(', ') || 'Direct check'}
                        </p>
                        {(v.status === 'REJECTED' || v.status === 'REVOKED') && (
                          <button
                            type="button"
                            onClick={() =>
                              setAppealTarget({
                                targetType: 'VERIFICATION',
                                targetRecordId: v.id,
                                label: `${v.category} verification (${v.status})`,
                              })
                            }
                            className="text-xs font-semibold text-success hover:underline cursor-pointer"
                          >
                            Appeal Decision
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {scout.activeRestrictions && scout.activeRestrictions.length > 0 && (
                <div className="pt-4 border-t border-border space-y-2">
                  <p className="text-xs font-semibold text-destructive">
                    Active Capability Restrictions ({scout.activeRestrictions.length})
                  </p>
                  {scout.activeRestrictions.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-sans font-semibold">
                          {r.capabilityCode} ({r.scope})
                        </p>
                        <p className="mt-0.5">{r.reason}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAppealTarget({
                            targetType: 'RESTRICTION',
                            targetRecordId: r.id,
                            label: `${r.capabilityCode} restriction`,
                          })
                        }
                        className="px-2.5 py-1 text-xs font-semibold bg-card border border-destructive/30 rounded-lg text-destructive shrink-0 cursor-pointer"
                      >
                        Appeal
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {appealTarget && (
                <form
                  onSubmit={handleSubmitAppeal}
                  className="p-4 bg-muted/50 border border-border rounded-xl space-y-3"
                >
                  <p className="text-xs font-semibold text-foreground">
                    Submit Independent Appeal for {appealTarget.label}
                  </p>
                  <textarea
                    rows={2}
                    required
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    placeholder="Provide clear context and supporting facts for an independent Appeals Officer..."
                    className="w-full px-3 py-2 text-xs border border-input rounded-xl bg-background text-foreground"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-3.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 cursor-pointer"
                    >
                      Submit Appeal
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppealTarget(null)}
                      className="px-3 py-1.5 text-xs text-muted-foreground cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {scout.governanceAppeals && scout.governanceAppeals.length > 0 && (
                <div className="pt-4 border-t border-border space-y-2">
                  <p className="text-xs font-semibold text-foreground">Your Appeals</p>
                  {scout.governanceAppeals.map((a) => (
                    <div
                      key={a.id}
                      className="p-2.5 bg-muted/50 border border-border rounded-xl text-xs space-y-1"
                    >
                      <div className="flex justify-between font-sans">
                        <span className="font-semibold text-foreground">{a.targetType}</span>
                        <span className="text-success font-semibold">{a.status}</span>
                      </div>
                      <p className="text-muted-foreground">{a.appealReason}</p>
                      {a.decisionNotes && (
                        <p className="text-muted-foreground">Officer Note: {a.decisionNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                let targetPath = `verification-docs/${scout.id}/${docName}`;
                const supabase = createSupabaseBrowserClient();
                if (docFile && supabase) {
                  const objectKey = `${scout.id}/${Date.now()}-${docFile.name}`;
                  const { error: uploadErr } = await supabase.storage
                    .from('verification-docs')
                    .upload(objectKey, docFile, { upsert: true });
                  if (uploadErr) {
                    setFeedback({ type: 'err', message: uploadErr.message });
                    return;
                  }
                  targetPath = `verification-docs/${objectKey}`;
                }
                await patchSettings(
                  {
                    section: 'verification',
                    category: verifCat,
                    evidencePaths: [targetPath],
                    bankSummary: verifCat === 'PAYOUT_BANK' ? bankSummary : undefined,
                  },
                  `${verifCat} verification submitted for review.`
                );
              }}
              className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 space-y-4 self-start"
            >
              <h3 className="font-sans text-lg font-bold text-foreground">
                Submit Verification / Bank Details
              </h3>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Verification Category
                </label>
                <select
                  value={verifCat}
                  onChange={(e) => setVerifCat(e.target.value as VerificationCategory)}
                  className="w-full px-3 py-2 text-sm border border-input rounded-xl bg-background text-foreground"
                >
                  <option value="IDENTITY">IDENTITY (NIN / Passport / Driver&apos;s License)</option>
                  <option value="PAYOUT_BANK">PAYOUT_BANK (Nigerian Naira Settlement Account)</option>
                  <option value="SELLER">SELLER (Additional Seller Proof)</option>
                  <option value="BUSINESS">BUSINESS (CAC Registration)</option>
                </select>
              </div>

              {verifCat === 'PAYOUT_BANK' && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Nigerian Bank &amp; Account Summary (Same-name match)
                  </label>
                  <input
                    type="text"
                    required
                    value={bankSummary}
                    onChange={(e) => setBankSummary(e.target.value)}
                    placeholder="e.g., GTBank · 0123456789"
                    className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Evidence Document
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setDocFile(f);
                      setDocName(f.name);
                    }
                  }}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-secondary file:text-secondary-foreground file:font-semibold"
                />
                <p className="mt-1 font-sans text-[11px] text-muted-foreground">
                  Bucket path: verification-docs/{scout.id}/{docName}
                </p>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
              >
                {busy ? 'Submitting...' : 'Submit for Officer Review'}
              </button>
            </form>
          </div>
        )}

        {tab === 'lifecycle' && (
          <div className="max-w-2xl bg-card border border-border rounded-2xl p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="font-sans text-xl font-bold text-foreground">
                    Two-Track Account &amp; Seller Closure
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Choose Track 1 to close only your Seller store while keeping your Scout identity
                    and commission wallet active, or Track 2 to permanently close your full
                    NairaScout account while preserving immutable ancestry &amp; ledger history.
                  </p>
                </div>
              </div>
              <Link
                href="/settings/closure"
                className="px-3.5 py-2 text-xs font-semibold text-commerce-foreground bg-commerce rounded-xl shrink-0"
              >
                Open Closure Flow
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 border border-border rounded-xl text-xs">
              <div>
                <p className="text-muted-foreground">Open Orders</p>
                <p className="font-numeric text-base font-bold text-foreground tabular-nums">
                  {openOrdersCount}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Pending Commissions</p>
                <p className="font-numeric text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatKoboToNaira(snapshot.wallet.pendingKobo)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Available Balance</p>
                <p className="font-numeric text-base font-bold text-success tabular-nums">
                  {formatKoboToNaira(snapshot.wallet.availableKobo)}
                </p>
              </div>
            </div>

            {scout.sellerProfile && scout.sellerProfile.sellerStatus !== 'CLOSED' && (
              <div className="p-4 bg-muted/50 border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <p className="font-semibold text-foreground">
                    Track 1: Close Seller Capabilities Only ({scout.sellerProfile.sellerName})
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    Expires active Seller listings and closes Seller Hub while preserving your
                    Scout account and commission wallet.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCloseSeller}
                  className="px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/40 bg-card rounded-xl hover:bg-amber-500/10 shrink-0 cursor-pointer"
                >
                  Close Seller Only
                </button>
              </div>
            )}

            <form onSubmit={handleCloseAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Reason for Closure (Optional)
                </label>
                <input
                  type="text"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="Optional feedback..."
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Track 2: Type <span className="font-sans font-bold">CLOSE MY ACCOUNT</span> to
                  confirm full closure
                </label>
                <input
                  type="text"
                  required
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CLOSE MY ACCOUNT"
                  className="w-full px-3 py-2 font-sans text-sm bg-background text-foreground border border-destructive/40 rounded-xl"
                />
              </div>

              <button
                type="submit"
                disabled={busy || confirmText.trim().toUpperCase() !== 'CLOSE MY ACCOUNT'}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-destructive-foreground bg-destructive rounded-xl hover:bg-destructive/90 disabled:opacity-45 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                {busy ? 'Closing Account...' : 'Close Full Account & Preserve Ledger'}
              </button>
            </form>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
              <span>
                Ineligible/closed accounts keep their fixed ancestry slot while earning ₦0.00 on
                subsequent transactions.
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
