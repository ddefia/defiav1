import { URL } from 'url';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_MAX_PAGES = 8;
const DEFAULT_MAX_CHARS = 24000;
const DOC_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.md', '.txt'];

const normalizeUrl = (value) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

const isHtmlResponse = (response) => {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
};

const fetchImpl = (...args) => {
  if (typeof fetch !== 'undefined') {
    return fetch(...args);
  }
  return import('node-fetch').then((mod) => mod.default(...args));
};

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

const sanitizeFolderName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const getExtensionFromContentType = (contentType) => {
  if (!contentType) return '';
  if (contentType.includes('image/jpeg')) return 'jpg';
  if (contentType.includes('image/png')) return 'png';
  if (contentType.includes('image/webp')) return 'webp';
  if (contentType.includes('image/gif')) return 'gif';
  return '';
};

const getExtensionFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    if (match) return match[1].toLowerCase().replace('jpeg', 'jpg');
  } catch {
    // ignore
  }
  return '';
};

const uploadImageToSupabase = async (supabase, folder, filename, buffer, contentType) => {
  if (!supabase) return null;
  try {
    const filePath = `${folder}/${filename}`;
    const { error } = await supabase.storage
      .from('brand-assets')
      .upload(filePath, buffer, { contentType, upsert: true });
    if (error) {
      console.warn('[Onboarding] Upload failed:', error.message);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage
      .from('brand-assets')
      .getPublicUrl(filePath);
    return publicUrl || null;
  } catch (e) {
    console.warn('[Onboarding] Upload exception:', e.message || e);
    return null;
  }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

const extractLinks = (html, baseUrl) => {
  const links = new Set();
  const hrefRegex = /href\s*=\s*["']([^"'#]+)["']/gi;
  let match = hrefRegex.exec(html);
  while (match) {
    try {
      const raw = match[1];
      if (!raw || raw.startsWith('mailto:') || raw.startsWith('tel:')) {
        match = hrefRegex.exec(html);
        continue;
      }
      const absolute = new URL(raw, baseUrl).toString();
      links.add(absolute);
    } catch {
      // ignore malformed URLs
    }
    match = hrefRegex.exec(html);
  }
  return Array.from(links);
};

const stripHtml = (html) => {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

const isSameDomain = (url, rootUrl) => {
  try {
    const root = new URL(rootUrl);
    const target = new URL(url);
    return target.hostname === root.hostname;
  } catch {
    return false;
  }
};

const isDocumentLink = (url) => DOC_EXTENSIONS.some((ext) => url.toLowerCase().includes(ext));

export const crawlWebsite = async (startUrl, { maxPages = DEFAULT_MAX_PAGES, maxChars = DEFAULT_MAX_CHARS } = {}) => {
  const normalized = normalizeUrl(startUrl);
  if (!normalized) {
    return { content: '', pages: [], docs: [] };
  }

  const visited = new Set();
  const queue = [normalized];
  const pages = [];
  const docs = new Set();
  let totalChars = 0;

  while (queue.length > 0 && pages.length < maxPages && totalChars < maxChars) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    try {
      const res = await fetchWithTimeout(current, {
        headers: { 'User-Agent': 'DefiaOnboardingBot/1.0' }
      });
      if (!res.ok || !isHtmlResponse(res)) {
        continue;
      }

      const html = await res.text();
      const text = stripHtml(html);
      if (text.length > 200) {
        pages.push({ url: current, text });
        totalChars += text.length;
      }

      const links = extractLinks(html, current);
      for (const link of links) {
        if (isDocumentLink(link)) {
          docs.add(link);
          continue;
        }
        if (isSameDomain(link, normalized) && !visited.has(link) && queue.length < maxPages * 3) {
          queue.push(link);
        }
      }
    } catch {
      // swallow crawl errors per-page
    }
  }

  const content = pages
    .map((page) => `SOURCE: ${page.url}\n${page.text}`)
    .join('\n\n---\n\n')
    .slice(0, maxChars);

  return {
    content,
    pages: pages.map((page) => page.url),
    docs: Array.from(docs)
  };
};

export const fetchTwitterContent = async (handle, { maxItems = 25, brandName } = {}) => {
  const token = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN || '';
  if (!token) {
    return { tweets: [], tweetExamples: [], referenceImages: [], error: 'Missing APIFY API token.' };
  }

  // New unified Twitter actor
  const ACTOR_TWITTER = 'VsTreSuczsXhhRIqa';
  const runRes = await fetchImpl(`https://api.apify.com/v2/acts/${ACTOR_TWITTER}/runs?token=${token}&waitForFinish=90`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handles: [handle],
      tweetsDesired: maxItems,
      profilesDesired: 1,
      withReplies: false,
      includeUserInfo: true,
      proxyConfig: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] }
    })
  });

  const runData = await runRes.json();
  if (!runRes.ok || !runData?.data?.defaultDatasetId) {
    const err = runData?.error?.message || runData?.data?.status || 'Apify run failed';
    return { tweets: [], tweetExamples: [], referenceImages: [], error: err };
  }

  const datasetId = runData.data.defaultDatasetId;
  const itemsRes = await fetchImpl(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
  const items = await itemsRes.json();

  // Map new actor output format
  const tweets = (items || []).map((item) => {
    const text = item.text || '';
    const likes = item.likes || 0;
    const retweets = item.retweets || 0;
    const replies = item.replies || 0;
    const quotes = item.quotes || 0;
    // New actor uses images array instead of nested media objects
    const mediaUrls = item.images || [];

    const score = likes + retweets * 2 + replies * 1.5 + quotes;

    return {
      id: item.id,
      text,
      createdAt: item.timestamp || '',
      likes,
      retweets,
      replies,
      views: 0, // New actor doesn't provide view count
      mediaUrls,
      score
    };
  }).filter((tweet) => tweet.text && tweet.text.length > 20);

  const topTweets = [...tweets].sort((a, b) => b.score - a.score).slice(0, 8);
  const tweetExamples = topTweets.map((tweet) => tweet.text);

  const referenceImages = [];
  const supabase = getSupabaseClient();
  const folder = sanitizeFolderName(brandName || handle) || sanitizeFolderName(handle) || 'unknown_brand';
  const seenImages = new Set();
  for (const tweet of tweets) {
    if (!tweet.mediaUrls || tweet.mediaUrls.length === 0) continue;
    const url = tweet.mediaUrls[0];
    if (seenImages.has(url)) continue;
    seenImages.add(url);
    let finalUrl = url;
    if (supabase) {
      try {
        const imgRes = await fetchImpl(url);
        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await imgRes.arrayBuffer();
          const extension = getExtensionFromContentType(contentType) || getExtensionFromUrl(url) || 'jpg';
          const filename = `tweet-${tweet.id}.${extension}`;
          const uploaded = await uploadImageToSupabase(
            supabase,
            folder,
            filename,
            Buffer.from(arrayBuffer),
            contentType
          );
          if (uploaded) finalUrl = uploaded;
        }
      } catch (e) {
        console.warn('[Onboarding] Failed to fetch/upload image:', e.message || e);
      }
    }

    referenceImages.push({
      id: `tweet-${tweet.id}`,
      url: finalUrl,
      name: `Tweet ${tweet.createdAt || ''}`.trim() || `Tweet ${tweet.id}`,
      category: 'Tweet'
    });
    if (referenceImages.length >= 10) break;
  }

  return { tweets, tweetExamples, referenceImages };
};

export const uploadCarouselGraphic = async ({ brandName, imageData, imageId }) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase not configured.' };
  }

  if (!imageData || typeof imageData !== 'string') {
    return { error: 'Missing image data.' };
  }

  const folder = sanitizeFolderName(brandName) || 'unknown_brand';
  const normalized = imageData.replace(/\s/g, '');
  const match = normalized.match(/^data:([^;]+);base64,(.*)$/);
  const mimeType = match ? match[1] : 'image/png';
  const base64Data = match ? match[2] : normalized;

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const extension = getExtensionFromContentType(mimeType) || 'png';
    const filename = `${imageId || `carousel-${Date.now()}`}.${extension}`;
    const publicUrl = await uploadImageToSupabase(supabase, folder, filename, buffer, mimeType);

    if (!publicUrl) {
      return { error: 'Upload failed.' };
    }

    return { publicUrl };
  } catch (e) {
    return { error: e?.message || 'Upload failed.' };
  }
};
