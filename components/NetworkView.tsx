'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Flag,
  GitBranch,
  Lock,
  Search,
  Send,
  Store,
  UserPlus,
  X,
} from 'lucide-react';
import type { NairaScoutSnapshot, ProductListing } from '@/lib/nairascout-store';
import { CommissionBreakdown, formatKoboToNaira } from '@/lib/commission-engine';
import { DismissibleNoticePanel } from './shared/DismissibleNoticePanel';
import { UserIdentityRow } from './shared/UserIdentityRow';

interface NetworkViewProps {
  snapshot: NairaScoutSnapshot;
  onInviteScout: (targetScoutId: string) => Promise<void>;
  onRespondInvite: (invitationId: string, decision: 'accept' | 'reject' | 'withdraw') => Promise<void>;
  onManageContact: (payload: {
    contactId?: string;
    targetUserId?: string;
    operation: 'remove' | 'block' | 'unblock';
  }) => Promise<void>;
  onReportAbuse: (payload: {
    reportedUserId: string;
    reason: string;
    description: string;
  }) => Promise<boolean>;
  onOpenReferForProduct: (product: ProductListing) => void;
}

export default function NetworkView({
  snapshot,
  onInviteScout,
  onRespondInvite,
  onManageContact,
  onReportAbuse,
  onOpenReferForProduct,
}: NetworkViewProps) {
  const [subTab, setSubTab] = useState<'explorer' | 'scouts_list' | 'simulator'>('explorer');
  const [inviteSubTab, setInviteSubTab] = useState<'received' | 'sent'>('received');
  const [scoutSearch, setScoutSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [abuseTarget, setAbuseTarget] = useState<{ userId: string; handle: string } | null>(null);
  const [abuseReason, setAbuseReason] = useState('Unsolicited spam or harassment');
  const [abuseDesc, setAbuseDesc] = useState('');

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(event.target as Node)
      ) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  // Simulator controls
  const [merchNaira, setMerchNaira] = useState<number>(100000);
  const [depth, setDepth] = useState<number>(13);
  const [isReferral, setIsReferral] = useState<boolean>(true);
  const [ineligibleGens, setIneligibleGens] = useState<number[]>([]);
  const [simResult, setSimResult] = useState<CommissionBreakdown | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const totalNetworkScouts = snapshot.downstreamGenerations.reduce(
    (sum, g) => sum + g.scoutCount,
    0
  );
  const directGen1Count = snapshot.downstreamGenerations[0]?.scoutCount ?? 0;

  useEffect(() => {
    let active = true;
    const runSim = async () => {
      setSimLoading(true);
      try {
        const res = await fetch('/api/nairascout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'simulate_commission',
            merchandiseNaira: merchNaira,
            depth,
            ineligibleGens,
            isReferral,
          }),
        });
        const data = await res.json();
        if (active && data.breakdown) {
          setSimResult(data.breakdown);
        }
      } finally {
        if (active) setSimLoading(false);
      }
    };
    runSim();
    return () => {
      active = false;
    };
  }, [merchNaira, depth, ineligibleGens, isReferral]);

  const toggleGenIneligible = (gen: number) => {
    setIneligibleGens((prev) =>
      prev.includes(gen) ? prev.filter((g) => g !== gen) : [...prev, gen]
    );
  };

  const filteredDirectory = useMemo(() => {
    const q = scoutSearch.trim().toLowerCase();
    return snapshot.allScoutsDirectory.filter(
      (s) =>
        !q ||
        s.username.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q) ||
        (s.locationState || '').toLowerCase().includes(q)
    );
  }, [snapshot.allScoutsDirectory, scoutSearch]);

  const receivedInvites = snapshot.invitations.filter(
    (i) => i.direction === 'incoming' && i.status === 'pending'
  );
  const sentInvites = snapshot.invitations.filter((i) => i.direction === 'outgoing');

  const handleSubmitAbuse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abuseTarget || !abuseDesc.trim()) return;
    const ok = await onReportAbuse({
      reportedUserId: abuseTarget.userId,
      reason: abuseReason,
      description: abuseDesc,
    });
    if (ok) {
      setAbuseTarget(null);
      setAbuseDesc('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Network
        </h1>

        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl shrink-0 self-start overflow-x-auto">
          <button
            type="button"
            onClick={() => setSubTab('explorer')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'explorer'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Ancestry
          </button>
          <button
            type="button"
            onClick={() => setSubTab('scouts_list')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'scouts_list'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Scouts
          </button>
          <button
            type="button"
            onClick={() => setSubTab('simulator')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'simulator'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Calculator
          </button>
        </div>
      </div>

      <DismissibleNoticePanel
        storageKey="nairascout_network_explainer_notice_v1"
        description="Inspect your permanent referral ancestry, manage Scouts List with strict privacy controls, or calculate your Commissions"
        ariaLabel="Network Explainer Notice"
      />

      {subTab === 'explorer' && (
        !snapshot.authenticated ? (
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-10 text-center space-y-3">
            <h2 className="font-sans text-xl font-bold text-foreground">
              Sign In to Inspect Your Permanent Referral Ancestry
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Your permanent direct-referrer ancestry and downstream Gen 1–13 counts are private to
              your Scout account. You can still test the 13-Gen Commission Calculator right away.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row sm:justify-center gap-3 w-full">
              <Link
                href="/auth/login"
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90"
              >
                Sign In/Join Free
              </Link>
              <button
                type="button"
                onClick={() => setSubTab('simulator')}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-foreground border border-border bg-card rounded-xl hover:bg-muted cursor-pointer"
              >
                Open Commission Calculator
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                <p className="text-xs text-muted-foreground">Permanent Direct Referrer (Gen 1)</p>
                <p className="mt-1 font-sans text-lg font-semibold text-foreground">
                  {snapshot.upstreamAncestry[0]
                    ? snapshot.upstreamAncestry[0].displayName
                    : 'Organic Registration'}
                </p>
                <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                  {snapshot.upstreamAncestry[0]
                    ? `@${snapshot.upstreamAncestry[0].handle} · Permanent`
                    : 'No direct referrer'}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                <p className="text-xs text-muted-foreground">Upstream Ancestry Depth</p>
                <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
                  {snapshot.upstreamAncestry.length} / 13
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Locked at registration</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                <p className="text-xs text-muted-foreground">Direct Downstream Scouts (Gen 1)</p>
                <p className="mt-1 font-numeric text-2xl font-bold text-foreground tabular-nums">
                  {directGen1Count}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Zero recruitment fees paid</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                <p className="text-xs text-muted-foreground">Total 13-Gen Network Reach</p>
                <p className="mt-1 font-numeric text-2xl font-bold text-success tabular-nums">
                  {totalNetworkScouts}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Aggregate counts only</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-sans text-lg font-bold text-foreground">
                    Downstream Network (Gen 1-13)
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    Your position above downstream Seller Scouts
                  </span>
                </div>

                <div className="bg-card border border-border rounded-2xl w-full overflow-x-auto">
                  <table className="w-full min-w-[540px] text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="py-3 px-4 font-medium">Generation</th>
                        <th className="py-3 px-4 font-medium text-right">Scouts</th>
                        <th className="py-3 px-4 font-medium text-right">Eligible</th>
                        <th className="py-3 px-4 font-medium text-right">Pool Share (4–13)</th>
                        <th className="py-3 px-4 font-medium">Permitted Handles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {snapshot.downstreamGenerations.map((row) => (
                        <tr key={row.generation} className="hover:bg-muted/40">
                          <td className="py-2.5 px-4 font-numeric text-xs font-semibold text-foreground">
                            Gen {row.generation}
                          </td>
                          <td className="py-2.5 px-4 font-numeric text-right tabular-nums text-foreground">
                            {row.scoutCount}
                          </td>
                          <td className="py-2.5 px-4 font-numeric text-right tabular-nums text-success font-semibold">
                            {row.eligibleCount}
                          </td>
                          <td className="py-2.5 px-4 font-numeric text-right tabular-nums text-muted-foreground">
                            {row.scheduleFractionAtFullDepth}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-muted-foreground">
                            {row.sampleHandles.length > 0
                              ? row.sampleHandles.join(', ')
                              : 'Privacy-protected aggregate count'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-sans text-lg font-bold text-foreground">
                    Your Permanent Upstream Ancestry
                  </h2>
                  <Lock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Private contact details, bank accounts, and individual earnings are never
                    exposed. Ineligible ancestors retain their fixed generation slot and receive
                    ₦0.00.
                  </p>

                  {snapshot.upstreamAncestry.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4">
                      Registered organically with no upstream direct referrer.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {snapshot.upstreamAncestry.map((node) => (
                        <div
                          key={node.generation}
                          className="py-2.5 flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-numeric text-xs font-semibold text-muted-foreground w-12 shrink-0">
                              Gen {node.generation}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {node.displayName}
                              </p>
                              <p className="font-numeric text-xs text-muted-foreground">
                                @{node.handle}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5 text-xs">
                            {node.eligible ? (
                              <>
                                <CheckCircle2
                                  className="w-3.5 h-3.5 text-success"
                                  aria-hidden="true"
                                />
                                <span className="text-success font-medium">Eligible</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle
                                  className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"
                                  aria-hidden="true"
                                />
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                  Ineligible (₦0)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {subTab === 'scouts_list' && (
        !snapshot.authenticated ? (
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-10 text-center space-y-3">
            <h2 className="font-sans text-xl font-bold text-foreground">
              Sign In to Manage Your Scouts List
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Search Scouts, send Scouts List invitations, manage blocks, and report abuse once
              signed in.
            </p>
            <Link
              href="/auth/login"
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90"
            >
              Sign In
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Active Contacts & Sanitized Scout Directory Search */}
            <div className="lg:col-span-7 space-y-8">
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h2 className="font-sans text-lg font-bold text-foreground">
                    Scouts List
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    INVITE is separate from product REFER
                  </span>
                </div>

                <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                  {snapshot.scoutsList.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No active contacts yet. Use the sanitized Scout Search below to send an
                      invitation.
                    </div>
                  ) : (
                    snapshot.scoutsList.map((contact) => (
                      <div
                        key={contact.contactId}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <UserIdentityRow
                          avatarUrl={contact.avatarUrl}
                          displayName={contact.displayName}
                          username={contact.handle}
                          badge={
                            contact.hasActiveSellerBadge ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success shrink-0">
                                <Store className="w-3 h-3" aria-hidden="true" />
                                Seller
                              </span>
                            ) : undefined
                          }
                          subtitle={`${contact.city} · Added ${contact.addedAt}`}
                        />

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {snapshot.products[0] && (
                            <button
                              type="button"
                              onClick={() => onOpenReferForProduct(snapshot.products[0])}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 cursor-pointer"
                            >
                              <Send className="w-3 h-3" aria-hidden="true" />
                              Refer
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              onManageContact({
                                contactId: contact.contactId,
                                operation: 'remove',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                          >
                            <X className="w-3 h-3" aria-hidden="true" />
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onManageContact({
                                targetUserId: contact.scoutId,
                                operation: 'block',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-destructive/30 rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer"
                          >
                            <Ban className="w-3 h-3" aria-hidden="true" />
                            Block
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAbuseTarget({ userId: contact.scoutId, handle: contact.handle })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Flag className="w-3 h-3" aria-hidden="true" />
                            Report
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Sanitized Scout Search */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-sans text-lg font-bold text-foreground">
                      Invite
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Emails, phone numbers, and wallet balances are never exposed in directory
                      search.
                    </p>
                  </div>
                  <div ref={searchDropdownRef} className="relative w-full sm:w-72">
                    <Search
                      className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-controls="scout-suggestions-listbox"
                      value={scoutSearch}
                      onFocus={() => setSearchFocused(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setSearchFocused(false);
                      }}
                      onChange={(e) => {
                        setScoutSearch(e.target.value);
                        setSearchFocused(true);
                      }}
                      placeholder="Search username or state..."
                      aria-label="Search public Scouts directory"
                      aria-expanded={searchFocused && scoutSearch.trim().length > 0}
                      className="pl-8 pr-8 py-2 text-xs bg-card text-foreground border border-border rounded-xl w-full focus:outline-none focus:border-ring"
                    />
                    {scoutSearch && (
                      <button
                        type="button"
                        onClick={() => setScoutSearch('')}
                        aria-label="Clear Scout search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Smart Suggestion Dropdown */}
                    {searchFocused && scoutSearch.trim().length > 0 && (
                      <div
                        id="scout-suggestions-listbox"
                        role="listbox"
                        aria-label="Scout search suggestions"
                        className="absolute left-0 right-0 mt-1.5 z-40 bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-border"
                      >
                        {filteredDirectory.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-muted-foreground">
                            No Scouts matching &ldquo;{scoutSearch.trim()}&rdquo;.
                          </p>
                        ) : (
                          filteredDirectory.slice(0, 6).map((scout) => {
                            const alreadyContact = snapshot.scoutsList.some(
                              (c) => c.scoutId === scout.userId
                            );
                            const pendingInv = snapshot.invitations.some(
                              (i) => i.otherScoutId === scout.userId && i.status === 'pending'
                            );
                            return (
                              <div
                                key={`suggest-${scout.userId}`}
                                role="option"
                                aria-selected={false}
                                className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-muted/60 transition-colors"
                              >
                                <UserIdentityRow
                                  avatarUrl={scout.avatarUrl}
                                  displayName={scout.displayName}
                                  username={scout.username}
                                  size="sm"
                                  badge={
                                    scout.hasActiveSellerBadge ? (
                                      <span className="text-[10px] font-semibold text-success shrink-0">
                                        Seller
                                      </span>
                                    ) : undefined
                                  }
                                />
                                <div className="shrink-0">
                                  {alreadyContact ? (
                                    <span className="text-[11px] font-semibold text-success">
                                      Contact
                                    </span>
                                  ) : pendingInv ? (
                                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                      Pending
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={busyId === scout.userId}
                                      onClick={async () => {
                                        setBusyId(scout.userId);
                                        await onInviteScout(scout.userId);
                                        setBusyId(null);
                                        setSearchFocused(false);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 cursor-pointer"
                                    >
                                      <UserPlus className="w-3 h-3" aria-hidden="true" />
                                      Invite
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl divide-y divide-border max-h-[380px] overflow-y-auto">
                  {filteredDirectory.map((scout) => {
                    const alreadyContact = snapshot.scoutsList.some(
                      (c) => c.scoutId === scout.userId
                    );
                    const pendingInv = snapshot.invitations.some(
                      (i) => i.otherScoutId === scout.userId && i.status === 'pending'
                    );
                    return (
                      <div
                        key={scout.userId}
                        className="p-4 flex items-center justify-between gap-4"
                      >
                        <UserIdentityRow
                          avatarUrl={scout.avatarUrl}
                          displayName={scout.displayName}
                          username={scout.username}
                          badge={
                            <>
                              {scout.hasActiveSellerBadge && (
                                <span className="text-[11px] font-medium text-foreground shrink-0">
                                  Seller
                                </span>
                              )}
                              {scout.isSellerVerified && (
                                <span className="text-[11px] font-semibold text-success shrink-0">
                                  · KYC Verified
                                </span>
                              )}
                            </>
                          }
                          subtitle={`${scout.locationState || 'Nigeria'} · Working with ${scout.workingWithCount} Scouts · ${scout.totalSoldUnits} units sold`}
                        />

                        <div className="shrink-0">
                          {alreadyContact ? (
                            <span className="text-xs font-semibold text-success">In Contacts</span>
                          ) : pendingInv ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              Pending
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={busyId === scout.userId}
                              onClick={async () => {
                                setBusyId(scout.userId);
                                await onInviteScout(scout.userId);
                                setBusyId(null);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                              Invite
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Right: Pending Invitations (Received / Sent) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-sans text-base font-semibold text-foreground">
                    Pending Invitations
                  </h3>
                  <div className="flex items-center gap-1 p-0.5 bg-muted rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setInviteSubTab('received')}
                      className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                        inviteSubTab === 'received'
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Received ({receivedInvites.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteSubTab('sent')}
                      className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                        inviteSubTab === 'sent'
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Sent ({sentInvites.length})
                    </button>
                  </div>
                </div>

                {inviteSubTab === 'received' ? (
                  receivedInvites.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4">
                      No pending incoming invitations.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {receivedInvites.map((inv) => (
                        <div key={inv.id} className="py-3 first:pt-0 space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <UserIdentityRow
                              avatarUrl={inv.otherAvatarUrl}
                              displayName={inv.otherDisplayName}
                              username={inv.otherHandle}
                              size="sm"
                              subtitle={`${inv.otherCity} · Expires ${inv.expiresAt}`}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => onRespondInvite(inv.id, 'accept')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => onRespondInvite(inv.id, 'reject')}
                              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : sentInvites.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">No outgoing invitations.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {sentInvites.map((inv) => (
                      <div key={inv.id} className="py-3 first:pt-0 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <UserIdentityRow
                            avatarUrl={inv.otherAvatarUrl}
                            displayName={inv.otherDisplayName}
                            username={inv.otherHandle}
                            size="sm"
                            subtitle={`${inv.otherCity} · Expires ${inv.expiresAt}`}
                          />
                          <span className="text-xs capitalize text-muted-foreground shrink-0">
                            {inv.status}
                          </span>
                        </div>
                        {inv.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => onRespondInvite(inv.id, 'withdraw')}
                            className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <p className="text-xs font-semibold text-foreground">
                  Your Privacy &amp; Block Controls
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Invitation policy</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5">
                      {snapshot.activeScout?.invitePolicy}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Blocked users</p>
                    <p className="font-numeric text-xs font-semibold text-foreground mt-0.5 tabular-nums">
                      {snapshot.blockedUsers.length}
                    </p>
                  </div>
                </div>
                <Link
                  href="/settings"
                  className="inline-block text-xs font-semibold text-foreground hover:underline"
                >
                  Configure privacy &amp; unblock users in Settings →
                </Link>
              </div>
            </div>
          </div>
        )
      )}

      {subTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 space-y-6 self-start">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-foreground" aria-hidden="true" />
              <h2 className="font-sans text-base font-bold text-foreground">
                Commission Engine Parameters
              </h2>
            </div>

            <div className="space-y-2">
              <label htmlFor="sim-merch" className="block text-xs font-medium text-muted-foreground">
                Eligible Revenue (₦). *Excluding delivery &amp; tax
              </label>
              <input
                id="sim-merch"
                type="number"
                min={1000}
                step={5000}
                value={merchNaira}
                onChange={(e) => setMerchNaira(Math.max(0, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 font-numeric text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring tabular-nums"
              />
              <div className="flex items-center gap-2 pt-1">
                {[25000, 100000, 250000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMerchNaira(preset)}
                    className="px-2.5 py-1 text-xs font-numeric bg-secondary hover:bg-muted rounded-lg text-secondary-foreground cursor-pointer"
                  >
                    ₦{preset.toLocaleString('en-NG')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sim-depth" className="font-medium text-muted-foreground">
                  Actual Seller Ancestry Depth
                </label>
                <span className="font-numeric font-semibold text-foreground">
                  {depth} {depth === 1 ? 'generation' : 'generations'}
                </span>
              </div>
              <input
                id="sim-depth"
                type="range"
                min={1}
                max={13}
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="w-full accent-foreground cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-numeric text-muted-foreground">
                <span>1 (1/2)</span>
                <span>2 (1/4, 1/5)</span>
                <span>3 (1/5, 1/6, 1/10)</span>
                <span>4–13 (Extended)</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Checkout Attribution Type</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsReferral(true)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border cursor-pointer ${
                    isReferral
                      ? 'bg-primary text-primary-foreground border-primary-border'
                      : 'bg-background text-muted-foreground border-border'
                  }`}
                >
                  Referral-Card Buy
                </button>
                <button
                  type="button"
                  onClick={() => setIsReferral(false)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border cursor-pointer ${
                    !isReferral
                      ? 'bg-commerce text-commerce-foreground border-commerce'
                      : 'bg-background text-muted-foreground border-border'
                  }`}
                >
                  Direct Marketplace
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground">
                Simulate Ineligible Ancestors (Verify No-Promotion Rule)
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: depth }, (_, i) => i + 1).map((g) => {
                  const off = ineligibleGens.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenIneligible(g)}
                      className={`py-1.5 text-xs font-numeric rounded-lg border cursor-pointer ${
                        off
                          ? 'bg-destructive/10 border-destructive/30 text-destructive line-through'
                          : 'bg-muted/60 border-border text-foreground'
                      }`}
                    >
                      G{g}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-5">
            {simResult && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                    <p className="text-xs text-muted-foreground">Seller Proceeds (90%)</p>
                    <p className="mt-1 font-numeric text-base font-bold text-foreground tabular-nums">
                      {formatKoboToNaira(simResult.sellerProceedsKobo)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                    <p className="text-xs text-muted-foreground">NairaScout Fee (10%)</p>
                    <p className="mt-1 font-numeric text-base font-bold text-foreground tabular-nums">
                      {formatKoboToNaira(simResult.marketplaceCommissionKobo)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                    <p className="text-xs text-muted-foreground">20% Referral Pool</p>
                    <p className="mt-1 font-numeric text-base font-bold text-success tabular-nums">
                      {formatKoboToNaira(simResult.referralPoolKobo)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                    <p className="text-xs text-muted-foreground">Retained (Undistributed)</p>
                    <p className="mt-1 font-numeric text-base font-bold text-muted-foreground tabular-nums">
                      {formatKoboToNaira(simResult.undistributedRetainedKobo)}
                    </p>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {simResult.scheduleName === 'Extended 4–13 Generation Schedule'
                        ? '13 Generation Schedule'
                        : simResult.scheduleName}
                    </span>
                    {simLoading && (
                      <span className="font-numeric text-muted-foreground">Calculating...</span>
                    )}
                  </div>

                  {simResult.allocations.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Direct marketplace purchase generates ₦0.00 referral pool and ₦0.00
                      generation commissions.
                    </div>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <table className="w-full min-w-[540px] text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs text-muted-foreground">
                            <th className="py-2.5 px-4 font-medium">Generation</th>
                            <th className="py-2.5 px-4 font-medium">Fraction</th>
                            <th className="py-2.5 px-4 font-medium">Eligibility</th>
                            <th className="py-2.5 px-4 font-medium text-right">Allocation (₦)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {simResult.allocations.map((row) => (
                            <tr key={row.generation} className="hover:bg-muted/40">
                              <td className="py-2.5 px-4 font-numeric text-xs font-semibold text-foreground">
                                Gen {row.generation}
                              </td>
                              <td className="py-2.5 px-4 font-numeric text-xs text-muted-foreground">
                                {row.fractionLabel}
                              </td>
                              <td className="py-2.5 px-4 text-xs">
                                {row.eligible ? (
                                  <span className="text-success font-medium">Eligible</span>
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                                    Ineligible (Slot kept empty)
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 font-numeric text-right tabular-nums font-bold text-foreground">
                                {formatKoboToNaira(row.amountKobo)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border bg-muted/50 font-semibold">
                            <td colSpan={3} className="py-3 px-4 text-xs text-foreground">
                              Total Allocated to Eligible Scouts
                            </td>
                            <td className="py-3 px-4 font-numeric text-right tabular-nums text-success">
                              {formatKoboToNaira(simResult.totalAllocatedKobo)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Report Abuse Modal */}
      {abuseTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report Abuse"
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-lg font-bold text-foreground">
                Report Abuse (@{abuseTarget.handle})
              </h3>
              <button
                type="button"
                onClick={() => setAbuseTarget(null)}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitAbuse} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Reason
                </label>
                <select
                  value={abuseReason}
                  onChange={(e) => setAbuseReason(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2 text-sm border border-input rounded-xl bg-background text-foreground"
                >
                  <option value="Unsolicited spam or harassment">
                    Unsolicited spam or harassment
                  </option>
                  <option value="Misleading product claims">Misleading product claims</option>
                  <option value="Suspected collusion or fraud">Suspected collusion or fraud</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={abuseDesc}
                  onChange={(e) => setAbuseDesc(e.target.value)}
                  placeholder="Describe what happened..."
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-destructive-foreground bg-destructive rounded-xl cursor-pointer"
              >
                Submit Report to Trust &amp; Safety
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
