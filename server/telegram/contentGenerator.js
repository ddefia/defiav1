/**
 * TELEGRAM CONTENT GENERATOR
 * Server-side content generation using brand context.
 * Ports the essential logic from client-side services/gemini.ts for Telegram use.
 */

import { GoogleGenAI } from '@google/genai';
import { getSupabaseClient } from '../agent/brandContext.js';

const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    return new GoogleGenAI({ apiKey });
};

// ━━━ Tweet Generation ━━━

const generateTweet = async (topic, brandProfile) => {
    const genAI = getGenAI();
    const brandName = brandProfile.name || 'the brand';
    const voice = brandProfile.voiceGuidelines || 'Professional and insightful';
    const examples = (brandProfile.tweetExamples || []).length > 0
        ? `STYLE REFERENCE (MIMIC THIS VOICE/PACE/LENGTH):\n${brandProfile.tweetExamples.map(t => `- ${t}`).join('\n')}`
        : '';
    const kb = (brandProfile.knowledgeBase || []).length > 0
        ? `KNOWLEDGE BASE (SOURCE OF TRUTH):\n${brandProfile.knowledgeBase.join('\n\n')}`
        : '';
    const banned = (brandProfile.bannedPhrases || []).length > 0
        ? `BANNED PHRASES: ${brandProfile.bannedPhrases.join(', ')}`
        : 'Avoid lazy AI words (e.g. Delve, Tapestry, Game changer, Unleash).';

    const systemInstruction = `
You are an Elite Content Creator for ${brandName}.
TASK: Write a single, high-quality tweet about: "${topic}".

TONE: ${voice}
${examples}
${kb}

CRITICAL RULES:
1. PRIORITIZE KNOWLEDGE BASE: If it contains specific facts, use them.
2. VALUE INFERENCE: If the topic is vague, infer specific benefits.
3. LENGTH: ~280 chars, but prioritize depth over brevity.
4. NO HASHTAGS (STRICTLY FORBIDDEN).
5. Use double line breaks between sections.

STRUCTURE:
1. HOOK: Punchy 1-sentence insight or headline.
2. BODY: Explain the "Why" in detail.
3. CTA: Clear directive.

${banned}
`;

    const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts: [{ text: `Generate a tweet about: "${topic}"` }] },
        config: {
            systemInstruction: { parts: [{ text: systemInstruction }] },
        },
    });

    const text = response.text || '';
    return text.trim();
};

// ━━━ Reference Image Helpers ━━━

/**
 * Pick a random reference image from the brand profile and resolve its base64 data.
 * Returns { base64, mimeType } or null.
 */
const pickReferenceImage = async (brandProfile) => {
    const refs = brandProfile.referenceImages || [];
    if (refs.length === 0) return null;

    // Shuffle and pick first one with data
    const shuffled = [...refs].sort(() => Math.random() - 0.5);

    for (const img of shuffled) {
        try {
            let base64 = null;
            let mimeType = 'image/png';

            if (img.data) {
                // Inline base64 data
                const match = img.data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9\-.+]+);base64,(.*)/);
                if (match) {
                    mimeType = match[1];
                    base64 = match[2];
                } else {
                    base64 = img.data.includes('base64,') ? img.data.split('base64,')[1] : img.data;
                }
            } else if (img.url) {
                // Fetch from URL (Supabase storage)
                const res = await fetch(img.url);
                if (!res.ok) continue;
                const arrayBuffer = await res.arrayBuffer();
                mimeType = res.headers.get('content-type') || 'image/png';
                base64 = Buffer.from(arrayBuffer).toString('base64');
            }

            if (base64) return { base64, mimeType, name: img.name || 'reference' };
        } catch (e) {
            console.warn(`[ContentGenerator] Failed to load reference image ${img.name || img.id}:`, e.message);
        }
    }
    return null;
};

/**
 * Analyze a reference image to extract a precise style description.
 * Same approach as client-side analyzeStyleFromReferences().
 */
const analyzeReferenceStyle = async (refImage) => {
    if (!refImage) return '';
    try {
        const genAI = getGenAI();
        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ parts: [
                { inlineData: { mimeType: refImage.mimeType, data: refImage.base64 } },
                { text: `Analyze this reference image to create an EXACT TEMPLATE SPECIFICATION for replication.

Describe with extreme precision:
1. LAYOUT: Position of every element using spatial relationships.
2. COLORS: Every dominant color as hex values. Background gradient direction.
3. TYPOGRAPHY: Font style, weight, case, size relative to frame.
4. VISUAL ELEMENTS: Shapes, icons, patterns, 3D objects, borders, overlays.
5. LIGHTING: Light direction, ambient glow colors, contrast level.
6. COMPOSITION: Alignment, margins, spacing, visual hierarchy.

Be forensically precise. A designer reading ONLY your description should recreate this with different text.` }
            ] }],
            config: { temperature: 0.2 },
        });

        const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text
            || (typeof response.text === 'function' ? response.text() : response.text)
            || '';
        return resultText.trim() ? `VISUAL STYLE REFERENCE (from brand's own images):\n${resultText.trim()}` : '';
    } catch (e) {
        console.warn('[ContentGenerator] Reference style analysis failed:', e.message);
        return '';
    }
};

// ━━━ Image Generation ━━━

/**
 * Generates a branded image using reference images from the brand profile.
 *
 * Flow:
 * 1. Pick a random reference image from the brand profile
 * 2. Analyze it to extract a precise style description
 * 3. Generate via Gemini (multimodal — passes ref image + style + prompt)
 * 4. Fallback to Imagen 4 (text-only prompt with style description)
 */
const generateImage = async (prompt, brandProfile) => {
    const brandName = brandProfile.name || 'the brand';
    const colors = (brandProfile.colors || []).map(c => `${c.name || c.hex}: ${c.hex}`).join(', ');
    const visualIdentity = brandProfile.visualIdentity || brandProfile.visualStyle || '';

    // Step 1: Pick a reference image from the brand
    const refImage = await pickReferenceImage(brandProfile);
    let styleDescription = '';

    // Step 2: Analyze reference image style (if we have one)
    if (refImage) {
        console.log(`[ContentGenerator] Using reference image: ${refImage.name}`);
        styleDescription = await analyzeReferenceStyle(refImage);
    }

    const basePrompt = `Create a professional social media graphic for ${brandName}.

VISUAL DIRECTION: ${prompt}
${colors ? `BRAND COLORS: ${colors}` : ''}
${visualIdentity ? `BRAND VISUAL IDENTITY:\n${visualIdentity}` : ''}
${styleDescription}

CRITICAL RULES:
- MATCH the reference image style EXACTLY — same colors, layout patterns, typography feel.
- DO NOT include any text that looks like placeholder or lorem ipsum.
- Professional, clean, modern aesthetic.`.trim();

    // Step 3: Try Gemini native with reference image (multimodal)
    if (refImage) {
        console.log('[ContentGenerator] Step 3: Trying gemini-3-pro-image-preview with reference image...');
        const result = await tryGeminiImageWithRef(basePrompt, refImage);
        if (result) { console.log('[ContentGenerator] ✓ Image generated with reference'); return result; }
    }

    // Step 4: Try Gemini text-only
    console.log('[ContentGenerator] Step 4: Trying gemini-3-pro-image-preview text-only...');
    const geminiResult = await tryGeminiImage(basePrompt);
    if (geminiResult) { console.log('[ContentGenerator] ✓ Image generated (text-only)'); return geminiResult; }

    // Step 5: Fallback to Imagen 4 (text prompt only — no ref image support)
    console.log('[ContentGenerator] Step 5: Gemini failed, trying Imagen 4...');
    const imagenResult = await tryImagen4(basePrompt);
    if (imagenResult) { console.log('[ContentGenerator] ✓ Image generated via Imagen 4'); return imagenResult; }
    console.error('[ContentGenerator] ✗ All image generation methods failed');
    return null;
};

/**
 * Gemini native image generation WITH a reference image passed as multimodal input.
 */
const tryGeminiImageWithRef = async (prompt, refImage) => {
    try {
        const genAI = getGenAI();
        const response = await genAI.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: [{ parts: [
                // Pass the reference image so Gemini can SEE it
                { inlineData: { mimeType: refImage.mimeType, data: refImage.base64 } },
                { text: `${prompt}\n\nThe image above is a STYLE REFERENCE from the brand. Your generated image MUST match this visual style (colors, layout patterns, typography feel) but with new content based on the visual direction above.` },
            ] }],
            config: {
                imageConfig: {
                    aspectRatio: '1:1',
                },
            },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith('image/')) {
                return part.inlineData.data; // base64
            }
        }
        return null;
    } catch (e) {
        console.warn('[ContentGenerator] Gemini multimodal image gen failed:', e.message);
        return null;
    }
};

/**
 * Gemini native image generation (text prompt only, no reference).
 */
const tryGeminiImage = async (prompt) => {
    try {
        const genAI = getGenAI();
        const response = await genAI.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                imageConfig: {
                    aspectRatio: '1:1',
                },
            },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith('image/')) {
                return part.inlineData.data; // base64
            }
        }
        return null;
    } catch (e) {
        console.error('[ContentGenerator] Gemini text-only image gen failed:', e.message);
        return null;
    }
};

/**
 * Imagen 4 via Vertex AI (text prompt only — no multimodal reference support).
 */
const tryImagen4 = async (prompt) => {
    try {
        const serverUrl = process.env.FRONTEND_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL || new URL(process.env.FRONTEND_URL).host}`
            : 'http://localhost:3001';

        const response = await fetch(`${serverUrl}/api/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, aspectRatio: '1:1' }),
        });

        if (!response.ok) {
            console.warn(`[ContentGenerator] Imagen 4 returned ${response.status}`);
            return null;
        }

        const data = await response.json();
        if (data.image) {
            const raw = data.image.includes('base64,')
                ? data.image.split('base64,')[1]
                : data.image;
            return raw;
        }
        return null;
    } catch (e) {
        console.warn('[ContentGenerator] Imagen 4 call failed:', e.message);
        return null;
    }
};

// ━━━ Chat Response (AI CMO Mode) ━━━

const generateChatResponse = async (message, chatHistory = [], brandProfile, context = '', enrichment = {}) => {
    const genAI = getGenAI();
    const brandName = brandProfile.name || 'the brand';
    const kb = (brandProfile.knowledgeBase || []).length > 0
        ? `Brand Knowledge Base:\n${brandProfile.knowledgeBase.slice(0, 5).join('\n')}`
        : '';
    const voice = brandProfile.voiceGuidelines || 'Professional and helpful';
    const audiences = (brandProfile.audiences || brandProfile.targetAudience || []);
    const audienceStr = audiences.length > 0
        ? `Target Audiences: ${audiences.map(a => typeof a === 'string' ? a : a.name || a.label).join(', ')}`
        : '';

    // Build enrichment context from recent recommendations, briefing, etc.
    const enrichmentParts = [];
    if (enrichment.recentRecommendations?.length > 0) {
        enrichmentParts.push('RECENT AI RECOMMENDATIONS:');
        enrichment.recentRecommendations.slice(0, 3).forEach((r, i) => {
            enrichmentParts.push(`${i + 1}. [${r.action}] ${r.reason || ''} ${r.draft ? '— Draft: ' + r.draft.slice(0, 80) : ''}`);
        });
    }
    if (enrichment.briefingSummary) {
        enrichmentParts.push(`\nLATEST BRIEFING SUMMARY:\n${enrichment.briefingSummary.slice(0, 300)}`);
    }

    const historyText = chatHistory.slice(-8).map(m => `${m.role}: ${m.text}`).join('\n');

    const systemInstruction = `
You are the AI CMO (Chief Marketing Officer) for ${brandName}, operating in a Telegram chat.
You are the same AI that powers the Defia dashboard — knowledgeable, strategic, and proactive.

BRAND VOICE: ${voice}
${audienceStr}
${kb}
${enrichmentParts.length > 0 ? '\n' + enrichmentParts.join('\n') : ''}
${context ? `\nADDITIONAL CONTEXT:\n${context}` : ''}

CAPABILITIES — remind the user they can:
- Ask you to "write a tweet about X" or "draft a post about Y"
- Say "create an image for X" or send a reference image + "make something like this"
- Ask "what's trending?" for market analysis
- Say "use recommendation #1" to turn AI suggestions into content
- Type /brief for the daily briefing

RULES:
- Be concise — this is Telegram, not an essay. Max 600 characters unless detail is needed.
- Act as a strategic marketing advisor, not just a chatbot.
- Reference recent AI recommendations or briefing data when relevant.
- Never make up facts about the brand — use the knowledge base.
- Be friendly, direct, and actionable.
- If the user asks something vague, suggest specific actions they can take.

CONVERSATION HISTORY:
${historyText || 'No previous messages.'}
`;

    const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts: [{ text: message }] },
        config: {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            temperature: 0.7,
        },
    });

    return (response.text || 'Sorry, I couldn\'t generate a response.').trim();
};

// ━━━ Image Analysis (Multimodal) ━━━

const analyzeImage = async (imageBase64, caption = '') => {
    const genAI = getGenAI();

    const parts = [
        {
            inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
            },
        },
        {
            text: caption
                ? `The user sent this image with caption: "${caption}". Describe the visual style, colors, layout, and mood of this image. Then explain how it could inspire a social media post.`
                : 'Describe the visual style, colors, layout, and mood of this image. How could this inspire a social media post?',
        },
    ];

    const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts },
        config: { temperature: 0.3 },
    });

    return (response.text || '').trim();
};

// ━━━ Trend Summary ━━━

const summarizeTrends = async (brandId, supabase) => {
    if (!supabase) return { summary: 'Unable to fetch trends.', trends: [] };

    // Fetch latest web3 news from app_storage
    const brandName = brandId.toLowerCase();
    const { data: rows } = await supabase
        .from('app_storage')
        .select('value')
        .like('key', `%web3_news%`)
        .order('updated_at', { ascending: false })
        .limit(1);

    let newsItems = [];
    if (rows && rows.length > 0 && rows[0].value) {
        const val = rows[0].value;
        newsItems = Array.isArray(val) ? val : (val.items || val.articles || []);
    }

    // Also check pulse/trends cache
    const { data: pulseRows } = await supabase
        .from('app_storage')
        .select('value')
        .like('key', `%pulse_cache%${brandName}%`)
        .order('updated_at', { ascending: false })
        .limit(1);

    let trendItems = [];
    if (pulseRows && pulseRows.length > 0 && pulseRows[0].value) {
        const val = pulseRows[0].value;
        trendItems = val.items || [];
    }

    // Combine and summarize
    const combined = [...trendItems.slice(0, 5), ...newsItems.slice(0, 5)];

    if (combined.length === 0) {
        return { summary: 'No recent trends or news found.', trends: [] };
    }

    // Use Gemini to create a quick summary
    try {
        const genAI = getGenAI();
        const newsText = combined.map(item => {
            const headline = item.headline || item.title || '';
            const source = item.source || item.news_provider || '';
            const summary = item.summary || '';
            return `- ${headline} (${source}): ${summary}`;
        }).join('\n');

        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [{ text: `Summarize these Web3/crypto trends and news in 3-4 bullet points. Be concise:\n\n${newsText}` }] },
            config: { temperature: 0.3 },
        });

        return {
            summary: (response.text || '').trim(),
            trends: combined.slice(0, 8),
        };
    } catch (e) {
        console.error('[ContentGenerator] Trend summarization failed:', e.message);
        return {
            summary: combined.slice(0, 3).map(i => `• ${i.headline || i.title}`).join('\n'),
            trends: combined,
        };
    }
};

// ━━━ Fetch Recommendations ━━━

const getRecentRecommendations = async (brandId, supabase, limit = 5) => {
    if (!supabase || !brandId) return [];

    const { data, error } = await supabase
        .from('agent_decisions')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error || !data) return [];
    return data;
};

// ━━━ Fetch Daily Briefing ━━━

const getLatestBriefing = async (brandId, supabase) => {
    if (!supabase || !brandId) return null;

    const storageKey = `defia_growth_report_v1_${brandId.toLowerCase()}`;
    const { data, error } = await supabase
        .from('app_storage')
        .select('value')
        .eq('key', storageKey)
        .maybeSingle();

    if (error || !data?.value) return null;
    return data.value;
};

export {
    generateTweet,
    generateImage,
    generateChatResponse,
    analyzeImage,
    summarizeTrends,
    getRecentRecommendations,
    getLatestBriefing,
};
