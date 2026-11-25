'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  FileText,
  Gavel,
  Lock,
  Pencil,
  Plus,
  Scale,
  Search,
  ShieldAlert,
  Tags,
  Users,
} from 'lucide-react';
import {
  ALL_PLATFORM_ADMIN_ROLES,
  type AccountStatus,
  type ActiveRestrictionDTO,
  type AdminRole,
  type CapabilityCode,
  type RestrictionScope,
  type SellerStatus,
  type SubscriptionStatus,
  type VerificationStatus,
} from '@/lib/auth/rbac';
import type {
  AbuseReportRecord,
  AuditLogRecord,
  GovernanceAppealDTO,
  HelpArticleDTO,
  ListingCategoryDTO,
  MakerCheckerActionType,
  MakerCheckerRequestDTO,
  PlatformPolicyDTO,
  VerificationRecord,
} from '@/lib/nairascout-store';
import { AdminContentManager } from './admin/AdminContentManager';
import { UserIdentityRow } from './shared/UserIdentityRow';
import { ThemeToggle } from './layout/ThemeToggle';

export interface AdminVerificationRow extends VerificationRecord {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  email: string;
  sellerName: string | null;
  sellerType: 'INDIVIDUAL' | 'BUSINESS' | null;
  sellerStatus: SellerStatus | null;
  sellerOwnerUserId?: string;
}

export interface AdminManagedUserRow {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  accountStatus: AccountStatus;
  restrictionReason: string | null;
  closedAt: string | null;
  sellerProfileId: string | null;
  sellerName: string | null;
  sellerStatus: SellerStatus | null;
  subscriptionPlan: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  adminRole: AdminRole | null;
  hasPermanentAncestry: boolean;
  ledgerEntriesCount: number;
}

export interface AdminRestrictionRow extends ActiveRestrictionDTO {
  userId: string;
  userHandle: string;
  imposedByHandle: string;
  liftedAt: string | null;
}

export interface AdminConsoleData {
  adminUserId: string;
  adminRole: AdminRole | null;
  verifications: AdminVerificationRow[];
  users: AdminManagedUserRow[];
  restrictions: AdminRestrictionRow[];
  makerCheckerRequests: MakerCheckerRequestDTO[];
  governanceAppeals: GovernanceAppealDTO[];
  abuseReports: AbuseReportRecord[];
  auditLogs: AuditLogRecord[];
  categories: ListingCategoryDTO[];
  policies: PlatformPolicyDTO[];
  helpArticles: HelpArticleDTO[];
}

export type AdminSection =
  | 'overview'
  | 'verifications'
  | 'users'
  | 'approvals'
  | 'appeals'
  | 'categories'
  | 'content'
  | 'audit_logs';

interface AdminConsoleViewProps {
  initialSection: AdminSection;
  authenticated: boolean;
  initialAdminData: AdminConsoleData | null;
}

export default function AdminConsoleView({
  initialSection,
  authenticated,
  initialAdminData,
}: AdminConsoleViewProps) {
  const [adminData, setAdminData] = useState<AdminConsoleData | null>(initialAdminData);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Verification Queue filters & notes
  const [verifFilter, setVerifFilter] = useState<'ALL' | VerificationStatus>('SUBMITTED');
  const [notesByVerif, setNotesByVerif] = useState<Record<string, string>>({});
  const [signedPreview, setSignedPreview] = useState<{
    path: string;
    signedUrl: string | null;
  } | null>(null);

  // User Governance & Restriction state
  const [userSearch, setUserSearch] = useState('');
  const [govReason, setGovReason] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>(
    initialAdminData?.users[0]?.userId || ''
  );
  const [restrictionScope, setRestrictionScope] = useState<RestrictionScope>('CAPABILITY');
  const [restrictionCapability, setRestrictionCapability] =
    useState<CapabilityCode>('CREATE_REFERRAL');
  const [restrictionDays, setRestrictionDays] = useState('14');

  // Maker-Checker state
  const [mcActionType, setMcActionType] =
    useState<MakerCheckerActionType>('COMMISSION_ADJUSTMENT');
  const [mcTargetUserId, setMcTargetUserId] = useState<string>(
    initialAdminData?.users[0]?.userId || ''
  );
  const [mcAmountNaira, setMcAmountNaira] = useState('2500');
  const [mcAdminRole, setMcAdminRole] = useState<AdminRole>('FINANCE_OFFICER');
  const [mcDirectReferrerId, setMcDirectReferrerId] = useState('');
  const [mcReason, setMcReason] = useState('');
  const [checkerNotesById, setCheckerNotesById] = useState<Record<string, string>>({});

  // Appeals state
  const [appealNotesById, setAppealNotesById] = useState<Record<string, string>>({});

  // Audit Log filter
  const [auditQuery, setAuditQuery] = useState('');

  // Listing Categories manager state (SUPER_ADMIN)
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatSort, setNewCatSort] = useState('10');
  const [newCatActive, setNewCatActive] = useState(true);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [editCatSort, setEditCatSort] = useState('0');

  const buildHeaders = (): HeadersInit => ({
    'Content-Type': 'application/json',
    'X-Requested-With': 'NairaScout',
  });

  const handleSignDocument = async (path: string) => {
    setFeedback(null);
    const res = await fetch(`/api/admin?signPath=${encodeURIComponent(path)}`);
    const data = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'err', message: data.error || 'Could not sign document URL.' });
      return;
    }
    setSignedPreview({
      path,
      signedUrl: data.signedUrl ?? null,
    });
  };

  const handleVerificationDecision = async (
    verificationId: string,
    decision: 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'ACTION_REQUIRED'
  ) => {
    const reviewerNotes = (notesByVerif[verificationId] || '').trim();
    if (!reviewerNotes && decision !== 'UNDER_REVIEW') {
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
      | 'SET_SUBSCRIPTION_STATUS'
      | 'HOLD_PENDING_COMMISSIONS'
      | 'RESOLVE_ABUSE_REPORT';
    accountStatus?: AccountStatus;
    sellerStatus?: SellerStatus;
    subscriptionStatus?: SubscriptionStatus;
    abuseReportId?: string;
    abuseResolution?: 'RESOLVED' | 'DISMISSED';
    reasonOverride?: string;
  }) => {
    const reason = (payload.reasonOverride ?? govReason).trim();
    if (!reason) {
      setFeedback({
        type: 'err',
        message: 'Documented governance reason is required before applying changes.',
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
          subscriptionStatus: payload.subscriptionStatus,
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

  const handleManageRestriction = async (
    payload:
      | { operation: 'IMPOSE'; targetUserId: string }
      | { operation: 'LIFT'; restrictionId: string }
  ) => {
    const reason =
      govReason.trim() || (payload.operation === 'LIFT' ? 'Restriction cleared after review' : '');
    if (!reason) {
      setFeedback({
        type: 'err',
        message: 'Documented governance reason is required before imposing a restriction.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const body =
        payload.operation === 'LIFT'
          ? {
              action: 'manage_restriction',
              operation: 'LIFT',
              restrictionId: payload.restrictionId,
              reason,
            }
          : {
              action: 'manage_restriction',
              operation: 'IMPOSE',
              targetUserId: payload.targetUserId,
              scope: restrictionScope,
              capabilityCode: restrictionCapability,
              expiresInDays: restrictionDays ? Number(restrictionDays) : null,
              reason,
            };
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Restriction update failed.' });
        return;
      }
      if (data.admin) setAdminData(data.admin);
      setGovReason('');
      setFeedback({
        type: 'ok',
        message:
          payload.operation === 'LIFT'
            ? 'Capability restriction lifted and logged.'
            : 'Granular capability restriction imposed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateMakerChecker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcTargetUserId || !mcReason.trim()) {
      setFeedback({ type: 'err', message: 'Target user and Maker reason are required.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const payload: Record<string, unknown> =
        mcActionType === 'ROLE_ASSIGNMENT'
          ? { adminRole: mcAdminRole }
          : mcActionType === 'ANCESTRY_OVERRIDE'
            ? { directReferrerId: mcDirectReferrerId.trim() || null }
            : { amountNaira: Number(mcAmountNaira || 0) };

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          action: 'maker_checker_create',
          actionType: mcActionType,
          targetUserId: mcTargetUserId,
          payload,
          reason: mcReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Failed to create Maker request.' });
        return;
      }
      if (data.admin) setAdminData(data.admin);
      setMcReason('');
      setFeedback({
        type: 'ok',
        message:
          'Maker-Checker request queued. A second distinct Checker officer must approve execution.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDecideMakerChecker = async (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED'
  ) => {
    const checkerNotes = (checkerNotesById[requestId] || '').trim();
    if (!checkerNotes) {
      setFeedback({ type: 'err', message: 'Checker decision notes are required.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          action: 'maker_checker_decide',
          requestId,
          decision,
          checkerNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Checker decision failed.' });
        return;
      }
      if (data.admin) setAdminData(data.admin);
      setFeedback({
        type: 'ok',
        message:
          decision === 'APPROVED'
            ? 'Dual-control request approved & executed atomically.'
            : 'Dual-control request rejected.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDecideAppeal = async (
    appealId: string,
    decision: 'UNDER_REVIEW' | 'UPHELD' | 'OVERTURNED'
  ) => {
    const decisionNotes = (appealNotesById[appealId] || '').trim();
    if (!decisionNotes && decision !== 'UNDER_REVIEW') {
      setFeedback({ type: 'err', message: 'Appeal resolution notes are required.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          action: 'decide_appeal',
          appealId,
          decision,
          decisionNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Appeal decision failed.' });
        return;
      }
      if (data.admin) setAdminData(data.admin);
      setFeedback({ type: 'ok', message: `Appeal ${appealId} updated to ${decision}.` });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      setFeedback({ type: 'err', message: 'Category name is required.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          name: newCatName.trim(),
          description: newCatDesc.trim() || null,
          sortOrder: Number(newCatSort || 0),
          isActive: newCatActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Could not create listing category.' });
        return;
      }
      if (data.admin) setAdminData(data.admin);
      setNewCatName('');
      setNewCatDesc('');
      setNewCatSort('10');
      setNewCatActive(true);
      setFeedback({
        type: 'ok',
        message: `Listing category "${data.category?.name ?? newCatName.trim()}" created and synced.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateCategory = async (payload: {
    id: string;
    name?: string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', message: data.error || 'Could not update listing category.' });
        return;
      }
      if (data.admin) setAdminData(data.admin);
      setEditingCatId(null);
      setFeedback({
        type: 'ok',
        message: `Listing category "${data.category?.name ?? ''}" updated and logged.`,
      });
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

  if (!adminData) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-2xl max-w-md w-full p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-destructive mx-auto" aria-hidden="true" />
          <h1 className="font-sans text-2xl font-bold text-foreground">
            403 · Admin Governance Access Required
          </h1>
          <p className="text-sm text-muted-foreground">
            {authenticated
              ? 'Your current session does not hold a platform administrator role in public.platform_admin_roles.'
              : 'Sign in with an administrator account granted in public.platform_admin_roles to access NairaScout governance.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            {!authenticated && (
              <Link
                href="/auth/login"
                className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90"
              >
                Sign In
              </Link>
            )}
            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold text-foreground border border-border rounded-xl"
            >
              Return to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pendingVerificationsCount = adminData.verifications.filter(
    (v) =>
      v.status === 'SUBMITTED' ||
      v.status === 'UNDER_REVIEW' ||
      v.status === 'ACTION_REQUIRED'
  ).length;
  const openAbuseCount = adminData.abuseReports.filter((r) => r.status === 'OPEN').length;
  const pendingMakerCheckerCount = adminData.makerCheckerRequests.filter(
    (m) => m.status === 'PENDING'
  ).length;
  const openAppealsCount = adminData.governanceAppeals.filter(
    (a) => a.status === 'OPEN' || a.status === 'UNDER_REVIEW'
  ).length;
  const activeCategoriesCount = adminData.categories.filter((c) => c.isActive).length;
  const isSuperAdmin = adminData.adminRole === 'SUPER_ADMIN';
  const selectedUser = adminData.users.find((u) => u.userId === selectedUserId) ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card/85 backdrop-blur-md border-b border-border sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-4 shrink-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Workspace
            </Link>
            <span className="font-sans text-base sm:text-lg font-bold text-foreground">
              NairaScout Governance
            </span>
          </div>

          <nav aria-label="Admin Navigation" className="flex items-center gap-4 text-xs font-semibold shrink-0">
            {(
              [
                { href: '/admin', id: 'overview', label: 'Overview' },
                {
                  href: '/admin/verifications',
                  id: 'verifications',
                  label: `Verifications (${pendingVerificationsCount})`,
                },
                { href: '/admin/users', id: 'users', label: `Users & Trust (${openAbuseCount})` },
                {
                  href: '/admin/approvals',
                  id: 'approvals',
                  label: `Approvals (${pendingMakerCheckerCount})`,
                },
                {
                  href: '/admin/appeals',
                  id: 'appeals',
                  label: `Appeals (${openAppealsCount})`,
                },
                {
                  href: '/admin/categories',
                  id: 'categories',
                  label: `Categories (${activeCategoriesCount})`,
                },
                {
                  href: '/admin/content',
                  id: 'content',
                  label: `Policies & Help (${(adminData.policies?.length ?? 0) + (adminData.helpArticles?.length ?? 0)})`,
                },
                { href: '/admin/audit-logs', id: 'audit_logs', label: 'Audit Logs' },
              ] as const
            ).map((nav) => (
              <Link
                key={nav.id}
                href={nav.href}
                className={`py-2 border-b-2 transition-colors whitespace-nowrap ${
                  initialSection === nav.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {nav.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <span className="font-sans text-xs font-semibold text-success">
              {adminData.adminRole}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
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

        {initialSection === 'overview' && (
          <div className="space-y-8">
            <div className="border-b border-border pb-6">
              <h1 className="font-sans text-2xl md:text-3xl font-bold text-foreground">
                Platform Governance Overview
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Separation-of-duties governance console backed directly by PostgreSQL. Supports 9
                platform roles, Maker-Checker dual control, granular capability restrictions, and an
                independent Appeals Desk.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs text-muted-foreground">Verification Queue</p>
                <p className="mt-1 font-numeric text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {pendingVerificationsCount}
                </p>
                <Link
                  href="/admin/verifications"
                  className="mt-3 inline-block text-xs font-semibold text-foreground hover:underline"
                >
                  Open Queue →
                </Link>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs text-muted-foreground">Maker-Checker Pending</p>
                <p className="mt-1 font-numeric text-3xl font-bold text-foreground tabular-nums">
                  {pendingMakerCheckerCount}
                </p>
                <Link
                  href="/admin/approvals"
                  className="mt-3 inline-block text-xs font-semibold text-foreground hover:underline"
                >
                  Open Dual Control →
                </Link>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs text-muted-foreground">Open Appeals</p>
                <p className="mt-1 font-numeric text-3xl font-bold text-success tabular-nums">
                  {openAppealsCount}
                </p>
                <Link
                  href="/admin/appeals"
                  className="mt-3 inline-block text-xs font-semibold text-foreground hover:underline"
                >
                  Open Appeals Desk →
                </Link>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs text-muted-foreground">Open Abuse Reports</p>
                <p className="mt-1 font-numeric text-3xl font-bold text-destructive tabular-nums">
                  {openAbuseCount}
                </p>
                <Link
                  href="/admin/users"
                  className="mt-3 inline-block text-xs font-semibold text-foreground hover:underline"
                >
                  Trust &amp; Safety →
                </Link>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs text-muted-foreground">Listing Categories</p>
                <p className="mt-1 font-numeric text-3xl font-bold text-foreground tabular-nums">
                  {activeCategoriesCount}
                </p>
                <Link
                  href="/admin/categories"
                  className="mt-3 inline-block text-xs font-semibold text-foreground hover:underline"
                >
                  Manage Categories →
                </Link>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs text-muted-foreground">Policies &amp; Help</p>
                <p className="mt-1 font-numeric text-3xl font-bold text-foreground tabular-nums">
                  {(adminData.policies?.length ?? 0) + (adminData.helpArticles?.length ?? 0)}
                </p>
                <Link
                  href="/admin/content"
                  className="mt-3 inline-block text-xs font-semibold text-foreground hover:underline"
                >
                  Manage Content →
                </Link>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs text-muted-foreground">Audit Log Events</p>
                <p className="mt-1 font-numeric text-3xl font-bold text-foreground tabular-nums">
                  {adminData.auditLogs.length}
                </p>
                <Link
                  href="/admin/audit-logs"
                  className="mt-3 inline-block text-xs font-semibold text-foreground hover:underline"
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
                <FileCheck className="w-5 h-5 text-success" aria-hidden="true" />
                <h2 className="font-sans text-xl md:text-2xl font-bold text-foreground">
                  8-State Verification Queue
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-1 p-1 bg-muted rounded-xl text-xs font-semibold">
                {(
                  [
                    'SUBMITTED',
                    'UNDER_REVIEW',
                    'ACTION_REQUIRED',
                    'VERIFIED',
                    'REJECTED',
                    'ALL',
                  ] as const
                ).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setVerifFilter(st)}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer ${
                      verifFilter === st
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {signedPreview && (
              <div className="p-4 bg-accent border border-border rounded-2xl flex items-center justify-between gap-4 text-xs text-accent-foreground">
                <div>
                  <p className="font-semibold">60-Second Short-Lived Signed Document Access</p>
                  <p className="font-sans mt-0.5">{signedPreview.path}</p>
                </div>
                {signedPreview.signedUrl && (
                  <a
                    href={signedPreview.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90"
                  >
                    Open Signed Document
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl divide-y divide-border">
              {filteredVerifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No verification records matching filter &ldquo;{verifFilter}&rdquo;.
                </div>
              ) : (
                filteredVerifications.map((v) => {
                  const isSelfRecord =
                    v.userId === adminData.adminUserId ||
                    v.sellerOwnerUserId === adminData.adminUserId;
                  return (
                    <div key={v.id} className="p-5 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2 min-w-0">
                          <p className="font-sans text-xs font-semibold text-success">
                            {v.id} · {v.category} · {v.status}
                          </p>
                          <UserIdentityRow
                            avatarUrl={v.avatarUrl}
                            displayName={v.displayName}
                            username={v.username}
                            size="md"
                            subtitle={v.email}
                          />
                          {v.sellerName && (
                            <p className="text-xs text-muted-foreground">
                              Seller Profile: {v.sellerName} ({v.sellerType}) · Seller Status:{' '}
                              <strong className="text-foreground">{v.sellerStatus}</strong>
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {v.evidencePaths.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => handleSignDocument(p)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans border border-border rounded-lg text-foreground hover:bg-muted cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-foreground" />
                              Inspect (60s URL): {p.split('/').pop()}
                            </button>
                          ))}
                        </div>
                      </div>

                      {v.reviewerNotes && (
                        <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-xl border border-border">
                          Last Reviewer Note: {v.reviewerNotes}
                        </p>
                      )}

                      {isSelfRecord && (
                        <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                          Own verification record — separation of duties prohibits self-review or
                          self-approval. A second Verification Officer must decide this record.
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border">
                        <input
                          type="text"
                          value={notesByVerif[v.id] || ''}
                          onChange={(e) =>
                            setNotesByVerif((prev) => ({ ...prev, [v.id]: e.target.value }))
                          }
                          placeholder="Mandatory reviewer notes (logged in audit_logs)..."
                          disabled={isSelfRecord}
                          className="flex-1 px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl disabled:bg-muted"
                        />
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {v.status === 'SUBMITTED' && (
                            <button
                              type="button"
                              disabled={busy || isSelfRecord}
                              onClick={() => handleVerificationDecision(v.id, 'UNDER_REVIEW')}
                              className="px-3 py-2 text-xs font-semibold text-foreground border border-border rounded-xl hover:bg-muted disabled:opacity-40 cursor-pointer"
                            >
                              Claim Review
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy || isSelfRecord}
                            onClick={() => handleVerificationDecision(v.id, 'VERIFIED')}
                            className="px-3.5 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
                          >
                            Verify (VERIFIED)
                          </button>
                          <button
                            type="button"
                            disabled={busy || isSelfRecord}
                            onClick={() => handleVerificationDecision(v.id, 'ACTION_REQUIRED')}
                            className="px-3.5 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/40 rounded-xl hover:bg-amber-500/10 disabled:opacity-40 cursor-pointer"
                          >
                            Request Action
                          </button>
                          <button
                            type="button"
                            disabled={busy || isSelfRecord}
                            onClick={() => handleVerificationDecision(v.id, 'REJECTED')}
                            className="px-3.5 py-2 text-xs font-semibold text-destructive border border-destructive/30 rounded-xl hover:bg-destructive/10 disabled:opacity-40 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {(initialSection === 'overview' || initialSection === 'users') && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-foreground" aria-hidden="true" />
                <h2 className="font-sans text-xl md:text-2xl font-bold text-foreground">
                  User, Seller &amp; Granular Capability Governance
                </h2>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users or sellers..."
                  className="pl-8 pr-3 py-2 text-xs bg-card text-foreground border border-border rounded-xl w-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-card border border-border rounded-2xl overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-3 px-4 font-medium">Identity</th>
                        <th className="py-3 px-4 font-medium">Account Status</th>
                        <th className="py-3 px-4 font-medium">Seller / Plan</th>
                        <th className="py-3 px-4 font-medium text-right">Ledger</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredUsers.map((u) => (
                        <tr
                          key={u.userId}
                          onClick={() => setSelectedUserId(u.userId)}
                          className={`cursor-pointer hover:bg-muted/40 ${
                            selectedUserId === u.userId ? 'bg-accent/70' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <UserIdentityRow
                              avatarUrl={u.avatarUrl}
                              displayName={u.displayName || u.email}
                              username={u.username || 'user'}
                              size="sm"
                              subtitle={`${u.email}${u.adminRole ? ` · ${u.adminRole}` : ''}`}
                            />
                          </td>
                          <td className="py-3 px-4 font-sans font-semibold text-foreground">
                            {u.accountStatus}
                          </td>
                          <td className="py-3 px-4 font-sans text-muted-foreground">
                            {u.sellerStatus
                              ? `${u.sellerStatus} (${u.subscriptionPlan} · ${u.subscriptionStatus})`
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-numeric tabular-nums text-foreground">
                            {u.ledgerEntriesCount} rows
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Active Capability Restrictions Ledger */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert
                      className="w-4 h-4 text-amber-600 dark:text-amber-400"
                      aria-hidden="true"
                    />
                    <h3 className="font-sans text-base font-bold text-foreground">
                      Granular Capability Restrictions ({adminData.restrictions.length})
                    </h3>
                  </div>
                  {adminData.restrictions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No capability restrictions imposed yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {adminData.restrictions.map((r) => (
                        <div
                          key={r.id}
                          className="py-3 first:pt-0 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-sans font-semibold text-foreground">
                              @{r.userHandle} · {r.capabilityCode} ({r.scope}) ·{' '}
                              <span
                                className={
                                  r.status === 'ACTIVE' ? 'text-destructive' : 'text-success'
                                }
                              >
                                {r.status}
                              </span>
                            </p>
                            <p className="text-muted-foreground mt-0.5">{r.reason}</p>
                            <p className="font-sans text-[11px] text-muted-foreground">
                              By @{r.imposedByHandle}
                              {r.expiresAt ? ` · Expires ${r.expiresAt.slice(0, 10)}` : ''}
                            </p>
                          </div>
                          {r.status === 'ACTIVE' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleManageRestriction({ operation: 'LIFT', restrictionId: r.id })
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-foreground border border-border rounded-lg hover:bg-muted cursor-pointer shrink-0"
                            >
                              Lift Restriction
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 space-y-6">
                {selectedUser && (
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Selected Identity</p>
                      <UserIdentityRow
                        avatarUrl={selectedUser.avatarUrl}
                        displayName={selectedUser.displayName || selectedUser.email}
                        username={selectedUser.username || 'user'}
                        size="md"
                      />
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Account: <strong className="text-foreground">{selectedUser.accountStatus}</strong> · Seller:{' '}
                        <strong className="text-foreground">{selectedUser.sellerStatus || 'None'}</strong>
                        {selectedUser.subscriptionStatus
                          ? ` · Billing: ${selectedUser.subscriptionStatus}`
                          : ''}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Documented Governance Reason (Required)
                      </label>
                      <input
                        type="text"
                        value={govReason}
                        onChange={(e) => setGovReason(e.target.value)}
                        placeholder="e.g., Referral spam rate trigger — restrict referrals only"
                        className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
                      />
                    </div>

                    {/* Granular Restriction Composer */}
                    <div className="space-y-2.5 pt-2 border-t border-border">
                      <p className="text-xs font-semibold text-foreground">
                        Impose Granular Capability Restriction (Least-Privilege)
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={restrictionCapability}
                          onChange={(e) =>
                            setRestrictionCapability(e.target.value as CapabilityCode)
                          }
                          className="pl-3.5 pr-10 py-1.5 text-xs border border-input rounded-lg bg-background text-foreground font-sans"
                        >
                          <option value="CREATE_REFERRAL">CREATE_REFERRAL</option>
                          <option value="PUBLISH_LISTING">PUBLISH_LISTING</option>
                          <option value="REQUEST_WITHDRAWAL">REQUEST_WITHDRAWAL</option>
                          <option value="INITIATE_PURCHASE">INITIATE_PURCHASE</option>
                          <option value="MANAGE_TEAM">MANAGE_TEAM</option>
                        </select>
                        <select
                          value={restrictionScope}
                          onChange={(e) =>
                            setRestrictionScope(e.target.value as RestrictionScope)
                          }
                          className="pl-3.5 pr-10 py-1.5 text-xs border border-input rounded-lg bg-background text-foreground font-sans"
                        >
                          <option value="CAPABILITY">CAPABILITY</option>
                          <option value="ROLE">ROLE</option>
                          <option value="ACCOUNT">ACCOUNT</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={restrictionDays}
                          onChange={(e) => setRestrictionDays(e.target.value)}
                          placeholder="Days (optional)"
                          className="w-28 px-2.5 py-1.5 text-xs font-numeric tabular-nums bg-background text-foreground border border-input rounded-lg"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleManageRestriction({
                              operation: 'IMPOSE',
                              targetUserId: selectedUser.userId,
                            })
                          }
                          className="flex-1 py-1.5 px-3 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 cursor-pointer"
                        >
                          Impose Capability Restriction
                        </button>
                      </div>
                    </div>

                    {selectedUser.sellerProfileId && (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1.5">
                            Seller-Only Status (Scout role stays independent)
                          </p>
                          <div className="flex flex-wrap gap-1.5">
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
                                className="px-2.5 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted cursor-pointer"
                              >
                                Seller → {st}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1.5">
                            Subscription Status (EXPIRED downgrades excess listings)
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(
                              ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'EXPIRED'] as SubscriptionStatus[]
                            ).map((subSt) => (
                              <button
                                key={subSt}
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleUserGovernance({
                                    targetUserId: selectedUser.userId,
                                    actionType: 'SET_SUBSCRIPTION_STATUS',
                                    subscriptionStatus: subSt,
                                  })
                                }
                                className="px-2 py-1 text-[11px] font-sans border border-border rounded-lg hover:bg-muted cursor-pointer"
                              >
                                {subSt}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-border">
                      <p className="text-xs font-semibold text-foreground">
                        Account Status &amp; Financial Holds
                      </p>
                      <div className="flex flex-wrap gap-1.5">
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
                            className="px-2.5 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted cursor-pointer"
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
                          className="px-2.5 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/40 rounded-lg hover:bg-amber-500/10 cursor-pointer"
                        >
                          Hold Pending Commissions
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" aria-hidden="true" />
                    <h3 className="font-sans text-base font-bold text-foreground">
                      Abuse Reports ({adminData.abuseReports.length})
                    </h3>
                  </div>
                  {adminData.abuseReports.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No abuse reports filed.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {adminData.abuseReports.map((rep) => (
                        <div key={rep.id} className="py-3 first:pt-0 space-y-1.5 text-xs">
                          <div className="flex justify-between font-sans">
                            <span className="font-semibold text-foreground">{rep.id}</span>
                            <span className="text-amber-600 dark:text-amber-400">{rep.status}</span>
                          </div>
                          <p>
                            @{rep.reporterHandle} reported <strong>@{rep.reportedHandle}</strong>:{' '}
                            {rep.reason}
                          </p>
                          <p className="text-muted-foreground">{rep.description}</p>
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
                                className="px-2.5 py-1 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 cursor-pointer"
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
                                className="px-2.5 py-1 text-xs font-medium border border-border rounded-lg cursor-pointer"
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

        {(initialSection === 'overview' || initialSection === 'approvals') && (
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-foreground" aria-hidden="true" />
              <div>
                <h2 className="font-sans text-xl md:text-2xl font-bold text-foreground">
                  Maker-Checker Dual-Control Queue
                </h2>
                <p className="text-xs text-muted-foreground">
                  High-impact financial, role, and ancestry operations require two distinct officers
                  (<span className="font-sans font-medium">maker_id !== checker_id</span>).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={handleCreateMakerChecker}
                className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-4 self-start"
              >
                <h3 className="font-sans text-base font-bold text-foreground">
                  Submit Maker Request
                </h3>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Dual-Control Action Type
                  </label>
                  <select
                    value={mcActionType}
                    onChange={(e) => setMcActionType(e.target.value as MakerCheckerActionType)}
                    className="w-full pl-3.5 pr-10 py-2 text-xs font-sans border border-input rounded-xl bg-background text-foreground"
                  >
                    <option value="COMMISSION_ADJUSTMENT">COMMISSION_ADJUSTMENT</option>
                    <option value="WALLET_CORRECTION">WALLET_CORRECTION</option>
                    <option value="EXCEPTIONAL_PAYOUT">EXCEPTIONAL_PAYOUT</option>
                    <option value="REFUND_EXCEPTION">REFUND_EXCEPTION</option>
                    <option value="ROLE_ASSIGNMENT">ROLE_ASSIGNMENT</option>
                    <option value="ANCESTRY_OVERRIDE">ANCESTRY_OVERRIDE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Target Account
                  </label>
                  <select
                    value={mcTargetUserId}
                    onChange={(e) => setMcTargetUserId(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2 text-xs border border-input rounded-xl bg-background text-foreground"
                  >
                    {adminData.users.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        @{u.username} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                {mcActionType === 'ROLE_ASSIGNMENT' ? (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Platform Role (9 Operational Roles)
                    </label>
                    <select
                      value={mcAdminRole}
                      onChange={(e) => setMcAdminRole(e.target.value as AdminRole)}
                      className="w-full pl-3.5 pr-10 py-2 text-xs font-sans border border-input rounded-xl bg-background text-foreground"
                    >
                      {ALL_PLATFORM_ADMIN_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : mcActionType === 'ANCESTRY_OVERRIDE' ? (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      New Direct Referrer User UUID (blank for Organic)
                    </label>
                    <input
                      type="text"
                      value={mcDirectReferrerId}
                      onChange={(e) => setMcDirectReferrerId(e.target.value)}
                      placeholder="UUID..."
                      className="w-full px-3 py-2 text-xs font-sans bg-background text-foreground border border-input rounded-xl"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Amount (₦, negative for debit/reversal)
                    </label>
                    <input
                      type="number"
                      required
                      value={mcAmountNaira}
                      onChange={(e) => setMcAmountNaira(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-numeric tabular-nums bg-background text-foreground border border-input rounded-xl"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Maker Justification (Required)
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={mcReason}
                    onChange={(e) => setMcReason(e.target.value)}
                    placeholder="Document audit evidence and justification..."
                    className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-commerce-foreground bg-commerce rounded-xl hover:bg-commerce/90 cursor-pointer"
                >
                  Submit Maker Request for Checker Approval
                </button>
              </form>

              <div className="lg:col-span-7 bg-card border border-border rounded-2xl divide-y divide-border">
                {adminData.makerCheckerRequests.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No Maker-Checker dual-control requests yet.
                  </div>
                ) : (
                  adminData.makerCheckerRequests.map((m) => {
                    const isSelfMaker = m.makerId === adminData.adminUserId;
                    return (
                      <div key={m.id} className="p-5 space-y-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-sans font-semibold text-foreground">
                            {m.actionType} → @{m.targetHandle}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-sans font-semibold ${
                              m.status === 'EXECUTED'
                                ? 'bg-accent text-accent-foreground'
                                : m.status === 'REJECTED'
                                  ? 'bg-destructive/15 text-destructive'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {m.status}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{m.reason}</p>
                        <p className="font-sans text-[11px] text-muted-foreground">
                          Maker: @{m.makerHandle} · Payload: {JSON.stringify(m.payload)}
                        </p>

                        {m.status === 'PENDING' && (
                          <div className="pt-2 border-t border-border space-y-2">
                            {isSelfMaker ? (
                              <p className="text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                                Dual-control enforcement: you created this Maker request. A second
                                distinct officer must act as Checker.
                              </p>
                            ) : (
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  value={checkerNotesById[m.id] || ''}
                                  onChange={(e) =>
                                    setCheckerNotesById((p) => ({
                                      ...p,
                                      [m.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Mandatory Checker verification notes..."
                                  className="flex-1 px-3 py-1.5 text-xs bg-background text-foreground border border-input rounded-xl"
                                />
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleDecideMakerChecker(m.id, 'APPROVED')}
                                  className="px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
                                >
                                  Approve &amp; Execute
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleDecideMakerChecker(m.id, 'REJECTED')}
                                  className="px-3 py-1.5 text-xs font-semibold text-destructive border border-destructive/30 rounded-xl cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {(initialSection === 'overview' || initialSection === 'appeals') && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-foreground" aria-hidden="true" />
              <div>
                <h2 className="font-sans text-xl md:text-2xl font-bold text-foreground">
                  Independent Appeals Desk
                </h2>
                <p className="text-xs text-muted-foreground">
                  Adjudicates appeals on Verification rejections, capability restrictions, and
                  suspensions. Original decision officers are blocked from reviewing their own
                  decisions.
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl divide-y divide-border">
              {adminData.governanceAppeals.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No governance appeals submitted yet.
                </div>
              ) : (
                adminData.governanceAppeals.map((a) => {
                  const conflict =
                    a.originalReviewerId === adminData.adminUserId ||
                    a.appellantUserId === adminData.adminUserId;
                  return (
                    <div key={a.id} className="p-5 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-sans font-semibold text-foreground">
                          @{a.appellantHandle} · {a.targetType} ({a.targetRecordId.slice(0, 8)}…)
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-sans font-semibold ${
                            a.status === 'OVERTURNED'
                              ? 'bg-accent text-accent-foreground'
                              : a.status === 'UPHELD'
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{a.appealReason}</p>
                      <p className="font-sans text-[11px] text-muted-foreground">
                        Original Officer:{' '}
                        {a.originalReviewerHandle ? `@${a.originalReviewerHandle}` : 'Unassigned'}
                        {a.appealsOfficerHandle ? ` · Adjudicated by @${a.appealsOfficerHandle}` : ''}
                      </p>

                      {(a.status === 'OPEN' || a.status === 'UNDER_REVIEW') && (
                        <div className="pt-2 border-t border-border space-y-2">
                          {conflict ? (
                            <p className="text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                              Independent review conflict: the original reviewer or appellant cannot
                              adjudicate this appeal.
                            </p>
                          ) : (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={appealNotesById[a.id] || ''}
                                onChange={(e) =>
                                  setAppealNotesById((p) => ({ ...p, [a.id]: e.target.value }))
                                }
                                placeholder="Independent Appeals Officer rationale..."
                                className="flex-1 px-3 py-1.5 text-xs bg-background text-foreground border border-input rounded-xl"
                              />
                              {a.status === 'OPEN' && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleDecideAppeal(a.id, 'UNDER_REVIEW')}
                                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-xl cursor-pointer"
                                >
                                  Start Review
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDecideAppeal(a.id, 'UPHELD')}
                                className="px-3 py-1.5 text-xs font-semibold text-destructive border border-destructive/30 rounded-xl cursor-pointer"
                              >
                                Uphold
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDecideAppeal(a.id, 'OVERTURNED')}
                                className="px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 cursor-pointer"
                              >
                                Overturn &amp; Lift
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {(initialSection === 'overview' || initialSection === 'categories') && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Tags className="w-5 h-5 text-foreground" aria-hidden="true" />
                <div>
                  <h2 className="font-sans text-xl md:text-2xl font-bold text-foreground">
                    Listing Categories
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Manage marketplace listing categories in PostgreSQL. Active categories sync
                    immediately to Account Settings Preferred Categories, Marketplace filters, and
                    Seller Hub.
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                {activeCategoriesCount} active / {adminData.categories.length} total
              </span>
            </div>

            {!isSuperAdmin && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-800 dark:text-amber-200">
                Read-only view ({adminData.adminRole}): Creating, editing, or toggling listing
                categories is restricted to <strong>SUPER_ADMIN</strong>.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={handleCreateCategory}
                className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-4 self-start"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-foreground" aria-hidden="true" />
                  <h3 className="font-sans text-base font-bold text-foreground">
                    Add Listing Category
                  </h3>
                </div>

                <div>
                  <label
                    htmlFor="cat-name"
                    className="block text-xs font-medium text-muted-foreground mb-1"
                  >
                    Category Name
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    required
                    disabled={!isSuperAdmin || busy}
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g., Sports & Fitness"
                    className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl disabled:opacity-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="cat-desc"
                    className="block text-xs font-medium text-muted-foreground mb-1"
                  >
                    Description (Optional)
                  </label>
                  <textarea
                    id="cat-desc"
                    rows={2}
                    disabled={!isSuperAdmin || busy}
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="Short category summary..."
                    className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label
                      htmlFor="cat-sort"
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      Sort Order
                    </label>
                    <input
                      id="cat-sort"
                      type="number"
                      disabled={!isSuperAdmin || busy}
                      value={newCatSort}
                      onChange={(e) => setNewCatSort(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-numeric tabular-nums bg-background text-foreground border border-input rounded-xl disabled:opacity-50"
                    />
                  </div>
                  <label className="flex items-center gap-2 p-2.5 bg-muted/50 border border-border rounded-xl text-xs font-medium text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isSuperAdmin || busy}
                      checked={newCatActive}
                      onChange={(e) => setNewCatActive(e.target.checked)}
                      className="accent-foreground"
                    />
                    Active immediately
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!isSuperAdmin || busy}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-45 cursor-pointer"
                >
                  {busy ? 'Saving Category...' : 'Add Category'}
                </button>
              </form>

              <div className="lg:col-span-7 bg-card border border-border rounded-2xl divide-y divide-border">
                {adminData.categories.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No listing categories found.
                  </div>
                ) : (
                  adminData.categories.map((cat) => {
                    const isEditing = editingCatId === cat.id;
                    return (
                      <div key={cat.id} className="p-4 space-y-3 text-xs">
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                value={editCatName}
                                onChange={(e) => setEditCatName(e.target.value)}
                                placeholder="Category Name"
                                className="sm:col-span-2 px-3 py-1.5 text-xs bg-background text-foreground border border-input rounded-lg"
                              />
                              <input
                                type="number"
                                value={editCatSort}
                                onChange={(e) => setEditCatSort(e.target.value)}
                                placeholder="Sort Order"
                                className="px-3 py-1.5 text-xs font-numeric tabular-nums bg-background text-foreground border border-input rounded-lg"
                              />
                            </div>
                            <input
                              type="text"
                              value={editCatDesc}
                              onChange={(e) => setEditCatDesc(e.target.value)}
                              placeholder="Optional description..."
                              className="w-full px-3 py-1.5 text-xs bg-background text-foreground border border-input rounded-lg"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busy || !editCatName.trim()}
                                onClick={() =>
                                  handleUpdateCategory({
                                    id: cat.id,
                                    name: editCatName.trim(),
                                    description: editCatDesc.trim() || null,
                                    sortOrder: Number(editCatSort || 0),
                                  })
                                }
                                className="px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-lg hover:bg-primary/90 cursor-pointer"
                              >
                                Save Changes
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCatId(null)}
                                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-sans text-sm font-semibold text-foreground">
                                  {cat.name}
                                </span>
                                <span className="font-numeric text-[11px] text-muted-foreground">
                                  #{cat.sortOrder} · {cat.slug}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md font-sans text-[11px] font-semibold ${
                                    cat.isActive
                                      ? 'bg-accent text-accent-foreground'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {cat.isActive ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                              </div>
                              {cat.description && (
                                <p className="text-muted-foreground">{cat.description}</p>
                              )}
                            </div>

                            {isSuperAdmin && (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditingCatId(cat.id);
                                    setEditCatName(cat.name);
                                    setEditCatDesc(cat.description || '');
                                    setEditCatSort(String(cat.sortOrder));
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" aria-hidden="true" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    handleUpdateCategory({
                                      id: cat.id,
                                      isActive: !cat.isActive,
                                    })
                                  }
                                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                                    cat.isActive
                                      ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                                      : 'border-primary-border bg-primary text-primary-foreground hover:bg-primary/90'
                                  }`}
                                >
                                  {cat.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {(initialSection === 'overview' || initialSection === 'content') && (
          <AdminContentManager
            adminRole={adminData.adminRole}
            policies={adminData.policies ?? []}
            helpArticles={adminData.helpArticles ?? []}
            busy={busy}
            setBusy={setBusy}
            onFeedback={setFeedback}
            onAdminUpdated={setAdminData}
          />
        )}

        {(initialSection === 'overview' || initialSection === 'audit_logs') && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" aria-hidden="true" />
                <h2 className="font-sans text-xl md:text-2xl font-bold text-foreground">
                  Immutable Audit Logs
                </h2>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditQuery}
                  onChange={(e) => setAuditQuery(e.target.value)}
                  placeholder="Filter action, handle, or reason..."
                  className="pl-8 pr-3 py-2 text-xs bg-card text-foreground border border-border rounded-xl w-64"
                />
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-x-auto">
              {filteredAuditLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No audit log entries recorded yet.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 px-4 font-medium">Timestamp</th>
                      <th className="py-3 px-4 font-medium">Actor</th>
                      <th className="py-3 px-4 font-medium">Action</th>
                      <th className="py-3 px-4 font-medium">Affected User</th>
                      <th className="py-3 px-4 font-medium">Change / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/40">
                        <td className="py-2.5 px-4 font-numeric text-muted-foreground whitespace-nowrap tabular-nums">
                          {log.createdAt.slice(0, 19).replace('T', ' ')}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-foreground">@{log.actorHandle}</td>
                        <td className="py-2.5 px-4 font-sans font-semibold text-foreground">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-foreground">@{log.affectedHandle}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">
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
