'use client';

// NS-UI-310, NS-UI-321 & NS-SCT-015: Dedicated Privacy Settings View
import { useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { ProfileVisibility } from '@/lib/auth/rbac';
import type { InvitationPolicy, NairaScoutSnapshot } from '@/lib/nairascout-store';
import { UserIdentityRow } from '@/components/shared/UserIdentityRow';

interface PrivacySettingsViewProps {
  snapshot: NairaScoutSnapshot;
  onSnapshotUpdated: (next: NairaScoutSnapshot) => void;
}

export default function PrivacySettingsView({
  snapshot,
  onSnapshotUpdated,
}: PrivacySettingsViewProps) {
  const scout = snapshot.activeScout;

  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>(
    scout?.profileVisibility || 'PRIVATE'
  );
  const [invitationPolicy, setInvitationPolicy] = useState<InvitationPolicy>(
    scout?.invitePolicy || 'EVERYONE'
  );
  const [muteReferrals, setMuteReferrals] = useState(scout?.muteReferrals ?? false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);

  if (!snapshot.authenticated || !scout) {
    return (
      <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
        <Lock className="w-8 h-8 text-foreground mx-auto" aria-hidden="true" />
        <h1 className="font-sans text-xl md:text-2xl font-bold text-foreground">
          Sign In to Manage Privacy Settings
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Control profile visibility, Scouts List invitation permissions, referral muting, and
          blocked accounts once signed in.
        </p>
        <Link
          href="/auth/login"
          className="inline-block px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const patchPrivacy = async (payload: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Could not save privacy settings.' });
        return;
      }
      if (data.snapshot) {
        onSnapshotUpdated(data.snapshot);
      }
      setFeedback({ type: 'ok', message: okMsg });
    } catch {
      setFeedback({ type: 'err', message: 'Network error while updating privacy preferences.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Privacy Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Private-by-default Scout controls. Email, phone, wallet balances, and ancestry remain
            strictly private.
          </p>
        </div>
        <Link
          href="/settings"
          className="text-xs font-semibold text-foreground hover:underline shrink-0"
        >
          All Account Settings →
        </Link>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void patchPrivacy(
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
            Profile Visibility &amp; Referral Controls
          </h2>

          <div className="space-y-2">
            <label
              htmlFor="dedicated-privacy-visibility"
              className="block text-xs font-medium text-muted-foreground"
            >
              Scout Profile Visibility
            </label>
            <select
              id="dedicated-privacy-visibility"
              value={profileVisibility}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'PRIVATE' || val === 'NETWORK_ONLY' || val === 'PUBLIC') {
                  setProfileVisibility(val);
                }
              }}
              className="w-full px-3.5 py-2 text-sm border border-input rounded-xl bg-background text-foreground"
            >
              <option value="PRIVATE">
                Private (Default) — Hide optional bio, State/LGA &amp; categories
              </option>
              <option value="NETWORK_ONLY">
                Scouts List Only — Share optional details with contacts
              </option>
              <option value="PUBLIC">
                Public Directory — Share optional details in Scouts search
              </option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              There is no public /scouts/[username] profile page. Only permitted directory snippets
              are shown according to your selection.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="dedicated-invitation-policy"
              className="block text-xs font-medium text-muted-foreground"
            >
              Who can send you Scouts List invitations?
            </label>
            <select
              id="dedicated-invitation-policy"
              value={invitationPolicy}
              onChange={(e) => setInvitationPolicy(e.target.value as InvitationPolicy)}
              className="w-full px-3.5 py-2 text-sm border border-input rounded-xl bg-background text-foreground"
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
                When enabled, other Scouts cannot dispatch new product referral cards to your inbox.
                Your permanent ancestry links remain unaffected.
              </p>
            </div>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save Privacy Preferences'}
          </button>
        </form>

        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 space-y-4 self-start">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Blocked Users ({snapshot.blockedUsers.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Blocked accounts cannot view your directory entry, send invitations, or refer products
            to you.
          </p>

          {snapshot.blockedUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">You have not blocked any users.</p>
          ) : (
            <div className="divide-y divide-border">
              {snapshot.blockedUsers.map((b) => (
                <div key={b.userId} className="py-3 flex items-center justify-between gap-3">
                  <UserIdentityRow
                    displayName={b.displayName}
                    username={b.username}
                    size="sm"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patchPrivacy(
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
    </div>
  );
}
