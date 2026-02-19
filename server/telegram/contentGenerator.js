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
 * Pick a reference image from the brand profile using the same priority as client-side:
 * 1. Template-linked images (the curated branded templates)
 * 2. Manually uploaded images (non-tweet, non-history)
 * 3. Any remaining image as last resort
 * Returns { base64, mimeType, name } or null.
 */
const pickReferenceImage = async (brandProfile) => {
    const refs = brandProfile.referenceImages || [];
    const templates = brandProfile.graphicTemplates || [];
    console.log(`[ContentGenerator] Reference images available: ${refs.length}, templates: ${templates.length}`);
    if (refs.length === 0) return null;

    // Collect all template-linked image IDs (these are the curated brand templates)
    const templateLinkedIds = new Set();
    templates.forEach(t => {
        (t.referenceImageIds || []).forEach(id => templateLinkedIds.add(id));
    });

    // Priority 0: Pinned images (user explicitly marked as core brand templates)
    const pinnedImages = refs.filter(r => r.pinned);
    // Priority 1: Template-linked images (the curated branded templates)
    const templateImages = refs.filter(r => templateLinkedIds.has(r.id));
    // Priority 2: Manually uploaded (not tweet-scraped, not history)
    const manualImages = refs.filter(r =>
        !templateLinkedIds.has(r.id) &&
        !r.name?.startsWith('tweet-') &&
        !r.id?.includes('_tweet-') &&
        !r.name?.startsWith('History:')
    );

    const candidates = pinnedImages.length > 0 ? pinnedImages
        : templateImages.length > 0 ? templateImages
        : manualImages.length > 0 ? manualImages
        : refs;

    const pool = pinnedImages.length > 0 ? 'PINNED'
        : templateImages.length > 0 ? 'TEMPLATE'
        : manualImages.length > 0 ? 'MANUAL'
        : 'ALL';
    console.log(`[ContentGenerator] Image selection: ${pinnedImages.length} pinned, ${templateImages.length} template-linked, ${manualImages.length} manual, using ${pool} pool (${candidates.length})`);

    // Shuffle candidates and pick first one that loads
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);

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
                console.log(`[ContentGenerator] Fetching reference image from URL: ${img.url.slice(0, 100)}...`);
                const res = await fetch(img.url);
                if (!res.ok) {
                    console.warn(`[ContentGenerator] Reference image fetch failed: ${res.status} ${res.statusText}`);
                    continue;
                }
                const arrayBuffer = await res.arrayBuffer();
                mimeType = res.headers.get('content-type') || 'image/png';
                base64 = Buffer.from(arrayBuffer).toString('base64');
                console.log(`[ContentGenerator] Reference image loaded: ${(base64.length / 1024).toFixed(0)}KB, type=${mimeType}`);
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
    const startTime = Date.now();
    const brandName = brandProfile.name || 'the brand';
    const colorPalette = (brandProfile.colors || []).map(c => `${c.name || c.hex} (${c.hex})`).join(', ');
    const visualIdentity = brandProfile.visualIdentity || brandProfile.visualStyle || '';

    // Step 1: Pick a reference image from the brand
    const refImage = await pickReferenceImage(brandProfile);
    console.log(`[ContentGenerator] Ref image picked in ${Date.now() - startTime}ms`);
    let styleDescription = '';

    // Step 2: Analyze reference image style (if we have one)
    if (refImage) {
        console.log(`[ContentGenerator] Using reference image: ${refImage.name}`);
        const analyzeStart = Date.now();
        styleDescription = await analyzeReferenceStyle(refImage);
        console.log(`[ContentGenerator] Style analysis done in ${Date.now() - analyzeStart}ms`);
    }

    // Step 3: Build the full branded prompt (mirrors client-side generateWeb3Graphic quality)
    console.log(`[ContentGenerator] Brand context: name=${brandName}, colors=${colorPalette ? colorPalette.slice(0, 80) + '...' : 'NONE'}, visualIdentity=${visualIdentity ? 'YES (' + visualIdentity.length + ' chars)' : 'NONE'}, refImage=${refImage ? refImage.name : 'NONE'}, styleDesc=${styleDescription ? 'YES (' + styleDescription.length + ' chars)' : 'NONE'}`);
    const QUALITY_SUFFIX = 'High Quality, 8k resolution, photorealistic, sharp focus, highly detailed, crystal clear, cinematic lighting.';

    const basePrompt = `You are an expert 3D graphic designer for ${brandName}, a leading Web3 company.
TASK: Create a professional social media graphic for: "${prompt}"

BRANDING ENFORCEMENT (CRITICAL):
Strict adherence to the brand identity is required.

1. COLORS:
   - PRIMARY PALETTE: ${colorPalette || 'Use professional, modern tones.'}
   - RULE: You MUST prioritize these exact colors.
   ${refImage ? '- REFERENCE ALIGNMENT: Match the color grading and saturation of the provided Reference Image EXACTLY.' : ''}

${visualIdentity ? `2. VISUAL IDENTITY SYSTEM:
${visualIdentity}
   - RULE: Follow these guidelines for composition, lighting, and texture.
` : ''}

3. STYLE & VIBE:
   - Style: PROFESSIONAL, HIGH-END, PREMIUM.
   ${styleDescription ? `- VISUAL STYLE EXTRACTION (FOLLOW STRICTLY): ${styleDescription}` : ''}
   - If a Reference Image is provided, you MUST mimic its:
     - Lighting (e.g. Neon vs Soft)
     - Materiality (e.g. Glass vs Metal)
     - Background Style (e.g. Abstract vs Cityscape)
   - DO NOT deviate from the established brand look.

4. LOGOS & TYPOGRAPHY (STRICT):
   - LOGOS: If a Logo is visible in the reference, leave space or abstractly represent the logo in the same position.
   - TEXT: If text is required, use the brand name "${brandName}" in a font style that matches the reference image.
   - CASE SENSITIVITY: Look at the Reference Image.
     - If the reference uses "Sentence case", you MUST use Sentence case.
     - If the reference uses "ALL CAPS", you may use ALL CAPS.
     - DEFAULT TO SENTENCE CASE if unclear. Do NOT use ALL CAPS by default.
   - DO NOT use generic or cartoony fonts.

INSTRUCTIONS:
- Analyze tweet/topic sentiment.
- STYLE ENFORCEMENT: ${QUALITY_SUFFIX}
- NEGATIVE (DO NOT INCLUDE): blurry, low quality, grainy, pixelated, distorted, watermark, bad composition, ugly, lowres, cartoon rocket ship, generic stock imagery, rainbow gradients.
- TEXT RULES:
  - NEVER copy-paste the full prompt text onto the image.
  - Use text SPARINGLY (Title/Stat only — max 5 words).

${refImage ? `REFERENCE IMAGE UTILIZATION (HIGHEST PRIORITY — OVERRIDES ALL OTHER INSTRUCTIONS):
- I have provided a reference image. This is your MASTER TEMPLATE.
- PIXEL-PERFECT REPLICATION MODE:
  - Your output MUST look like the reference image was opened in Photoshop and ONLY the text was swapped.
  - SAME background (exact colors, gradients, effects).
  - SAME layout (every element in the same position and proportion).
  - SAME typography style (font weight, case, size, color, effects).
  - SAME visual elements (shapes, icons, borders, cards, overlays) in the SAME positions.
  - SAME lighting, atmosphere, and color grading.
- ONLY CHANGE: Replace the headline text with a SHORT HEADLINE (Max 5 words) derived from: "${prompt}".
- DO NOT add, remove, or modify any visual elements.
- DO NOT change colors, lighting, or atmosphere.
- DO NOT reinterpret or "improve" the design. COPY IT EXACTLY.
` : ''}`.trim();

    // Step 4: Try Gemini native with reference image (multimodal)
    if (refImage) {
        console.log('[ContentGenerator] Step 4: Trying gemini-3-pro-image-preview with reference image...');
        const result = await tryGeminiImageWithRef(basePrompt, refImage);
        if (result) { console.log('[ContentGenerator] ✓ Image generated with reference'); return result; }
    }

    // Step 5: Try Gemini text-only
    console.log('[ContentGenerator] Step 5: Trying gemini-3-pro-image-preview text-only...');
    const geminiResult = await tryGeminiImage(basePrompt);
    if (geminiResult) { console.log('[ContentGenerator] ✓ Image generated (text-only)'); return geminiResult; }

    // Step 6: Fallback to Imagen 4 (text prompt only — no ref image support)
    console.log('[ContentGenerator] Step 6: Gemini failed, trying Imagen 4...');
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
                { text: `${prompt}\n\nThe image above is a STYLE REFERENCE from the brand — it is your MASTER TEMPLATE. Your output MUST look like this reference was opened in Photoshop and only the headline text was swapped. Same background, same layout, same color grading, same typography style, same visual elements. COPY it exactly — do NOT reinterpret or add generic clip art.` },
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

    const historyText = chatHistory.slice(-10).map(m => `${m.role}: ${m.text}`).join('\n');

    const systemInstruction = `
You are the marketing brain behind ${brandName}. You sit in this Telegram group as a team member — not an assistant, not a bot. You're the sharpest person in the room when it comes to marketing, positioning, and content for ${brandName}.

PERSONALITY:
- Talk like a real person in a group chat. Short, punchy, no fluff.
- Never say "Great question!" or "I'd be happy to help!" or any assistant-speak.
- No emojis unless it's genuinely funny or adds edge. Never decorative emojis.
- Be opinionated. Have a point of view. Say "here's what I'd do" not "here are some options."
- Match the energy of whoever's talking to you. Casual question = casual answer.
- You can be witty, dry, slightly irreverent. Never cringe. Never corporate.
- If someone asks something dumb, you can gently roast them while still helping.

${audienceStr}
${kb}
${enrichmentParts.length > 0 ? '\n' + enrichmentParts.join('\n') : ''}
${context ? `\nADDITIONAL CONTEXT:\n${context}` : ''}

RULES:
- Keep it tight. This is Telegram, not a blog post. 2-4 sentences usually.
- Never make up facts about ${brandName} — use the knowledge base.
- If they reference something from earlier in the conversation, you remember it. Use the history.
- If the request is vague, just take your best shot rather than asking 5 clarifying questions.
- You know you can draft tweets, create images, analyze trends, and pull briefings. Mention these naturally only when actually relevant, never as a list.

CONVERSATION HISTORY (IMPORTANT — this is your memory of the conversation):
${historyText || '(New conversation)'}
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
