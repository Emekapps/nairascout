'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, Eye, FileText, Pencil, Plus, Scale } from 'lucide-react';
import type { AdminRole } from '@/lib/auth/rbac';
import {
  HELP_ARTICLE_CATEGORIES,
  HELP_AUDIENCE_ROLES,
  type HelpArticleCategory,
  type HelpAudienceRole,
} from '@/lib/constants/foundation-content';
import type { HelpArticleDTO, PlatformPolicyDTO } from '@/lib/nairascout-store';
import type { AdminConsoleData } from '../AdminConsoleView';
import { SafeMarkdown } from '../shared/SafeMarkdown';

// NS-FND-007: Super Admin & Platform Admin Policy & Help Centre Content Editor
interface AdminContentManagerProps {
  adminRole: AdminRole | null;
  policies: PlatformPolicyDTO[];
  helpArticles: HelpArticleDTO[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onFeedback: (fb: { type: 'ok' | 'err'; message: string } | null) => void;
  onAdminUpdated: (admin: AdminConsoleData) => void;
}

export function AdminContentManager({
  adminRole,
  policies,
  helpArticles,
  busy,
  setBusy,
  onFeedback,
  onAdminUpdated,
}: AdminContentManagerProps) {
  const canManageContent = adminRole === 'SUPER_ADMIN' || adminRole === 'PLATFORM_ADMIN';
  const [contentTab, setContentTab] = useState<'policies' | 'articles'>('policies');

  // Policy Editor state
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [policySlug, setPolicySlug] = useState('');
  const [policyTitle, setPolicyTitle] = useState('');
  const [policyVersion, setPolicyVersion] = useState('1.0.0');
  const [policyEffectiveDate, setPolicyEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [policySummary, setPolicySummary] = useState('');
  const [policyMarkdown, setPolicyMarkdown] = useState('');
  const [policyPublished, setPolicyPublished] = useState(true);
  const [previewPolicyMd, setPreviewPolicyMd] = useState(false);

  // Help Article Editor state
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [articleSlug, setArticleSlug] = useState('');
  const [articleCategory, setArticleCategory] = useState<HelpArticleCategory>('GETTING_STARTED');
  const [articleRole, setArticleRole] = useState<HelpAudienceRole>('ALL');
  const [articleSortOrder, setArticleSortOrder] = useState('10');
  const [articleTitle, setArticleTitle] = useState('');
  const [articleSummary, setArticleSummary] = useState('');
  const [articleMarkdown, setArticleMarkdown] = useState('');
  const [articlePublished, setArticlePublished] = useState(true);
  const [previewArticleMd, setPreviewArticleMd] = useState(false);

  const resetPolicyForm = () => {
    setEditingPolicyId(null);
    setPolicySlug('');
    setPolicyTitle('');
    setPolicyVersion('1.0.0');
    setPolicyEffectiveDate(new Date().toISOString().slice(0, 10));
    setPolicySummary('');
    setPolicyMarkdown('');
    setPolicyPublished(true);
    setPreviewPolicyMd(false);
  };

  const loadPolicyIntoForm = (policy: PlatformPolicyDTO) => {
    setEditingPolicyId(policy.id);
    setPolicySlug(policy.slug);
    setPolicyTitle(policy.title);
    setPolicyVersion(policy.version);
    setPolicyEffectiveDate(policy.effectiveDate.slice(0, 10));
    setPolicySummary(policy.summary);
    setPolicyMarkdown(policy.contentMarkdown);
    setPolicyPublished(policy.isPublished);
    setPreviewPolicyMd(false);
  };

  const resetArticleForm = () => {
    setEditingArticleId(null);
    setArticleSlug('');
    setArticleCategory('GETTING_STARTED');
    setArticleRole('ALL');
    setArticleSortOrder('10');
    setArticleTitle('');
    setArticleSummary('');
    setArticleMarkdown('');
    setArticlePublished(true);
    setPreviewArticleMd(false);
  };

  const loadArticleIntoForm = (article: HelpArticleDTO) => {
    setEditingArticleId(article.id);
    setArticleSlug(article.slug);
    setArticleCategory(article.category);
    setArticleRole(article.audienceRole);
    setArticleSortOrder(String(article.sortOrder));
    setArticleTitle(article.title);
    setArticleSummary(article.summary);
    setArticleMarkdown(article.bodyMarkdown);
    setArticlePublished(article.isPublished);
    setPreviewArticleMd(false);
  };

  const submitContentPayload = async (
    method: 'POST' | 'PATCH',
    payload: Record<string, unknown>,
    successMsg: string
  ) => {
    setBusy(true);
    onFeedback(null);
    try {
      const res = await fetch('/api/admin/content', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        onFeedback({ type: 'err', message: data.error || 'Could not update content.' });
        return false;
      }
      if (data.admin) {
        onAdminUpdated(data.admin);
      }
      onFeedback({ type: 'ok', message: successMsg });
      return true;
    } finally {
      setBusy(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitContentPayload(
      editingPolicyId ? 'PATCH' : 'POST',
      {
        kind: 'policy',
        id: editingPolicyId ?? undefined,
        slug: policySlug.trim() || policyTitle.trim(),
        title: policyTitle.trim(),
        summary: policySummary.trim(),
        contentMarkdown: policyMarkdown.trim(),
        version: policyVersion.trim() || '1.0.0',
        effectiveDate: policyEffectiveDate
          ? new Date(`${policyEffectiveDate}T00:00:00.000Z`).toISOString()
          : new Date().toISOString(),
        isPublished: policyPublished,
      },
      editingPolicyId
        ? `Platform policy "${policyTitle.trim()}" updated (v${policyVersion.trim()}) and logged.`
        : `Platform policy "${policyTitle.trim()}" created and logged.`
    );
    if (ok) {
      resetPolicyForm();
    }
  };

  const handleTogglePolicyPublish = async (policy: PlatformPolicyDTO) => {
    await submitContentPayload(
      'PATCH',
      {
        kind: 'policy',
        id: policy.id,
        slug: policy.slug,
        title: policy.title,
        summary: policy.summary,
        contentMarkdown: policy.contentMarkdown,
        version: policy.version,
        effectiveDate: policy.effectiveDate,
        isPublished: !policy.isPublished,
      },
      `Policy "${policy.title}" marked ${!policy.isPublished ? 'Published' : 'Draft'}.`
    );
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitContentPayload(
      editingArticleId ? 'PATCH' : 'POST',
      {
        kind: 'article',
        id: editingArticleId ?? undefined,
        slug: articleSlug.trim() || articleTitle.trim(),
        category: articleCategory,
        audienceRole: articleRole,
        sortOrder: Number(articleSortOrder || 0),
        title: articleTitle.trim(),
        summary: articleSummary.trim(),
        bodyMarkdown: articleMarkdown.trim(),
        isPublished: articlePublished,
      },
      editingArticleId
        ? `Help Centre article "${articleTitle.trim()}" updated and logged.`
        : `Help Centre article "${articleTitle.trim()}" created and logged.`
    );
    if (ok) {
      resetArticleForm();
    }
  };

  const handleToggleArticlePublish = async (article: HelpArticleDTO) => {
    await submitContentPayload(
      'PATCH',
      {
        kind: 'article',
        id: article.id,
        slug: article.slug,
        category: article.category,
        audienceRole: article.audienceRole,
        sortOrder: article.sortOrder,
        title: article.title,
        summary: article.summary,
        bodyMarkdown: article.bodyMarkdown,
        isPublished: !article.isPublished,
      },
      `Help article "${article.title}" marked ${!article.isPublished ? 'Published' : 'Draft'}.`
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-foreground" aria-hidden="true" />
          <div>
            <h2 className="font-sans text-xl md:text-2xl font-bold text-foreground">
              Platform Policies &amp; Help Centre CMS
            </h2>
            <p className="text-xs text-muted-foreground">
              Publish, version, and audit live Programme Rules, Payout Policies, Platform
              Boundaries, and Help Centre Knowledge Base articles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-[#F3F4F6] dark:bg-[#181818] border border-border rounded-full self-start">
          <button
            type="button"
            onClick={() => setContentTab('policies')}
            className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer transition-colors ${
              contentTab === 'policies'
                ? 'bg-[#000000] text-[#FFFFFF] dark:bg-white dark:text-black font-semibold shadow-xs'
                : 'bg-[#FFFFFF] text-[#000000] dark:bg-secondary dark:text-foreground font-medium'
            }`}
          >
            Platform Policies ({policies.length})
          </button>
          <button
            type="button"
            onClick={() => setContentTab('articles')}
            className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer transition-colors ${
              contentTab === 'articles'
                ? 'bg-[#000000] text-[#FFFFFF] dark:bg-white dark:text-black font-semibold shadow-xs'
                : 'bg-[#FFFFFF] text-[#000000] dark:bg-secondary dark:text-foreground font-medium'
            }`}
          >
            Help Centre Articles ({helpArticles.length})
          </button>
        </div>
      </div>

      {!canManageContent && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-800 dark:text-amber-200">
          Access restricted ({adminRole || 'UNKNOWN'}): Viewing and editing platform policies and
          Help Centre articles requires <strong>SUPER_ADMIN</strong> or{' '}
          <strong>PLATFORM_ADMIN</strong>.
        </div>
      )}

      {canManageContent && contentTab === 'policies' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSavePolicy}
            className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-4 self-start"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {editingPolicyId ? (
                  <Pencil className="w-4 h-4 text-foreground" aria-hidden="true" />
                ) : (
                  <Plus className="w-4 h-4 text-foreground" aria-hidden="true" />
                )}
                <h3 className="font-sans text-base font-bold text-foreground">
                  {editingPolicyId ? 'Edit Platform Policy' : 'Create Platform Policy'}
                </h3>
              </div>
              {editingPolicyId && (
                <button
                  type="button"
                  onClick={resetPolicyForm}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="pol-slug"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Slug
                </label>
                <input
                  id="pol-slug"
                  type="text"
                  required
                  disabled={busy}
                  value={policySlug}
                  onChange={(e) => setPolicySlug(e.target.value)}
                  placeholder="programme-rules"
                  className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <div>
                <label
                  htmlFor="pol-version"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Version
                </label>
                <input
                  id="pol-version"
                  type="text"
                  required
                  disabled={busy}
                  value={policyVersion}
                  onChange={(e) => setPolicyVersion(e.target.value)}
                  placeholder="1.0.1"
                  className="w-full px-3 py-2 text-xs font-numeric bg-background text-foreground border border-input rounded-xl"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="pol-title"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Policy Title
              </label>
              <input
                id="pol-title"
                type="text"
                required
                disabled={busy}
                value={policyTitle}
                onChange={(e) => setPolicyTitle(e.target.value)}
                placeholder="Programme Rules & Commercial Model"
                className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
              />
            </div>

            <div>
              <label
                htmlFor="pol-summary"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Summary
              </label>
              <textarea
                id="pol-summary"
                rows={2}
                required
                disabled={busy}
                value={policySummary}
                onChange={(e) => setPolicySummary(e.target.value)}
                placeholder="Concise policy overview..."
                className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="pol-md"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Markdown Content
                </label>
                <button
                  type="button"
                  onClick={() => setPreviewPolicyMd((p) => !p)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:underline cursor-pointer"
                >
                  <Eye className="w-3 h-3" aria-hidden="true" />
                  {previewPolicyMd ? 'Edit Markdown' : 'Preview'}
                </button>
              </div>
              {previewPolicyMd ? (
                <div className="min-h-[160px] max-h-72 overflow-y-auto p-3 rounded-xl border border-border bg-muted/30">
                  <SafeMarkdown content={policyMarkdown || '_Nothing to preview yet._'} />
                </div>
              ) : (
                <textarea
                  id="pol-md"
                  rows={8}
                  required
                  disabled={busy}
                  value={policyMarkdown}
                  onChange={(e) => setPolicyMarkdown(e.target.value)}
                  placeholder="# Heading&#10;&#10;Policy body in Markdown..."
                  className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl font-mono"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label
                  htmlFor="pol-date"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Effective Date
                </label>
                <input
                  id="pol-date"
                  type="date"
                  required
                  disabled={busy}
                  value={policyEffectiveDate}
                  onChange={(e) => setPolicyEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-numeric bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <label className="flex items-center gap-2 p-2.5 bg-muted/50 border border-border rounded-xl text-xs font-medium text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={policyPublished}
                  onChange={(e) => setPolicyPublished(e.target.checked)}
                  className="accent-foreground"
                />
                Publish live
              </label>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-45 cursor-pointer"
            >
              {busy
                ? 'Saving Policy...'
                : editingPolicyId
                  ? 'Save Policy Revision'
                  : 'Create Policy'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-card border border-border rounded-2xl divide-y divide-border">
            {policies.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No platform policies recorded yet.
              </div>
            ) : (
              policies.map((pol) => (
                <div key={pol.id} className="p-4 sm:p-5 space-y-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-foreground" aria-hidden="true" />
                        <span className="font-sans text-sm font-semibold text-foreground">
                          {pol.title}
                        </span>
                        <span className="font-numeric text-[11px] text-muted-foreground">
                          v{pol.version} · /{pol.slug}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-sans text-[11px] font-semibold ${
                            pol.isPublished
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {pol.isPublished ? 'PUBLISHED' : 'DRAFT'}
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{pol.summary}</p>
                      <p className="font-numeric text-[11px] text-muted-foreground tabular-nums">
                        Effective {pol.effectiveDate.slice(0, 10)} · Updated{' '}
                        {pol.updatedAt.slice(0, 10)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => loadPolicyIntoForm(pol)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleTogglePolicyPublish(pol)}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                          pol.isPublished
                            ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                            : 'border-primary-border bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                      >
                        {pol.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {canManageContent && contentTab === 'articles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSaveArticle}
            className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-4 self-start"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {editingArticleId ? (
                  <Pencil className="w-4 h-4 text-foreground" aria-hidden="true" />
                ) : (
                  <Plus className="w-4 h-4 text-foreground" aria-hidden="true" />
                )}
                <h3 className="font-sans text-base font-bold text-foreground">
                  {editingArticleId ? 'Edit Help Article' : 'Create Help Article'}
                </h3>
              </div>
              {editingArticleId && (
                <button
                  type="button"
                  onClick={resetArticleForm}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="art-slug"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Slug
                </label>
                <input
                  id="art-slug"
                  type="text"
                  required
                  disabled={busy}
                  value={articleSlug}
                  onChange={(e) => setArticleSlug(e.target.value)}
                  placeholder="how-referrals-work"
                  className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
                />
              </div>
              <div>
                <label
                  htmlFor="art-sort"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Sort Order
                </label>
                <input
                  id="art-sort"
                  type="number"
                  disabled={busy}
                  value={articleSortOrder}
                  onChange={(e) => setArticleSortOrder(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-numeric tabular-nums bg-background text-foreground border border-input rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="art-cat"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Category
                </label>
                <div className="relative">
                  <select
                    id="art-cat"
                    disabled={busy}
                    value={articleCategory}
                    onChange={(e) => setArticleCategory(e.target.value as HelpArticleCategory)}
                    className="w-full appearance-none pl-3.5 pr-10 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
                  >
                    {HELP_ARTICLE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="w-3.5 h-3.5 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="art-role"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Audience Role
                </label>
                <div className="relative">
                  <select
                    id="art-role"
                    disabled={busy}
                    value={articleRole}
                    onChange={(e) => setArticleRole(e.target.value as HelpAudienceRole)}
                    className="w-full appearance-none pl-3.5 pr-10 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
                  >
                    {HELP_AUDIENCE_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="w-3.5 h-3.5 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="art-title"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Article Title
              </label>
              <input
                id="art-title"
                type="text"
                required
                disabled={busy}
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="How the 13-Generation Referral Pool Works"
                className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
              />
            </div>

            <div>
              <label
                htmlFor="art-summary"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Summary
              </label>
              <textarea
                id="art-summary"
                rows={2}
                required
                disabled={busy}
                value={articleSummary}
                onChange={(e) => setArticleSummary(e.target.value)}
                placeholder="Short summary shown on Help Centre cards..."
                className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="art-md"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Body Markdown
                </label>
                <button
                  type="button"
                  onClick={() => setPreviewArticleMd((p) => !p)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:underline cursor-pointer"
                >
                  <Eye className="w-3 h-3" aria-hidden="true" />
                  {previewArticleMd ? 'Edit Markdown' : 'Preview'}
                </button>
              </div>
              {previewArticleMd ? (
                <div className="min-h-[160px] max-h-72 overflow-y-auto p-3 rounded-xl border border-border bg-muted/30">
                  <SafeMarkdown content={articleMarkdown || '_Nothing to preview yet._'} />
                </div>
              ) : (
                <textarea
                  id="art-md"
                  rows={8}
                  required
                  disabled={busy}
                  value={articleMarkdown}
                  onChange={(e) => setArticleMarkdown(e.target.value)}
                  placeholder="# Article Heading&#10;&#10;Step-by-step guidance..."
                  className="w-full px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl font-mono"
                />
              )}
            </div>

            <label className="flex items-center gap-2 p-2.5 bg-muted/50 border border-border rounded-xl text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                disabled={busy}
                checked={articlePublished}
                onChange={(e) => setArticlePublished(e.target.checked)}
                className="accent-foreground"
              />
              Publish live to Help Centre
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl hover:bg-primary/90 disabled:opacity-45 cursor-pointer"
            >
              {busy
                ? 'Saving Article...'
                : editingArticleId
                  ? 'Save Help Article'
                  : 'Create Help Article'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-card border border-border rounded-2xl divide-y divide-border">
            {helpArticles.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No Help Centre articles recorded yet.
              </div>
            ) : (
              helpArticles.map((art) => (
                <div key={art.id} className="p-4 sm:p-5 space-y-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-foreground" aria-hidden="true" />
                        <span className="font-sans text-sm font-semibold text-foreground">
                          {art.title}
                        </span>
                        <span className="font-numeric text-[11px] text-muted-foreground">
                          #{art.sortOrder} · {art.category} · {art.audienceRole}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-sans text-[11px] font-semibold ${
                            art.isPublished
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {art.isPublished ? 'PUBLISHED' : 'DRAFT'}
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{art.summary}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => loadArticleIntoForm(art)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleArticlePublish(art)}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                          art.isPublished
                            ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                            : 'border-primary-border bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                      >
                        {art.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
