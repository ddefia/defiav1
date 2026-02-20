
import { fetchMentions, TRACKED_BRANDS } from './ingest.js';
import { fetchBrandProfile, getSupabaseClient } from './brandContext.js';
import { generateText } from '../telegram/llm.js';

/**
 * GENERATOR SERVICE (Server-Side)
 * "The Writer"
 *
 * Generates data-driven daily briefings using real social metrics,
 * engagement data, and market signals.
 */

// ━━━ Data Fetchers ━━━

const fetchLunarCrushData = async (xHandle) => {
    const apiKey = process.env.VITE_LUNARCRUSH_API_KEY || process.env.LUNARCRUSH_API_KEY;
    if (!apiKey) {
        console.warn('[Generator] LunarCrush: No API key found (set LUNARCRUSH_API_KEY or VITE_LUNARCRUSH_API_KEY in Vercel env vars)');
        return null;
    }
    if (!xHandle) {
        console.warn('[Generator] LunarCrush: No X handle provided');
        return null;
    }

    // LunarCrush expects handle without @ prefix
    const cleanHandle = xHandle.replace(/^@/, '');
    console.log(`[Generator] LunarCrush: Fetching data for @${cleanHandle}...`);

    try {
        const [creatorRes, postsRes] = await Promise.all([
            fetch(`https://lunarcrush.com/api4/public/creator/twitter/${cleanHandle}/v1`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            }),
            fetch(`https://lunarcrush.com/api4/public/creator/twitter/${cleanHandle}/posts/v1`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            }),
        ]);

        if (!creatorRes.ok) {
            console.warn(`[Generator] LunarCrush creator endpoint: ${creatorRes.status} for @${cleanHandle}`);
        }
        if (!postsRes.ok) {
            console.warn(`[Generator] LunarCrush posts endpoint: ${postsRes.status} for @${cleanHandle}`);
        }

        const creator = creatorRes.ok ? await creatorRes.json() : null;
        const posts = postsRes.ok ? await postsRes.json() : null;

        const hasData = !!creator?.data;
        console.log(`[Generator] LunarCrush result for @${cleanHandle}: creator=${hasData}, posts=${posts?.data?.length || 0}`);

        return { creator: creator?.data, posts: posts?.data?.slice(0, 10) };
    } catch (e) {
        console.warn('[Generator] LunarCrush fetch failed:', e.message);
        return null;
    }
};

const fetchRecentDecisions = async (supabase, brandId) => {
    if (!supabase) return [];
    try {
        const { data } = await supabase
            .from('agent_decisions')
            .select('action, reason, draft, created_at')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
            .limit(5);
        return data || [];
    } catch {
        return [];
    }
};

const formatNumber = (n) => {
    if (!n && n !== 0) return 'N/A';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

// ━━━ Main Briefing Generator ━━━

export const generateDailyBriefing = async (brandId) => {
    console.log(`[Generator] Starting Daily Briefing for ${brandId}...`);

    const supabase = getSupabaseClient();
    if (!supabase) {
        console.error("[Generator] Missing Supabase Config");
        return;
    }

    // 1. Fetch brand profile
    const profile = await fetchBrandProfile(supabase, brandId);
    if (!profile) {
        console.warn(`[Generator] No profile found for ${brandId}. Skipping.`);
        return;
    }

    const brandName = profile.name || brandId;
    const positioning = profile.positioning || "";
    const xHandle = profile.xHandle || profile.twitterHandle || TRACKED_BRANDS[brandId] || brandId;

    // 2. Fetch data in parallel
    const apifyKey = process.env.APIFY_API_TOKEN;
    console.log(`[Generator] Fetching data for ${brandName} (X: @${xHandle})...`);

    const [lunarData, mentions, recentDecisions] = await Promise.all([
        fetchLunarCrushData(xHandle),
        fetchMentions(apifyKey, TRACKED_BRANDS[brandId] || brandId),
        fetchRecentDecisions(supabase, brandId),
    ]);

    // 3. Format data sections
    const socialMetricsSection = lunarData?.creator
        ? `SOCIAL METRICS (LunarCrush — last 24h):
    - Followers: ${formatNumber(lunarData.creator.followers_count)}
    - Following: ${formatNumber(lunarData.creator.following_count)}
    - Engagement Rate: ${lunarData.creator.engagement ? (lunarData.creator.engagement * 100).toFixed(2) + '%' : 'N/A'}
    - Average Interactions: ${formatNumber(lunarData.creator.average_interactions)}
    - Galaxy Score: ${lunarData.creator.galaxy_score || 'N/A'}/100
    - Social Rank: #${formatNumber(lunarData.creator.rank) || 'N/A'}
    - Sentiment: ${lunarData.creator.sentiment || 'N/A'}/5`
        : '';

    const topPostsSection = lunarData?.posts?.length > 0
        ? `TOP RECENT POSTS (performance data):\n${lunarData.posts.slice(0, 5).map(p =>
            `    - "${(p.body || p.text || '').slice(0, 100)}..." → ${formatNumber(p.interactions || p.social_interactions)} interactions, ${formatNumber(p.likes || p.social_likes)} likes`
        ).join('\n')}`
        : 'TOP POSTS: No recent post data available';

    const mentionsSection = mentions?.length > 0
        ? `RECENT MENTIONS/CONVERSATIONS:\n${mentions.slice(0, 8).map(m =>
            `    - @${m.author}: "${(m.text || '').slice(0, 120)}"`
        ).join('\n')}`
        : 'MENTIONS: No recent mentions detected';

    const recentActionsSection = recentDecisions.length > 0
        ? `RECENT AI ACTIONS (what we've already done):\n${recentDecisions.map(d =>
            `    - [${d.action}] ${d.reason?.slice(0, 100) || d.draft?.slice(0, 100) || 'No details'}`
        ).join('\n')}`
        : '';

    const kb = (profile.knowledgeBase && Array.isArray(profile.knowledgeBase))
        ? profile.knowledgeBase.slice(0, 5).join('\n')
        : "";

    // 4. Build prompt
    const systemInstruction = `
You are generating a daily marketing briefing for ${brandName}'s marketing team.
${positioning ? `BRAND POSITIONING: ${positioning}` : ''}

Your briefing must be DATA-DRIVEN. Reference specific numbers from the data below. Never make up metrics.

LIVE DATA:

${socialMetricsSection}

${topPostsSection}

${mentionsSection}

${recentActionsSection}

${kb ? `BRAND KNOWLEDGE:\n${kb}` : ''}

TASK: Generate a concise, actionable daily briefing.

OUTPUT FORMAT (JSON):
{
    "executiveSummary": "2-3 sentences. MUST reference actual numbers from the data above. Example: 'Engagement rate at 2.3% with Galaxy Score 68/100. Our partnership thread pulled 4.2K interactions — 3x our average. Double down on the infrastructure narrative.'",
    "tacticalPlan": "3-4 specific actions with reasons tied to the data. Not generic advice — reference actual posts, metrics, or conversations. Example: 'Post a follow-up thread to the DAT explainer (4.2K interactions). Reply to the 3 community questions about staking. Create a graphic comparing our TPS to competitors — data threads are outperforming narrative threads 2:1.'",
    "strategicPlan": [
        {
            "action": "KILL" | "DOUBLE_DOWN" | "OPTIMIZE",
            "subject": "Specific topic/initiative",
            "reasoning": "Data-backed reason referencing actual metrics, not opinions."
        }
    ],
    "keyMetrics": {
        "followers": "${lunarData?.creator?.followers_count || 'N/A'}",
        "engagementRate": "${lunarData?.creator?.engagement ? (lunarData.creator.engagement * 100).toFixed(2) + '%' : 'N/A'}",
        "galaxyScore": "${lunarData?.creator?.galaxy_score || 'N/A'}",
        "avgInteractions": "${lunarData?.creator?.average_interactions || 'N/A'}",
        "topPostInteractions": "${lunarData?.posts?.[0]?.interactions || lunarData?.posts?.[0]?.social_interactions || 'N/A'}"
    }
}

RULES:
- Every claim must be backed by a number from the data.
- If social metrics data is unavailable, focus the briefing on recent AI actions, trends, and strategic opportunities instead. Do NOT say "no social metrics are available" — just skip metrics and focus on what you DO have.
- Be direct and specific. "Post more" is useless. "Post a follow-up to X because it got Y interactions" is useful.
- Strategic actions must reference metrics or trends, not vibes.
- Max 3 strategic actions. Quality over quantity.
`;

    // 5. Generate with LLM (Gemini → Groq fallback)
    try {
        const text = await generateText({
            systemPrompt: systemInstruction,
            userMessage: "Generate the daily marketing briefing based on the live data provided.",
            temperature: 0.3,
            jsonMode: true,
        });

        const parsed = JSON.parse(text || '{}');

        // Add metadata
        parsed.lastUpdated = Date.now();
        parsed.dataSourcesUsed = {
            lunarCrush: !!lunarData?.creator,
            mentions: mentions?.length || 0,
            recentDecisions: recentDecisions.length,
        };

        // 6. Save to Supabase (app_storage)
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
            console.log(`[Generator]    Data sources: LC=${!!lunarData?.creator}, Mentions=${mentions?.length || 0}, Decisions=${recentDecisions.length}`);
        }

    } catch (e) {
        console.error(`[Generator] Generation failed for ${brandId}`, e);
    }
};
