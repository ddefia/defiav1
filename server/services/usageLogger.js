/**
 * API Usage Logger — shared module for tracking external API calls.
 * Fire-and-forget writes to Supabase `api_usage_logs` table.
 */

import { createClient } from '@supabase/supabase-js';

// ─── Cost Lookup (per 1M tokens for text, per-image for image models) ────────

const COST_RATES = {
    'gemini-2.5-flash':          { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
    'gemini-2.5-pro':            { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
    'gemini-2.0-flash':          { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
    'gemini-1.5-flash':          { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
    'gemini-3-pro-image-preview':{ input: 0, output: 0.0315 },   // per image
    'text-embedding-004':        { input: 0.00625 / 1_000_000, output: 0 },
    'imagen-4.0-generate-001':   { input: 0, output: 0.04 },     // per image
    'flux-2-klein-9b':           { input: 0, output: 0.04 },     // per image (approx)
};

/**
 * Estimates cost in USD for a given model + token counts.
 * For image models, tokensOut should be 1 (per image generated).
 */
export const estimateCost = (model, tokensIn = 0, tokensOut = 0) => {
    const rates = COST_RATES[model];
    if (!rates) return 0;
    return (rates.input * tokensIn) + (rates.output * tokensOut);
};

// ─── Supabase Client (lazy singleton) ────────────────────────────────────────

let _supabase = null;

const getClient = () => {
    if (_supabase) return _supabase;
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    _supabase = createClient(url, key);
    return _supabase;
};

// ─── Logger ──────────────────────────────────────────────────────────────────

/**
 * Logs an API usage entry to `api_usage_logs`. Fire-and-forget — never throws.
 *
 * @param {Object} entry
 * @param {string} entry.provider       'gemini' | 'apify' | 'lunarcrush' | 'dune' | 'imagen' | 'flux'
 * @param {string} [entry.model]        e.g. 'gemini-2.0-flash'
 * @param {string} entry.endpoint       e.g. '/api/gemini/generate'
 * @param {number} [entry.tokens_in]
 * @param {number} [entry.tokens_out]
 * @param {number} [entry.estimated_cost_usd]
 * @param {string} [entry.brand_id]     UUID or null
 * @param {string} [entry.user_id]      UUID or null
 * @param {string} entry.source         'client-proxy' | 'telegram-bot' | 'agent-cron' | 'image-gen'
 * @param {number} [entry.status_code]
 * @param {number} [entry.duration_ms]
 */
export const logApiUsage = async (entry) => {
    try {
        const supabase = getClient();
        if (!supabase) return;
        await supabase.from('api_usage_logs').insert({
            provider: entry.provider,
            model: entry.model || null,
            endpoint: entry.endpoint,
            tokens_in: entry.tokens_in || null,
            tokens_out: entry.tokens_out || null,
            estimated_cost_usd: entry.estimated_cost_usd || 0,
            brand_id: entry.brand_id || null,
            user_id: entry.user_id || null,
            source: entry.source,
            status_code: entry.status_code || null,
            duration_ms: entry.duration_ms || null,
        });
    } catch (e) {
        // Non-critical — never block the request
        console.warn('[UsageLog] Write failed:', e.message?.slice(0, 80));
    }
};
