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

const TIMEOUT_MS = 15000;

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

const callGemini = async ({ systemPrompt, userMessage, temperature = 0.5, jsonMode = false }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const genAI = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
    const config = { temperature };
    if (systemPrompt) config.systemInstruction = { parts: [{ text: systemPrompt }] };
    if (jsonMode) config.responseMimeType = 'application/json';

    const response = await withTimeout(genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts: [{ text: userMessage }] },
        config,
    }));

    return (response.text || '').trim();
};

// ━━━ Groq (OpenAI-compatible) ━━━

const callGroq = async ({ systemPrompt, userMessage, temperature = 0.5, jsonMode = false }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null; // No Groq key — can't fallback

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
 * Generate text with automatic Gemini → Groq fallback.
 *
 * @param {Object} opts
 * @param {string} opts.systemPrompt - System instruction (optional)
 * @param {string} opts.userMessage - User/input message (required)
 * @param {number} opts.temperature - 0.0-1.0 (default 0.5)
 * @param {boolean} opts.jsonMode - Request JSON output (default false)
 * @returns {Promise<string>} Generated text
 */
const generateText = async (opts) => {
    let geminiError;

    // Try Gemini first
    try {
        const result = await callGemini(opts);
        if (result) return result;
    } catch (e) {
        geminiError = e;
        const isRetryable = e.message?.includes('429')
            || e.message?.includes('quota')
            || e.message?.includes('RESOURCE_EXHAUSTED')
            || e.message?.includes('timed out')
            || e.message?.includes('503')
            || e.message?.includes('overloaded');
        if (!isRetryable) throw e; // Non-retryable errors (bad prompt, auth, etc.) — don't fallback
        console.warn(`[LLM] Gemini failed (${e.message?.slice(0, 80)}), trying Groq fallback...`);
    }

    // Fallback to Groq
    try {
        const result = await callGroq(opts);
        if (result) {
            console.log('[LLM] Groq fallback succeeded');
            return result;
        }
    } catch (e) {
        console.error('[LLM] Groq fallback also failed:', e.message?.slice(0, 100));
    }

    // Both failed — throw original Gemini error
    throw geminiError || new Error('All LLM providers failed');
};

export { generateText, callGemini, callGroq, withTimeout, TIMEOUT_MS };
