
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
import { crawlWebsite, fetchTwitterContent, uploadCarouselGraphic } from './server/onboarding.js';
import { fetchWeb3News, scheduledNewsFetch } from './server/services/web3News.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for the frontend (Vite runs on 3000 usually)
app.use(cors());
app.use(express.json());

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
    '/api/web3-news'
]);

// Prefixes for dynamic routes that should be public
const PUBLIC_API_PREFIXES = [
    '/api/social-metrics/',
    '/api/action-center/',
    '/api/lunarcrush/'
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

// --- Onboarding: Website Crawl ---
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

// --- Onboarding: Twitter Scrape ---
app.post('/api/onboarding/twitter', async (req, res) => {
    try {
        const { handle, maxItems, brandName } = req.body || {};
        const normalizedHandle = normalizeHandle(String(handle || ''));
        if (!normalizedHandle || !isValidHandle(normalizedHandle)) {
            return res.status(400).json({ error: 'Valid X/Twitter handle is required.' });
        }

        const result = await fetchTwitterContent(normalizedHandle, {
            maxItems: typeof maxItems === 'number' ? Math.min(Math.max(maxItems, 5), 50) : undefined,
            brandName: brandName ? String(brandName) : undefined
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
        const result = await runBrainCycle({ label, brandIdentifier: brandId });
        return res.json(result);
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

app.post('/api/web3-news/refresh', async (req, res) => {
    const { brands } = req.body;
    const supabase = getSupabaseClient();

    try {
        let brandList = brands || [];

        // If no brands specified, fetch active brands from DB
        if (brandList.length === 0 && supabase) {
            const { data } = await supabase
                .from('brands')
                .select('id, name')
                .eq('active', true);
            brandList = data || [];
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
        const data = cache[key];

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
