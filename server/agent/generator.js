
import { GoogleGenAI } from '@google/genai';
import { fetchMentions, TRACKED_BRANDS } from './ingest.js';
import { fetchBrandProfile, getSupabaseClient } from './brandContext.js';

/**
 * GENERATOR SERVICE (Server-Side)
 * "The Writer"
 * 
 * Replicates the logic of the Frontend's `generateGrowthReport` but runs autonomously.
 */

export const generateDailyBriefing = async (brandId) => {
    console.log(`[Generator] Starting Daily Briefing for ${brandId}...`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("[Generator] Missing GEMINI_API_KEY");
        return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        console.error("[Generator] Missing Supabase Config");
        return;
    }

    // 1. Fetch Context
    const profile = await fetchBrandProfile(supabase, brandId);
    if (!profile) {
        console.warn(`[Generator] No profile found for ${brandId}. Skipping.`);
        return;
    }

    const brandName = profile.name || brandId;
    const voice = profile.voiceGuidelines || "Professional";
    const positioning = profile.positioning || "";

    // 2. Fetch Live Market Data
    const apifyKey = process.env.APIFY_API_TOKEN;

    const trends = [];
    const [mentions] = await Promise.all([
        fetchMentions(apifyKey, TRACKED_BRANDS[brandId] || brandId)
    ]);

    // 3. Prepare Prompt (Replicating Frontend Logic)
    // FILTER: Apply GAIA strict filtering to backend trends too
    const BLACKLIST = ['roblox', 'fortnite', 'minecraft', 'youtube', 'tiktok', 'netflix', 'disney', 'marvel', 'taylor swift'];

    const significantTrends = trends
        .filter(t => t.relevanceScore > 70) // Base relevance
        .filter(t => {
            const topic = t.headline ? t.headline.toLowerCase() : "";
            const matchesBlacklist = BLACKLIST.some(b => topic.includes(b));
            return !matchesBlacklist; // Remove if matches blacklist
        })
        .slice(0, 5)
        .map(t => `- ${t.headline} (${t.source}): ${t.summary}`)
        .join('\n');

    const kb = (profile.knowledgeBase && Array.isArray(profile.knowledgeBase))
        ? profile.knowledgeBase.join('\n')
        : "Brand context unavailable.";

    const systemInstruction = `
    You are the Chief Strategy Officer for ${brandName}.
    BRAND VOICE: ${voice}
    ${positioning ? `POSITIONING: ${positioning}` : ''}
    
    TASK: Generate the "Daily Strategic Briefing" based on real-time market signals.
    
    INPUT DATA:
    - KEY MARKET TRENDS:
    ${significantTrends || "No major market shifts detected."}
    
    - BRAND CONTEXT:
    ${kb}
    
    OUTPUT FORMAT (JSON):
    {
        "executiveSummary": "2 sentences summarizing the market state and our stance (e.g. 'Market is bullish on L2s. We should pivot content to emphasize speed.').",
        "tacticalPlan": "Specific, immediate actions for the social team (e.g. 'Reply to @Vitalik's post about scaling').",
        "strategicPlan": [
            {
                "action": "KILL" | "DOUBLE_DOWN" | "OPTIMIZE",
                "subject": "The specific initiative or topic",
                "reasoning": "Why we are taking this action based on the trends."
            },
             {
                "action": "DOUBLE_DOWN",
                "subject": "Example Topic",
                "reasoning": "Reason here."
            }
        ]
    }
    `;

    // 4. Generate with Gemini
    try {
        const genAI = new GoogleGenAI({ apiKey });
        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [{ text: "Generate Daily Briefing." }] },
            config: {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                responseMimeType: "application/json"
            }
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const parsed = JSON.parse(text);

        // Add Timestamp
        parsed.lastUpdated = Date.now();

        // 5. Save to Supabase (app_storage)
        const storageKey = `defia_growth_report_v1_${brandId.toLowerCase()}`;

        const { error } = await supabase
            .from('app_storage')
            .upsert({
                key: storageKey,
                value: parsed,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error(`[Generator] DB Save Failed for ${brandId}:`, error.message);
        } else {
            console.log(`[Generator] ✅ Daily Briefing saved for ${brandId} (Key: ${storageKey})`);
        }

    } catch (e) {
        console.error(`[Generator] Generation failed for ${brandId}`, e);
    }
};
