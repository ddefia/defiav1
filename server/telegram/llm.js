/**
 * LLM ABSTRACTION — Gemini → Groq Fallback
 *
 * Provides a single generateText() function that tries Gemini first,
 * then falls back to Groq (Llama 3.3 70B) on failure (429, timeout, etc).
 *
 * Used by all text-only server-side generation (telegram bot + agent crons).
 * Multimodal/image functions bypass this and call Gemini directly.
 */

import { GoogleGenAI } from '@google/genai';
import { logApiUsage, estimateCost } from '../services/usageLogger.js';

const TIMEOUT_MS = 30000;
const THINKING_TIMEOUT_MS = 90000; // Thinking mode needs longer

// ━━━ Timeout Helper ━━━

const withTimeout = (promise, ms = TIMEOUT_MS) => {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('LLM request timed out')), ms);
        }),
    ]).finally(() => clearTimeout(timer));
};

// ━━━ Gemini ━━━

const callGemini = async ({ systemPrompt, userMessage, temperature = 0.5, jsonMode = false, model = 'gemini-2.5-flash', thinkingConfig = null }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const timeout = thinkingConfig ? THINKING_TIMEOUT_MS : TIMEOUT_MS;
    const genAI = new GoogleGenAI({ apiKey, httpOptions: { timeout } });
    const config = { temperature };
    if (systemPrompt) config.systemInstruction = { parts: [{ text: systemPrompt }] };
    if (jsonMode) config.responseMimeType = 'application/json';
    if (thinkingConfig) config.thinkingConfig = thinkingConfig;

    const response = await withTimeout(genAI.models.generateContent({
        model,
        contents: { parts: [{ text: userMessage }] },
        config,
    }), timeout);

    return (response.text || '').trim();
};

// ━━━ Groq (OpenAI-compatible) ━━━

// Cache: Groq key loaded from Supabase app_storage as fallback when env var missing
let _groqKeyCache = null;

const _getGroqKey = async () => {
    if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
    if (_groqKeyCache) return _groqKeyCache;
    // Fallback: read from Supabase app_storage (key: 'llm_keys')
    try {
        const { createClient } = await import('@supabase/supabase-js');
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        if (!url || !key) return null;
        const sb = createClient(url, key);
        const { data } = await sb.from('app_storage').select('value').eq('key', 'llm_keys').single();
        if (data?.value?.groq) {
            _groqKeyCache = data.value.groq;
            console.log('[LLM] Loaded Groq key from Supabase fallback');
            return _groqKeyCache;
        }
    } catch (e) {
        console.warn('[LLM] Supabase Groq key lookup failed:', e.message?.slice(0, 80));
    }
    return null;
};

const callGroq = async ({ systemPrompt, userMessage, temperature = 0.5, jsonMode = false }) => {
    const apiKey = await _getGroqKey();
    if (!apiKey) return null;

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userMessage });

    const body = {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature,
        max_tokens: 4096,
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`Groq API ${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        return (data.choices?.[0]?.message?.content || '').trim();
    } finally {
        clearTimeout(timer);
    }
};

// ━━━ Main Export ━━━

/**
 * Generate text with automatic provider fallback.
 *
 * Provider order:
 *   - Default: Gemini → Groq (for Telegram bot, content generation)
 *   - preferGroq: true: Groq → Gemini (for server crons — saves Gemini quota)
 *
 * @param {Object} opts
 * @param {string} opts.userMessage - User/input message (required)
 * @param {string} [opts.systemPrompt] - System instruction
 * @param {number} [opts.temperature] - 0.0-1.0 (default 0.5)
 * @param {boolean} [opts.jsonMode] - Request JSON output
 * @param {boolean} [opts.preferGroq] - Try Groq first (saves Gemini quota)
 * @param {string} [opts._source] - Log source tag
 * @param {string} [opts._endpoint] - Log endpoint label
 * @param {string} [opts._brandId] - Brand UUID for attribution
 * @returns {Promise<string>} Generated text
 */
const generateText = async (opts) => {
    const start = Date.now();
    const modelName = opts.model || 'gemini-2.5-flash';

    // Determine provider order
    const providers = opts.preferGroq
        ? [{ name: 'groq', fn: callGroq, model: 'llama-3.3-70b-versatile' }, { name: 'gemini', fn: callGemini, model: modelName }]
        : [{ name: 'gemini', fn: callGemini, model: modelName }, { name: 'groq', fn: callGroq, model: 'llama-3.3-70b-versatile' }];

    let lastError;
    for (const provider of providers) {
        try {
            const result = await provider.fn(opts);
            if (result) {
                logApiUsage({
                    provider: provider.name, model: provider.model,
                    endpoint: opts._endpoint || 'generateText',
                    source: opts._source || 'server-llm',
                    brand_id: opts._brandId || null,
                    status_code: 200, duration_ms: Date.now() - start,
                    estimated_cost_usd: provider.name === 'gemini' ? estimateCost(modelName, 500, 300) : 0,
                });
                return result;
            }
        } catch (e) {
            lastError = e;
            const isRetryable = e.message?.includes('429')
                || e.message?.includes('quota')
                || e.message?.includes('RESOURCE_EXHAUSTED')
                || e.message?.includes('timed out')
                || e.message?.includes('503')
                || e.message?.includes('overloaded');
            if (!isRetryable) throw e; // Auth errors, bad prompts — don't try other provider
            console.warn(`[LLM] ${provider.name} failed (${e.message?.slice(0, 80)}), trying next...`);
            logApiUsage({
                provider: provider.name, model: provider.model,
                endpoint: opts._endpoint || 'generateText',
                source: opts._source || 'server-llm',
                brand_id: opts._brandId || null,
                status_code: 429, duration_ms: Date.now() - start, estimated_cost_usd: 0,
            });
        }
    }

    throw lastError || new Error('All LLM providers failed');
};

export { generateText, callGemini, callGroq, withTimeout, TIMEOUT_MS };
