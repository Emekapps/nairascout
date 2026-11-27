'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ImagePlus,
  Loader2,
  Lock,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import type { NairaScoutSnapshot } from '@/lib/nairascout-store';
import { DEFAULT_LISTING_CATEGORIES_SEED } from '@/lib/constants/nigeria-and-categories';
import { SELLER_PLAN_ENTITLEMENTS } from '@/lib/auth/rbac';
import { SELLER_PLANS, planIdToEnum } from '@/lib/seller-plans';
import { MAX_LISTING_IMAGES, parseAndNormalizeVideoLink } from '@/lib/media/video-links';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

interface CreateListingWizardProps {
  initialSnapshot: NairaScoutSnapshot;
}

export default function CreateListingWizard({ initialSnapshot }: CreateListingWizardProps) {
  const router = useRouter();
  const scout = initialSnapshot.activeScout;

  const activeCategoryNames =
    initialSnapshot.categories && initialSnapshot.categories.length > 0
      ? initialSnapshot.categories.filter((c) => c.isActive).map((c) => c.name)
      : DEFAULT_LISTING_CATEGORIES_SEED.map((c) => c.name);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Screen 1
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(activeCategoryNames[0] || 'Fashion & Apparel');

  // Screen 2
  const [stock, setStock] = useState('10');
  const [priceNaira, setPriceNaira] = useState('18500');

  // Screen 3
  const [deliveryFeeNaira, setDeliveryFeeNaira] = useState('2500');
  const [description, setDescription] = useState('');

  // Screen 4: Images (up to 10) + Plan-Capped Video Links
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [videoInputs, setVideoInputs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!initialSnapshot.authenticated || !scout) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-2xl max-w-md w-full p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-foreground mx-auto" aria-hidden="true" />
          <h1 className="font-sans text-2xl font-bold text-foreground">
            Sign In to Create a Product Listing
          </h1>
          <p className="text-sm text-muted-foreground">
            Authenticate your Scout &amp; Seller account to upload product images and save drafts.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl"
            >
              Sign In
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold text-foreground border border-border rounded-xl"
            >
              Back to Feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!scout.sellerProfile || scout.sellerProfile.sellerStatus === 'CLOSED') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-2xl max-w-md w-full p-8 text-center space-y-4">
          <Lock className="w-8 h-8 text-foreground mx-auto" aria-hidden="true" />
          <h1 className="font-sans text-2xl font-bold text-foreground">
            Seller Capabilities Required
          </h1>
          <p className="text-sm text-muted-foreground">
            Activate your Seller profile in Seller Hub before creating product listings.
          </p>
          <Link
            href="/?tab=seller"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border rounded-xl"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to Seller Hub
          </Link>
        </div>
      </div>
    );
  }

  const planSpec = SELLER_PLANS[scout.sellerPlan];
  const planEnum = planIdToEnum(scout.sellerPlan);
  const planEntitlements = SELLER_PLAN_ENTITLEMENTS[planEnum];
  const maxVideosAllowed = planEntitlements.maxVideosPerListing;

  const goToStep = (next: 1 | 2 | 3 | 4) => {
    setErrorMsg(null);
    if (next > step) {
      if (step === 1 && (!title.trim() || !category.trim())) {
        setErrorMsg('Please enter a Product Name and choose a Category.');
        return;
      }
      if (step === 2) {
        const qty = Number(stock);
        const unit = Number(priceNaira);
        if (!Number.isFinite(qty) || qty < 1) {
          setErrorMsg('Quantity must be at least 1.');
          return;
        }
        if (!Number.isFinite(unit) || unit < 500) {
          setErrorMsg('Unit Price must be at least ₦500.');
          return;
        }
      }
      if (step === 3) {
        const fee = Number(deliveryFeeNaira);
        if (!Number.isFinite(fee) || fee < 0) {
          setErrorMsg('Delivery Fee must be ₦0 or more.');
          return;
        }
        if (!description.trim()) {
          setErrorMsg('Please provide a Product Description.');
          return;
        }
      }
    }
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = MAX_LISTING_IMAGES - imageUrls.length;
    if (remainingSlots <= 0) {
      setErrorMsg(`Maximum of ${MAX_LISTING_IMAGES} images reached.`);
      return;
    }

    const queue = files.slice(0, remainingSlots);
    setUploadingImages(true);
    setErrorMsg(null);

    try {
      const uploadedUrls: string[] = [];
      for (const file of queue) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          setErrorMsg(`"${file.name}" skipped — use JPG, PNG, or WebP only.`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          setErrorMsg(`"${file.name}" exceeds the 5 MB image limit.`);
          continue;
        }
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/seller/listings/media', {
          method: 'POST',
          headers: { 'X-Requested-With': 'NairaScout' },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || `Failed to upload ${file.name}.`);
          continue;
        }
        if (typeof data.url === 'string') {
          uploadedUrls.push(data.url);
        }
      }
      if (uploadedUrls.length > 0) {
        setImageUrls((prev) => [...prev, ...uploadedUrls].slice(0, MAX_LISTING_IMAGES));
      }
    } catch {
      setErrorMsg('Network error uploading product images.');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = async (idx: number) => {
    const targetUrl = imageUrls[idx];
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
    if (targetUrl) {
      await fetch('/api/seller/listings/media', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({ url: targetUrl }),
      }).catch(() => undefined);
    }
  };

  const handleMakePrimaryCover = (idx: number) => {
    if (idx === 0) return;
    setImageUrls((prev) => {
      const copy = [...prev];
      const [picked] = copy.splice(idx, 1);
      return [picked, ...copy];
    });
  };

  const handleAddVideoField = () => {
    if (videoInputs.length >= maxVideosAllowed) return;
    setVideoInputs((prev) => [...prev, '']);
  };

  const handleVideoChange = (idx: number, value: string) => {
    setVideoInputs((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const handleRemoveVideo = (idx: number) => {
    setVideoInputs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveDraft = async () => {
    setErrorMsg(null);
    const cleanedVideos = videoInputs.map((v) => v.trim()).filter(Boolean);
    for (const rawUrl of cleanedVideos) {
      if (!parseAndNormalizeVideoLink(rawUrl)) {
        setErrorMsg(
          `Invalid video link "${rawUrl}". Enter a valid YouTube or TikTok video URL.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/seller/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'NairaScout',
        },
        body: JSON.stringify({
          title: title.trim(),
          category,
          stock: Number(stock),
          priceNaira: Number(priceNaira),
          deliveryFeeNaira: Number(deliveryFeeNaira),
          description: description.trim(),
          imageUrls,
          videoLinks: cleanedVideos,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not save draft listing.');
        setSubmitting(false);
        return;
      }

      router.push('/?tab=seller');
      router.refresh();
    } catch {
      setErrorMsg('Network error saving listing draft.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/?tab=seller"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to Seller Hub
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-numeric text-xs font-semibold text-muted-foreground tabular-nums">
              Step {step} of 4
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-sans text-2xl font-bold tracking-tight text-foreground">
              Create Listing
            </h1>
            <span className="text-xs font-medium text-muted-foreground">
              Plan: {planSpec.name}
            </span>
          </div>

          {/* 4-Step Progress Bar */}
          <div className="grid grid-cols-4 gap-2" aria-label={`Step ${step} of 4`}>
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-colors ${
                  idx <= step ? 'bg-foreground' : 'bg-border'
                }`}
              />
            ))}
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive"
          >
            {errorMsg}
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ x: direction * 36, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction * -36, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <div>
                  <h2 className="font-sans text-lg font-bold text-foreground">
                    Product Basics
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Give your product a clear title and assign an approved category.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="wiz-title"
                    className="block text-xs font-medium text-muted-foreground mb-1.5"
                  >
                    Product Name
                  </label>
                  <input
                    id="wiz-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Abeokuta Adire Cotton Cushion Set"
                    className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wiz-category"
                    className="block text-xs font-medium text-muted-foreground mb-1.5"
                  >
                    Category
                  </label>
                  <div className="relative">
                    <select
                      id="wiz-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full appearance-none pl-3.5 pr-10 py-2.5 text-sm border border-input rounded-xl bg-background text-foreground focus:outline-none focus:border-ring"
                    >
                      {activeCategoryNames.map((catName) => (
                        <option key={catName} value={catName}>
                          {catName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="w-4 h-4 text-muted-foreground pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {planSpec.name} plan allows {planSpec.maxCategories} active product{' '}
                    {planSpec.maxCategories === 1 ? 'category' : 'categories'}.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ x: direction * 36, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction * -36, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <div>
                  <h2 className="font-sans text-lg font-bold text-foreground">
                    Inventory &amp; Unit Pricing
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Unit price determines the eligible merchandise base for Seller proceeds (90%)
                    and referral commissions.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="wiz-stock"
                    className="block text-xs font-medium text-muted-foreground mb-1.5"
                  >
                    Quantity
                  </label>
                  <input
                    id="wiz-stock"
                    type="number"
                    min={1}
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-numeric tabular-nums bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wiz-price"
                    className="block text-xs font-medium text-muted-foreground mb-1.5"
                  >
                    Unit Price (₦)
                  </label>
                  <input
                    id="wiz-price"
                    type="number"
                    min={500}
                    required
                    value={priceNaira}
                    onChange={(e) => setPriceNaira(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-numeric tabular-nums bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ x: direction * 36, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction * -36, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <div>
                  <h2 className="font-sans text-lg font-bold text-foreground">
                    Delivery &amp; Description
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Delivery fees are collected alongside checkout and excluded from the commission
                    base.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="wiz-deliv"
                    className="block text-xs font-medium text-muted-foreground mb-1.5"
                  >
                    Delivery Fee (₦)
                  </label>
                  <input
                    id="wiz-deliv"
                    type="number"
                    min={0}
                    required
                    value={deliveryFeeNaira}
                    onChange={(e) => setDeliveryFeeNaira(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-numeric tabular-nums bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wiz-desc"
                    className="block text-xs font-medium text-muted-foreground mb-1.5"
                  >
                    Description
                  </label>
                  <textarea
                    id="wiz-desc"
                    rows={5}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Material details, sizing, authenticity, and fulfilment notes..."
                    className="w-full px-3.5 py-2.5 text-sm bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                  />
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step-4"
                initial={{ x: direction * 36, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction * -36, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                {/* Field 1: Multi-Image Uploader (up to 10 images) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-sans text-base font-bold text-foreground">
                        Product Images ({imageUrls.length} / {MAX_LISTING_IMAGES})
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Upload up to 10 JPG, PNG, or WebP photos (max 5 MB each). First image is the
                        Primary Cover.
                      </p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleUploadFiles}
                    className="sr-only"
                    aria-label="Upload product images"
                  />

                  <button
                    type="button"
                    disabled={uploadingImages || imageUrls.length >= MAX_LISTING_IMAGES}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 px-4 border-2 border-dashed border-border rounded-2xl bg-muted/30 hover:bg-muted/60 transition-colors flex flex-col items-center justify-center gap-2 text-center disabled:opacity-50 cursor-pointer"
                  >
                    {uploadingImages ? (
                      <Loader2 className="w-6 h-6 animate-spin text-foreground" aria-hidden="true" />
                    ) : (
                      <ImagePlus className="w-6 h-6 text-foreground" aria-hidden="true" />
                    )}
                    <span className="text-xs font-semibold text-foreground">
                      {uploadingImages
                        ? 'Uploading product images...'
                        : imageUrls.length >= MAX_LISTING_IMAGES
                          ? 'Maximum 10 images uploaded'
                          : 'Tap to select product photos (JPG, PNG, WebP)'}
                    </span>
                  </button>

                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      {imageUrls.map((url, idx) => (
                        <div
                          key={url}
                          className={`relative rounded-xl overflow-hidden border bg-muted aspect-square group ${
                            idx === 0 ? 'border-foreground ring-1 ring-foreground' : 'border-border'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Product upload ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          {idx === 0 ? (
                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#1E241E]/85 text-white text-[10px] font-semibold">
                              Cover
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMakePrimaryCover(idx)}
                              className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/75 text-white text-[10px] font-medium hover:bg-black cursor-pointer"
                            >
                              Set Cover
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            aria-label={`Remove image ${idx + 1}`}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/75 text-white hover:bg-destructive flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Field 2: Plan-Capped Video Link Input List */}
                <div className="pt-5 border-t border-border space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-foreground" aria-hidden="true" />
                      <h2 className="font-sans text-base font-bold text-foreground">
                        Video Links (YouTube &amp; TikTok)
                      </h2>
                    </div>
                    <span className="font-numeric text-xs text-muted-foreground tabular-nums">
                      {videoInputs.length} / {maxVideosAllowed} allowed ({planSpec.name})
                    </span>
                  </div>

                  {maxVideosAllowed === 0 ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                      <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                        Video links are not included on the Starter plan (0 videos).
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Upgrade to Traction (1 video), Growth (3 videos), or Sprawl (5 videos) to
                        embed YouTube and TikTok product videos in the Marketplace Feed.
                      </p>
                      <input
                        type="url"
                        disabled
                        placeholder="Upgrade to Traction or higher to add YouTube/TikTok links"
                        className="w-full px-3 py-2 text-xs bg-muted text-muted-foreground border border-border rounded-xl cursor-not-allowed"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <p className="text-xs text-muted-foreground">
                        Paste up to {maxVideosAllowed} YouTube (`youtube.com`, `youtu.be`) or
                        TikTok (`tiktok.com`) video URL{maxVideosAllowed === 1 ? '' : 's'}.
                      </p>

                      {videoInputs.map((val, idx) => {
                        const parsed = val.trim() ? parseAndNormalizeVideoLink(val) : null;
                        return (
                          <div key={`vid-row-${idx}`} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="url"
                                value={val}
                                onChange={(e) => handleVideoChange(idx, e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=... or https://www.tiktok.com/@user/video/..."
                                aria-label={`Video link ${idx + 1}`}
                                className="flex-1 px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl focus:outline-none focus:border-ring"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveVideo(idx)}
                                aria-label={`Remove video link ${idx + 1}`}
                                className="p-2 text-muted-foreground hover:text-destructive border border-border rounded-xl cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </div>
                            {val.trim() && (
                              <p
                                className={`text-[11px] flex items-center gap-1 ${
                                  parsed ? 'text-success' : 'text-destructive'
                                }`}
                              >
                                {parsed ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                                    Valid {parsed.platform} video link
                                  </>
                                ) : (
                                  'Enter a valid YouTube or TikTok video URL.'
                                )}
                              </p>
                            )}
                          </div>
                        );
                      })}

                      {videoInputs.length < maxVideosAllowed && (
                        <button
                          type="button"
                          onClick={handleAddVideoField}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-border bg-background hover:bg-muted rounded-xl text-foreground cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          Add Video Link ({videoInputs.length}/{maxVideosAllowed})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Navigation Controls */}
          <div className="mt-8 pt-5 border-t border-border flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => goToStep((step - 1) as 1 | 2 | 3 | 4)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-xl cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                Back
              </button>
            ) : (
              <Link
                href="/?tab=seller"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border border-border bg-background hover:bg-muted text-foreground rounded-xl"
              >
                Cancel
              </Link>
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => goToStep((step + 1) as 1 | 2 | 3 | 4)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary-border hover:bg-primary/90 rounded-xl cursor-pointer"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting || uploadingImages}
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-commerce-foreground bg-commerce hover:bg-commerce/90 disabled:opacity-45 rounded-xl cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    Saving Draft...
                  </>
                ) : (
                  'Save Draft'
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
