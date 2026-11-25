-- NairaScout PRD v1.9: Product Listing Multi-Image & Video Links, Listing Media Storage Bucket, and Read/Unread Notifications
-- Traceability: NS-SEL-002, NS-SEL-006, NS-NOT-001

-- 1. Extend product_listings with multi-image and video_links arrays
ALTER TABLE public.product_listings
  ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_links JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill image_urls from existing image_url where empty
UPDATE public.product_listings
SET image_urls = jsonb_build_array(image_url)
WHERE jsonb_array_length(image_urls) = 0
  AND image_url IS NOT NULL
  AND image_url <> '';

-- 2. Public storage bucket for product listing images (up to 10 per listing, max 5 MB each)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-media',
  'listing-media',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated sellers upload listing media'
  ) THEN
    CREATE POLICY "Authenticated sellers upload listing media"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'listing-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated sellers delete own listing media'
  ) THEN
    CREATE POLICY "Authenticated sellers delete own listing media"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'listing-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read listing media'
  ) THEN
    CREATE POLICY "Public read listing media"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'listing-media');
  END IF;
END $$;

-- 3. Persistent user notifications table for Read/Unread green badge tracking
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'SYSTEM',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
      AND policyname = 'Users manage own notifications'
  ) THEN
    CREATE POLICY "Users manage own notifications"
      ON public.notifications FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Backfill any existing platform_notifications rows into public.notifications idempotently
INSERT INTO public.notifications (id, user_id, category, title, body, is_read, created_at)
SELECT id, user_id, UPPER(category), title, body, read, created_at
FROM public.platform_notifications
ON CONFLICT (id) DO NOTHING;
