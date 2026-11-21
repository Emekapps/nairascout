'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  FileText,
  Lock,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import type {
  AccountStatus,
  AdminRole,
  SellerStatus,
  VerificationStatus,
} from '@/lib/auth/rbac';
import type {
  AbuseReportRecord,
  AuditLogRecord,
  VerificationRecord,
} from '@/lib/nairascout-store';

export interface AdminVerificationRow extends VerificationRecord {
  username: string;
  displayName: string;
  email: string;
  sellerName: string | null;
  sellerType: 'INDIVIDUAL' | 'BUSINESS' | null;
  sellerStatus: SellerStatus | null;
}

export interface AdminManagedUserRow {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  accountStatus: AccountStatus;
  restrictionReason: string | null;
  closedAt: string | null;
  sellerProfileId: string | null;
  sellerName: string | null;
  sellerStatus: SellerStatus | null;
  subscriptionPlan: string | null;
  adminRole: AdminRole | null;
  hasPermanentAncestry: boolean;
  ledgerEntriesCount: number;
}

export interface AdminConsoleData {
  adminRole: AdminRole | null;
  verifications: AdminVerificationRow[];
  users: AdminManagedUserRow[];
  abuseReports: AbuseReportRecord[];
  auditLogs: AuditLogRecord[];
}

export type AdminSection = 'overview' | 'verifications' | 'users' | 'audit_logs';

interface AdminConsoleViewProps {
  initialSection: AdminSection;
  authenticated: boolean;
  adminBootstrapAvailable: boolean;
  initialAdminData: AdminConsoleData | null;
}

export default function AdminConsoleView({
  initialSection,
  authenticated,
  adminBootstrapAvailable,
  initialAdminData,
}: AdminConsoleViewProps) {
  const router = useRouter();
  const [adminData, setAdminData] = useState<AdminConsoleData | null>(initialAdminData);
  const [bootstrapAvailable, setBootstrapAvailable] = useState(adminBootstrapAvailable);
  const [bearerToken, setBearerToken] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // First-run Super Admin claim form
  const [claimName, setClaimName] = useState('Platform Super Admin');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPassword, setClaimPassword] = useState('');

  // Verification Queue filters & notes
  const [verifFilter, setVerifFilter] = useState<'ALL' | VerificationStatus>('PENDING');
  const [notesByVerif, setNotesByVerif] = useState<Record<string, string>>({});
  const [signedPreview, setSignedPreview] = useState<{
    path: string;
    signedUrl: string | null;
    summary?: string;
  } | null>(null);

  // User Governance state
  const [userSearch, setUserSearch] = useState('');
  const [govReason, setGovReason] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>(
    initialAdminData?.users[0]?.userId || ''
  );

  // Audit Log filter
  const [auditQuery, setAuditQuery] = useState('');

  const buildHeaders = (): HeadersInit => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'NairaScout',
    };
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }
    return headers;
  };

  const handleClaimSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({
          action: 'claim_admin',
          email: claimEmail,
          password: claimPassword,
          displayName: claimName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Could not claim Super Admin.' });
        return;
      }
      if (data.token) setBearerToken(data.token);
      setBootstrapAvailable(false);

      const adminRes = await fetch('/api/admin', {
        headers: data.token ? { Authorization: `Bearer ${data.token}` } : undefined,
      });
      if (adminRes.ok) {
        const fetchedAdmin = (await adminRes.json()) as AdminConsoleData;
        setAdminData(fetchedAdmin);
        setSelectedUserId(fetchedAdmin.users[0]?.userId || '');
      }
      setFeedback({ type: 'ok', message: 'Super Admin role provisioned and signed in.' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleSignDocument = async (path: string) => {
    setFeedback(null);
    const headers: Record<string, string> = {};
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
    const res = await fetch(`/api/admin?signPath=${encodeURIComponent(path)}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'err', message: data.error || 'Could not sign document URL.' });
      return;
    }
    setSignedPreview({
      path,
      signedUrl: data.signedUrl ?? null,
      summary: data.previewDocumentSummary,
    });
  };

  const handleVerificationDecision = async (
    verificationId: string,
    decision: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED'
  ) => {
    const reviewerNotes = (notesByVerif[verificationId] || '').trim();
    if (!reviewerNotes) {
      setFeedback({
        type: 'err',
        message: 'Mandatory reviewer notes are required before submitting a verification decision.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          action: 'review_verification',
          verificationId,
          decision,
          reviewerNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Verification review failed.' });
        return;
      }
      if (data.admin) setAdminData(data.admin);
      setFeedback({
        type: 'ok',
        message: `Verification ${verificationId} marked ${decision} and recorded in audit logs.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUserGovernance = async (payload: {
    targetUserId: string;
    actionType:
      | 'SET_ACCOUNT_STATUS'
      | 'SET_SELLER_STATUS'
      | 'HOLD_PENDING_COMMISSIONS'
      | 'RESOLVE_ABUSE_REPORT';
    accountStatus?: AccountStatus;
    sellerStatus?: SellerStatus;
    abuseReportId?: string;
    abuseResolution?: 'RESOLVED' | 'DISMISSED';
    reasonOverride?: string;
  }) => {
    const reason = (payload.reasonOverride ?? govReason).trim();
    if (!reason) {
      setFeedback({
        type: 'err',
        message: 'Documented governance reason is required before applying restrictions.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          action: 'user_governance',
          targetUserId: payload.targetUserId,
          actionType: payload.actionType,
          accountStatus: payload.accountStatus,
          sellerStatus: payload.sellerStatus,
          abuseReportId: payload.abuseReportId,
          abuseResolution: payload.abuseResolution,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Governance action failed.' });
        return;
      }
      if (data.admin) setAdminData(data.admin);
      setGovReason('');
      setFeedback({ type: 'ok', message: 'Governance action applied and logged.' });
    } finally {
      setBusy(false);
    }
  };

  const filteredVerifications = useMemo(() => {
    if (!adminData) return [];
    return adminData.verifications.filter(
      (v) => verifFilter === 'ALL' || v.status === verifFilter
    );
  }, [adminData, verifFilter]);

  const filteredUsers = useMemo(() => {
    if (!adminData) return [];
    const q = userSearch.trim().toLowerCase();
    return adminData.users.filter(
      (u) =>
        !q ||
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.sellerName || '').toLowerCase().includes(q)
    );
  }, [adminData, userSearch]);

  const filteredAuditLogs = useMemo(() => {
    if (!adminData) return [];
    const q = auditQuery.trim().toLowerCase();
    return adminData.auditLogs.filter(
      (l) =>
        !q ||
        l.action.toLowerCase().includes(q) ||
        l.actorHandle.toLowerCase().includes(q) ||
        l.affectedHandle.toLowerCase().includes(q) ||
        (l.reason || '').toLowerCase().includes(q)
    );
  }, [adminData, auditQuery]);

  // Bootstrap Claim Super Admin UI when no admin exists yet
  if (!adminData && bootstrapAvailable) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col justify-center p-6">
        <div className="max-w-md w-full mx-auto space-y-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C665E] hover:text-[#111814]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to NairaScout
          </Link>

          <div className="bg-white border border-[#E4E4DE] rounded-xl p-7 space-y-5">
            <div className="flex items-center gap-2 text-[#0B6E4F] text-xs font-semibold uppercase tracking-wider">
              <Shield className="w-4 h-4" aria-hidden="true" />
              First-Run Bootstrap
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-[#111814]">
                Claim Super Admin Console
              </h1>
              <p className="mt-1 text-xs text-[#5C665E] leading-relaxed">
                No platform administrator exists yet. Claim the one-time Super Admin role to review
                Seller verifications, enforce proportional restrictions, and inspect audit logs.
              </p>
            </div>

            {feedback && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#B91C1C]">
                {feedback.message}
              </div>
            )}

            <form onSubmit={handleClaimSuperAdmin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Administrator Name
                </label>
                <input
                  type="text"
                  required
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Administrator Email
                </label>
                <input
                  type="email"
                  required
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  placeholder="admin@nairascout.ng"
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4B554E] mb-1">
                  Strong Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={claimPassword}
                  onChange={(e) => setClaimPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D8D8D0] rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] cursor-pointer"
              >
                {busy ? 'Provisioning...' : 'Provision Super Admin Role'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Non-admin Access Denied view
  if (!adminData) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E4E4DE] rounded-xl max-w-md w-full p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-[#B91C1C] mx-auto" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold text-[#111814]">
            403 · Admin Governance Access Required
          </h1>
          <p className="text-sm text-[#5C665E]">
            {authenticated
              ? 'Your current Scout/Seller session does not hold a platform administrator role.'
              : 'Sign in with an administrator account to access NairaScout governance.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            {!authenticated && (
              <Link
                href="/auth/login"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg"
              >
                Sign In
              </Link>
            )}
            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold text-[#111814] border border-[#D8D8D0] rounded-lg"
            >
              Return to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pendingVerificationsCount = adminData.verifications.filter(
    (v) => v.status === 'PENDING' || v.status === 'ACTION_REQUIRED'
  ).length;
  const openAbuseCount = adminData.abuseReports.filter((r) => r.status === 'OPEN').length;
  const selectedUser = adminData.users.find((u) => u.userId === selectedUserId) ?? null;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="bg-white border-b border-[#E4E4DE] sticky top-0 z-20">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C665E] hover:text-[#111814]"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Workspace
            </Link>
            <span className="font-display text-lg font-bold text-[#111814]">
              NairaScout Governance
            </span>
          </div>

          <nav aria-label="Admin Navigation" className="flex items-center gap-5 text-xs font-semibold">
            {(
              [
                { href: '/admin', id: 'overview', label: 'Overview' },
                {
                  href: '/admin/verifications',
                  id: 'verifications',
                  label: `Verifications (${pendingVerificationsCount})`,
                },
                { href: '/admin/users', id: 'users', label: `Users & Trust (${openAbuseCount})` },
                { href: '/admin/audit-logs', id: 'audit_logs', label: 'Audit Logs' },
              ] as const
            ).map((nav) => (
              <Link
                key={nav.id}
                href={nav.href}
                className={`py-2 border-b-2 transition-colors ${
                  initialSection === nav.id
                    ? 'border-[#0B6E4F] text-[#0B6E4F]'
                    : 'border-transparent text-[#556158] hover:text-[#111814]'
                }`}
              >
                {nav.label}
              </Link>
            ))}
          </nav>

          <span className="font-mono text-xs font-semibold text-[#0B6E4F]">
            {adminData.adminRole}
          </span>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-8">
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

        {initialSection === 'overview' && (
          <div className="space-y-8">
            <div className="border-b border-[#E4E4DE] pb-6">
              <h1 className="font-display text-3xl font-bold text-[#111814]">
                Platform Governance Overview
              </h1>
              <p className="mt-1.5 text-sm text-[#4B554E]">
                Separation-of-duties governance console. Every verification decision and user/seller
                restriction is permanently recorded in the append-only audit log.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-[#E4E4DE] rounded-xl p-5">
                <p className="text-xs text-[#5C665E]">Pending Verifications</p>
                <p className="mt-1 font-mono text-3xl font-bold text-[#B45309] tabular-nums">
                  {pendingVerificationsCount}
                </p>
                <Link
                  href="/admin/verifications"
                  className="mt-3 inline-block text-xs font-semibold text-[#0B6E4F] hover:underline"
                >
                  Open Verification Queue →
                </Link>
              </div>
              <div className="bg-white border border-[#E4E4DE] rounded-xl p-5">
                <p className="text-xs text-[#5C665E]">Open Abuse Reports</p>
                <p className="mt-1 font-mono text-3xl font-bold text-[#B91C1C] tabular-nums">
                  {openAbuseCount}
                </p>
                <Link
                  href="/admin/users"
                  className="mt-3 inline-block text-xs font-semibold text-[#0B6E4F] hover:underline"
                >
                  Manage Trust &amp; Safety →
                </Link>
              </div>
              <div className="bg-white border border-[#E4E4DE] rounded-xl p-5">
                <p className="text-xs text-[#5C665E]">Registered Identities</p>
                <p className="mt-1 font-mono text-3xl font-bold text-[#111814] tabular-nums">
                  {adminData.users.length}
                </p>
                <Link
                  href="/admin/users"
                  className="mt-3 inline-block text-xs font-semibold text-[#0B6E4F] hover:underline"
                >
                  Inspect User Accounts →
                </Link>
              </div>
              <div className="bg-white border border-[#E4E4DE] rounded-xl p-5">
                <p className="text-xs text-[#5C665E]">Audit Log Events</p>
                <p className="mt-1 font-mono text-3xl font-bold text-[#111814] tabular-nums">
                  {adminData.auditLogs.length}
                </p>
                <Link
                  href="/admin/audit-logs"
                  className="mt-3 inline-block text-xs font-semibold text-[#0B6E4F] hover:underline"
                >
                  View Audit Trail →
                </Link>
              </div>
            </div>
          </div>
        )}

        {(initialSection === 'overview' || initialSection === 'verifications') && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#0B6E4F]" aria-hidden="true" />
                <h2 className="font-display text-2xl font-bold text-[#111814]">
                  Verification Queue
                </h2>
              </div>
              <div className="flex items-center gap-1 p-1 bg-[#EFEFE9] rounded-lg text-xs font-semibold">
                {(['PENDING', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED', 'ALL'] as const).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setVerifFilter(st)}
                      className={`px-3 py-1.5 rounded-md cursor-pointer ${
                        verifFilter === st ? 'bg-white text-[#111814]' : 'text-[#556158]'
                      }`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </div>

            {signedPreview && (
              <div className="p-4 bg-[#F3F8F6] border border-[#CBE2D8] rounded-xl flex items-center justify-between gap-4 text-xs text-[#0B6E4F]">
                <div>
                  <p className="font-semibold">60-Second Short-Lived Signed Document Access</p>
                  <p className="font-mono mt-0.5">{signedPreview.summary || signedPreview.path}</p>
                </div>
                {signedPreview.signedUrl && (
                  <a
                    href={signedPreview.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold text-white bg-[#0B6E4F] rounded-md"
                  >
                    Open Signed Document
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            <div className="bg-white border border-[#E4E4DE] rounded-xl divide-y divide-[#ECECE6]">
              {filteredVerifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#5C665E]">
                  No verification records matching filter &ldquo;{verifFilter}&rdquo;.
                </div>
              ) : (
                filteredVerifications.map((v) => (
                  <div key={v.id} className="p-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#0B6E4F]">
                          {v.id} · {v.category} · {v.status}
                        </p>
                        <h3 className="mt-1 font-display text-base font-bold text-[#111814]">
                          {v.displayName} (@{v.username}) — {v.email}
                        </h3>
                        {v.sellerName && (
                          <p className="text-xs text-[#4B554E]">
                            Seller Profile: {v.sellerName} ({v.sellerType}) · Seller Status:{' '}
                            <strong>{v.sellerStatus}</strong>
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {v.evidencePaths.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handleSignDocument(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-[#D8D8D0] rounded-md text-[#111814] hover:bg-[#FAFAF8] cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#0B6E4F]" />
                            Inspect (60s URL): {p.split('/').pop()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {v.reviewerNotes && (
                      <p className="text-xs text-[#4B554E] bg-[#FAFAF8] p-2.5 rounded border border-[#ECECE6]">
                        Last Reviewer Note: {v.reviewerNotes}
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-[#F2F2EC]">
                      <input
                        type="text"
                        value={notesByVerif[v.id] || ''}
                        onChange={(e) =>
                          setNotesByVerif((prev) => ({ ...prev, [v.id]: e.target.value }))
                        }
                        placeholder="Mandatory reviewer notes (logged in audit_logs)..."
                        className="flex-1 px-3 py-2 text-xs border border-[#D8D8D0] rounded-lg"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleVerificationDecision(v.id, 'APPROVED')}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0B6E4F] rounded-lg hover:bg-[#09583F] cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleVerificationDecision(v.id, 'ACTION_REQUIRED')}
                          className="px-3.5 py-2 text-xs font-semibold text-[#B45309] border border-[#E5CFA3] rounded-lg hover:bg-[#FFFBEB] cursor-pointer"
                        >
                          Request Action
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleVerificationDecision(v.id, 'REJECTED')}
                          className="px-3.5 py-2 text-xs font-semibold text-[#B91C1C] border border-[#E8D0D0] rounded-lg hover:bg-[#FEF2F2] cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {(initialSection === 'overview' || initialSection === 'users') && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0B6E4F]" aria-hidden="true" />
                <h2 className="font-display text-2xl font-bold text-[#111814]">
                  User &amp; Seller Governance + Abuse Reports
                </h2>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6C776E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users or sellers..."
                  className="pl-8 pr-3 py-2 text-xs bg-white border border-[#D8D8D0] rounded-lg w-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 bg-white border border-[#E4E4DE] rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E4DE] text-[#5C665E]">
                      <th className="py-3 px-4 font-medium">Identity</th>
                      <th className="py-3 px-4 font-medium">Account Status</th>
                      <th className="py-3 px-4 font-medium">Seller Status</th>
                      <th className="py-3 px-4 font-medium text-right">Ledger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECECE6]">
                    {filteredUsers.map((u) => (
                      <tr
                        key={u.userId}
                        onClick={() => setSelectedUserId(u.userId)}
                        className={`cursor-pointer hover:bg-[#FAFAF8] ${
                          selectedUserId === u.userId ? 'bg-[#F3F8F6]' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#111814]">
                            {u.displayName}{' '}
                            <span className="font-mono text-[#5C665E]">@{u.username}</span>
                          </p>
                          <p className="text-[11px] text-[#5C665E]">{u.email}</p>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">{u.accountStatus}</td>
                        <td className="py-3 px-4 font-mono">
                          {u.sellerStatus ? `${u.sellerStatus} (${u.subscriptionPlan})` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {u.ledgerEntriesCount} rows
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lg:col-span-5 space-y-6">
                {selectedUser && (
                  <div className="bg-white border border-[#E4E4DE] rounded-xl p-5 space-y-4">
                    <div>
                      <p className="text-xs text-[#5C665E]">Selected Identity</p>
                      <h3 className="font-display text-lg font-bold text-[#111814]">
                        {selectedUser.displayName} (@{selectedUser.username})
                      </h3>
                      <p className="text-xs text-[#5C665E] mt-0.5">
                        Account: <strong>{selectedUser.accountStatus}</strong> · Seller:{' '}
                        <strong>{selectedUser.sellerStatus || 'None'}</strong>
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#4B554E] mb-1">
                        Documented Governance Reason (Required)
                      </label>
                      <input
                        type="text"
                        value={govReason}
                        onChange={(e) => setGovReason(e.target.value)}
                        placeholder="e.g., Fulfilment SLA breach — suspend seller only"
                        className="w-full px-3 py-2 text-xs border border-[#D8D8D0] rounded-lg"
                      />
                    </div>

                    {selectedUser.sellerProfileId && (
                      <div className="space-y-2 pt-2 border-t border-[#ECECE6]">
                        <p className="text-xs font-semibold text-[#111814]">
                          Seller-Only Status (Scout role stays independent)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(['ACTIVE', 'RESTRICTED', 'SUSPENDED'] as SellerStatus[]).map((st) => (
                            <button
                              key={st}
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleUserGovernance({
                                  targetUserId: selectedUser.userId,
                                  actionType: 'SET_SELLER_STATUS',
                                  sellerStatus: st,
                                })
                              }
                              className="px-2.5 py-1.5 text-xs font-medium border border-[#D8D8D0] rounded-md hover:bg-[#FAFAF8] cursor-pointer"
                            >
                              Seller → {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-[#ECECE6]">
                      <p className="text-xs font-semibold text-[#111814]">
                        Account Status &amp; Financial Holds
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(['ACTIVE', 'RESTRICTED', 'SUSPENDED'] as AccountStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              handleUserGovernance({
                                targetUserId: selectedUser.userId,
                                actionType: 'SET_ACCOUNT_STATUS',
                                accountStatus: st,
                              })
                            }
                            className="px-2.5 py-1.5 text-xs font-medium border border-[#D8D8D0] rounded-md hover:bg-[#FAFAF8] cursor-pointer"
                          >
                            Account → {st}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleUserGovernance({
                              targetUserId: selectedUser.userId,
                              actionType: 'HOLD_PENDING_COMMISSIONS',
                            })
                          }
                          className="px-2.5 py-1.5 text-xs font-semibold text-[#B45309] border border-[#E5CFA3] rounded-md hover:bg-[#FFFBEB] cursor-pointer"
                        >
                          Hold Pending Commissions
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-[#E4E4DE] rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#B91C1C]" aria-hidden="true" />
                    <h3 className="font-display text-base font-bold text-[#111814]">
                      Abuse Reports ({adminData.abuseReports.length})
                    </h3>
                  </div>
                  {adminData.abuseReports.length === 0 ? (
                    <p className="text-xs text-[#5C665E]">No abuse reports filed.</p>
                  ) : (
                    <div className="divide-y divide-[#ECECE6]">
                      {adminData.abuseReports.map((rep) => (
                        <div key={rep.id} className="py-3 first:pt-0 space-y-1.5 text-xs">
                          <div className="flex justify-between font-mono">
                            <span className="font-semibold text-[#111814]">{rep.id}</span>
                            <span className="text-[#B45309]">{rep.status}</span>
                          </div>
                          <p>
                            @{rep.reporterHandle} reported <strong>@{rep.reportedHandle}</strong>:{' '}
                            {rep.reason}
                          </p>
                          <p className="text-[#5C665E]">{rep.description}</p>
                          {rep.status === 'OPEN' && (
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUserGovernance({
                                    targetUserId: rep.reportedUserId,
                                    actionType: 'RESOLVE_ABUSE_REPORT',
                                    abuseReportId: rep.id,
                                    abuseResolution: 'RESOLVED',
                                    reasonOverride: 'Trust & Safety investigation resolved report',
                                  })
                                }
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0B6E4F] rounded cursor-pointer"
                              >
                                Resolve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUserGovernance({
                                    targetUserId: rep.reportedUserId,
                                    actionType: 'RESOLVE_ABUSE_REPORT',
                                    abuseReportId: rep.id,
                                    abuseResolution: 'DISMISSED',
                                    reasonOverride: 'Dismissed after review',
                                  })
                                }
                                className="px-2.5 py-1 text-xs font-medium border border-[#D8D8D0] rounded cursor-pointer"
                              >
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {(initialSection === 'overview' || initialSection === 'audit_logs') && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#0B6E4F]" aria-hidden="true" />
                <h2 className="font-display text-2xl font-bold text-[#111814]">
                  Immutable Audit Logs
                </h2>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6C776E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditQuery}
                  onChange={(e) => setAuditQuery(e.target.value)}
                  placeholder="Filter action, handle, or reason..."
                  className="pl-8 pr-3 py-2 text-xs bg-white border border-[#D8D8D0] rounded-lg w-64"
                />
              </div>
            </div>

            <div className="bg-white border border-[#E4E4DE] rounded-xl overflow-x-auto">
              {filteredAuditLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#5C665E]">
                  No audit log entries recorded yet.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E4DE] text-[#5C665E]">
                      <th className="py-3 px-4 font-medium">Timestamp</th>
                      <th className="py-3 px-4 font-medium">Actor</th>
                      <th className="py-3 px-4 font-medium">Action</th>
                      <th className="py-3 px-4 font-medium">Affected User</th>
                      <th className="py-3 px-4 font-medium">Change / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECECE6]">
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#FAFAF8]">
                        <td className="py-2.5 px-4 font-mono text-[#5C665E] whitespace-nowrap">
                          {log.createdAt.slice(0, 19).replace('T', ' ')}
                        </td>
                        <td className="py-2.5 px-4 font-mono">@{log.actorHandle}</td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#111814]">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 font-mono">@{log.affectedHandle}</td>
                        <td className="py-2.5 px-4 text-[#4B554E]">
                          {log.reason || JSON.stringify(log.newValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
