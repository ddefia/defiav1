
import 'dotenv/config'; // Load .env file
import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { startAgent, triggerAgentRun, runBrainCycle } from './server/agent/scheduler.js';
import { runPublishingCycle, startPublishing } from './server/publishing/scheduler.js';
import { crawlWebsite, deepCrawlWebsite, fetchTwitterContent, uploadCarouselGraphic, fetchDocumentContent, extractDefiMetrics } from './server/onboarding.js';
import { fetchWeb3News, scheduledNewsFetch } from './server/services/web3News.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: restrict to known frontend origins
const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ALLOWED_ORIGINS
        : true, // Allow all origins in dev
    credentials: true,
}));
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
    // OAuth callbacks must be public (X won't include our API key)
    '/api/auth/x/authorize-url',
    '/api/auth/x/callback',
    '/api/auth/x/status',
]);

// Prefixes for dynamic routes that should be public
const PUBLIC_API_PREFIXES = [
    '/api/social-metrics/',
    '/api/action-center/',
    '/api/lunarcrush/',
    '/api/auth/x/',
    '/api/x/metrics/'
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

// --- Health Check ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), agent: 'active' });
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
        const { data, error } = await supabase
            .from('app_storage')
            .select('value, updated_at')
            .eq('key', key)
            .maybeSingle();
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

app.get('/api/x/metrics/:brand', async (req, res) => {
    const brandId = sanitizeText(String(req.params.brand || ''));
    const forceRefresh = String(req.query.refresh || '') === 'true';
    if (!brandId) return res.status(400).json({ error: 'brandId is required' });

    const supabase = getSupabaseServiceClient() || getSupabaseClient();
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

    const cacheKey = `x_metrics_cache_${brandId.toLowerCase()}`;
    const tokenKey = `x_oauth_tokens_${brandId.toLowerCase()}`;
    const now = Date.now();

    try {
        if (!forceRefresh) {
            const { data: cacheRow } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', cacheKey)
                .maybeSingle();
            if (cacheRow?.value?.metrics && cacheRow.value.lastFetched && (now - cacheRow.value.lastFetched) < 15 * 60 * 1000) {
                return res.json({ connected: true, source: 'cache', metrics: cacheRow.value.metrics });
            }
        }

        const { data: tokenRow } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', tokenKey)
            .maybeSingle();

        if (!tokenRow?.value?.access_token) {
            return res.json({ connected: false });
        }

        let tokenValue = tokenRow.value;
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

        const accessToken = tokenValue.access_token;

        let meRes = await fetch(`${X_ME_URL}?user.fields=public_metrics,username,verified`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
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
        const userId = user.id;

        const tweetsRes = await fetch(`${X_TWEETS_URL}/${userId}/tweets?max_results=5&tweet.fields=public_metrics,created_at`, {
            headers: { 'Authorization': `Bearer ${tokenValue.access_token}` },
        });
        const tweetsJson = await tweetsRes.json().catch(() => ({}));
        const tweets = Array.isArray(tweetsJson?.data) ? tweetsJson.data : [];

        const recentPosts = tweets.map((t) => {
            const metrics = t.public_metrics || {};
            const likes = metrics.like_count || 0;
            const retweets = metrics.retweet_count || 0;
            const comments = metrics.reply_count || 0;
            const quotes = metrics.quote_count || 0;
            const engagements = likes + retweets + comments + quotes;
            const followers = user.public_metrics?.followers_count || 0;
            const engagementRate = followers > 0 ? (engagements / followers) * 100 : 0;
            return {
                id: t.id,
                content: t.text || '',
                date: t.created_at ? new Date(t.created_at).toLocaleDateString() : 'Recent',
                likes,
                comments,
                retweets,
                impressions: engagements * 20,
                engagementRate: parseFloat(engagementRate.toFixed(2)),
                url: `https://x.com/${user.username}/status/${t.id}`
            };
        });

        const followersCount = user.public_metrics?.followers_count || 0;
        const totalEngagements = recentPosts.reduce((sum, p) => sum + p.likes + p.retweets + p.comments, 0);
        const avgEngagementRate = recentPosts.length > 0 && followersCount > 0
            ? (totalEngagements / recentPosts.length / followersCount) * 100
            : 0;

        const metrics = {
            totalFollowers: followersCount,
            weeklyImpressions: recentPosts.reduce((sum, p) => sum + p.impressions, 0) * 2,
            engagementRate: parseFloat(avgEngagementRate.toFixed(2)),
            mentions: 0,
            topPost: recentPosts[0]?.content || 'No recent posts found',
            recentPosts,
            engagementHistory: [],
            comparison: { period: 'vs Last Week', followersChange: 0, engagementChange: 0, impressionsChange: 0 },
            isLive: true
        };

        await supabase
            .from('app_storage')
            .upsert({
                key: cacheKey,
                value: { metrics, lastFetched: now },
                updated_at: new Date().toISOString()
            });

        return res.json({
            connected: true,
            source: 'x',
            user: {
                id: userId,
                username: user.username,
                verified: user.verified || false,
                followers: followersCount,
                following: user.public_metrics?.following_count || 0,
                tweetCount: user.public_metrics?.tweet_count || 0
            },
            metrics
        });
    } catch (e) {
        console.error('[XMetrics] Failed:', e);
        return res.status(500).json({ error: 'Failed to fetch X metrics' });
    }
});

// --- Onboarding: Website Crawl (Simple) ---
app.post('/api/onboarding/crawl', async (req, res) => {
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
app.post('/api/onboarding/deep-crawl', async (req, res) => {
    try {
        const { url, maxPages, maxDepth, includeDocsSubdomain } = req.body || {};
        const normalized = normalizeDomain(String(url || ''));
        if (!normalized || !isValidUrl(normalized)) {
            return res.status(400).json({ error: 'Valid URL is required.' });
        }

        console.log(`[DeepCrawl] Starting deep crawl of ${normalized}...`);

        const result = await deepCrawlWebsite(normalized, {
            maxPages: typeof maxPages === 'number' ? Math.min(Math.max(maxPages, 10), 100) : 50,
            maxDepth: typeof maxDepth === 'number' ? Math.min(Math.max(maxDepth, 3), 20) : 10,
            includeDocsSubdomain: includeDocsSubdomain !== false
        });

        // Extract DeFi metrics from the content
        if (result.content) {
            result.defiMetrics = extractDefiMetrics(result.content);
        }

        return res.json(result);
    } catch (e) {
        console.error('[DeepCrawl] Failed:', e);
        return res.status(500).json({ error: 'Deep crawl failed.' });
    }
});

// --- Onboarding: Fetch Document Content ---
app.post('/api/onboarding/fetch-document', async (req, res) => {
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
app.post('/api/onboarding/twitter', async (req, res) => {
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
            return res.status(400).json({ error: result.error });
        }
        return res.json(result);
    } catch (e) {
        console.error('[OnboardingTwitter] Failed:', e);
        return res.status(500).json({ error: 'Twitter scrape failed.' });
    }
});

// --- Onboarding: Carousel Upload ---
app.post('/api/onboarding/carousel-upload', async (req, res) => {
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

app.post('/api/brands/register', async (req, res) => {
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

app.post('/api/brands/resolve', async (req, res) => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
        const { name, websiteUrl, sources = {} } = req.body || {};
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

app.patch('/api/brands/:id/integrations', async (req, res) => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
        const brandId = req.params.id;
        const ownerId = req.auth?.ownerId;
        if (!ownerId) {
            return res.status(403).json({ error: 'Owner key required' });
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
app.post('/api/agent/trigger', async (req, res) => {
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

app.patch('/api/brands/:id/automation', async (req, res) => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
        const brandId = req.params.id;
        const ownerId = req.auth?.ownerId;
        if (!ownerId) {
            return res.status(403).json({ error: 'Owner key required' });
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

app.post('/api/assets/upload', async (req, res) => {
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
app.get('/api/decisions', (req, res) => {
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
        res.json({ image: base64Image });

    } catch (error) {
        console.error("[Proxy] Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- LunarCrush Proxy Endpoints ---

const getLunarKey = () => process.env.VITE_LUNARCRUSH_API_KEY || process.env.LUNARCRUSH_API_KEY;

app.get('/api/lunarcrush/creator/:screen_name', async (req, res) => {
    const { screen_name } = req.params;
    const apiKey = getLunarKey();

    if (!apiKey) return res.status(500).json({ error: "Server missing LunarCrush API Key" });

    try {
        console.log(`[Proxy] Fetching LunarCrush Creator: ${screen_name}`);
        const response = await fetch(`https://lunarcrush.com/api4/public/creator/twitter/${screen_name}/v1`, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });

        if (!response.ok) {
            const txt = await response.text();
            console.warn(`[Proxy] LC Error: ${response.status} - ${txt}`);
            return res.status(response.status).json({ error: txt });
        }

        const data = await response.json();
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

// --- Internal Cache Endpoints ---

app.get('/api/social-metrics/:brand', (req, res) => {
    const { brand } = req.params;

    if (!fs.existsSync(CACHE_FILE)) {
        return res.json({ error: "Cache not built yet" });
    }

    try {
        const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        const key = brand.toLowerCase();
        // Try exact match first, then lowercase, then case-insensitive scan
        const data = cache[brand] || cache[key] || Object.entries(cache).find(([k]) => k.toLowerCase() === key)?.[1];

        if (!data) {
            return res.json({ error: "Brand not tracked" });
        }

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: "Cache read failed" });
    }
});

// --- Action Center (Server Brain Output) ---

app.get('/api/action-center/:brand', async (req, res) => {
    const brand = req.params.brand || '';
    const brandKey = brand.toLowerCase();
    let decisions = [];

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

                decisions = dbDecisions || [];
            }
        }

        if (decisions.length === 0 && fs.existsSync(DECISIONS_FILE)) {
            const data = JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf-8'));
            decisions = Array.isArray(data)
                ? data.filter(item => (item.brandId || '').toLowerCase() === brandKey)
                : [];
        }
    } catch (e) {
        console.warn("[ActionCenter] Failed to read decisions:", e.message);
    }

    let socialMetrics = null;
    try {
        if (fs.existsSync(CACHE_FILE)) {
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

// Only start server if NOT running in Vercel (Vercel handles the server via 'api' folder)
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`\n🚀 Backend Proxy running at http://localhost:${PORT}`);
        console.log(`   - Endpoint: POST /api/generate-image`);
        console.log(`   - Auth: Parsing service-account.json...`);

        // Start Autonomous Agent
        startAgent();

        // Start Scheduled Publisher (local dev)
        // startPublishing(); // PAUSED - enable when ready to test publishing
    });
}

export default app;
