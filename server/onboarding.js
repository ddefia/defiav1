import { URL } from 'url';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_MAX_PAGES = 15;
const DEFAULT_MAX_CHARS = 100000;
const DOC_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.md', '.txt'];

// Apify Website Content Crawler Actor ID
const ACTOR_WEBSITE_CRAWLER = 'aYG0l9s7dbB7j3gbS';

// Keywords to identify important content categories
const CONTENT_CATEGORIES = {
  docs: ['documentation', 'docs', 'guide', 'tutorial', 'getting-started', 'quickstart', 'api-reference'],
  whitepaper: ['whitepaper', 'white-paper', 'litepaper', 'lite-paper', 'technical-paper'],
  tokenomics: ['tokenomics', 'token', 'economics', 'supply', 'distribution', 'vesting'],
  defi: ['apr', 'apy', 'yield', 'staking', 'liquidity', 'pool', 'farm', 'vault', 'tvl'],
  governance: ['governance', 'dao', 'voting', 'proposal', 'treasury'],
  security: ['audit', 'security', 'bug-bounty', 'immunefi'],
  roadmap: ['roadmap', 'milestone', 'timeline', 'upcoming']
};

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

/**
 * Categorize content based on URL and text patterns
 */
const categorizeContent = (url, text) => {
  const urlLower = url.toLowerCase();
  const textLower = text.toLowerCase().slice(0, 2000); // Check first 2000 chars

  for (const [category, keywords] of Object.entries(CONTENT_CATEGORIES)) {
    for (const keyword of keywords) {
      if (urlLower.includes(keyword) || textLower.includes(keyword)) {
        return category;
      }
    }
  }
  return 'general';
};

/**
 * Extract title from URL path
 */
const extractTitleFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const segments = path.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      return last
        .replace(/[-_]/g, ' ')
        .replace(/\.[^/.]+$/, '') // Remove extension
        .replace(/\b\w/g, l => l.toUpperCase()); // Title case
    }
    return parsed.hostname;
  } catch {
    return 'Unknown';
  }
};

/**
 * Extract document links from text (PDFs, etc.)
 */
const extractDocumentLinks = (text) => {
  const links = [];
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+\.(pdf|doc|docx|pptx?|md|txt)/gi;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    links.push(match[0]);
  }
  return links;
};

/**
 * Count pages by category
 */
const countCategories = (pages) => {
  const counts = {};
  for (const page of pages) {
    counts[page.category] = (counts[page.category] || 0) + 1;
  }
  return counts;
};

export const crawlWebsite = async (startUrl, { maxPages = DEFAULT_MAX_PAGES, maxChars = DEFAULT_MAX_CHARS } = {}) => {
  const normalized = normalizeUrl(startUrl);
  if (!normalized) {
    return { content: '', pages: [], docs: [], knowledgeBase: [], crawledImages: [] };
  }

  const visited = new Set();
  const queue = [normalized];
  const pages = [];
  const docs = new Set();
  let totalChars = 0;

  // Also try docs subdomain (like the deep crawl does)
  try {
    const parsedUrl = new URL(normalized);
    const baseDomain = parsedUrl.hostname.replace(/^www\./, '');
    if (!baseDomain.startsWith('docs.')) {
      const docsUrl = `https://docs.${baseDomain}`;
      queue.push(docsUrl);
      console.log(`[SimpleCrawl] Also queuing docs subdomain: ${docsUrl}`);
    }
  } catch { /* ignore */ }

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
        // Extract title from <title> tag
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : extractTitleFromUrl(current);
        const category = categorizeContent(current, text);

        // Extract image URLs from <img> tags and og:image
        const imageUrls = [];
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        let imgMatch;
        while ((imgMatch = imgRegex.exec(html)) !== null) {
          imageUrls.push(imgMatch[1]);
        }
        // Also extract Open Graph image
        const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogImgMatch) imageUrls.push(ogImgMatch[1]);

        pages.push({ url: current, text, title, category, imageUrls });
        totalChars += text.length;
      }

      const links = extractLinks(html, current);
      for (const link of links) {
        if (isDocumentLink(link)) {
          docs.add(link);
          continue;
        }
        // Allow docs subdomain pages too
        if ((isSameDomain(link, normalized) || isSameDomain(link, current)) && !visited.has(link) && queue.length < maxPages * 3) {
          queue.push(link);
        }
      }
    } catch {
      // swallow crawl errors per-page
    }
  }

  const content = pages
    .map((page) => `SOURCE: ${page.url}\nCATEGORY: ${page.category}\nTITLE: ${page.title}\n\n${page.text}`)
    .join('\n\n---\n\n')
    .slice(0, maxChars);

  // Build knowledge base entries (matching deep crawl format)
  const knowledgeBase = pages.map((page, index) => ({
    id: `kb-${Date.now()}-${index}`,
    title: page.title,
    content: page.text.slice(0, 10000),
    source: page.url,
    category: page.category,
    extractedAt: new Date().toISOString()
  }));

  // Sort by category priority (same as deep crawl)
  const categoryPriority = ['whitepaper', 'tokenomics', 'docs', 'defi', 'governance', 'security', 'roadmap', 'general'];
  knowledgeBase.sort((a, b) => {
    const aIdx = categoryPriority.indexOf(a.category);
    const bIdx = categoryPriority.indexOf(b.category);
    return aIdx - bIdx;
  });

  // Extract unique, high-quality image URLs from all crawled pages
  const seenImages = new Set();
  const crawledImages = [];
  const baseDomainForImages = (() => {
    try { return new URL(normalized).hostname.replace(/^www\./, ''); } catch { return ''; }
  })();

  for (const page of pages) {
    for (const imgUrl of (page.imageUrls || [])) {
      try {
        // Resolve relative URLs
        const absoluteUrl = imgUrl.startsWith('http') ? imgUrl : new URL(imgUrl, page.url).href;

        // Skip tiny images, tracking pixels, data URIs, SVGs, and icons
        if (absoluteUrl.startsWith('data:')) continue;
        if (/\.(svg|ico)(\?|$)/i.test(absoluteUrl)) continue;
        if (/\b(1x1|pixel|tracker|analytics|beacon)\b/i.test(absoluteUrl)) continue;
        if (seenImages.has(absoluteUrl)) continue;

        seenImages.add(absoluteUrl);
        crawledImages.push({
          url: absoluteUrl,
          sourcePage: page.url,
          isOwnDomain: absoluteUrl.includes(baseDomainForImages)
        });
      } catch { /* skip malformed URLs */ }
    }
  }

  // Prioritize own-domain images, limit to 15
  crawledImages.sort((a, b) => (b.isOwnDomain ? 1 : 0) - (a.isOwnDomain ? 1 : 0));
  const topImages = crawledImages.slice(0, 15);

  console.log(`[SimpleCrawl] Complete: ${pages.length} pages, ${knowledgeBase.length} KB entries, ${docs.size} doc links, ${topImages.length} images`);

  return {
    content,
    pages: pages.map((page) => ({ url: page.url, title: page.title, category: page.category })),
    docs: Array.from(docs),
    knowledgeBase,
    crawledImages: topImages,
    stats: {
      totalPages: pages.length,
      totalChars,
      categories: countCategories(pages)
    }
  };
};

/**
 * DEEP WEBSITE CRAWL using Apify Website Content Crawler
 * This provides much more comprehensive content extraction including:
 * - Deep crawling of all pages
 * - Markdown conversion for clean text
 * - Automatic docs subdomain detection
 * - Content categorization
 */
export const deepCrawlWebsite = async (startUrl, options = {}) => {
  const {
    maxPages = 50,
    maxDepth = 10,
    includeDocsSubdomain = true,
    waitForFinishSecs = 180
  } = options;

  const token = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN || '';
  if (!token) {
    console.warn('[Onboarding] No Apify token - falling back to simple crawl');
    return crawlWebsite(startUrl, { maxPages: 8 });
  }

  const normalized = normalizeUrl(startUrl);
  if (!normalized) {
    return { content: '', pages: [], docs: [], knowledgeBase: [], crawledImages: [] };
  }

  console.log(`[Onboarding] Starting deep crawl of ${normalized}...`);

  try {
    const parsedUrl = new URL(normalized);
    const baseDomain = parsedUrl.hostname;

    // Build list of URLs to crawl
    const urlsToCrawl = [{ url: normalized }];

    // Auto-detect and add docs subdomain if it exists
    if (includeDocsSubdomain && !baseDomain.startsWith('docs.')) {
      const docsUrl = `https://docs.${baseDomain.replace(/^www\./, '')}`;
      urlsToCrawl.push({ url: docsUrl });
      console.log(`[Onboarding] Also crawling docs subdomain: ${docsUrl}`);
    }

    // Run Apify Website Content Crawler
    const runRes = await fetchImpl(
      `https://api.apify.com/v2/acts/${ACTOR_WEBSITE_CRAWLER}/runs?token=${token}&waitForFinish=${waitForFinishSecs}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: urlsToCrawl,
          useSitemaps: true,
          useLlmsTxt: true,
          respectRobotsTxtFile: true,
          crawlerType: 'playwright:adaptive',
          maxCrawlDepth: maxDepth,
          maxCrawlPages: maxPages,
          maxConcurrency: 10,
          dynamicContentWaitSecs: 5,
          removeElementsCssSelector: `nav, footer, script, style, noscript, svg, img[src^='data:'],
            [role="alert"], [role="banner"], [role="dialog"], [role="alertdialog"],
            [role="region"][aria-label*="skip" i], [aria-modal="true"],
            .cookie-banner, .newsletter-popup, .modal, .overlay`,
          removeCookieWarnings: true,
          blockMedia: true,
          htmlTransformer: 'readableText',
          readableTextCharThreshold: 100,
          saveMarkdown: true,
          saveHtml: false,
          proxyConfiguration: { useApifyProxy: true }
        })
      }
    );

    const runData = await runRes.json();

    if (!runData.data || (runData.data.status !== 'SUCCEEDED' && runData.data.status !== 'RUNNING')) {
      console.warn('[Onboarding] Deep crawl failed, falling back to simple crawl. Status:', runData.data?.status, 'Error:', JSON.stringify(runData?.error || runData?.data?.statusMessage || 'unknown'));
      const fallback = await crawlWebsite(startUrl, { maxPages: 8 });
      fallback.warning = `Deep crawl failed (${runData.data?.status || 'no response'}), used basic crawl`;
      return fallback;
    }

    // Fetch results from dataset
    const datasetId = runData.data.defaultDatasetId;
    const itemsRes = await fetchImpl(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`
    );
    const items = await itemsRes.json();

    console.log(`[Onboarding] Deep crawl fetched ${items?.length || 0} pages`);

    if (!items || items.length === 0) {
      console.warn('[Onboarding] No results from deep crawl, falling back to simple crawl');
      const fallback = await crawlWebsite(startUrl, { maxPages: 8 });
      fallback.warning = 'Deep crawl returned no pages, used basic crawl';
      return fallback;
    }

    // Process and categorize content
    const pages = [];
    const docs = new Set();
    const knowledgeBase = [];
    let totalChars = 0;

    for (const item of items) {
      const url = item.url || '';
      const text = item.text || item.markdown || '';
      const title = item.metadata?.title || extractTitleFromUrl(url);

      if (!text || text.length < 100) continue;

      // Check for document links
      if (isDocumentLink(url)) {
        docs.add(url);
        continue;
      }

      // Categorize the content
      const category = categorizeContent(url, text);

      pages.push({ url, text, title, category });
      totalChars += text.length;

      // Build knowledge base entry
      const kbEntry = {
        id: `kb-${Date.now()}-${knowledgeBase.length}`,
        title: title,
        content: text.slice(0, 10000), // Limit per entry
        source: url,
        category: category,
        extractedAt: new Date().toISOString()
      };
      knowledgeBase.push(kbEntry);

      // Extract any linked documents from this page
      const pageLinks = extractDocumentLinks(text);
      pageLinks.forEach(link => docs.add(link));
    }

    // Sort knowledge base by category priority
    const categoryPriority = ['whitepaper', 'tokenomics', 'docs', 'defi', 'governance', 'security', 'roadmap', 'general'];
    knowledgeBase.sort((a, b) => {
      const aIdx = categoryPriority.indexOf(a.category);
      const bIdx = categoryPriority.indexOf(b.category);
      return aIdx - bIdx;
    });

    // Build combined content string
    const content = pages
      .map((page) => `SOURCE: ${page.url}\nCATEGORY: ${page.category}\nTITLE: ${page.title}\n\n${page.text}`)
      .join('\n\n---\n\n');

    // Deep crawl uses blockMedia, so extract images from homepage separately
    let crawledImages = [];
    try {
      const homeRes = await fetchWithTimeout(normalized, { headers: { 'User-Agent': 'DefiaOnboardingBot/1.0' } }, 10000);
      if (homeRes.ok && isHtmlResponse(homeRes)) {
        const homeHtml = await homeRes.text();
        const seenImages = new Set();
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        let imgMatch;
        while ((imgMatch = imgRegex.exec(homeHtml)) !== null) {
          const src = imgMatch[1];
          if (src.startsWith('data:') || /\.(svg|ico)(\?|$)/i.test(src)) continue;
          if (/\b(1x1|pixel|tracker|analytics|beacon)\b/i.test(src)) continue;
          const absoluteUrl = src.startsWith('http') ? src : new URL(src, normalized).href;
          if (!seenImages.has(absoluteUrl)) {
            seenImages.add(absoluteUrl);
            crawledImages.push({ url: absoluteUrl, sourcePage: normalized, isOwnDomain: true });
          }
        }
        const ogImgMatch = homeHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                        || homeHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogImgMatch && !seenImages.has(ogImgMatch[1])) {
          crawledImages.unshift({ url: ogImgMatch[1], sourcePage: normalized, isOwnDomain: true });
        }
        crawledImages = crawledImages.slice(0, 15);
      }
    } catch (imgErr) {
      console.warn('[Onboarding] Image extraction from homepage failed:', imgErr.message);
    }

    console.log(`[Onboarding] Deep crawl complete: ${pages.length} pages, ${knowledgeBase.length} KB entries, ${docs.size} doc links, ${crawledImages.length} images`);

    return {
      content,
      pages: pages.map((page) => ({ url: page.url, title: page.title, category: page.category })),
      docs: Array.from(docs),
      knowledgeBase,
      crawledImages,
      stats: {
        totalPages: pages.length,
        totalChars,
        categories: countCategories(pages)
      }
    };

  } catch (e) {
    console.error('[Onboarding] Deep crawl error:', e.message);
    // Fallback to simple crawl
    const fallback = await crawlWebsite(startUrl, { maxPages: 8 });
    fallback.warning = `Deep crawl error: ${e.message}, used basic crawl`;
    return fallback;
  }
};

/**
 * Fetch and extract content from a PDF/document URL
 */
export const fetchDocumentContent = async (docUrl) => {
  const token = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN || '';
  if (!token) {
    return { error: 'No Apify token available' };
  }

  try {
    console.log(`[Onboarding] Fetching document: ${docUrl}`);

    // Use Apify's document-to-text or similar actor
    // For now, we'll try to fetch and extract basic info
    const res = await fetchWithTimeout(docUrl, {
      headers: { 'User-Agent': 'DefiaOnboardingBot/1.0' }
    }, 30000);

    if (!res.ok) {
      return { error: `Failed to fetch: ${res.status}` };
    }

    const contentType = res.headers.get('content-type') || '';
    const fileName = docUrl.split('/').pop() || 'document';

    // For PDFs, we'd need a PDF parser - for now return metadata
    if (contentType.includes('pdf')) {
      const buffer = await res.arrayBuffer();
      return {
        url: docUrl,
        fileName,
        type: 'pdf',
        size: buffer.byteLength,
        // PDF text extraction would require additional processing
        extractable: true
      };
    }

    // For text/markdown files, extract content directly
    if (contentType.includes('text') || docUrl.endsWith('.md') || docUrl.endsWith('.txt')) {
      const text = await res.text();
      return {
        url: docUrl,
        fileName,
        type: 'text',
        content: text.slice(0, 50000),
        size: text.length
      };
    }

    return {
      url: docUrl,
      fileName,
      type: 'unknown',
      contentType
    };

  } catch (e) {
    console.error('[Onboarding] Document fetch error:', e.message);
    return { error: e.message };
  }
};

/**
 * Extract DeFi-specific data (APRs, TVL, etc.) from crawled content
 */
export const extractDefiMetrics = (content) => {
  const metrics = {
    aprs: [],
    tvl: null,
    pools: [],
    tokens: []
  };

  // Extract APR/APY values
  const aprRegex = /(\d+(?:\.\d+)?)\s*%?\s*(?:APR|APY|annual)/gi;
  let match;
  while ((match = aprRegex.exec(content)) !== null) {
    const value = parseFloat(match[1]);
    if (value > 0 && value < 10000) { // Sanity check
      metrics.aprs.push({
        value,
        context: content.slice(Math.max(0, match.index - 50), match.index + 50)
      });
    }
  }

  // Extract TVL
  const tvlRegex = /TVL[:\s]*\$?([\d,.]+)\s*(M|B|K)?/gi;
  while ((match = tvlRegex.exec(content)) !== null) {
    let value = parseFloat(match[1].replace(/,/g, ''));
    const suffix = match[2]?.toUpperCase();
    if (suffix === 'B') value *= 1e9;
    else if (suffix === 'M') value *= 1e6;
    else if (suffix === 'K') value *= 1e3;
    if (!metrics.tvl || value > metrics.tvl) {
      metrics.tvl = value;
    }
  }

  // Extract pool names
  const poolRegex = /(?:pool|farm|vault)[:\s]*([A-Z]{2,10}[-\/][A-Z]{2,10})/gi;
  while ((match = poolRegex.exec(content)) !== null) {
    if (!metrics.pools.includes(match[1])) {
      metrics.pools.push(match[1]);
    }
  }

  return metrics;
};

export const fetchTwitterContent = async (handle, { maxItems = 25, brandName } = {}) => {
  const token = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN || '';
  if (!token) {
    console.log('[OnboardingTwitter] No Apify token - returning empty data (not an error)');
    return { tweets: [], tweetExamples: [], referenceImages: [], noToken: true };
  }

  // Actor definitions: primary + fallback
  const ACTORS = [
    {
      label: 'primary (twitter-scraper)',
      id: 'VsTreSuczsXhhRIqa',
      input: {
        handles: [handle],
        tweetsDesired: maxItems,
        profilesDesired: 1,
        withReplies: false,
        includeUserInfo: true,
        proxyConfig: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] }
      },
      timeout: 240000 // 4 min — runs typically take 2-3 min per Apify dashboard
    },
    {
      label: 'fallback (tweet-scraper)',
      id: '61RPP7dywgiy0JPD0',
      input: {
        twitterHandles: [handle],
        maxItems: maxItems,
        sort: 'Latest',
        tweetLanguage: 'en'
      },
      timeout: 90000
    }
  ];

  let items = null;
  let lastError = '';

  for (const actor of ACTORS) {
    console.log(`[OnboardingTwitter] Trying ${actor.label} (${actor.id}) for @${handle}...`);

    try {
      const runRes = await fetchImpl(`https://api.apify.com/v2/acts/${actor.id}/runs?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actor.input)
      });

      const runData = await runRes.json();
      console.log(`[OnboardingTwitter] ${actor.label} run started:`, {
        ok: runRes.ok,
        status: runRes.status,
        runId: runData?.data?.id,
        runStatus: runData?.data?.status,
      });

      if (!runRes.ok || !runData?.data?.id) {
        const err = runData?.error?.message || `HTTP ${runRes.status}`;
        console.warn(`[OnboardingTwitter] ${actor.label} failed to start: ${err}`);
        lastError = `${actor.label}: ${err}`;
        continue; // try next actor
      }

      const runId = runData.data.id;
      const datasetId = runData.data.defaultDatasetId;
      const startTime = Date.now();
      let runStatus = runData.data.status;

      // Poll for completion
      while (runStatus !== 'SUCCEEDED' && runStatus !== 'FAILED' && runStatus !== 'ABORTED') {
        if (Date.now() - startTime > actor.timeout) {
          console.warn(`[OnboardingTwitter] ${actor.label} timed out after ${actor.timeout / 1000}s, status: ${runStatus}`);
          // Try to abort the hanging run to save Apify credits
          try {
            await fetchImpl(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${token}`, { method: 'POST' });
            console.log(`[OnboardingTwitter] Aborted hanging run ${runId}`);
          } catch { /* ignore abort errors */ }
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
        const statusRes = await fetchImpl(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
        const statusData = await statusRes.json();
        runStatus = statusData?.data?.status || 'UNKNOWN';
      }

      console.log(`[OnboardingTwitter] ${actor.label} final status: ${runStatus}`);

      if (runStatus !== 'SUCCEEDED') {
        lastError = `${actor.label}: run ${runStatus}`;
        continue; // try next actor
      }

      // Fetch results
      const itemsRes = await fetchImpl(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
      const fetched = await itemsRes.json();

      // Check for noResults / empty
      const hasRealData = Array.isArray(fetched) && fetched.length > 0 && !fetched[0]?.noResults;
      console.log(`[OnboardingTwitter] ${actor.label} returned ${fetched?.length || 0} items, hasRealData: ${hasRealData}`);

      if (hasRealData) {
        items = fetched;
        console.log(`[OnboardingTwitter] ✓ Using results from ${actor.label}`);
        break; // success, stop trying actors
      } else {
        lastError = `${actor.label}: completed but returned no results`;
        continue; // try next actor
      }
    } catch (e) {
      console.error(`[OnboardingTwitter] ${actor.label} exception:`, e.message);
      lastError = `${actor.label}: ${e.message}`;
      continue; // try next actor
    }
  }

  // If no actor returned data, return graceful empty with error info
  if (!items || items.length === 0) {
    console.warn(`[OnboardingTwitter] All actors failed for @${handle}. Last error: ${lastError}`);
    return {
      tweets: [],
      tweetExamples: [],
      referenceImages: [],
      error: `Twitter scraping unavailable: ${lastError}`,
      warning: 'Twitter/X scraping actors are currently experiencing issues. Tweet data could not be imported — AI will generate content based on website analysis instead.'
    };
  }

  console.log('[OnboardingTwitter] Dataset items:', {
    itemsCount: items?.length || 0,
    sampleKeys: items?.[0] ? Object.keys(items[0]).slice(0, 8).join(', ') : null,
    sampleItem: items?.[0] ? { id: items[0].id, hasText: !!(items[0].text || items[0].full_text), hasImages: !!(items[0].images?.length) } : null
  });

  // Map actor output - handles BOTH primary (text, images) and fallback (full_text) formats
  // FILTER OUT retweets, quote tweets, and replies
  const tweets = (items || [])
    .filter((item) => {
      // Skip retweets, quote tweets, and replies - we only want original content
      if (item.isRetweet || item.isQuote || item.isReply) return false;
      // Fallback actor: skip items with noResults flag
      if (item.noResults) return false;
      return true;
    })
    .map((item) => {
      // Support both actor formats: primary uses `text`, fallback uses `full_text`
      const text = item.text || item.full_text || '';
      const likes = item.likes || item.favorite_count || 0;
      const retweets = item.retweets || item.retweet_count || 0;
      const replies = item.replies || item.reply_count || 0;
      const quotes = item.quotes || item.quote_count || 0;
      // Primary: images array; Fallback: entities.media
      const mediaUrls = item.images || (item.entities?.media || []).map(m => m.media_url_https || m.media_url).filter(Boolean) || [];

      const score = likes + retweets * 2 + replies * 1.5 + quotes;

      return {
        id: item.id || item.id_str || '',
        text,
        createdAt: item.timestamp || item.created_at || '',
        likes,
        retweets,
        replies,
        views: item.views || 0,
        mediaUrls,
        score
      };
    }).filter((tweet) => tweet.text && tweet.text.length > 20);

  console.log('[OnboardingTwitter] Filtered tweets (original content only):', tweets.length);

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
