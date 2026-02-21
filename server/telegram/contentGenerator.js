/**
 * TELEGRAM CONTENT GENERATOR
 * Server-side content generation using brand context.
 * Ports the essential logic from client-side services/gemini.ts for Telegram use.
 */

import { GoogleGenAI } from '@google/genai';
import { getSupabaseClient } from '../agent/brandContext.js';
import { generateText, withTimeout, TIMEOUT_MS } from './llm.js';

// Gemini client for multimodal calls (image analysis, image generation).
// Text-only calls go through generateText() which has Groq fallback.
const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    return new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
};

// ━━━ Tweet Generation ━━━

const generateTweet = async (topic, brandProfile) => {
    const brandName = brandProfile.name || 'the brand';
    const voice = brandProfile.voiceGuidelines || 'Narrative Authority: Insightful, grounded, and high-signal. Speak to mechanics, not just features.';
    const examples = (brandProfile.tweetExamples || []).length > 0
        ? `STYLE REFERENCE (MIMIC THIS VOICE/PACE/LENGTH):\n${brandProfile.tweetExamples.map(t => `- ${t}`).join('\n')}`
        : '';
    const avoidExamples = (brandProfile.rejectedStyleExamples || []).length > 0
        ? `\nAVOID THESE STYLE PATTERNS (DO NOT COPY TONE/STRUCTURE):\n${brandProfile.rejectedStyleExamples.map(t => `- ${t}`).join('\n')}\n`
        : '';

    const templateExamples = (brandProfile.graphicTemplates || [])
        .filter(t => t.tweetExample && t.tweetExample.trim().length > 0)
        .map(t => `[TEMPLATE STYLE: ${t.label}]: "${t.tweetExample}"`)
        .join('\n');
    const templateContext = templateExamples.length > 0
        ? `\nTEMPLATE-SPECIFIC WRITING STYLES (Use these if the output fits the template context):\n${templateExamples}`
        : '';

    const kb = (brandProfile.knowledgeBase || []).length > 0
        ? `KNOWLEDGE BASE (THE ABSOLUTE SOURCE OF TRUTH):\n${brandProfile.knowledgeBase.join('\n\n')}`
        : '';
    const banned = (brandProfile.bannedPhrases || []).length > 0
        ? `STRICTLY BANNED PHRASES: ${brandProfile.bannedPhrases.join(', ')}`
        : 'Avoid lazy AI words (e.g. Delve, Tapestry, Game changer, Unleash).';

    const toneNotes = brandProfile.toneGuidelines ? `\nADDITIONAL TONE NOTES: ${brandProfile.toneGuidelines}` : '';
    const audienceList = brandProfile.audiences || [];
    const audienceContext = audienceList.length > 0
        ? `\nTARGET AUDIENCE: ${audienceList.map(a => typeof a === 'string' ? a : a.title || a.name || a.label || '').filter(Boolean).join(', ')}`
        : (brandProfile.targetAudience ? `\nTARGET AUDIENCE: ${brandProfile.targetAudience}` : '');

    const systemPrompt = `You are an Elite Crypto Content Creator for ${brandName}.
You are known for high-signal content that simplifies complex topics without losing nuance.

TASK: Write a single, high-quality tweet about: "${topic}".

TONE: ${voice}${toneNotes}${audienceContext}
- BALANCE: Be authoritative but friendly.
- ACCESSIBILITY: Deep technical understanding, explained simply.

${examples}
${avoidExamples}
${templateContext}

${kb}

CRITICAL RULES:
1. PRIORITIZE KNOWLEDGE BASE: If the Knowledge Base contains specific facts, terminology, or goals, you MUST use them.
2. VALUE INFERENCE: If the topic is vague, logically infer specific benefits (Liquidity, Speed, Yield).
3. AUTHENTIC PROFESSIONALISM: It is okay to say "We are excited" for major news, but avoid overusing it. Be human.
4. FORMATTING: Use short paragraphs. Use bullet points (•) if listing benefits.

INSTRUCTIONS:
- ${banned}
- LENGTH: Optimal ~280 chars, but prioritize DEPTH. Do NOT sacrifice detail for brevity.

INTENT RECOGNITION & ADAPTATION:
- IF ANNOUNCEMENT/PARTNERSHIP:
  - Start with a strong Hook/Headline (e.g. PARTNERSHIP SECURED).
  - Use limited emojis (🚨, 🤝) for impact.
  - CRITICAL: List 2-3 specific benefits. If not provided, infer them from the context of the brands.
  - STORYTELLING: Do not just announce. Explain the "Journey" that led here.
- IF INSIGHT/THOUGHT:
  - Focus on the "Alpha". Why does this matter? What is the mechanic?
  - DEEP DIVE: Explain the technical nuance. Assume the reader is smart.

STRICT STRUCTURE:
1. HOOK: A punchy, 1-sentence insight or headline.
2. BODY: Explain the "Why" in detail. Use bullets if helpful. MAKE IT DENSE.
3. CTA: Clear directive.

FORMATTING REQUIREMENTS:
- YOU MUST use double line breaks between sections.
- NO HASHTAGS (STRICTLY FORBIDDEN).`;

    const raw = await generateText({
        systemPrompt,
        userMessage: `Generate a tweet about: "${topic}"`,
        _source: 'telegram-bot', _endpoint: 'contentGen.generateTweet',
    });
    // Hard strip any hashtags the LLM snuck in (e.g. #L2 #DeFi)
    return (raw || '').replace(/#\w+/g, '').replace(/  +/g, ' ').trim();
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
        const response = await withTimeout(genAI.models.generateContent({
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
        }));

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

    // Step 3: Build the full branded prompt (mirrors client-side generateWeb3Graphic)
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
   - CASE SENSITIVITY: DEFAULT TO SENTENCE CASE. Do NOT use ALL CAPS by default.
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

    // Step 7: Fallback to BFL Flux 2 (external API, no Gemini dependency)
    console.log('[ContentGenerator] Step 7: All Gemini methods failed, trying Flux 2...');
    const fluxResult = await tryFlux2(prompt); // Use original prompt, not the huge basePrompt
    if (fluxResult) { console.log('[ContentGenerator] ✓ Image generated via Flux 2'); return fluxResult; }

    console.error('[ContentGenerator] ✗ All image generation methods failed');
    return null;
};

/**
 * Gemini native image generation WITH a reference image passed as multimodal input.
 */
const tryGeminiImageWithRef = async (prompt, refImage) => {
    try {
        const genAI = getGenAI();
        const response = await withTimeout(genAI.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: [{ parts: [
                // Pass the reference image so Gemini can SEE it
                { inlineData: { mimeType: refImage.mimeType, data: refImage.base64 } },
                { text: `${prompt}

I have provided 1 reference image above. This is your MASTER TEMPLATE.
🚨 PIXEL-PERFECT REPLICATION MODE:
- Your output MUST look like the reference image was opened in Photoshop and ONLY the text was swapped.
- SAME background (exact colors, gradients, effects).
- SAME layout (every element in the same position and proportion).
- SAME typography style (font weight, case, size, color, effects).
- SAME visual elements (shapes, icons, borders, cards, overlays) in the SAME positions.
- SAME lighting, atmosphere, and color grading.
- ONLY CHANGE: Replace the headline text with a SHORT HEADLINE (Max 5 words). 🚨 NEVER paste full text.
- DO NOT add, remove, or modify any visual elements.
- DO NOT change colors, lighting, or atmosphere.
- DO NOT reinterpret or "improve" the design. COPY IT EXACTLY.` },
            ] }],
            config: {
                imageConfig: {
                    aspectRatio: '1:1',
                },
            },
        }));

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
        const response = await withTimeout(genAI.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                imageConfig: {
                    aspectRatio: '1:1',
                },
            },
        }));

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

/**
 * BFL Flux 2 image generation (text prompt only — async polling API).
 * Uses FLUX.2 klein-9b model as fallback when Gemini image gen is unavailable.
 */
const tryFlux2 = async (prompt) => {
    const apiKey = process.env.BFL_API_KEY;
    if (!apiKey) {
        console.warn('[ContentGenerator] BFL_API_KEY not set, skipping Flux 2 fallback');
        return null;
    }

    try {
        // Step 1: Submit generation request
        console.log('[ContentGenerator] Flux 2: Submitting generation request...');
        const submitRes = await fetch('https://api.bfl.ai/v1/flux-2-klein-9b', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-key': apiKey,
                'accept': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt.slice(0, 2000), // BFL has prompt length limits
                width: 1024,
                height: 1024,
            }),
        });

        if (!submitRes.ok) {
            const errText = await submitRes.text().catch(() => '');
            console.warn(`[ContentGenerator] Flux 2 submit failed: ${submitRes.status} ${errText.slice(0, 200)}`);
            return null;
        }

        const submitData = await submitRes.json();
        const pollingUrl = submitData.polling_url;
        if (!pollingUrl) {
            console.warn('[ContentGenerator] Flux 2: No polling_url returned');
            return null;
        }

        // Step 2: Poll for result (max 60s, poll every 2s)
        const maxPolls = 30;
        for (let i = 0; i < maxPolls; i++) {
            await new Promise(r => setTimeout(r, 2000));

            const pollRes = await fetch(pollingUrl, {
                headers: { 'x-key': apiKey, 'accept': 'application/json' },
            });

            if (!pollRes.ok) continue;

            const pollData = await pollRes.json();
            if (pollData.status === 'Ready' && pollData.result?.sample) {
                // Step 3: Download the image and convert to base64
                console.log('[ContentGenerator] Flux 2: Image ready, downloading...');
                const imgRes = await fetch(pollData.result.sample);
                if (!imgRes.ok) {
                    console.warn('[ContentGenerator] Flux 2: Failed to download result image');
                    return null;
                }
                const arrayBuffer = await imgRes.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                return base64;
            }

            if (pollData.status === 'Error' || pollData.status === 'Failed') {
                console.warn(`[ContentGenerator] Flux 2 generation failed: ${pollData.status}`);
                return null;
            }
            // Otherwise status is 'Pending' / 'Processing' — keep polling
        }

        console.warn('[ContentGenerator] Flux 2: Polling timed out after 60s');
        return null;
    } catch (e) {
        console.warn('[ContentGenerator] Flux 2 call failed:', e.message);
        return null;
    }
};

// ━━━ Title Extraction (for Image Prompts) ━━━

/**
 * Extract a short visual title/concept from a long tweet or message.
 * The client-side UI does this via the template selector — the bot needs to do it with LLM.
 * Returns a 2-5 word title suitable for image generation.
 */
const extractImageTitle = async (rawText, brandName = '') => {
    // If already short enough (under 8 words), use as-is
    const wordCount = rawText.trim().split(/\s+/).length;
    if (wordCount <= 8) return rawText.trim();

    try {
        const result = await generateText({
            systemPrompt: `You extract short visual titles from tweets/text. Return ONLY the title, nothing else.`,
            _source: 'telegram-bot', _endpoint: 'contentGen.extractImageTitle',
            userMessage: `Extract a 2-5 word visual headline from this text. The headline should capture the CORE CONCEPT that a graphic designer would visualize.${brandName ? ` Brand: ${brandName}.` : ''}

Text: "${rawText}"

Return ONLY the 2-5 word title. No quotes, no explanation.`,
            temperature: 0.1,
        });

        const title = (result || '').trim().replace(/^["']|["']$/g, '');
        // Sanity check — if LLM returned something too long, truncate
        const words = title.split(/\s+/);
        if (words.length > 8) return words.slice(0, 5).join(' ');
        return title || rawText.slice(0, 60);
    } catch (e) {
        console.warn('[ContentGenerator] Title extraction failed, using first 8 words:', e.message);
        return rawText.split(/\s+/).slice(0, 8).join(' ');
    }
};

// ━━━ Chat Response (AI CMO Mode) ━━━

const generateChatResponse = async (message, chatHistory = [], brandProfile, context = '', enrichment = {}) => {
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

    const systemPrompt = `You are the marketing brain behind ${brandName}. You sit in this Telegram group as a team member — not an assistant, not a bot. You're the sharpest person in the room when it comes to marketing, positioning, and content for ${brandName}.

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
${historyText || '(New conversation)'}`;

    return generateText({
        systemPrompt,
        userMessage: message,
        temperature: 0.7,
        _source: 'telegram-bot', _endpoint: 'contentGen.chatResponse',
    });
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

    const response = await withTimeout(genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts },
        config: { temperature: 0.3 },
    }));

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

    // Summarize with LLM (Gemini → Groq fallback)
    try {
        const newsText = combined.map(item => {
            const headline = item.headline || item.title || '';
            const source = item.source || item.news_provider || '';
            const summary = item.summary || '';
            return `- ${headline} (${source}): ${summary}`;
        }).join('\n');

        const summary = await generateText({
            userMessage: `You're the marketing lead for ${brandId}. Based on these trends, give a 2-3 sentence take on what matters for us and what we should jump on. Be direct, no fluff, no bullet points — talk like a teammate in a group chat.\n\n${newsText}`,
            temperature: 0.5,
            _source: 'telegram-bot', _endpoint: 'contentGen.summarizeTrends',
        });

        return {
            summary,
            trends: combined.slice(0, 4),
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

// ━━━ Tweet URL Helpers ━━━

/** Regex to match X/Twitter tweet URLs */
const TWEET_URL_REGEX = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i;

/**
 * Extract a tweet URL from a message string.
 * Returns { url, username, tweetId } or null.
 */
const extractTweetUrl = (text) => {
    if (!text) return null;
    const match = text.match(TWEET_URL_REGEX);
    if (!match) return null;
    return { url: match[0], username: match[1], tweetId: match[2] };
};

/**
 * Fetch the original tweet content from a tweet URL.
 * Uses Twitter's syndication API (no auth required) as primary,
 * falls back to oEmbed API.
 */
const fetchTweetContent = async (tweetId) => {
    // Method 1: Twitter syndication API (returns full tweet JSON, no auth needed)
    try {
        const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=0`;
        const res = await fetch(syndicationUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Defia/1.0)',
                'Accept': 'application/json',
            },
        });

        if (res.ok) {
            const data = await res.json();
            const text = data.text || '';
            const authorName = data.user?.name || '';
            const authorHandle = data.user?.screen_name || '';
            if (text) {
                return {
                    text,
                    authorName,
                    authorHandle,
                    source: 'syndication',
                };
            }
        }
    } catch (e) {
        console.warn('[ContentGenerator] Syndication API failed:', e.message);
    }

    // Method 2: oEmbed API (returns HTML snippet, we extract text)
    try {
        const oembedUrl = `https://publish.twitter.com/oembed?url=https://twitter.com/i/status/${tweetId}&omit_script=true`;
        const res = await fetch(oembedUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Defia/1.0)' },
        });

        if (res.ok) {
            const data = await res.json();
            // Extract text from the HTML blockquote
            const html = data.html || '';
            const textMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
            const rawText = textMatch ? textMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';
            const authorName = data.author_name || '';
            const authorHandle = data.author_url?.split('/').pop() || '';

            if (rawText) {
                return {
                    text: rawText,
                    authorName,
                    authorHandle,
                    source: 'oembed',
                };
            }
        }
    } catch (e) {
        console.warn('[ContentGenerator] oEmbed API failed:', e.message);
    }

    // Method 3: Use Apify if available
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (apifyToken) {
        try {
            console.log('[ContentGenerator] Trying Apify tweet scraper...');
            const res = await fetch('https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items?token=' + apifyToken, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tweetIDs: [tweetId],
                    maxItems: 1,
                }),
            });

            if (res.ok) {
                const items = await res.json();
                if (items?.[0]?.full_text || items?.[0]?.text) {
                    return {
                        text: items[0].full_text || items[0].text,
                        authorName: items[0].user?.name || '',
                        authorHandle: items[0].user?.screen_name || '',
                        source: 'apify',
                    };
                }
            }
        } catch (e) {
            console.warn('[ContentGenerator] Apify tweet fetch failed:', e.message);
        }
    }

    return null;
};

// ━━━ Quote Retweet Generation ━━━

/**
 * Generate a quote retweet in the brand's voice.
 * Takes the original tweet text + brand profile and generates a QRT draft.
 * Uses the exact same model, voice, knowledge base, and style as generateTweet.
 */
const generateQuoteRetweet = async (originalTweet, brandProfile) => {
    const brandName = brandProfile.name || 'the brand';
    const voice = brandProfile.voiceGuidelines || 'Narrative Authority: Insightful, grounded, and high-signal. Speak to mechanics, not just features.';
    const examples = (brandProfile.tweetExamples || []).length > 0
        ? `STYLE REFERENCE (MIMIC THIS VOICE/PACE/LENGTH):\n${brandProfile.tweetExamples.map(t => `- ${t}`).join('\n')}`
        : '';
    const avoidExamples = (brandProfile.rejectedStyleExamples || []).length > 0
        ? `\nAVOID THESE STYLE PATTERNS (DO NOT COPY TONE/STRUCTURE):\n${brandProfile.rejectedStyleExamples.map(t => `- ${t}`).join('\n')}\n`
        : '';

    const kb = (brandProfile.knowledgeBase || []).length > 0
        ? `KNOWLEDGE BASE (THE ABSOLUTE SOURCE OF TRUTH):\n${brandProfile.knowledgeBase.join('\n\n')}`
        : '';
    const banned = (brandProfile.bannedPhrases || []).length > 0
        ? `STRICTLY BANNED PHRASES: ${brandProfile.bannedPhrases.join(', ')}`
        : 'Avoid lazy AI words (e.g. Delve, Tapestry, Game changer, Unleash).';

    const qrtToneNotes = brandProfile.toneGuidelines ? `\nADDITIONAL TONE NOTES: ${brandProfile.toneGuidelines}` : '';

    const authorCredit = originalTweet.authorHandle
        ? ` by @${originalTweet.authorHandle}`
        : originalTweet.authorName
        ? ` by ${originalTweet.authorName}`
        : '';

    const systemPrompt = `You are an Elite Crypto Content Creator for ${brandName}.
You are writing a QUOTE RETWEET — a response that adds value on top of an existing tweet.

ORIGINAL TWEET${authorCredit}:
"${originalTweet.text}"

TASK: Write a sharp, high-quality quote retweet that adds ${brandName}'s perspective on this tweet.

TONE: ${voice}${qrtToneNotes}
- BALANCE: Be authoritative but friendly.
- ACCESSIBILITY: Deep technical understanding, explained simply.

${examples}
${avoidExamples}

${kb}

QUOTE RETWEET STRATEGY:
1. NEVER just agree or parrot the original tweet. ADD something new.
2. Options (pick the best fit):
   a. ADD CONTEXT: Share specific data, insight, or alpha that the original missed
   b. PERSONAL ANGLE: Connect it to what ${brandName} is building or has shipped
   c. HOT TAKE: Respectfully agree OR push back with a unique angle
   d. AMPLIFY: If the original mentions ${brandName}, celebrate it with substance (not just "thanks!")
   e. BRIDGE: Connect the tweet's topic to something ${brandName} solves or enables
3. The QRT should make people want to follow ${brandName} — show expertise, not just engagement.

CRITICAL RULES:
1. PRIORITIZE KNOWLEDGE BASE: If the Knowledge Base contains relevant facts, USE them.
2. Be conversational and authentic — this is a QRT, not a blog post.
3. Keep it punchy: 1-3 sentences max. This is the addition ON TOP of the original tweet.
4. If the original tweet is about a topic ${brandName} has expertise in, SHOW that expertise.

INSTRUCTIONS:
- ${banned}
- LENGTH: Short and impactful. 1-3 sentences. The original tweet provides the context — your QRT adds the edge.
- NO HASHTAGS (STRICTLY FORBIDDEN).
- Do NOT start with "Great point" or "Love this" or "This is so true" — these are filler. Start with substance.
- Do NOT quote or repeat what the original tweet says — the reader can already see it.`;

    const raw = await generateText({
        systemPrompt,
        userMessage: `Write a quote retweet for this tweet: "${originalTweet.text}"`,
        _source: 'telegram-bot', _endpoint: 'contentGen.generateQuoteRetweet',
    });

    // Hard strip any hashtags the LLM snuck in
    return (raw || '').replace(/#\w+/g, '').replace(/  +/g, ' ').trim();
};

export {
    generateTweet,
    generateImage,
    generateChatResponse,
    analyzeImage,
    summarizeTrends,
    getRecentRecommendations,
    getLatestBriefing,
    extractImageTitle,
    extractTweetUrl,
    fetchTweetContent,
    generateQuoteRetweet,
};
