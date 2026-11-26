'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import type { ActiveRestrictionDTO, CapabilityCode } from '@/lib/auth/rbac';
import type { ActiveScoutDTO } from '@/lib/nairascout-store';
import { formatLagosDate, formatLagosDateTime } from '@/lib/utils/africa-lagos';

interface RestrictionNoticeBannerProps {
  activeScout: ActiveScoutDTO | null;
}

function getFriendlyStatusLabel(
  accountStatus: ActiveScoutDTO['accountStatus'],
  restriction?: ActiveRestrictionDTO,
  hasOpenAppeal?: boolean
): string {
  if (hasOpenAppeal) return 'Under review';
  if (accountStatus === 'SUSPENDED') return 'Account suspended';
  if (restriction) {
    if (restriction.capabilityCode === 'CREATE_REFERRAL') return 'Referrals restricted';
    if (restriction.capabilityCode === 'REQUEST_WITHDRAWAL') return 'Withdrawals restricted';
    if (
      restriction.capabilityCode === 'PUBLISH_LISTING' ||
      restriction.capabilityCode === 'MANAGE_TEAM' ||
      restriction.capabilityCode === 'INITIATE_PURCHASE'
    ) {
      return 'Scout features restricted';
    }
  }
  if (accountStatus === 'RESTRICTED') return 'Account limited';
  return 'Scout features restricted';
}

function getFriendlyCapabilityName(code: CapabilityCode): string {
  switch (code) {
    case 'CREATE_REFERRAL':
      return 'Sending product referrals & Scouts List invites';
    case 'REQUEST_WITHDRAWAL':
      return 'Wallet withdrawal requests';
    case 'PUBLISH_LISTING':
      return 'Publishing product listings';
    case 'INITIATE_PURCHASE':
      return 'Marketplace purchases';
    case 'MANAGE_TEAM':
      return 'Seller team management';
    default:
      return 'Account capabilities';
  }
}

// NS-SCT-084 - NS-SCT-095: User-facing Scout Restriction Notice Banner with Africa/Lagos duration & appeal shortcut
export function RestrictionNoticeBanner({ activeScout }: RestrictionNoticeBannerProps) {
  if (!activeScout) return null;

  const now = new Date();
  const activeRows = (activeScout.activeRestrictions || []).filter(
    (r) => r.status === 'ACTIVE' && (!r.expiresAt || new Date(r.expiresAt) > now)
  );
  const isAccountRestricted =
    activeScout.accountStatus === 'RESTRICTED' || activeScout.accountStatus === 'SUSPENDED';

  if (!isAccountRestricted && activeRows.length === 0) {
    return null;
  }

  const openAppealIds = new Set(
    (activeScout.governanceAppeals || [])
      .filter((a) => a.status === 'OPEN' || a.status === 'UNDER_REVIEW')
      .map((a) => a.targetRecordId)
  );

  const primary = activeRows[0];
  const hasOpenAppeal = primary ? openAppealIds.has(primary.id) : openAppealIds.size > 0;
  const friendlyLabel = getFriendlyStatusLabel(activeScout.accountStatus, primary, hasOpenAppeal);

  return (
    <section
      role="alert"
      aria-label="Account Restriction Notice"
      className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 sm:p-5 space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {activeScout.accountStatus === 'SUSPENDED' ? (
            <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertTriangle
              className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          )}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-destructive text-destructive-foreground">
                {friendlyLabel}
              </span>
              {activeScout.accountStatus === 'RESTRICTED' && (
                <span className="text-xs font-medium text-muted-foreground">
                  Unrelated Scout features remain available
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-foreground">
              {primary
                ? primary.reason
                : activeScout.restrictionReason ||
                  'Your account currently has an active compliance review affecting specific features.'}
            </p>
          </div>
        </div>

        <Link
          href="/settings?tab=lifecycle"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground border border-primary-border hover:bg-primary/90 shrink-0"
        >
          {hasOpenAppeal ? 'View Appeal Status' : 'Submit Appeal / Request Review'}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>

      {activeRows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-destructive/20">
          {activeRows.map((r) => (
            <div
              key={r.id}
              className="bg-card/90 border border-border rounded-xl p-3 text-xs space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">
                  {getFriendlyStatusLabel(activeScout.accountStatus, r, openAppealIds.has(r.id))}
                </span>
                <span className="text-muted-foreground font-numeric">
                  Effective {formatLagosDate(r.createdAt)}
                </span>
              </div>
              <p className="text-muted-foreground">
                Affected capability:{' '}
                <strong className="text-foreground">
                  {getFriendlyCapabilityName(r.capabilityCode)}
                </strong>
              </p>
              <p className="text-muted-foreground">
                Duration:{' '}
                <strong className="text-foreground">
                  {r.expiresAt
                    ? `Temporarily restricted until ${formatLagosDateTime(r.expiresAt)}`
                    : 'In effect pending review'}
                </strong>
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
