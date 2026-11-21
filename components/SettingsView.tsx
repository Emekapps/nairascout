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

  if (!snapshot.authenticated || !scout) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E4E4DE] rounded-xl max-w-md w-full p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-[#0B6E4F] mx-auto" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold text-[#111814]">
            Sign In to Access Account Settings
          </h1>
          <p className="text-sm text-[#5C665E]">
            Manage your Scout profile, Scouts List privacy controls, verification documents, and
            account lifecycle.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg"
            >
              Sign In
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold text-[#111814] border border-[#D8D8D0] rounded-lg"
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

  const openOrdersCount = snapshot.orders.filter(
    (o) => o.fulfilmentStatus !== 'Delivered' && o.fulfilmentStatus !== 'Refunded'
  ).length;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="bg-white border-b border-[#E4E4DE]">
        <div className="max-w-[1040px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111814] hover:text-[#0B6E4F]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to NairaScout Workspace
          </Link>
          <span className="font-mono text-xs text-[#5C665E]">@{scout.handle}</span>
        </div>
      </header>

      <main className="max-w-[1040px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E4E4DE] pb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#111814]">Account Settings</h1>
            <p className="mt-1 text-sm text-[#4B554E]">
              Primary Identity: <span className="font-mono">{scout.email}</span> · Account Status:{' '}
              <strong>{scout.accountStatus}</strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-1 p-1 bg-[#EFEFE9] rounded-lg text-xs font-semibold">
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
                className={`px-3 py-2 rounded-md cursor-pointer ${
                  tab === t.id ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
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
                ? 'bg-[#F3F8F6] border-[#CBE2D8] text-[#0B6E4F]'
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
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
            className="bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-5 max-w-2xl"
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-[#111814]">
                Public Scout Profile
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 font-mono text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Location State
                </label>
                <input
                  type="text"
                  value={locationState}
                  onChange={(e) => setLocationState(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Profile Visibility
                </label>
                <select
                  value={profileVisibility}
                  onChange={(e) =>
                    setProfileVisibility(
                      e.target.value === 'NETWORK_ONLY' ? 'NETWORK_ONLY' : 'PUBLIC'
                    )
                  }
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg bg-white"
                >
                  <option value="PUBLIC">Public Sanitized Directory</option>
                  <option value="NETWORK_ONLY">Scouts List &amp; Network Only</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B554E] mb-1">Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-[#4B554E] mb-2">Preferred Categories</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const active = preferredCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 text-xs rounded-lg border cursor-pointer ${
                        active
                          ? 'bg-[#0B6E4F] text-white border-[#0B6E4F]'
                          : 'bg-[#FAFAF8] text-[#4B554E] border-[#D8D8D0]'
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
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] cursor-pointer"
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
              className="lg:col-span-7 bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-5"
            >
              <h2 className="font-display text-lg font-bold text-[#111814]">
                Scouts List &amp; Referral Controls
              </h2>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-[#4B554E]">
                  Who can send you Scouts List invitations?
                </label>
                <select
                  value={invitationPolicy}
                  onChange={(e) => setInvitationPolicy(e.target.value as InvitationPolicy)}
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg bg-white"
                >
                  <option value="EVERYONE">EVERYONE — Any active Scout can invite you</option>
                  <option value="CONTACTS_ONLY">
                    CONTACTS_ONLY — Only Scouts sharing a mutual contact
                  </option>
                  <option value="NOBODY">NOBODY — Disable all incoming Scouts List invites</option>
                </select>
              </div>

              <label className="flex items-start gap-3 p-4 bg-[#FAFAF8] border border-[#E4E4DE] rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={muteReferrals}
                  onChange={(e) => setMuteReferrals(e.target.checked)}
                  className="mt-0.5 accent-[#0B6E4F]"
                />
                <div className="text-xs">
                  <p className="font-semibold text-[#111814]">Mute Incoming Product Referrals</p>
                  <p className="text-[#5C665E] mt-0.5">
                    When enabled, other Scouts cannot dispatch new product referral cards to your
                    inbox. Your permanent ancestry links remain unaffected.
                  </p>
                </div>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg cursor-pointer"
              >
                {busy ? 'Saving...' : 'Save Privacy Preferences'}
              </button>
            </form>

            <div className="lg:col-span-5 bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-4">
              <h3 className="font-display text-lg font-bold text-[#111814]">
                Blocked Users ({snapshot.blockedUsers.length})
              </h3>
              <p className="text-xs text-[#5C665E]">
                Blocked accounts cannot view your directory entry, send invitations, or refer
                products to you.
              </p>

              {snapshot.blockedUsers.length === 0 ? (
                <p className="text-xs text-[#5C665E] py-4">You have not blocked any users.</p>
              ) : (
                <div className="divide-y divide-[#ECECE6]">
                  {snapshot.blockedUsers.map((b) => (
                    <div key={b.userId} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#111814]">{b.displayName}</p>
                        <p className="font-mono text-xs text-[#5C665E]">@{b.username}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          patchSettings(
                            { section: 'unblock', targetUserId: b.userId },
                            `Unblocked @${b.username}.`
                          )
                        }
                        className="px-3 py-1.5 text-xs font-semibold border border-[#D8D8D0] rounded-md text-[#111814] hover:bg-[#F3F3EF] cursor-pointer"
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
            <div className="lg:col-span-7 bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-[#111814]">
                  Verification Records
                </h2>
              </div>

              <div className="divide-y divide-[#ECECE6]">
                {scout.verifications.length === 0 ? (
                  <p className="text-xs text-[#5C665E] py-4">
                    No verification submissions yet. Submit Identity or Bank details on the right.
                  </p>
                ) : (
                  scout.verifications.map((v) => (
                    <div key={v.id} className="py-3.5 first:pt-0 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-[#111814]">{v.category}</span>
                        <span
                          className={`font-semibold ${
                            v.status === 'APPROVED'
                              ? 'text-[#0B6E4F]'
                              : v.status === 'REJECTED'
                              ? 'text-[#B91C1C]'
                              : 'text-[#B45309]'
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                      {v.reviewerNotes && (
                        <p className="text-xs text-[#4B554E]">Reviewer Note: {v.reviewerNotes}</p>
                      )}
                      <p className="font-mono text-[11px] text-[#6C776E]">
                        {v.evidencePaths.join(', ') || 'Direct check'}
                      </p>
                    </div>
                  ))
                )}
              </div>
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
              className="lg:col-span-5 bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-4 self-start"
            >
              <h3 className="font-display text-lg font-bold text-[#111814]">
                Submit Verification / Bank Details
              </h3>

              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Verification Category
                </label>
                <select
                  value={verifCat}
                  onChange={(e) => setVerifCat(e.target.value as VerificationCategory)}
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg bg-white"
                >
                  <option value="IDENTITY">IDENTITY (NIN / Passport / Driver&apos;s License)</option>
                  <option value="PAYOUT_BANK">PAYOUT_BANK (Nigerian Naira Settlement Account)</option>
                  <option value="SELLER">SELLER (Additional Seller Proof)</option>
                  <option value="BUSINESS">BUSINESS (CAC Registration)</option>
                </select>
              </div>

              {verifCat === 'PAYOUT_BANK' && (
                <div>
                  <label className="block text-xs font-medium text-[#4B554E] mb-1">
                    Nigerian Bank &amp; Account Summary (Same-name match)
                  </label>
                  <input
                    type="text"
                    required
                    value={bankSummary}
                    onChange={(e) => setBankSummary(e.target.value)}
                    placeholder="e.g., GTBank · 0123456789"
                    className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
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
                  className="block w-full text-xs text-[#4B554E] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#F3F3EF] file:font-semibold"
                />
                <p className="mt-1 font-mono text-[11px] text-[#5C665E]">
                  Bucket path: verification-docs/{scout.id}/{docName}
                </p>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg cursor-pointer"
              >
                {busy ? 'Submitting...' : 'Submit for Officer Review'}
              </button>
            </form>
          </div>
        )}

        {tab === 'lifecycle' && (
          <div className="max-w-2xl bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#B91C1C] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="font-display text-xl font-bold text-[#111814]">
                  Voluntary Account Closure
                </h2>
                <p className="mt-1 text-xs text-[#4B554E] leading-relaxed">
                  Closing your account disables sign-in, pauses active Seller listings, and blocks
                  future referrals. For auditability and 13-generation ledger integrity,{' '}
                  <strong>
                    users, referralAncestry, referralEvents, and commission ledger rows are
                    preserved permanently
                  </strong>{' '}
                  rather than hard-deleted.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-[#FAFAF8] border border-[#E4E4DE] rounded-lg text-xs">
              <div>
                <p className="text-[#5C665E]">Open Orders</p>
                <p className="font-mono text-base font-bold text-[#111814] tabular-nums">
                  {openOrdersCount}
                </p>
              </div>
              <div>
                <p className="text-[#5C665E]">Pending Commissions</p>
                <p className="font-mono text-base font-bold text-[#B45309] tabular-nums">
                  {formatKoboToNaira(snapshot.wallet.pendingKobo)}
                </p>
              </div>
              <div>
                <p className="text-[#5C665E]">Available Balance</p>
                <p className="font-mono text-base font-bold text-[#0B6E4F] tabular-nums">
                  {formatKoboToNaira(snapshot.wallet.availableKobo)}
                </p>
              </div>
            </div>

            <form onSubmit={handleCloseAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Reason for Closure (Optional)
                </label>
                <input
                  type="text"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="Optional feedback..."
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Type <span className="font-mono font-bold">CLOSE MY ACCOUNT</span> to confirm
                </label>
                <input
                  type="text"
                  required
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CLOSE MY ACCOUNT"
                  className="w-full px-3 py-2 font-mono text-sm border border-[#E8D0D0] rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={busy || confirmText.trim().toUpperCase() !== 'CLOSE MY ACCOUNT'}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#B91C1C] rounded-lg hover:bg-[#991B1B] disabled:opacity-45 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                {busy ? 'Closing Account...' : 'Close Account & Preserve Ledger'}
              </button>
            </form>

            <div className="flex items-center gap-2 text-xs text-[#5C665E] pt-2 border-t border-[#ECECE6]">
              <CheckCircle2 className="w-4 h-4 text-[#0B6E4F] shrink-0" aria-hidden="true" />
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
