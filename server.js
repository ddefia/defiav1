
import 'dotenv/config'; // Load .env file
import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { startAgent, triggerAgentRun, runBrainCycle, runBriefingCycle } from './server/agent/scheduler.js';
import { runPublishingCycle, startPublishing } from './server/publishing/scheduler.js';
import { updateAllBrands } from './server/agent/ingest.js';
import { fetchActiveBrands } from './server/agent/brandRegistry.js';
import { crawlWebsite, deepCrawlWebsite, fetchTwitterContent, uploadCarouselGraphic, fetchDocumentContent, extractDefiMetrics } from './server/onboarding.js';
import { fetchWeb3News, scheduledNewsFetch } from './server/services/web3News.js';
import { generateAndCreateQueries, CHAIN_SCHEMAS } from './server/services/dune.js';
import Stripe from 'stripe';
import { handleTelegramWebhook } from './server/telegram/webhookHandler.js';
import { generateLinkCode, getLinkedChats } from './server/telegram/linkManager.js';
import { sendMessage as sendTelegramMessage, setWebhook as setTelegramWebhook, deleteWebhook as deleteTelegramWebhook, getMe as getTelegramMe, isConfigured as isTelegramConfigured } from './server/telegram/telegramClient.js';
import { logApiUsage, estimateCost } from './server/services/usageLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ━━━ Startup Environment Validation ━━━
(() => {
    const check = (name, ...vars) => vars.some(v => !!process.env[v]);
    const status = [];

    // Gemini
    status.push(check('Gemini', 'GEMINI_API_KEY', 'VITE_GEMINI_API_KEY')
        ? '  \x1b[32m✓\x1b[0m Gemini AI'
        : '  \x1b[31m✗\x1b[0m Gemini AI — missing GEMINI_API_KEY');

    // Supabase
    const hasSupabaseUrl = check('SB', 'SUPABASE_URL', 'VITE_SUPABASE_URL');
    const hasSupabaseKey = check('SB', 'SUPABASE_KEY', 'VITE_SUPABASE_ANON_KEY');
    const hasServiceRole = check('SB', 'SUPABASE_SERVICE_ROLE_KEY');
    if (hasSupabaseUrl && hasSupabaseKey) {
        status.push(hasServiceRole
            ? '  \x1b[32m✓\x1b[0m Supabase (with service role key)'
            : '  \x1b[33m⚠\x1b[0m Supabase (anon key only — add SUPABASE_SERVICE_ROLE_KEY for full DB access)');
    } else {
        status.push('  \x1b[31m✗\x1b[0m Supabase — missing URL or key');
    }

    // Apify
    status.push(check('Apify', 'APIFY_API_TOKEN', 'VITE_APIFY_API_TOKEN')
        ? '  \x1b[32m✓\x1b[0m Apify (deep crawl, Twitter, news)'
        : '  \x1b[33m⚠\x1b[0m Apify — not configured (onboarding will use basic crawl)');

    // X/Twitter Publishing
    const hasXPub = check('X', 'X_API_KEY') && check('X', 'X_API_SECRET') && check('X', 'X_ACCESS_TOKEN') && check('X', 'X_ACCESS_SECRET');
    status.push(hasXPub
        ? '  \x1b[32m✓\x1b[0m X/Twitter publishing'
        : '  \x1b[31m✗\x1b[0m X/Twitter publishing — missing credentials (X_API_KEY etc.)');

    // X OAuth
    const hasXOAuth = check('X', 'X_CLIENT_ID') && check('X', 'X_CLIENT_SECRET');
    status.push(hasXOAuth
        ? '  \x1b[32m✓\x1b[0m X/Twitter OAuth ("Connect X" button)'
        : '  \x1b[33m⚠\x1b[0m X/Twitter OAuth — not configured (Connect X button won\'t work)');

    // Stripe
    status.push(check('Stripe', 'STRIPE_SECRET_KEY')
        ? '  \x1b[32m✓\x1b[0m Stripe billing'
        : '  \x1b[33m⚠\x1b[0m Stripe — not configured (billing disabled)');

    // Telegram Bot
    status.push(check('Telegram', 'TELEGRAM_BOT_TOKEN')
        ? '  \x1b[32m✓\x1b[0m Telegram Bot'
        : '  \x1b[33m⚠\x1b[0m Telegram Bot — not configured (TELEGRAM_BOT_TOKEN)');

    // FRONTEND_URL (critical for production)
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        status.push(process.env.FRONTEND_URL
            ? `  \x1b[32m✓\x1b[0m FRONTEND_URL: ${process.env.FRONTEND_URL}`
            : '  \x1b[31m✗\x1b[0m FRONTEND_URL — NOT SET! CORS will block ALL API requests in production!');
    }

    console.log('\n━━━ DEFIA API Status ━━━');
    status.forEach(s => console.log(s));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━\n');
})();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: restrict to known frontend origins
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ALLOWED_ORIGINS = IS_PRODUCTION
    ? [process.env.FRONTEND_URL].filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:5173'];

if (IS_PRODUCTION && !process.env.FRONTEND_URL) {
    console.error('⚠️  WARNING: FRONTEND_URL is not set. CORS will reject all cross-origin requests in production.');
}

app.use(cors({
    origin: IS_PRODUCTION ? ALLOWED_ORIGINS : true,
    credentials: true,
}));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// --- Stripe Setup ---
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const STRIPE_PRICE_TO_TIER = {
    [process.env.STRIPE_STARTER_PRICE_ID]: 'starter',
    [process.env.STRIPE_GROWTH_PRICE_ID]: 'growth',
};

// Stripe webhook MUST be registered before express.json() to get raw body
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(500).json({ error: 'Webhook secret not configured' });

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('[Stripe] Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) return res.status(500).json({ error: 'Database unavailable' });

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                if (session.mode !== 'subscription') break;
                const subscriptionId = session.subscription;
                const sub = await stripe.subscriptions.retrieve(subscriptionId);
                const priceId = sub.items.data[0]?.price?.id;
                const tier = STRIPE_PRICE_TO_TIER[priceId] || 'starter';

                await supabase.from('subscriptions').upsert({
                    id: sub.id,
                    user_id: session.metadata?.user_id || null,
                    brand_id: session.metadata?.brand_id || null,
                    stripe_customer_id: sub.customer,
                    stripe_price_id: priceId,
                    plan_tier: tier,
                    status: sub.status,
                    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
                    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                    cancel_at_period_end: sub.cancel_at_period_end,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });

                // Also sync the tier to app_storage for in-app subscription state
                if (session.metadata?.brand_id) {
                    const storageKey = `subscription_${session.metadata.brand_id}`;
                    await supabase.from('app_storage').upsert({
                        key: storageKey,
                        value: { plan: tier, status: sub.status, stripeSubscriptionId: sub.id },
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'key' });
                }
                console.log(`[Stripe] Checkout completed: ${sub.id} → ${tier}`);
                break;
            }

            case 'customer.subscription.updated': {
                const sub = event.data.object;
                const priceId = sub.items.data[0]?.price?.id;
                const tier = STRIPE_PRICE_TO_TIER[priceId] || 'starter';

                await supabase.from('subscriptions').upsert({
                    id: sub.id,
                    stripe_customer_id: sub.customer,
                    stripe_price_id: priceId,
                    plan_tier: tier,
                    status: sub.status,
                    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
                    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                    cancel_at_period_end: sub.cancel_at_period_end,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });

                // Sync tier update to app_storage
                const { data: existingSub } = await supabase
                    .from('subscriptions')
                    .select('brand_id')
                    .eq('id', sub.id)
                    .maybeSingle();
                if (existingSub?.brand_id) {
                    const storageKey = `subscription_${existingSub.brand_id}`;
                    await supabase.from('app_storage').upsert({
                        key: storageKey,
                        value: { plan: tier, status: sub.status, stripeSubscriptionId: sub.id },
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'key' });
                }
                console.log(`[Stripe] Subscription updated: ${sub.id} → ${tier} (${sub.status})`);
                break;
            }

            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                await supabase.from('subscriptions')
                    .update({ status: 'canceled', updated_at: new Date().toISOString() })
                    .eq('id', sub.id);

                const { data: existingSub } = await supabase
                    .from('subscriptions')
                    .select('brand_id')
                    .eq('id', sub.id)
                    .maybeSingle();
                if (existingSub?.brand_id) {
                    const storageKey = `subscription_${existingSub.brand_id}`;
                    await supabase.from('app_storage').upsert({
                        key: storageKey,
                        value: { plan: 'starter', status: 'canceled', stripeSubscriptionId: sub.id },
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'key' });
                }
                console.log(`[Stripe] Subscription canceled: ${sub.id}`);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                if (invoice.subscription) {
                    await supabase.from('subscriptions')
                        .update({ status: 'past_due', updated_at: new Date().toISOString() })
                        .eq('id', invoice.subscription);
                }
                console.warn(`[Stripe] Payment failed for invoice: ${invoice.id}`);
                break;
            }

            default:
                // Unhandled event type
                break;
        }
    } catch (err) {
        console.error(`[Stripe] Webhook handler error for ${event.type}:`, err);
        return res.status(500).json({ error: 'Webhook handler failed' });
    }

    res.json({ received: true });
});

app.use(express.json({ limit: '10mb' })); // Increased limit for base64 image uploads

// Basic rate limiting for API endpoints
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per IP

app.use('/api', (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(ip, { windowStart: now, count: 1 });
        return next();
    }

    record.count++;
    if (record.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    return next();
});

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap.entries()) {
        if (now - record.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
            rateLimitMap.delete(ip);
        }
    }
}, 5 * 60 * 1000);

const requestLog = [];
const pushRequestLog = (entry) => {
    requestLog.unshift(entry);
    if (requestLog.length > 200) requestLog.length = 200;
};

app.use((req, res, next) => {
    const entry = { time: new Date().toISOString(), method: req.method, path: req.path };
    res.on('finish', () => {
        pushRequestLog({ ...entry, status: res.statusCode });
    });
    next();
});

const KEY_FILE_PATH = path.join(__dirname, 'service-account.json');
const DECISIONS_FILE = path.join(__dirname, 'server/cache/decisions.json');
const CACHE_FILE = path.join(__dirname, 'server/cache/social_metrics.json');

const getSupabaseClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
};

const getSupabaseServiceClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
};

const getSupabaseAdminClient = () => getSupabaseServiceClient() || getSupabaseClient();

const normalizeHandle = (value = '') => value.replace(/^@/, '').trim();

const isValidHandle = (value = '') => /^[A-Za-z0-9_]{1,15}$/.test(normalizeHandle(value));

const normalizeDomain = (value = '') => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) {
        return `https://${trimmed}`;
    }
    return trimmed;
};

const isValidUrl = (value = '') => {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
};

const sanitizeText = (value = '') => value.trim().slice(0, 255);

const sanitizeFileName = (value = '') => value.replace(/[^a-zA-Z0-9-_\.]/g, '-').slice(0, 120);

const decodeBase64File = (input = '') => {
    const raw = input.includes('base64,') ? input.split('base64,')[1] : input;
    return Buffer.from(raw, 'base64');
};

const PUBLIC_API_PATHS = new Set([
    '/api/health',
    '/api/health/extended',
    '/api/logs',
    '/api/decisions',
    '/api/web3-news',
    '/api/tweet-oembed',
    // OAuth callbacks must be public (X won't include our API key)
    '/api/auth/x/authorize-url',
    '/api/auth/x/callback',
    '/api/auth/x/status',
    // Stripe webhook uses its own signature verification
    '/api/billing/webhook',
    // Image generation — called internally by telegram bot and client-side
    '/api/generate-image',
    '/api/generate-image-flux',
    // Vercel cron jobs — invoked by Vercel scheduler, no auth headers
    '/api/agent/run',
    '/api/agent/briefing',
    '/api/web3-news/refresh',
    '/api/social-sync',
]);

// Prefixes for dynamic routes that should be public
const PUBLIC_API_PREFIXES = [
    '/api/social-metrics/',
    '/api/action-center/',
    '/api/lunarcrush/',
    '/api/auth/x/',
    '/api/x/metrics/',
    '/api/onboarding/',
    '/api/telegram/',
];

const parseApiKeys = () => {
    const raw = process.env.DEFIA_API_KEYS || process.env.API_KEYS || '';
    return raw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const [key, ownerId] = entry.split(':').map((part) => part.trim());
            return { key, ownerId: ownerId || null };
        });
};

const timingSafeMatch = (a, b) => {
    if (!a || !b) return false;
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
};

// ---- X (Twitter) OAuth helpers (Authorization Code + PKCE) ----
const base64UrlEncode = (input) => {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlDecodeJson = (input) => {
    const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLen);
    const raw = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(raw);
};

const parseCookies = (cookieHeader) => {
    const out = {};
    const raw = String(cookieHeader || '');
    raw.split(';').map((p) => p.trim()).filter(Boolean).forEach((pair) => {
        const idx = pair.indexOf('=');
        if (idx === -1) return;
        const k = pair.slice(0, idx).trim();
        const v = pair.slice(idx + 1).trim();
        if (!k) return;
        out[k] = decodeURIComponent(v);
    });
    return out;
};

const signXState = (payload) => {
    const secret = process.env.X_OAUTH_STATE_SECRET || '';
    if (!secret) throw new Error('Missing X_OAUTH_STATE_SECRET');
    const body = base64UrlEncode(JSON.stringify(payload));
    const sig = base64UrlEncode(crypto.createHmac('sha256', secret).update(body).digest());
    return `${body}.${sig}`;
};

const verifyXState = (state) => {
    const secret = process.env.X_OAUTH_STATE_SECRET || '';
    if (!secret) throw new Error('Missing X_OAUTH_STATE_SECRET');
    const [body, sig] = String(state || '').split('.');
    if (!body || !sig) return null;
    const expected = base64UrlEncode(crypto.createHmac('sha256', secret).update(body).digest());
    if (!timingSafeMatch(expected, sig)) return null;
    return base64UrlDecodeJson(body);
};

const buildPkcePair = () => {
    const verifier = base64UrlEncode(crypto.randomBytes(32));
    const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
    return { verifier, challenge };
};

const setCookie = (res, name, value, opts = {}) => {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    parts.push(`Path=${opts.path || '/'}`);
    if (opts.httpOnly !== false) parts.push('HttpOnly');
    parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
    if (opts.secure !== false) parts.push('Secure');
    if (opts.maxAgeSeconds !== undefined) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
    res.append('Set-Cookie', parts.join('; '));
};

const clearCookie = (res, name) => setCookie(res, name, '', { maxAgeSeconds: 0 });

const refreshXToken = async (refreshToken) => {
    const clientId = process.env.X_CLIENT_ID || '';
    const clientSecret = process.env.X_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) throw new Error('X OAuth not configured');
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenBody = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
    });

    const tokenRes = await fetch(X_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basic}`,
        },
        body: tokenBody.toString(),
    });

    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.access_token) {
        const msg = tokenJson?.error_description || tokenJson?.error || 'refresh_failed';
        throw new Error(msg);
    }

    const expiresIn = typeof tokenJson.expires_in === 'number' ? tokenJson.expires_in : null;
    const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;

    return {
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token || refreshToken,
        token_type: tokenJson.token_type || null,
        scope: tokenJson.scope || null,
        expires_at: expiresAt,
    };
};

app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) return next();
    if (PUBLIC_API_PATHS.has(req.path)) return next();
    // Check if path starts with any public prefix
    if (PUBLIC_API_PREFIXES.some(prefix => req.path.startsWith(prefix))) return next();

    const apiKeys = parseApiKeys();
    // In local dev (no API keys configured), allow all requests
    if (apiKeys.length === 0) {
        // Only block in production - allow in dev for easier testing
        if (process.env.NODE_ENV === 'production') {
            return res.status(500).json({ error: 'API keys not configured' });
        }
        return next();
    }

    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const providedKey = bearer || String(req.headers['x-api-key'] || '').trim();

    if (!providedKey) {
        return res.status(401).json({ error: 'Missing API key' });
    }

    const match = apiKeys.find(({ key }) => timingSafeMatch(key, providedKey));
    if (!match) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    req.auth = { apiKey: match.key, ownerId: match.ownerId };
    return next();
});

// Auth middleware — validates Supabase JWT from Authorization header
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required. Provide a valid Bearer token.' });
    }
    const token = authHeader.replace('Bearer ', '');
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return res.status(500).json({ error: 'Auth service unavailable' });
        }
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.authUser = { id: user.id, email: user.email };
        return next();
    } catch (e) {
        console.error('Auth middleware error:', e);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

const ensureBrandOwnership = async (supabase, brandId, ownerId) => {
    const { data: brand, error } = await supabase
        .from('brands')
        .select('id, owner_id')
        .eq('id', brandId)
        .maybeSingle();

    if (error) {
        return { status: 500, error: error.message };
    }

    if (!brand) {
        return { status: 404, error: 'Brand not found' };
    }

    if (brand.owner_id && brand.owner_id !== ownerId) {
        return { status: 403, error: 'Forbidden' };
    }

    if (!brand.owner_id) {
        const { error: claimError } = await supabase
            .from('brands')
            .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
            .eq('id', brandId);
        if (claimError) {
            return { status: 500, error: claimError.message };
        }
    }

    return { status: 200 };
};

// --- Gemini API Proxy ---
// Prevents API key exposure in client bundle. Client sends request params, server adds API key and forwards.
import { GoogleGenAI } from "@google/genai";

const getGeminiApiKey = () => process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

app.post('/api/gemini/generate', async (req, res) => {
    const start = Date.now();
    try {
        const apiKey = getGeminiApiKey();
        if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured on server' });

        const { model, contents, config } = req.body;
        if (!model || !contents) return res.status(400).json({ error: 'Missing model or contents' });

        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.generateContent({ model, contents, config });

        // Extract response - handle both property and function access patterns
        const text = typeof result.text === 'string' ? result.text : typeof result.text === 'function' ? result.text() : (result.candidates?.[0]?.content?.parts?.[0]?.text || '');

        // Check for inline image data (for image generation models)
        const parts = result.candidates?.[0]?.content?.parts || [];
        const images = parts
            .filter(p => p.inlineData?.mimeType?.startsWith('image/'))
            .map(p => ({ mimeType: p.inlineData.mimeType, data: p.inlineData.data }));

        // Log API usage
        const tokensIn = result.usageMetadata?.promptTokenCount || 0;
        const tokensOut = result.usageMetadata?.candidatesTokenCount || 0;
        const imageCount = images.length;
        logApiUsage({
            provider: 'gemini', model, endpoint: '/api/gemini/generate',
            tokens_in: tokensIn, tokens_out: tokensOut,
            estimated_cost_usd: imageCount > 0
                ? estimateCost(model, tokensIn, imageCount)
                : estimateCost(model, tokensIn, tokensOut),
            user_id: req.authUser?.id || null, source: 'client-proxy',
            status_code: 200, duration_ms: Date.now() - start,
        });

        res.json({ text, images, raw: { candidates: result.candidates } });
    } catch (err) {
        console.error('[Gemini Proxy] Error:', err.message || err);
        const status = err.status || err.httpStatusCode || 500;
        logApiUsage({
            provider: 'gemini', model: req.body?.model, endpoint: '/api/gemini/generate',
            source: 'client-proxy', status_code: status, duration_ms: Date.now() - start,
            estimated_cost_usd: 0,
        });
        res.status(status).json({ error: err.message || 'Gemini API call failed' });
    }
});

app.post('/api/gemini/embed', async (req, res) => {
    const start = Date.now();
    try {
        const apiKey = getGeminiApiKey();
        if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured on server' });

        const { model, contents } = req.body;
        if (!model || !contents) return res.status(400).json({ error: 'Missing model or contents' });

        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.embedContent({ model, contents });

        logApiUsage({
            provider: 'gemini', model, endpoint: '/api/gemini/embed',
            tokens_in: 0, tokens_out: 0,
            estimated_cost_usd: estimateCost(model || 'text-embedding-004', 500, 0), // rough estimate
            user_id: req.authUser?.id || null, source: 'client-proxy',
            status_code: 200, duration_ms: Date.now() - start,
        });

        res.json({ embeddings: result.embeddings });
    } catch (err) {
        console.error('[Gemini Embed Proxy] Error:', err.message || err);
        logApiUsage({
            provider: 'gemini', model: req.body?.model, endpoint: '/api/gemini/embed',
            source: 'client-proxy', status_code: 500, duration_ms: Date.now() - start,
            estimated_cost_usd: 0,
        });
        res.status(500).json({ error: err.message || 'Gemini embed call failed' });
    }
});

// --- Health Check ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), agent: 'active' });
});

// --- Debug: Apify Status ---
app.get('/api/debug/apify-status', async (req, res) => {
    const token = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN || '';
    if (!token) {
        return res.json({ token: false, error: 'No APIFY_API_TOKEN configured' });
    }

    const actors = {
        websiteCrawler: { id: 'aYG0l9s7dbB7j3gbS', name: 'website-content-crawler' },
        twitterPrimary: { id: 'VsTreSuczsXhhRIqa', name: 'twitter-scraper (primary)' },
        twitterFallback: { id: '61RPP7dywgiy0JPD0', name: 'tweet-scraper (fallback)' },
    };

    const results = { token: true, tokenPrefix: token.slice(0, 12) + '...' };

    for (const [key, actor] of Object.entries(actors)) {
        try {
            const checkRes = await fetch(`https://api.apify.com/v2/acts/${actor.id}?token=${token}`);
            const checkData = await checkRes.json();
            results[key] = {
                id: actor.id,
                name: actor.name,
                accessible: checkRes.status === 200,
                httpStatus: checkRes.status,
                actorName: checkData?.data?.name || null,
            };
        } catch (e) {
            results[key] = {
                id: actor.id,
                name: actor.name,
                accessible: false,
                error: e.message,
            };
        }
    }

    res.json(results);
});

app.get('/api/health/extended', async (req, res) => {
    const supabase = getSupabaseClient();
    let dbStatus = 'unconfigured';
    let dbError = null;

    if (supabase) {
        try {
            const { error } = await supabase
                .from('brands')
                .select('id')
                .limit(1);
            dbStatus = error ? 'error' : 'ok';
            dbError = error?.message || null;
        } catch (e) {
            dbStatus = 'error';
            dbError = e?.message || 'Unknown error';
        }
    }

    res.json({
        status: 'ok',
        uptime: process.uptime(),
        agent: 'active',
        database: { status: dbStatus, error: dbError },
        version: process.env.npm_package_version || null
    });
});

app.get('/api/logs', (req, res) => {
    res.json({ entries: requestLog });
});

// --- X OAuth (Authorization Code + PKCE) ---
const X_OAUTH_COOKIE = 'defia_x_oauth';
const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const X_ME_URL = 'https://api.x.com/2/users/me';
const X_TWEETS_URL = 'https://api.x.com/2/users';
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN || '';

const normalizeXHandle = (value) => normalizeHandle(String(value || '')).replace(/^@/, '');

// --- Metrics Snapshot Helpers ---
const getSnapshotKey = (brandKey, daysAgo = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return `x_metrics_snapshot_${brandKey}_${d.toISOString().slice(0, 10)}`;
};

const saveMetricsSnapshot = async (supabase, brandKey, metrics) => {
    if (!supabase || !metrics) return;
    const key = getSnapshotKey(brandKey);
    try {
        await supabase.from('app_storage').upsert({
            key,
            value: {
                totalFollowers: metrics.totalFollowers,
                weeklyImpressions: metrics.weeklyImpressions,
                engagementRate: metrics.engagementRate,
                mentions: metrics.mentions,
                date: new Date().toISOString().slice(0, 10)
            },
            updated_at: new Date().toISOString()
        });
    } catch (e) {
        console.warn('[Snapshot] Failed to save:', e?.message);
    }
};

const computeComparison = async (supabase, brandKey, currentMetrics) => {
    const comparison = { period: 'vs 7 days ago', followersChange: 0, engagementChange: 0, impressionsChange: 0 };
    if (!supabase || !currentMetrics) return comparison;
    try {
        const prevKey = getSnapshotKey(brandKey, 7);
        const { data: prevRow } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', prevKey)
            .maybeSingle();
        if (prevRow?.value) {
            const prev = prevRow.value;
            if (prev.totalFollowers > 0) {
                comparison.followersChange = parseFloat((((currentMetrics.totalFollowers - prev.totalFollowers) / prev.totalFollowers) * 100).toFixed(1));
            }
            if (prev.engagementRate > 0) {
                comparison.engagementChange = parseFloat((((currentMetrics.engagementRate - prev.engagementRate) / prev.engagementRate) * 100).toFixed(1));
            }
            if (prev.weeklyImpressions > 0) {
                comparison.impressionsChange = parseFloat((((currentMetrics.weeklyImpressions - prev.weeklyImpressions) / prev.weeklyImpressions) * 100).toFixed(1));
            }
        }
    } catch (e) {
        console.warn('[Snapshot] Failed to compute comparison:', e?.message);
    }
    return comparison;
};

const buildXMetricsPayload = (user, tweets = []) => {
    const recentPosts = tweets.map((t) => {
        const metrics = t.public_metrics || {};
        const likes = metrics.like_count || 0;
        const retweets = metrics.retweet_count || 0;
        const comments = metrics.reply_count || 0;
        const quotes = metrics.quote_count || 0;
        const impressions = metrics.impression_count || 0;
        const engagements = likes + retweets + comments + quotes;
        const followers = user?.public_metrics?.followers_count || 0;
        const engagementRate = followers > 0 ? (engagements / followers) * 100 : 0;
        return {
            id: t.id,
            content: t.text || '',
            date: t.created_at ? new Date(t.created_at).toLocaleDateString() : 'Recent',
            likes,
            comments,
            retweets,
            impressions: impressions > 0 ? impressions : engagements,
            engagementRate: parseFloat(engagementRate.toFixed(2)),
            url: `https://x.com/${user?.username || 'x'}/status/${t.id}`
        };
    });

    const followersCount = user?.public_metrics?.followers_count || 0;
    const totalEngagements = recentPosts.reduce((sum, p) => sum + p.likes + p.retweets + p.comments, 0);
    const avgEngagementRate = recentPosts.length > 0 && followersCount > 0
        ? (totalEngagements / recentPosts.length / followersCount) * 100
        : 0;

    // Build engagement history from actual post data (one point per post)
    const engagementHistory = recentPosts.map(p => ({
        date: p.date,
        rate: p.engagementRate,
        impressions: p.impressions,
        engagements: p.likes + p.retweets + p.comments
    })).reverse();

    const weeklyImpressions = recentPosts.reduce((sum, p) => sum + p.impressions, 0);
    const mentionCount = recentPosts.reduce((sum, p) => sum + p.comments, 0);

    const metrics = {
        totalFollowers: followersCount,
        weeklyImpressions,
        engagementRate: parseFloat(avgEngagementRate.toFixed(2)),
        mentions: mentionCount,
        topPost: recentPosts[0]?.content || 'No recent posts found',
        recentPosts,
        engagementHistory,
        comparison: { period: 'vs Last Week', followersChange: 0, engagementChange: 0, impressionsChange: 0 },
        isLive: true
    };

    return { metrics, recentPosts, followersCount };
};

const fetchXUserByHandle = async (handle, bearer) => {
    const res = await fetch(`https://api.x.com/2/users/by/username/${handle}?user.fields=public_metrics,username,verified`, {
        headers: { 'Authorization': `Bearer ${bearer}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.data?.id) {
        throw new Error('Failed to fetch X user profile');
    }
    return json.data;
};

const fetchXRecentTweets = async (userId, bearer) => {
    const res = await fetch(`${X_TWEETS_URL}/${userId}/tweets?max_results=5&tweet.fields=public_metrics,created_at`, {
        headers: { 'Authorization': `Bearer ${bearer}` },
    });
    const json = await res.json().catch(() => ({}));
    return Array.isArray(json?.data) ? json.data : [];
};

app.post('/api/auth/x/authorize-url', async (req, res) => {
    try {
        const { brandId } = req.body || {};
        const normalizedBrandId = sanitizeText(String(brandId || ''));
        if (!normalizedBrandId) return res.status(400).json({ error: 'brandId is required' });

        const clientId = process.env.X_CLIENT_ID || '';
        const redirectUri = process.env.X_REDIRECT_URI || '';
        const scopes = (process.env.X_SCOPES || 'users.read tweet.read offline.access').trim();
        if (!clientId || !redirectUri) {
            return res.status(500).json({ error: 'X OAuth not configured (missing X_CLIENT_ID/X_REDIRECT_URI)' });
        }

        const nonce = base64UrlEncode(crypto.randomBytes(16));
        const state = signXState({ brandId: normalizedBrandId, nonce, iat: Date.now() });
        const { verifier, challenge } = buildPkcePair();

        // Bind the flow to this browser/session.
        setCookie(res, X_OAUTH_COOKIE, JSON.stringify({ v: verifier, n: nonce }), { maxAgeSeconds: 10 * 60 });

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scopes,
            state,
            code_challenge: challenge,
            code_challenge_method: 'S256',
        });

        return res.json({ url: `${X_AUTHORIZE_URL}?${params.toString()}` });
    } catch (e) {
        console.error('[XOAuth] authorize-url failed:', e);
        return res.status(500).json({ error: 'Failed to start X OAuth' });
    }
});

app.get('/api/auth/x/status', async (req, res) => {
    const brandId = sanitizeText(String(req.query.brandId || ''));
    if (!brandId) return res.status(400).json({ error: 'brandId is required' });

    const supabase = getSupabaseServiceClient() || getSupabaseClient();
    if (!supabase) return res.json({ connected: false, reason: 'supabase_unconfigured' });

    const key = `x_oauth_tokens_${brandId.toLowerCase()}`;
    try {
        let { data, error } = await supabase
            .from('app_storage')
            .select('value, updated_at')
            .eq('key', key)
            .maybeSingle();
        if (!data?.value) {
            const { data: brandRow } = await supabase
                .from('brands')
                .select('name')
                .eq('id', brandId)
                .maybeSingle();
            if (brandRow?.name) {
                const fallbackKey = `x_oauth_tokens_${sanitizeText(brandRow.name).toLowerCase()}`;
                if (fallbackKey !== key) {
                    const fallback = await supabase
                        .from('app_storage')
                        .select('value, updated_at')
                        .eq('key', fallbackKey)
                        .maybeSingle();
                    data = fallback.data || data;
                    error = fallback.error || error;
                }
            }
        }
        if (error || !data?.value) return res.json({ connected: false });
        const value = data.value || {};
        return res.json({
            connected: !!value.access_token,
            username: value?.user?.username || null,
            userId: value?.user?.id || null,
            scope: value?.scope || null,
            expiresAt: value?.expires_at || null,
            updatedAt: data.updated_at || null,
        });
    } catch (e) {
        console.error('[XOAuth] status failed:', e);
        return res.status(500).json({ connected: false, error: 'status_failed' });
    }
});

app.get('/api/auth/x/callback', async (req, res) => {
    try {
        const error = String(req.query.error || '');
        if (error) {
            clearCookie(res, X_OAUTH_COOKIE);
            return res.redirect(302, '/settings');
        }

        const code = String(req.query.code || '');
        const state = String(req.query.state || '');
        if (!code || !state) return res.status(400).send('Missing code/state');

        const decodedState = verifyXState(state);
        if (!decodedState?.brandId || !decodedState?.nonce) return res.status(400).send('Invalid state');

        const cookies = parseCookies(req.headers.cookie || '');
        let flow = null;
        try {
            flow = cookies[X_OAUTH_COOKIE] ? JSON.parse(cookies[X_OAUTH_COOKIE]) : null;
        } catch {
            flow = null;
        }
        const verifier = flow?.v;
        const nonce = flow?.n;
        if (!verifier || !nonce || nonce !== decodedState.nonce) {
            return res.status(400).send('OAuth session expired. Please retry Connect X.');
        }

        const clientId = process.env.X_CLIENT_ID || '';
        const clientSecret = process.env.X_CLIENT_SECRET || '';
        const redirectUri = process.env.X_REDIRECT_URI || '';
        if (!clientId || !clientSecret || !redirectUri) {
            return res.status(500).send('X OAuth not configured');
        }

        const tokenBody = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            code_verifier: verifier,
        });

        const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenRes = await fetch(X_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basic}`,
            },
            body: tokenBody.toString(),
        });

        const tokenJson = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tokenJson.access_token) {
            console.error('[XOAuth] token exchange failed:', tokenRes.status, tokenJson);
            clearCookie(res, X_OAUTH_COOKIE);
            return res.redirect(302, '/settings');
        }

        const accessToken = tokenJson.access_token;
        const refreshToken = tokenJson.refresh_token || null;
        const expiresIn = typeof tokenJson.expires_in === 'number' ? tokenJson.expires_in : null;
        const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;

        const meRes = await fetch(`${X_ME_URL}?user.fields=public_metrics,username,verified`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const meJson = await meRes.json().catch(() => ({}));

        const supabase = getSupabaseServiceClient() || getSupabaseClient();
        if (!supabase) {
            console.error('[XOAuth] Supabase not configured; cannot persist tokens');
            clearCookie(res, X_OAUTH_COOKIE);
            return res.redirect(302, '/settings');
        }

        const brandId = sanitizeText(String(decodedState.brandId));
        const key = `x_oauth_tokens_${brandId.toLowerCase()}`;
        const value = {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: tokenJson.token_type || null,
            scope: tokenJson.scope || null,
            expires_at: expiresAt,
            user: meJson?.data ? { id: meJson.data.id, username: meJson.data.username, verified: meJson.data.verified } : null,
            updated_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
            .from('app_storage')
            .upsert({ key, value, updated_at: new Date().toISOString() });
        if (upsertError) console.error('[XOAuth] token persist failed:', upsertError);

        clearCookie(res, X_OAUTH_COOKIE);
        return res.redirect(302, '/settings');
    } catch (e) {
        console.error('[XOAuth] callback failed:', e);
        clearCookie(res, X_OAUTH_COOKIE);
        return res.redirect(302, '/settings');
    }
});

app.get('/api/x/metrics/:brand', requireAuth, async (req, res) => {
    const brandParam = sanitizeText(String(req.params.brand || ''));
    const forceRefresh = String(req.query.refresh || '') === 'true';
    if (!brandParam) return res.status(400).json({ error: 'brandId is required' });

    const supabase = getSupabaseServiceClient() || getSupabaseClient();
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

    const now = Date.now();
    let resolvedBrandId = null;
    let resolvedBrandName = null;

    try {
        const byId = await supabase.from('brands').select('id, name, slug').eq('id', brandParam).maybeSingle();
        if (byId?.data?.id) {
            resolvedBrandId = byId.data.id;
            resolvedBrandName = byId.data.name;
        } else {
            const slug = brandParam.toLowerCase().replace(/\s+/g, '-');
            const bySlug = await supabase.from('brands').select('id, name, slug').eq('slug', slug).maybeSingle();
            if (bySlug?.data?.id) {
                resolvedBrandId = bySlug.data.id;
                resolvedBrandName = bySlug.data.name;
            } else {
                const byName = await supabase.from('brands').select('id, name, slug').ilike('name', brandParam).maybeSingle();
                if (byName?.data?.id) {
                    resolvedBrandId = byName.data.id;
                    resolvedBrandName = byName.data.name;
                }
            }
        }
    } catch (e) {
        console.warn('[XMetrics] Brand resolve skipped:', e?.message || e);
    }

    const primaryKey = (resolvedBrandId || brandParam).toLowerCase();
    const cacheKey = `x_metrics_cache_${primaryKey}`;
    const tokenKey = `x_oauth_tokens_${primaryKey}`;

    const requestedHandle = normalizeXHandle(req.query.handle);
    let handle = isValidHandle(requestedHandle) ? requestedHandle : '';

    try {
        if (!forceRefresh) {
            const { data: cacheRow } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', cacheKey)
                .maybeSingle();
            if (cacheRow?.value?.metrics && cacheRow.value.lastFetched && (now - cacheRow.value.lastFetched) < 15 * 60 * 1000) {
                const cachedHandle = normalizeXHandle(cacheRow.value.handle || cacheRow.value.username || '');
                const requestedHandle = normalizeXHandle(req.query.handle);
                if (requestedHandle && cachedHandle && requestedHandle.toLowerCase() !== cachedHandle.toLowerCase()) {
                    // Handle changed, skip cache to prevent stale account metrics.
                } else {
                return res.json({ connected: true, source: 'cache', metrics: cacheRow.value.metrics });
                }
            }
        }

        let tokenValue = null;
        const { data: tokenRow } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', tokenKey)
            .maybeSingle();
        tokenValue = tokenRow?.value || null;

        if (!tokenValue?.access_token && resolvedBrandName) {
            const fallbackKey = `x_oauth_tokens_${sanitizeText(resolvedBrandName).toLowerCase()}`;
            if (fallbackKey !== tokenKey) {
                const { data: fallbackRow } = await supabase
                    .from('app_storage')
                    .select('value')
                    .eq('key', fallbackKey)
                    .maybeSingle();
                if (fallbackRow?.value?.access_token) {
                    tokenValue = fallbackRow.value;
                }
            }
        }

        if (!handle && resolvedBrandId) {
            const { data: integrationRow } = await supabase
                .from('brand_integrations')
                .select('apify_handle')
                .eq('brand_id', resolvedBrandId)
                .maybeSingle();
            const integrationHandle = normalizeXHandle(integrationRow?.apify_handle || '');
            if (isValidHandle(integrationHandle)) {
                handle = integrationHandle;
            }
        }

        const connectedUsername = tokenValue?.user?.username || '';
        const handleMatchesConnected = handle && connectedUsername
            ? handle.toLowerCase() === connectedUsername.toLowerCase()
            : false;

        if (tokenValue?.access_token && (!handle || handleMatchesConnected)) {
            const expiresAt = tokenValue.expires_at || null;
            if (expiresAt && expiresAt < (now + 60 * 1000) && tokenValue.refresh_token) {
                try {
                    const refreshed = await refreshXToken(tokenValue.refresh_token);
                    tokenValue = { ...tokenValue, ...refreshed };
                    await supabase
                        .from('app_storage')
                        .upsert({ key: tokenKey, value: tokenValue, updated_at: new Date().toISOString() });
                } catch (e) {
                    console.warn('[XMetrics] refresh failed:', e.message);
                }
            }

            let meRes = await fetch(`${X_ME_URL}?user.fields=public_metrics,username,verified`, {
                headers: { 'Authorization': `Bearer ${tokenValue.access_token}` },
            });
            if (meRes.status === 401 && tokenValue.refresh_token) {
                const refreshed = await refreshXToken(tokenValue.refresh_token);
                tokenValue = { ...tokenValue, ...refreshed };
                await supabase
                    .from('app_storage')
                    .upsert({ key: tokenKey, value: tokenValue, updated_at: new Date().toISOString() });
                meRes = await fetch(`${X_ME_URL}?user.fields=public_metrics,username,verified`, {
                    headers: { 'Authorization': `Bearer ${tokenValue.access_token}` },
                });
            }

            const meJson = await meRes.json().catch(() => ({}));
            if (!meRes.ok || !meJson?.data?.id) {
                return res.status(500).json({ error: 'Failed to fetch X user profile' });
            }

            const user = meJson.data;
            const tweets = await fetchXRecentTweets(user.id, tokenValue.access_token);
            const { metrics, followersCount } = buildXMetricsPayload(user, tweets);

            // Save daily snapshot + compute week-over-week comparison
            await saveMetricsSnapshot(supabase, primaryKey, metrics);
            metrics.comparison = await computeComparison(supabase, primaryKey, metrics);

            await supabase
                .from('app_storage')
                .upsert({
                    key: cacheKey,
                    value: { metrics, lastFetched: now, handle: user.username },
                    updated_at: new Date().toISOString()
                });

            return res.json({
                connected: true,
                source: 'x',
                user: {
                    id: user.id,
                    username: user.username,
                    verified: user.verified || false,
                    followers: followersCount,
                    following: user.public_metrics?.following_count || 0,
                    tweetCount: user.public_metrics?.tweet_count || 0
                },
                metrics
            });
        }

        if (X_BEARER_TOKEN && handle) {
            const user = await fetchXUserByHandle(handle, X_BEARER_TOKEN);
            const tweets = await fetchXRecentTweets(user.id, X_BEARER_TOKEN);
            const { metrics, followersCount } = buildXMetricsPayload(user, tweets);

            // Save daily snapshot + compute week-over-week comparison
            await saveMetricsSnapshot(supabase, primaryKey, metrics);
            metrics.comparison = await computeComparison(supabase, primaryKey, metrics);

            await supabase
                .from('app_storage')
                .upsert({
                    key: cacheKey,
                    value: { metrics, lastFetched: now, handle: user.username || handle },
                    updated_at: new Date().toISOString()
                });

            return res.json({
                connected: false,
                source: 'x_app',
                user: {
                    id: user.id,
                    username: user.username,
                    verified: user.verified || false,
                    followers: followersCount,
                    following: user.public_metrics?.following_count || 0,
                    tweetCount: user.public_metrics?.tweet_count || 0
                },
                metrics
            });
        }

        return res.json({ connected: false });
    } catch (e) {
        console.error('[XMetrics] Failed:', e);
        return res.status(500).json({ error: 'Failed to fetch X metrics' });
    }
});

// --- Onboarding: Website Crawl (Simple) ---
app.post('/api/onboarding/crawl', requireAuth, async (req, res) => {
    try {
        const { url, maxPages } = req.body || {};
        const normalized = normalizeDomain(String(url || ''));
        if (!normalized || !isValidUrl(normalized)) {
            return res.status(400).json({ error: 'Valid URL is required.' });
        }

        const result = await crawlWebsite(normalized, {
            maxPages: typeof maxPages === 'number' ? Math.min(Math.max(maxPages, 1), 15) : undefined
        });
        return res.json(result);
    } catch (e) {
        console.error('[OnboardingCrawl] Failed:', e);
        return res.status(500).json({ error: 'Website crawl failed.' });
    }
});

// --- Onboarding: Deep Website Crawl (Apify-powered) ---
// This crawls extensively including docs subdomain, extracts knowledge base entries
app.post('/api/onboarding/deep-crawl', requireAuth, async (req, res) => {
    try {
        const { url, maxPages, maxDepth, includeDocsSubdomain } = req.body || {};
        const normalized = normalizeDomain(String(url || ''));
        if (!normalized || !isValidUrl(normalized)) {
            return res.status(400).json({ error: 'Valid URL is required.' });
        }

        const apifyToken = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN || '';
        console.log(`[DeepCrawl] Starting deep crawl of ${normalized} (Apify token: ${apifyToken ? 'present' : 'MISSING'})`);

        const result = await deepCrawlWebsite(normalized, {
            maxPages: typeof maxPages === 'number' ? Math.min(Math.max(maxPages, 10), 100) : 50,
            maxDepth: typeof maxDepth === 'number' ? Math.min(Math.max(maxDepth, 3), 20) : 10,
            includeDocsSubdomain: includeDocsSubdomain !== false,
            waitForFinishSecs: 300
        });

        // Extract DeFi metrics from the content
        if (result.content) {
            result.defiMetrics = extractDefiMetrics(result.content);
        }

        console.log(`[DeepCrawl] Result:`, {
            pages: result.pages?.length || 0,
            knowledgeBase: result.knowledgeBase?.length || 0,
            contentLength: result.content?.length || 0,
            images: result.crawledImages?.length || 0,
            docs: result.docs?.length || 0
        });

        return res.json(result);
    } catch (e) {
        console.error('[DeepCrawl] Failed:', e);
        return res.status(500).json({ error: 'Deep crawl failed.' });
    }
});

// --- Onboarding: Fetch Document Content ---
app.post('/api/onboarding/fetch-document', requireAuth, async (req, res) => {
    try {
        const { url } = req.body || {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Document URL is required.' });
        }

        const result = await fetchDocumentContent(url);
        return res.json(result);
    } catch (e) {
        console.error('[FetchDocument] Failed:', e);
        return res.status(500).json({ error: 'Document fetch failed.' });
    }
});

// --- Onboarding: Twitter Scrape ---
app.post('/api/onboarding/twitter', requireAuth, async (req, res) => {
    try {
        const { handle, maxItems, brandName } = req.body || {};
        const normalizedHandle = normalizeHandle(String(handle || ''));
        console.log('[OnboardingTwitter] Request received:', { handle, normalizedHandle, brandName });

        if (!normalizedHandle || !isValidHandle(normalizedHandle)) {
            return res.status(400).json({ error: 'Valid X/Twitter handle is required.' });
        }

        const result = await fetchTwitterContent(normalizedHandle, {
            maxItems: typeof maxItems === 'number' ? Math.min(Math.max(maxItems, 5), 50) : undefined,
            brandName: brandName ? String(brandName) : undefined
        });

        console.log('[OnboardingTwitter] Result:', {
            tweetsCount: result.tweets?.length,
            tweetExamplesCount: result.tweetExamples?.length,
            referenceImagesCount: result.referenceImages?.length,
            sampleImage: result.referenceImages?.[0]
        });

        if (result.error) {
            console.warn('[OnboardingTwitter] Apify error (returning empty gracefully):', result.error);
            // Return success with empty data instead of error — frontend handles empty arrays gracefully
            return res.json({
                tweets: result.tweets || [],
                tweetExamples: result.tweetExamples || [],
                referenceImages: result.referenceImages || [],
                warning: result.error
            });
        }
        return res.json(result);
    } catch (e) {
        console.error('[OnboardingTwitter] Failed:', e);
        return res.status(500).json({ error: 'Twitter scrape failed.' });
    }
});

// --- Onboarding: Carousel Upload ---
app.post('/api/onboarding/carousel-upload', requireAuth, async (req, res) => {
    try {
        const { brandName, imageData, imageId } = req.body || {};
        if (!brandName || !imageData) {
            return res.status(400).json({ error: 'brandName and imageData are required.' });
        }

        const result = await uploadCarouselGraphic({
            brandName: String(brandName),
            imageData: String(imageData),
            imageId: imageId ? String(imageId) : undefined
        });

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        return res.json({ publicUrl: result.publicUrl });
    } catch (e) {
        console.error('[OnboardingCarousel] Failed:', e);
        return res.status(500).json({ error: 'Carousel upload failed.' });
    }
});

app.post('/api/brands/register', requireAuth, async (req, res) => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
        const { name, websiteUrl, sources = {}, config, enrichment } = req.body || {};
        const ownerId = req.auth?.ownerId || null;
        const normalizedName = sanitizeText(name || '');

        if (!normalizedName || normalizedName.length < 2) {
            return res.status(400).json({ error: 'Brand name is required.' });
        }

        const { data: existingBrand } = await supabase
            .from('brands')
            .select('id, name, owner_id')
            .ilike('name', normalizedName)
            .maybeSingle();

        if (existingBrand) {
            if (existingBrand.owner_id && ownerId && existingBrand.owner_id !== ownerId) {
                return res.status(403).json({ error: 'Brand already exists for another owner.' });
            }
            return res.json({ id: existingBrand.id, name: existingBrand.name });
        }

        const domains = Array.isArray(sources.domains) ? sources.domains : [];
        const xHandles = Array.isArray(sources.xHandles) ? sources.xHandles : [];
        const youtube = sources.youtube ? String(sources.youtube) : null;

        const normalizedDomains = domains
            .map((domain) => normalizeDomain(String(domain)))
            .filter(Boolean)
            .filter(isValidUrl);

        const normalizedHandles = xHandles
            .map((handle) => normalizeHandle(String(handle)))
            .filter((handle) => handle && isValidHandle(handle));

        if (normalizedDomains.length === 0) {
            return res.status(400).json({ error: 'At least one valid domain is required.' });
        }

        const website = websiteUrl ? normalizeDomain(String(websiteUrl)) : normalizedDomains[0];
        if (website && !isValidUrl(website)) {
            return res.status(400).json({ error: 'Website URL is invalid.' });
        }

        const { data: brand, error: brandError } = await supabase
            .from('brands')
            .insert({
                owner_id: ownerId ? sanitizeText(ownerId) : null,
                name: normalizedName,
                slug: normalizedName.toLowerCase().replace(/\s+/g, '-'),
                website_url: website || null,
                updated_at: new Date().toISOString()
            })
            .select('id, name')
            .single();

        if (brandError) {
            return res.status(500).json({ error: brandError.message });
        }

        const sourceRows = [
            ...normalizedDomains.map((domain) => ({
                brand_id: brand.id,
                source_type: 'domain',
                value: domain,
                normalized_value: domain.toLowerCase()
            })),
            ...normalizedHandles.map((handle) => ({
                brand_id: brand.id,
                source_type: 'x_handle',
                value: `@${handle}`,
                normalized_value: handle
            }))
        ];

        if (youtube) {
            sourceRows.push({
                brand_id: brand.id,
                source_type: 'youtube',
                value: youtube,
                normalized_value: youtube
            });
        }

        if (sourceRows.length > 0) {
            const { error: sourcesError } = await supabase
                .from('brand_sources')
                .upsert(sourceRows, { onConflict: 'brand_id,source_type,normalized_value' });
            if (sourcesError) {
                console.warn('[BrandRegister] Failed to insert sources:', sourcesError.message);
            }
        }

        const primaryHandle = normalizedHandles[0];
        if (primaryHandle) {
            const { error: integrationError } = await supabase
                .from('brand_integrations')
                .upsert(
                    { brand_id: brand.id, apify_handle: primaryHandle },
                    { onConflict: 'brand_id' }
                );
            if (integrationError) {
                console.warn('[BrandRegister] Failed to upsert integrations:', integrationError.message);
            }
        }

        if (config) {
            const { error: configError } = await supabase
                .from('brand_configs')
                .insert({ brand_id: brand.id, config });
            if (configError) {
                console.warn('[BrandRegister] Failed to insert config:', configError.message);
            }
        }

        if (enrichment) {
            const { error: enrichError } = await supabase
                .from('brand_enrichments')
                .insert({
                    brand_id: brand.id,
                    mode: enrichment.mode || null,
                    summary: enrichment.summary || null,
                    raw_profile: enrichment.profile || enrichment
                });
            if (enrichError) {
                console.warn('[BrandRegister] Failed to insert enrichment:', enrichError.message);
            }
        }

        return res.json({ id: brand.id, name: brand.name });
    } catch (e) {
        console.error('[BrandRegister] Unexpected error:', e);
        return res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/brands/resolve', requireAuth, async (req, res) => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
        const { name, websiteUrl, sources = {} } = req.body || {};
        const ownerId = req.authUser?.id || req.auth?.ownerId || null;
        const normalizedName = sanitizeText(name || '');
        if (!normalizedName || normalizedName.length < 2) {
            return res.status(400).json({ error: 'Brand name is required.' });
        }

        const { data: existingBrand } = await supabase
            .from('brands')
            .select('id, name, owner_id')
            .ilike('name', normalizedName)
            .maybeSingle();

        if (existingBrand) {
            if (existingBrand.owner_id && ownerId && existingBrand.owner_id !== ownerId) {
                return res.status(403).json({ error: 'Brand already exists for another owner.' });
            }
            // Claim unclaimed brand for the authenticated user
            if (!existingBrand.owner_id && ownerId) {
                await supabase.from('brands')
                    .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
                    .eq('id', existingBrand.id);
            }
            return res.json({ id: existingBrand.id, name: existingBrand.name });
        }

        const domains = Array.isArray(sources.domains) ? sources.domains : [];
        const normalizedDomains = domains
            .map((domain) => normalizeDomain(String(domain)))
            .filter(Boolean)
            .filter(isValidUrl);

        if (normalizedDomains.length === 0) {
            return res.status(400).json({ error: 'Brand not found. Provide at least one valid domain to create.' });
        }

        const website = websiteUrl ? normalizeDomain(String(websiteUrl)) : normalizedDomains[0];

        const { data: brand, error: brandError } = await supabase
            .from('brands')
            .insert({
                owner_id: ownerId ? sanitizeText(ownerId) : null,
                name: normalizedName,
                slug: normalizedName.toLowerCase().replace(/\s+/g, '-'),
                website_url: website || null,
                updated_at: new Date().toISOString()
            })
            .select('id, name')
            .single();

        if (brandError) {
            return res.status(500).json({ error: brandError.message });
        }

        return res.json({ id: brand.id, name: brand.name });
    } catch (e) {
        console.error('[BrandResolve] Unexpected error:', e);
        return res.status(500).json({ error: 'Brand resolve failed' });
    }
});

// ── Dune: Auto-generate queries from contract addresses ──────────
app.post('/api/dune/generate-queries', requireAuth, async (req, res) => {
    try {
        const { duneApiKey, contracts, brandName } = req.body || {};

        if (!duneApiKey || typeof duneApiKey !== 'string') {
            return res.json({ success: false, error: 'Dune API key is required' });
        }
        if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
            return res.json({ success: false, error: 'At least one contract is required' });
        }
        if (!brandName || typeof brandName !== 'string') {
            return res.json({ success: false, error: 'Brand name is required' });
        }

        // Validate contracts have supported chains
        const supported = contracts.filter(c => c.chain && CHAIN_SCHEMAS[c.chain]);
        if (supported.length === 0) {
            const chains = [...new Set(contracts.map(c => c.chain).filter(Boolean))];
            return res.json({
                success: false,
                error: `No supported chains found. Supported: ${Object.keys(CHAIN_SCHEMAS).join(', ')}. Got: ${chains.join(', ') || 'none'}`,
            });
        }

        console.log(`[Dune] Generating queries for ${brandName} (${supported.length} contracts)`);
        const queryIds = await generateAndCreateQueries(duneApiKey, supported, brandName);
        console.log(`[Dune] Generated query IDs:`, queryIds);

        return res.json({ success: true, queryIds });
    } catch (e) {
        console.error('[Dune] Generate queries error:', e.message);
        return res.json({ success: false, error: e.message || 'Failed to generate Dune queries' });
    }
});

app.patch('/api/brands/:id/integrations', requireAuth, async (req, res) => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
        const brandId = req.params.id;
        const ownerId = req.authUser?.id || req.auth?.ownerId;
        if (!ownerId) {
            return res.status(403).json({ error: 'Authentication required' });
        }

        const ownership = await ensureBrandOwnership(supabase, brandId, ownerId);
        if (ownership.status !== 200) {
            return res.status(ownership.status).json({ error: ownership.error });
        }

        const { apifyHandle, lunarcrushSymbol, duneQueryIds, xApiKey, xApiSecret, xAccessToken, xAccessSecret } = req.body || {};

        const normalizedHandle = apifyHandle ? normalizeHandle(String(apifyHandle)) : null;
        if (normalizedHandle && !isValidHandle(normalizedHandle)) {
            return res.status(400).json({ error: 'Invalid Apify/X handle.' });
        }

        const { data: existing } = await supabase
            .from('brand_integrations')
            .select('metadata')
            .eq('brand_id', brandId)
            .maybeSingle();

        const metadata = existing?.metadata || {};
        if (xApiKey && xApiSecret && xAccessToken && xAccessSecret) {
            metadata.xCredentials = {
                apiKey: String(xApiKey),
                apiSecret: String(xApiSecret),
                accessToken: String(xAccessToken),
                accessSecret: String(xAccessSecret),
                updatedAt: new Date().toISOString()
            };
        }

        const payload = {
            brand_id: brandId,
            apify_handle: normalizedHandle || null,
            lunarcrush_symbol: lunarcrushSymbol ? sanitizeText(String(lunarcrushSymbol)) : null,
            dune_query_ids: duneQueryIds || null,
            metadata: Object.keys(metadata).length ? metadata : null,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('brand_integrations')
            .upsert(payload, { onConflict: 'brand_id' })
            .select('brand_id, apify_handle, lunarcrush_symbol, dune_query_ids')
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.json({ integration: data });
    } catch (e) {
        console.error('[BrandIntegrations] Unexpected error:', e);
        return res.status(500).json({ error: 'Failed to update integrations' });
    }
});

// --- Agent Trigger (Immediate Brain Cycle) ---
app.post('/api/agent/trigger', requireAuth, async (req, res) => {
    try {
        const { brandId, brandName } = req.body || {};
        const target = brandId || brandName;
        if (!target) {
            return res.status(400).json({ error: 'brandId or brandName is required.' });
        }

        const result = await triggerAgentRun(target);
        if (result?.error) {
            return res.status(400).json({ error: result.error });
        }

        return res.json(result);
    } catch (e) {
        console.error('[AgentTrigger] Failed:', e);
        return res.status(500).json({ error: 'Agent trigger failed.' });
    }
});

// --- Agent Run (Always-On Cron Entry) ---
app.get('/api/agent/run', async (req, res) => {
    try {
        const brandId = req.query.brandId;
        const label = req.query.label || 'API Decision Scan';
        const runPromise = runBrainCycle({ label, brandIdentifier: brandId });
        const timeoutMs = 55 * 1000;
        const timeoutResult = await Promise.race([
            runPromise,
            new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), timeoutMs))
        ]);

        if (timeoutResult && timeoutResult.timeout) {
            runPromise.catch((err) => console.error('[AgentRun] Background run failed:', err));
            return res.status(202).json({
                status: 'pending',
                message: 'Brain cycle still running. Try again shortly.',
                timeoutMs
            });
        }

        return res.json(timeoutResult);
    } catch (e) {
        console.error('[AgentRun] Failed:', e);
        return res.status(500).json({ error: 'Agent run failed.' });
    }
});

// --- Briefing Generation (Daily Briefing + Telegram Push) ---
app.get('/api/agent/briefing', async (req, res) => {
    try {
        const label = req.query.label || 'Scheduled Briefing';
        const runPromise = runBriefingCycle({ label });
        const timeoutMs = 55 * 1000;
        const timeoutResult = await Promise.race([
            runPromise,
            new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), timeoutMs))
        ]);

        if (timeoutResult && timeoutResult.timeout) {
            runPromise.catch((err) => console.error('[Briefing] Background run failed:', err));
            return res.status(202).json({
                status: 'pending',
                message: 'Briefing generation still running.',
                timeoutMs
            });
        }

        return res.json(timeoutResult);
    } catch (e) {
        console.error('[Briefing] Failed:', e);
        return res.status(500).json({ error: 'Briefing run failed.' });
    }
});

// --- Social Sync (Vercel Cron) ---
app.get('/api/social-sync', async (req, res) => {
    try {
        const apifyKey = process.env.APIFY_API_TOKEN;
        if (!apifyKey) return res.status(500).json({ error: 'No Apify key' });

        const supabase = getSupabaseClient();
        const activeBrands = supabase ? await fetchActiveBrands(supabase) : [];
        if (activeBrands.length === 0) {
            return res.json({ success: true, message: 'No active brands' });
        }

        const runPromise = updateAllBrands(apifyKey, activeBrands);
        const timeoutMs = 55 * 1000;
        const timeoutResult = await Promise.race([
            runPromise.then(() => ({ done: true })),
            new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), timeoutMs))
        ]);

        if (timeoutResult?.timeout) {
            runPromise.catch((err) => console.error('[SocialSync] Background run failed:', err));
            return res.status(202).json({ status: 'pending', message: 'Social sync still running.' });
        }

        return res.json({ success: true, brands: activeBrands.length });
    } catch (e) {
        console.error('[SocialSync] Failed:', e);
        return res.status(500).json({ error: 'Social sync failed.' });
    }
});

// --- Publishing Run (Scheduled Posts) ---
app.get('/api/publish/run', async (req, res) => {
    try {
        const brandId = req.query.brandId;
        const label = req.query.label || 'API Publish Run';
        const result = await runPublishingCycle({ label, brandIdentifier: brandId });
        return res.json(result);
    } catch (e) {
        console.error('[PublishRun] Failed:', e);
        return res.status(500).json({ error: 'Publish run failed.' });
    }
});

app.patch('/api/brands/:id/automation', requireAuth, async (req, res) => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
        const brandId = req.params.id;
        const ownerId = req.authUser?.id || req.auth?.ownerId;
        if (!ownerId) {
            return res.status(403).json({ error: 'Authentication required' });
        }

        const ownership = await ensureBrandOwnership(supabase, brandId, ownerId);
        if (ownership.status !== 200) {
            return res.status(ownership.status).json({ error: ownership.error });
        }

        const { enabled, scheduleWindow, postingLimits, riskThresholds } = req.body || {};

        const payload = {
            brand_id: brandId,
            owner_id: sanitizeText(String(ownerId)),
            enabled: enabled !== undefined ? Boolean(enabled) : true,
            schedule_window: scheduleWindow || null,
            posting_limits: postingLimits || null,
            risk_thresholds: riskThresholds || null,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('automation_policies')
            .upsert(payload, { onConflict: 'brand_id,owner_id' })
            .select('brand_id, owner_id, enabled, schedule_window, posting_limits, risk_thresholds')
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.json({ automation: data });
    } catch (e) {
        console.error('[AutomationPolicy] Unexpected error:', e);
        return res.status(500).json({ error: 'Failed to update automation settings' });
    }
});

app.post('/api/assets/upload', requireAuth, async (req, res) => {
    const supabase = getSupabaseServiceClient();
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
        const { brandId, fileName, mimeType, base64Data, metadata } = req.body || {};
        if (!brandId || !fileName || !base64Data) {
            return res.status(400).json({ error: 'brandId, fileName, and base64Data are required.' });
        }

        const safeName = sanitizeFileName(String(fileName));
        const extension = safeName.includes('.') ? safeName.split('.').pop() : 'png';
        const storagePath = `${brandId}/${Date.now()}-${safeName || 'asset'}.${extension}`;

        const buffer = decodeBase64File(String(base64Data));
        const { error: uploadError } = await supabase
            .storage
            .from('brand-assets')
            .upload(storagePath, buffer, {
                contentType: mimeType || 'image/png',
                upsert: true
            });

        if (uploadError) {
            return res.status(500).json({ error: uploadError.message });
        }

        const { data: publicData } = supabase
            .storage
            .from('brand-assets')
            .getPublicUrl(storagePath);

        const publicUrl = publicData?.publicUrl || null;

        const { data: assetRow, error: assetError } = await supabase
            .from('brand_assets')
            .insert({
                brand_id: brandId,
                asset_type: mimeType ? mimeType.split('/')[0] : 'image',
                storage_path: storagePath,
                public_url: publicUrl,
                metadata: metadata || null
            })
            .select('id, brand_id, storage_path, public_url')
            .single();

        if (assetError) {
            return res.status(500).json({ error: assetError.message });
        }

        return res.json({ asset: assetRow });
    } catch (e) {
        console.error('[AssetUpload] Unexpected error:', e);
        return res.status(500).json({ error: 'Asset upload failed' });
    }
});

// --- Agent Decisions Bridge ---
app.get('/api/decisions', requireAuth, (req, res) => {
    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            supabase
                .from('agent_decisions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100)
                .then(({ data, error }) => {
                    if (!error && data) {
                        return res.json(data);
                    }

                    if (fs.existsSync(DECISIONS_FILE)) {
                        const fileData = fs.readFileSync(DECISIONS_FILE, 'utf-8');
                        return res.json(JSON.parse(fileData));
                    }

                    return res.json([]);
                })
                .catch(() => {
                    if (fs.existsSync(DECISIONS_FILE)) {
                        const fileData = fs.readFileSync(DECISIONS_FILE, 'utf-8');
                        return res.json(JSON.parse(fileData));
                    }
                    return res.json([]);
                });
            return;
        }

        if (fs.existsSync(DECISIONS_FILE)) {
            const data = fs.readFileSync(DECISIONS_FILE, 'utf-8');
            res.json(JSON.parse(data));
        } else {
            res.json([]);
        }
    } catch (e) {
        res.status(500).json({ error: "Failed to read decisions" });
    }
});

// Helper to get Credentials
const getCredentials = () => {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
            return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        } catch (e) {
            console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON", e);
        }
    }
    if (fs.existsSync(KEY_FILE_PATH)) {
        return KEY_FILE_PATH; // GoogleAuth can take file path as 'keyFile' or object as 'credentials'
    }
    return null;
};

// Check if credentials exist
if (!getCredentials()) {
    console.warn("⚠️  WARNING: Service Account Credentials not found (env or file).");
    console.warn("    Imagen 3 generation will fail.");
}

app.post('/api/generate-image', async (req, res) => {
    const start = Date.now();
    try {
        const creds = getCredentials();
        if (!creds) {
            throw new Error("Service Account Credentials missing (GOOGLE_SERVICE_ACCOUNT_JSON or service-account.json).");
        }

        const { prompt, aspectRatio } = req.body;

        // 1. Authenticate
        const authOptions = typeof creds === 'string'
            ? { keyFile: creds }
            : { credentials: creds };

        const auth = new GoogleAuth({
            ...authOptions,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });

        const client = await auth.getClient();
        const projectId = await auth.getProjectId();
        const accessToken = await client.getAccessToken();

        if (!projectId) throw new Error("Could not determine Project ID from Service Account.");

        // 2. Prepare Request for Imagen 3
        // Endpoint: https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict
        const location = 'us-central1';
        const modelId = 'imagen-4.0-generate-001';
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

        const requestBody = {
            instances: [
                { prompt: prompt }
            ],
            parameters: {
                sampleCount: 1,
                aspectRatio: aspectRatio || "16:9",
                safetyFilterLevel: "block_low_and_above",
                personGeneration: "allow_adult"
            }
        };

        console.log(`[Proxy] Generating image via Vertex AI (${projectId})...`);

        // 3. Call Vertex AI
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Proxy] Vertex AI Error:", errorText);
            throw new Error(`Vertex AI API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();

        // 4. Extract Image
        // Response format: { predictions: [ { bytesBase64Encoded: "..." } ] }
        const predictions = data.predictions;
        if (!predictions || predictions.length === 0 || !predictions[0].bytesBase64Encoded) {
            throw new Error("No image data returned from Vertex AI.");
        }

        const base64Image = `data:image/png;base64,${predictions[0].bytesBase64Encoded}`;

        console.log("[Proxy] Success! Sending image to client.");
        logApiUsage({
            provider: 'imagen', model: 'imagen-4.0-generate-001', endpoint: '/api/generate-image',
            tokens_in: 0, tokens_out: 1, estimated_cost_usd: 0.04,
            user_id: req.authUser?.id || null, source: 'image-gen',
            status_code: 200, duration_ms: Date.now() - start,
        });
        res.json({ image: base64Image });

    } catch (error) {
        console.error("[Proxy] Error:", error.message);
        logApiUsage({
            provider: 'imagen', model: 'imagen-4.0-generate-001', endpoint: '/api/generate-image',
            source: 'image-gen', status_code: 500, duration_ms: Date.now() - start,
            estimated_cost_usd: 0,
        });
        res.status(500).json({ error: error.message });
    }
});

// --- BFL Flux 2 Image Generation Fallback ---

app.post('/api/generate-image-flux', async (req, res) => {
    const start = Date.now();
    try {
        const apiKey = process.env.BFL_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'BFL_API_KEY not configured' });
        }

        const { prompt, width, height } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' });
        }

        // Step 1: Submit generation request
        const submitRes = await fetch('https://api.bfl.ai/v1/flux-2-klein-9b', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-key': apiKey,
                'accept': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt.slice(0, 2000),
                width: width || 1024,
                height: height || 1024,
            }),
        });

        if (!submitRes.ok) {
            const errText = await submitRes.text().catch(() => '');
            console.error(`[Flux2] Submit failed: ${submitRes.status} ${errText.slice(0, 200)}`);
            return res.status(submitRes.status).json({ error: `Flux 2 submit failed: ${submitRes.status}` });
        }

        const submitData = await submitRes.json();
        const pollingUrl = submitData.polling_url;
        if (!pollingUrl) {
            return res.status(500).json({ error: 'No polling_url returned from BFL' });
        }

        // Step 2: Poll for result (max 60s)
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));

            const pollRes = await fetch(pollingUrl, {
                headers: { 'x-key': apiKey, 'accept': 'application/json' },
            });
            if (!pollRes.ok) continue;

            const pollData = await pollRes.json();
            if (pollData.status === 'Ready' && pollData.result?.sample) {
                // Download image and return as base64
                const imgRes = await fetch(pollData.result.sample);
                if (!imgRes.ok) {
                    return res.status(500).json({ error: 'Failed to download generated image' });
                }
                const arrayBuffer = await imgRes.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                console.log('[Flux2] Success! Sending image to client.');
                logApiUsage({
                    provider: 'flux', model: 'flux-2-klein-9b', endpoint: '/api/generate-image-flux',
                    tokens_in: 0, tokens_out: 1, estimated_cost_usd: 0.04,
                    user_id: req.authUser?.id || null, source: 'image-gen',
                    status_code: 200, duration_ms: Date.now() - start,
                });
                return res.json({ image: `data:image/png;base64,${base64}` });
            }

            if (pollData.status === 'Error' || pollData.status === 'Failed') {
                return res.status(500).json({ error: `Flux 2 generation failed: ${pollData.status}` });
            }
        }

        res.status(504).json({ error: 'Flux 2 generation timed out' });
    } catch (error) {
        console.error('[Flux2] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- LunarCrush Proxy Endpoints ---

const getLunarKey = () => process.env.VITE_LUNARCRUSH_API_KEY || process.env.LUNARCRUSH_API_KEY;

app.get('/api/lunarcrush/creator/:screen_name', async (req, res) => {
    const { screen_name } = req.params;
    const apiKey = getLunarKey();
    const start = Date.now();

    if (!apiKey) return res.status(500).json({ error: "Server missing LunarCrush API Key" });

    try {
        console.log(`[Proxy] Fetching LunarCrush Creator: ${screen_name}`);
        const response = await fetch(`https://lunarcrush.com/api4/public/creator/twitter/${screen_name}/v1`, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });

        if (!response.ok) {
            const txt = await response.text();
            console.warn(`[Proxy] LC Error: ${response.status} - ${txt}`);
            logApiUsage({ provider: 'lunarcrush', endpoint: `/api/lunarcrush/creator/${screen_name}`, source: 'client-proxy', status_code: response.status, duration_ms: Date.now() - start, estimated_cost_usd: 0 });
            return res.status(response.status).json({ error: txt });
        }

        const data = await response.json();
        logApiUsage({ provider: 'lunarcrush', endpoint: `/api/lunarcrush/creator/${screen_name}`, source: 'client-proxy', status_code: 200, duration_ms: Date.now() - start, estimated_cost_usd: 0 });
        res.json(data);
    } catch (e) {
        console.error("[Proxy] LC Exception:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/lunarcrush/time-series/:screen_name', async (req, res) => {
    const { screen_name } = req.params;
    const { interval = '1d' } = req.query;
    const apiKey = getLunarKey();

    if (!apiKey) return res.status(500).json({ error: "Server missing LunarCrush API Key" });

    try {
        console.log(`[Proxy] Fetching LC Time Series: ${screen_name}`);
        const response = await fetch(`https://lunarcrush.com/api4/public/creator/twitter/${screen_name}/time-series/v1?interval=${interval}`, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/lunarcrush/posts/:screen_name', async (req, res) => {
    const { screen_name } = req.params;
    const apiKey = getLunarKey();
    if (!apiKey) return res.status(500).json({ error: "Server missing LunarCrush API Key" });

    try {
        const response = await fetch(`https://lunarcrush.com/api4/public/creator/twitter/${screen_name}/posts/v1`, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Web3 News Endpoints ---

app.get('/api/web3-news', async (req, res) => {
    const { brand, refresh } = req.query;
    const supabase = getSupabaseClient();

    try {
        const result = await fetchWeb3News(supabase, brand || 'global', {
            forceRefresh: refresh === 'true',
            limit: 10,
            cacheDurationMs: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({
            items: result.items || [],
            cached: result.cached || false,
            stale: result.stale || false,
            count: result.items?.length || 0
        });
    } catch (e) {
        res.status(500).json({ error: e.message, items: [] });
    }
});

app.get('/api/web3-news/refresh', async (req, res) => {
    const supabase = getSupabaseClient();
    try {
        let brandList = [];

        if (supabase) {
            const { data } = await supabase
                .from('brands')
                .select('id');
            brandList = (data || []).map(b => ({ id: b.id, name: b.id }));
        }

        const results = await scheduledNewsFetch(supabase, brandList);
        res.json({ success: true, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/web3-news/refresh', async (req, res) => {
    const { brands } = req.body;
    const supabase = getSupabaseClient();

    try {
        let brandList = brands || [];

        // If no brands specified, fetch active brands from DB
        if (brandList.length === 0 && supabase) {
            const { data } = await supabase
                .from('brands')
                .select('id');
            brandList = (data || []).map(b => ({ id: b.id, name: b.id }));
        }

        const results = await scheduledNewsFetch(supabase, brandList);
        res.json({ success: true, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Tweet oEmbed Endpoint (for Quote Retweet) ---

app.post('/api/tweet-oembed', async (req, res) => {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing tweet URL' });
    }

    // Validate it's a Twitter/X URL
    const tweetUrlPattern = /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
    if (!tweetUrlPattern.test(url.trim())) {
        return res.status(400).json({ error: 'Invalid tweet URL. Must be a twitter.com or x.com status link.' });
    }

    try {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url.trim())}&omit_script=true`;
        const response = await fetch(oembedUrl);

        if (!response.ok) {
            throw new Error(`oEmbed returned ${response.status}`);
        }

        const data = await response.json();
        // data.html is like: <blockquote class="twitter-tweet"><p lang="en" dir="ltr">Tweet text here</p>&mdash; Author Name (@handle) ...</blockquote>

        let text = '';
        let authorName = data.author_name || '';
        let authorHandle = '';

        // Extract tweet text from <p> tags in HTML
        if (data.html) {
            const pMatch = data.html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
            if (pMatch) {
                // Strip inner HTML tags (links etc), keep text
                text = pMatch[1]
                    .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&mdash;/g, '—')
                    .trim();
            }

            // Extract handle from the mdash line: "&mdash; Author Name (@handle)"
            const handleMatch = data.html.match(/\(@(\w+)\)/);
            if (handleMatch) {
                authorHandle = handleMatch[1];
            }
        }

        // Fallback: extract handle from the URL
        if (!authorHandle) {
            const urlHandleMatch = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status/i);
            if (urlHandleMatch) authorHandle = urlHandleMatch[1];
        }

        res.json({
            text,
            authorName,
            authorHandle,
            url: url.trim(),
            authorUrl: data.author_url || ''
        });
    } catch (e) {
        console.error('[tweet-oembed] Error:', e.message);
        res.status(500).json({ error: `Failed to fetch tweet: ${e.message}` });
    }
});

// --- Internal Cache Endpoints ---

app.get('/api/social-metrics/:brand', requireAuth, async (req, res) => {
    const { brand } = req.params;
    const key = brand.toLowerCase();

    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            const { data, error } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', 'defia_social_metrics_cache_v1')
                .maybeSingle();

            if (!error && data?.value) {
                const metrics = data.value[brand] || data.value[key]
                    || Object.entries(data.value).find(([k]) => k.toLowerCase() === key)?.[1];
                if (metrics) return res.json(metrics);
            }
        }

        // Fallback: try filesystem (local dev)
        if (fs.existsSync(CACHE_FILE)) {
            const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
            const fileData = cache[brand] || cache[key]
                || Object.entries(cache).find(([k]) => k.toLowerCase() === key)?.[1];
            if (fileData) return res.json(fileData);
        }

        res.json({ error: "Brand not tracked" });
    } catch (e) {
        res.status(500).json({ error: "Metrics read failed" });
    }
});

// --- Action Center (Server Brain Output) ---

app.get('/api/action-center/:brand', requireAuth, async (req, res) => {
    const brand = req.params.brand || '';
    const brandKey = brand.toLowerCase();
    let decisions = [];

    // Filter out errored or garbage decisions
    const isValidDecision = (d) => {
        if (!d || !d.action) return false;
        if (d.action === 'ERROR' || d.action === 'NO_ACTION') return false;
        const reason = (d.reason || '').toLowerCase();
        if (reason.includes('could not load') || reason.includes('quota') || reason.includes('credentials')) return false;
        return true;
    };

    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            const { data: brandRow } = await supabase
                .from('brands')
                .select('id')
                .eq('id', brand)
                .maybeSingle();

            const { data: namedBrand } = await supabase
                .from('brands')
                .select('id')
                .ilike('name', brand)
                .maybeSingle();

            const brandId = brandRow?.id || namedBrand?.id;
            if (brandId) {
                const { data: dbDecisions } = await supabase
                    .from('agent_decisions')
                    .select('*')
                    .eq('brand_id', brandId)
                    .order('created_at', { ascending: false })
                    .limit(50);

                decisions = (dbDecisions || []).filter(isValidDecision);
            }
        }

        if (decisions.length === 0 && fs.existsSync(DECISIONS_FILE)) {
            const data = JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf-8'));
            decisions = Array.isArray(data)
                ? data.filter(item => (item.brandId || '').toLowerCase() === brandKey).filter(isValidDecision)
                : [];
        }
    } catch (e) {
        console.warn("[ActionCenter] Failed to read decisions:", e.message);
    }

    let socialMetrics = null;
    try {
        const sbClient = getSupabaseClient();
        if (sbClient) {
            const { data: metricsRow } = await sbClient
                .from('app_storage')
                .select('value')
                .eq('key', 'defia_social_metrics_cache_v1')
                .maybeSingle();
            if (metricsRow?.value) {
                socialMetrics = metricsRow.value[brandKey] || null;
            }
        }
        // Fallback: filesystem (local dev)
        if (!socialMetrics && fs.existsSync(CACHE_FILE)) {
            const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
            socialMetrics = cache[brandKey] || null;
        }
    } catch (e) {
        console.warn("[ActionCenter] Failed to read social metrics:", e.message);
    }

    let growthReport = null;
    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            const storageKey = `defia_growth_report_v1_${brandKey}`;
            const { data, error } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', storageKey)
                .maybeSingle();

            if (error) {
                console.warn("[ActionCenter] Supabase fetch error:", error.message);
            } else if (data?.value) {
                growthReport = data.value;
            }
        }
    } catch (e) {
        console.warn("[ActionCenter] Growth report fetch failed:", e.message);
    }

    res.json({
        brand,
        decisions,
        socialMetrics,
        growthReport,
        generatedAt: new Date().toISOString()
    });
});

// ============================================================
// Stripe Billing — Checkout + Customer Portal
// ============================================================

app.post('/api/billing/create-checkout', requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

    const { priceId, brandId } = req.body;
    if (!priceId) return res.status(400).json({ error: 'priceId is required' });

    const userId = req.authUser.id;
    const userEmail = req.authUser.email;

    try {
        const supabase = getSupabaseAdminClient();

        // Check if user already has a Stripe customer record
        let customerId = null;
        if (supabase) {
            const { data: existingSub } = await supabase
                .from('subscriptions')
                .select('stripe_customer_id')
                .eq('user_id', userId)
                .limit(1)
                .maybeSingle();
            if (existingSub?.stripe_customer_id) {
                customerId = existingSub.stripe_customer_id;
            }
        }

        // Create Stripe customer if not found
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: userEmail,
                metadata: { user_id: userId, brand_id: brandId || '' },
            });
            customerId = customer.id;
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${frontendUrl}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}?billing=canceled`,
            metadata: { user_id: userId, brand_id: brandId || '' },
            subscription_data: {
                metadata: { user_id: userId, brand_id: brandId || '' },
            },
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('[Stripe] Create checkout error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/billing/create-portal', requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

    const userId = req.authUser.id;

    try {
        const supabase = getSupabaseAdminClient();
        if (!supabase) return res.status(500).json({ error: 'Database unavailable' });

        // Look up the user's Stripe customer ID
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

        if (!sub?.stripe_customer_id) {
            return res.status(404).json({ error: 'No active subscription found. Please subscribe first.' });
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const session = await stripe.billingPortal.sessions.create({
            customer: sub.stripe_customer_id,
            return_url: `${frontendUrl}?section=settings`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('[Stripe] Create portal error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Fetch current subscription status for the authenticated user
app.get('/api/billing/status', requireAuth, async (req, res) => {
    const userId = req.authUser.id;

    try {
        const supabase = getSupabaseAdminClient();
        if (!supabase) return res.status(500).json({ error: 'Database unavailable' });

        const { data: sub, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[Billing] Status fetch error:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json({ subscription: sub || null });
    } catch (err) {
        console.error('[Billing] Status error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TELEGRAM BOT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Webhook endpoint (PUBLIC — Telegram calls this)
app.post('/api/telegram/webhook/:secret', (req, res) => handleTelegramWebhook(req, res));

// Health check (PUBLIC)
app.get('/api/telegram/health', async (req, res) => {
    if (!isTelegramConfigured()) {
        return res.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set' });
    }
    try {
        const me = await getTelegramMe();
        res.json({ ok: true, bot: { username: me.username, name: me.first_name } });
    } catch (e) {
        res.json({ ok: false, error: e.message });
    }
});

// Generate link code (AUTH REQUIRED)
app.post('/api/telegram/generate-link-code', requireAuth, async (req, res) => {
    const { brandId } = req.body || {};
    if (!brandId) return res.status(400).json({ error: 'brandId is required' });

    const supabase = getSupabaseAdminClient();
    if (!supabase) return res.status(500).json({ error: 'Database unavailable' });

    // Verify brand ownership
    const ownership = await ensureBrandOwnership(supabase, brandId, req.authUser.id);
    if (ownership.status !== 200) {
        return res.status(ownership.status).json({ error: ownership.error });
    }

    try {
        const code = await generateLinkCode(supabase, brandId);

        // Get bot username for deep link
        let botUsername = 'DefiaBot';
        if (isTelegramConfigured()) {
            try {
                const me = await getTelegramMe();
                botUsername = me.username;
            } catch { /* ignore */ }
        }

        res.json({
            code,
            botUsername,
            deepLink: `https://t.me/${botUsername}?startgroup=${code}`,
        });
    } catch (e) {
        console.error('[Telegram] Link code generation failed:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get linked chats (AUTH REQUIRED)
app.get('/api/telegram/status', requireAuth, async (req, res) => {
    const brandId = req.query.brandId;
    if (!brandId) return res.status(400).json({ error: 'brandId query param required' });

    const supabase = getSupabaseAdminClient();
    if (!supabase) return res.status(500).json({ error: 'Database unavailable' });

    try {
        const chats = await getLinkedChats(supabase, brandId);
        res.json({ linked: chats.length > 0, chats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Unlink a chat (AUTH REQUIRED)
app.post('/api/telegram/unlink', requireAuth, async (req, res) => {
    const { brandId, chatId } = req.body || {};
    if (!brandId || !chatId) return res.status(400).json({ error: 'brandId and chatId required' });

    const supabase = getSupabaseAdminClient();
    if (!supabase) return res.status(500).json({ error: 'Database unavailable' });

    const ownership = await ensureBrandOwnership(supabase, brandId, req.authUser.id);
    if (ownership.status !== 200) {
        return res.status(ownership.status).json({ error: ownership.error });
    }

    try {
        const { error } = await supabase
            .from('telegram_links')
            .delete()
            .eq('brand_id', brandId)
            .eq('chat_id', chatId);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Setup webhook (AUTH REQUIRED — one-time setup)
app.post('/api/telegram/setup-webhook', requireAuth, async (req, res) => {
    if (!isTelegramConfigured()) {
        return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
    }

    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return res.status(400).json({ error: 'TELEGRAM_WEBHOOK_SECRET not configured' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const webhookUrl = `${frontendUrl}/api/telegram/webhook/${webhookSecret}`;

    try {
        const result = await setTelegramWebhook(webhookUrl);
        res.json({ success: true, webhookUrl, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ━━━ Admin Dashboard Endpoints ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

const requireAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return res.status(500).json({ error: 'Auth service unavailable' });
        const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (error || !user) return res.status(401).json({ error: 'Invalid token' });
        if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        req.authUser = { id: user.id, email: user.email };
        return next();
    } catch (e) {
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

// GET /api/admin/overview — all brands with owner, subscription, trial status
app.get('/api/admin/overview', requireAdmin, async (req, res) => {
    try {
        const supabase = getSupabaseAdminClient();
        if (!supabase) return res.status(500).json({ error: 'Database unavailable' });

        const [brandsRes, subsRes, configsRes] = await Promise.all([
            supabase.from('brands').select('id, name, slug, owner_id, created_at').order('created_at', { ascending: false }),
            supabase.from('subscriptions').select('id, user_id, brand_id, plan_tier, status, current_period_end, created_at'),
            supabase.from('brand_configs').select('brand_id, config').order('created_at', { ascending: false }),
        ]);

        // Build config map (latest per brand)
        const configMap = {};
        for (const bc of configsRes.data || []) {
            if (!configMap[bc.brand_id]) configMap[bc.brand_id] = bc.config;
        }

        // Build subscription map by brand_id
        const subMap = {};
        for (const s of subsRes.data || []) {
            if (s.brand_id && !subMap[s.brand_id]) subMap[s.brand_id] = s;
        }

        // Fetch auth users via admin API
        let userMap = {};
        try {
            const serviceUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (serviceUrl && serviceKey) {
                const adminClient = createClient(serviceUrl, serviceKey);
                const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
                for (const u of users || []) {
                    userMap[u.id] = { email: u.email, createdAt: u.created_at };
                }
            }
        } catch (e) {
            console.warn('[Admin] Could not fetch auth users:', e.message?.slice(0, 80));
        }

        const now = Date.now();
        const result = (brandsRes.data || []).map(brand => {
            const sub = subMap[brand.id];
            const cfg = configMap[brand.id];
            const trialEndsAt = cfg?.subscription?.trialEndsAt || null;
            const usage = cfg?.subscription?.usage || {};

            return {
                brandId: brand.id,
                brandName: brand.name,
                ownerId: brand.owner_id,
                ownerEmail: userMap[brand.owner_id]?.email || null,
                createdAt: brand.created_at,
                subscription: {
                    status: sub?.status || (trialEndsAt && trialEndsAt > now ? 'trialing' : trialEndsAt ? 'expired' : 'none'),
                    planTier: sub?.plan_tier || cfg?.subscription?.plan || 'starter',
                    periodEnd: sub?.current_period_end || null,
                    stripeSubId: sub?.id || null,
                },
                trial: {
                    endsAt: trialEndsAt,
                    hoursLeft: trialEndsAt ? Math.max(0, Math.round((trialEndsAt - now) / 3_600_000)) : null,
                    isExpired: trialEndsAt ? trialEndsAt < now : false,
                },
                usage: {
                    contentThisMonth: usage.contentThisMonth || 0,
                    imagesThisMonth: usage.imagesThisMonth || 0,
                },
            };
        });

        res.json({ users: result, total: result.length });
    } catch (e) {
        console.error('[Admin] Overview error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/api-usage — usage stats from api_usage_logs
app.get('/api/admin/api-usage', requireAdmin, async (req, res) => {
    try {
        const supabase = getSupabaseAdminClient();
        if (!supabase) return res.status(500).json({ error: 'Database unavailable' });

        const { from, to } = req.query;
        const toDate = to ? new Date(to) : new Date();
        const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86_400_000);

        const { data: logs, error } = await supabase
            .from('api_usage_logs')
            .select('provider, model, endpoint, tokens_in, tokens_out, estimated_cost_usd, brand_id, source, created_at, status_code, duration_ms')
            .gte('created_at', fromDate.toISOString())
            .lte('created_at', toDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(10000);

        if (error) return res.status(500).json({ error: error.message });

        // Aggregate
        const dailyMap = {};
        const providerMap = {};
        const modelMap = {};
        let totalCost = 0;

        for (const log of logs || []) {
            const cost = Number(log.estimated_cost_usd) || 0;
            totalCost += cost;

            const day = log.created_at.slice(0, 10);
            if (!dailyMap[day]) dailyMap[day] = { date: day, totalCost: 0, callCount: 0 };
            dailyMap[day].totalCost += cost;
            dailyMap[day].callCount += 1;

            const p = log.provider;
            if (!providerMap[p]) providerMap[p] = { provider: p, totalCost: 0, callCount: 0 };
            providerMap[p].totalCost += cost;
            providerMap[p].callCount += 1;

            if (log.model) {
                if (!modelMap[log.model]) modelMap[log.model] = { model: log.model, totalCost: 0, callCount: 0, totalTokensIn: 0, totalTokensOut: 0 };
                modelMap[log.model].totalCost += cost;
                modelMap[log.model].callCount += 1;
                modelMap[log.model].totalTokensIn += log.tokens_in || 0;
                modelMap[log.model].totalTokensOut += log.tokens_out || 0;
            }
        }

        const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
        const days = daily.length || 1;

        res.json({
            summary: { totalCost, totalCalls: (logs || []).length, avgCostPerDay: totalCost / days, from: fromDate.toISOString(), to: toDate.toISOString() },
            daily,
            byProvider: Object.values(providerMap),
            byModel: Object.values(modelMap),
        });
    } catch (e) {
        console.error('[Admin] API usage error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/billing — subscription/revenue summary
app.get('/api/admin/billing', requireAdmin, async (req, res) => {
    try {
        const supabase = getSupabaseAdminClient();
        if (!supabase) return res.status(500).json({ error: 'Database unavailable' });

        const { data: subs } = await supabase
            .from('subscriptions')
            .select('*')
            .order('created_at', { ascending: false });

        const PLAN_MRR = { starter: 299, growth: 499, enterprise: 0 };
        const activeSubs = (subs || []).filter(s => s.status === 'active');
        const trialingSubs = (subs || []).filter(s => s.status === 'trialing');
        const canceledSubs = (subs || []).filter(s => s.status === 'canceled');
        const pastDueSubs = (subs || []).filter(s => s.status === 'past_due');

        const mrr = activeSubs.reduce((sum, s) => sum + (PLAN_MRR[s.plan_tier] || 0), 0);

        const convertedIds = new Set(activeSubs.map(s => s.user_id).filter(Boolean));
        const allTrialIds = new Set([...trialingSubs, ...canceledSubs].map(s => s.user_id).filter(Boolean));
        const conversionRate = (convertedIds.size + allTrialIds.size) > 0
            ? Math.round((convertedIds.size / (convertedIds.size + allTrialIds.size)) * 100)
            : 0;

        res.json({
            mrr,
            totalActive: activeSubs.length,
            totalTrialing: trialingSubs.length,
            totalCanceled: canceledSubs.length,
            totalPastDue: pastDueSubs.length,
            conversionRate,
            byTier: {
                starter: activeSubs.filter(s => s.plan_tier === 'starter').length,
                growth: activeSubs.filter(s => s.plan_tier === 'growth').length,
                enterprise: activeSubs.filter(s => s.plan_tier === 'enterprise').length,
            },
            subscriptions: subs || [],
        });
    } catch (e) {
        console.error('[Admin] Billing error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Only start server if NOT running in Vercel (Vercel handles the server via 'api' folder)
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`\n🚀 Backend Proxy running at http://localhost:${PORT}`);
        console.log(`   - Endpoint: POST /api/generate-image`);
        console.log(`   - Auth: Parsing service-account.json...`);

        // Start Autonomous Agent
        startAgent();

        // Start Scheduled Publisher (checks every 10 minutes for due tweets)
        startPublishing();
    });
}

export default app;
