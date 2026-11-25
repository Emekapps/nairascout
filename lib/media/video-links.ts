// NS-SEL-006: Safe YouTube & TikTok video link validation, plan enforcement, and embed construction

export type ListingVideoPlatform = 'YouTube' | 'TikTok';

export interface ListingVideoLink {
  url: string;
  platform: ListingVideoPlatform;
}

export interface VideoEmbedInfo {
  platform: ListingVideoPlatform;
  embedUrl: string | null;
  safeHref: string;
  caption: string;
}

export const MAX_LISTING_IMAGES = 10;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
]);

const SAFE_YT_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;
const SAFE_TT_NUM_ID_RE = /^[0-9]{10,25}$/;

export function extractYouTubeVideoId(parsed: URL): string | null {
  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  if (host === 'youtu.be') {
    const seg = parsed.pathname.split('/').filter(Boolean)[0];
    return seg && SAFE_YT_ID_RE.test(seg) ? seg : null;
  }

  const vParam = parsed.searchParams.get('v');
  if (vParam && SAFE_YT_ID_RE.test(vParam)) {
    return vParam;
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live')) {
    return SAFE_YT_ID_RE.test(parts[1]) ? parts[1] : null;
  }

  return null;
}

export function extractTikTokVideoId(parsed: URL): { videoId: string | null; validTikTokUrl: boolean } {
  const host = parsed.hostname.toLowerCase();
  if (!TIKTOK_HOSTS.has(host)) {
    return { videoId: null, validTikTokUrl: false };
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  // Standard: https://www.tiktok.com/@handle/video/7123456789012345678
  const videoIdx = parts.indexOf('video');
  if (videoIdx !== -1 && parts[videoIdx + 1] && SAFE_TT_NUM_ID_RE.test(parts[videoIdx + 1])) {
    return { videoId: parts[videoIdx + 1], validTikTokUrl: true };
  }

  // Embed: https://www.tiktok.com/embed/v2/7123456789012345678
  if (parts[0] === 'embed' && parts[1] === 'v2' && parts[2] && SAFE_TT_NUM_ID_RE.test(parts[2])) {
    return { videoId: parts[2], validTikTokUrl: true };
  }

  // Short links (vm.tiktok.com/<code>, tiktok.com/t/<code>)
  if ((host === 'vm.tiktok.com' || host === 'vt.tiktok.com') && parts.length >= 1) {
    return { videoId: null, validTikTokUrl: /^[A-Za-z0-9_-]{4,32}$/.test(parts[0]) };
  }
  if (parts[0] === 't' && parts[1]) {
    return { videoId: null, validTikTokUrl: /^[A-Za-z0-9_-]{4,32}$/.test(parts[1]) };
  }

  return { videoId: null, validTikTokUrl: false };
}

export function parseAndNormalizeVideoLink(rawUrl: string): ListingVideoLink | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  // Force canonical HTTPS scheme for safe storage and rendering
  parsed.protocol = 'https:';

  const ytId = extractYouTubeVideoId(parsed);
  if (ytId) {
    return {
      url: `https://www.youtube.com/watch?v=${ytId}`,
      platform: 'YouTube',
    };
  }

  const tt = extractTikTokVideoId(parsed);
  if (tt.validTikTokUrl) {
    return {
      url: parsed.toString(),
      platform: 'TikTok',
    };
  }

  return null;
}

export function getVideoEmbedInfo(
  link: ListingVideoLink,
  options?: { autoplay?: boolean }
): VideoEmbedInfo {
  const autoplay = options?.autoplay ? '1' : '0';
  let parsed: URL | null = null;
  try {
    parsed = new URL(link.url);
  } catch {
    parsed = null;
  }

  if (link.platform === 'YouTube' && parsed) {
    const ytId = extractYouTubeVideoId(parsed);
    const safeHref = ytId ? `https://www.youtube.com/watch?v=${ytId}` : 'https://www.youtube.com';
    return {
      platform: 'YouTube',
      embedUrl: ytId
        ? `https://www.youtube.com/embed/${ytId}?autoplay=${autoplay}&rel=0&playsinline=1`
        : null,
      safeHref,
      caption: 'Video hosted on YouTube',
    };
  }

  if (link.platform === 'TikTok' && parsed) {
    const tt = extractTikTokVideoId(parsed);
    const safeHref = tt.validTikTokUrl ? parsed.toString() : 'https://www.tiktok.com';
    return {
      platform: 'TikTok',
      embedUrl: tt.videoId
        ? `https://www.tiktok.com/embed/v2/${tt.videoId}?autoplay=${autoplay}`
        : null,
      safeHref,
      caption: 'Video hosted on TikTok',
    };
  }

  return {
    platform: 'YouTube',
    embedUrl: null,
    safeHref: 'https://www.youtube.com',
    caption: 'Video hosted on YouTube',
  };
}

export function sanitizeListingImageUrls(rawUrls: unknown): string[] {
  if (!Array.isArray(rawUrls)) return [];
  const cleaned: string[] = [];
  for (const item of rawUrls) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        cleaned.push(parsed.toString());
      }
    } catch {
      // Ignore malformed URLs
    }
    if (cleaned.length >= MAX_LISTING_IMAGES) break;
  }
  return Array.from(new Set(cleaned));
}

export function sanitizeStoredVideoLinks(rawLinks: unknown): ListingVideoLink[] {
  if (!Array.isArray(rawLinks)) return [];
  const out: ListingVideoLink[] = [];
  for (const entry of rawLinks) {
    if (typeof entry === 'string') {
      const parsed = parseAndNormalizeVideoLink(entry);
      if (parsed) out.push(parsed);
    } else if (entry && typeof entry === 'object') {
      const rawUrl = (entry as { url?: unknown }).url;
      if (typeof rawUrl === 'string') {
        const parsed = parseAndNormalizeVideoLink(rawUrl);
        if (parsed) out.push(parsed);
      }
    }
  }
  return out;
}
