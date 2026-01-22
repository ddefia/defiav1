
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { fetchPulseTrends, fetchMentions, TRACKED_BRANDS } from './ingest.js';

/**
 * GENERATOR SERVICE (Server-Side)
 * "The Writer"
 * 
 * Replicates the logic of the Frontend's `generateGrowthReport` but runs autonomously.
 */

const getSupabase = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
};

const getBrandProfile = async (supabase, brandId) => {
    // Fetch the huge JSON object that stores all profiles
    // Key matches services/storage.ts
    const STORAGE_KEY = 'ethergraph_brand_profiles_v17';

    try {
        const { data, error } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', STORAGE_KEY)
            .maybeSingle();

        if (error || !data) return null;

        const allProfiles = data.value;
        // Search case-insensitive
        const key = Object.keys(allProfiles).find(k => k.toLowerCase() === brandId.toLowerCase());
        return key ? allProfiles[key] : null;

    } catch (e) {
        console.error("Failed to load brand profiles from DB", e);
        return null;
    }
};

export const generateDailyBriefing = async (brandId) => {
    console.log(`[Generator] Starting Daily Briefing for ${brandId}...`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("[Generator] Missing GEMINI_API_KEY");
        return;
    }

    const supabase = getSupabase();
    if (!supabase) {
        console.error("[Generator] Missing Supabase Config");
        return;
    }

    // 1. Fetch Context
    const profile = await getBrandProfile(supabase, brandId);
    if (!profile) {
        console.warn(`[Generator] No profile found for ${brandId}. Skipping.`);
        return;
    }

    const brandName = profile.name || brandId;

    // 2. Fetch Live Market Data
    // We use the ingest keys/functions
    const lunarKey = process.env.VITE_LUNARCRUSH_API_KEY || process.env.LUNARCRUSH_API_KEY;
    const apifyKey = process.env.APIFY_API_TOKEN;

    const [trends, mentions] = await Promise.all([
        fetchPulseTrends(lunarKey),
        fetchMentions(apifyKey, TRACKED_BRANDS[brandId] || brandId)
    ]);

    // 3. Prepare Prompt (Replicating Frontend Logic)
    const significantTrends = trends
        .filter(t => t.relevanceScore > 70)
        .slice(0, 5)
        .map(t => `- ${t.headline} (${t.source}): ${t.summary}`)
        .join('\n');

    const kb = (profile.knowledgeBase && Array.isArray(profile.knowledgeBase))
        ? profile.knowledgeBase.join('\n')
        : "Brand context unavailable.";

    const systemInstruction = `
    You are the Chief Strategy Officer for ${brandName}.
    
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
