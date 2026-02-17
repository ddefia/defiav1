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

// ━━━ Image Generation ━━━

const generateImage = async (prompt, brandProfile) => {
    const genAI = getGenAI();
    const brandName = brandProfile.name || 'the brand';
    const colors = (brandProfile.colors || []).map(c => `${c.name || c.hex}: ${c.hex}`).join(', ');

    const imagePrompt = `
Create a professional social media graphic for ${brandName}.

VISUAL DIRECTION: ${prompt}
${colors ? `BRAND COLORS: ${colors}` : ''}

Style: Clean, modern, Web3/crypto aesthetic. Bold typography. Dark background preferred.
DO NOT include any text that looks like placeholder or lorem ipsum.
`;

    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: { parts: [{ text: imagePrompt }] },
            config: {
                responseModalities: ['image', 'text'],
            },
        });

        // Extract image from response
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith('image/')) {
                return part.inlineData.data; // base64
            }
        }
        return null;
    } catch (e) {
        console.error('[ContentGenerator] Image generation failed:', e.message);
        return null;
    }
};

// ━━━ Chat Response ━━━

const generateChatResponse = async (message, chatHistory = [], brandProfile, context = '') => {
    const genAI = getGenAI();
    const brandName = brandProfile.name || 'the brand';
    const kb = (brandProfile.knowledgeBase || []).length > 0
        ? `Brand Knowledge Base:\n${brandProfile.knowledgeBase.slice(0, 5).join('\n')}`
        : '';
    const voice = brandProfile.voiceGuidelines || 'Professional and helpful';

    const historyText = chatHistory.slice(-8).map(m => `${m.role}: ${m.text}`).join('\n');

    const systemInstruction = `
You are the AI marketing assistant for ${brandName}, operating in a Telegram group chat.
You are helpful, concise, and speak with the brand's voice.

BRAND VOICE: ${voice}
${kb}
${context ? `ADDITIONAL CONTEXT:\n${context}` : ''}

RULES:
- Be concise — this is Telegram, not an essay.
- Keep responses under 500 characters when possible.
- If asked about capabilities, mention you can: create tweets, generate images, analyze trends, and deliver daily briefings.
- Never make up facts about the brand — use the knowledge base.
- Be friendly and professional.

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
