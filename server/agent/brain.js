
import { generateText } from '../telegram/llm.js';

/**
 * BRAIN SERVICE (Server-Side)
 * "The Intelligence"
 *
 * Uses Groq (Llama 3.3 70B) as primary, Gemini 2.0 Flash as fallback.
 * Groq has 14,400 RPD free tier vs Gemini's 20-1500 RPD.
 * Saves Gemini quota for client-side features.
 * One comprehensive call replaces 6 separate calls.
 */

export const analyzeState = async (duneMetrics, lunarTrends, mentions, pulseTrends, brandProfile = {}, competitorTweets = [], trendingTweets = []) => {
    try {
        const brandName = brandProfile.name || brandProfile.brandName || "Web3 Protocol";
        const voice = brandProfile.voiceGuidelines || "Professional";
        // Filter out stale KB entries about past events (e.g. "launched Q4 2025")
        const currentYear = new Date().getFullYear();
        const pastEventRe = /\b(launched|went live|announced|completed|shipped|released|achieved|hit milestone)\b.*\b(20[0-2][0-9])\b/i;
        const rawKB = Array.isArray(brandProfile.knowledgeBase) ? brandProfile.knowledgeBase : [];
        const filteredKB = rawKB.filter(entry => {
            const yearMatch = entry.match(/\b(20[0-2][0-9])\b/);
            if (yearMatch && parseInt(yearMatch[1]) < currentYear && pastEventRe.test(entry)) return false;
            return true;
        });
        const knowledgeBase = filteredKB.length > 0
            ? filteredKB.slice(0, 12).join('\n')
            : "No additional brand context provided.";

        // Pull in the full brand kit — tweet examples, tone, audiences, banned phrases
        const tweetExamples = Array.isArray(brandProfile.tweetExamples) && brandProfile.tweetExamples.length > 0
            ? brandProfile.tweetExamples.slice(0, 5).join('\n---\n')
            : '';
        const toneGuidelines = brandProfile.toneGuidelines || '';
        const bannedPhrases = Array.isArray(brandProfile.bannedPhrases) && brandProfile.bannedPhrases.length > 0
            ? brandProfile.bannedPhrases.join(', ')
            : '';
        const marketingDirectives = brandProfile.marketingDirectives || '';
        const audienceList = Array.isArray(brandProfile.audiences)
            ? brandProfile.audiences.map(a => typeof a === 'string' ? a : a.title || a.name || a.label || '').filter(Boolean)
            : [];
        const targetAudience = audienceList.length > 0
            ? audienceList.join(', ')
            : (brandProfile.targetAudience || '');

        const mentionsBlock = mentions.length > 0
            ? mentions.map(m => `- [${m.author}] "${m.text}"`).join('\n')
            : '- No direct mentions/tags found recently';

        const trendsBlock = pulseTrends.length > 0
            ? pulseTrends.map(t => `- ${t.headline}: ${t.summary}`).join('\n')
            : '- No market trends available';

        const competitorTweetsBlock = competitorTweets.length > 0
            ? competitorTweets.slice(0, 10).map(t => `- @${t.competitor}${t.competitorName ? ` (${t.competitorName})` : ''}: "${t.text}" (${t.likes || 0} likes)`).join('\n')
            : '';

        const trendingTweetsBlock = trendingTweets.length > 0
            ? trendingTweets.slice(0, 15).map(t => `- @${t.author}: "${(t.text || '').slice(0, 600)}" [${t.likes || 0} likes, ${t.retweets || 0} RTs]${t.tweetUrl ? ` (${t.tweetUrl})` : ''}`).join('\n')
            : '';

        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const prompt = `
You are the Autonomous Marketing Strategist for ${brandName}.
TODAY'S DATE: ${today}

═══════════════════════════════════════════
BRAND IDENTITY
═══════════════════════════════════════════
VOICE: ${voice}
${toneGuidelines ? `TONE: ${toneGuidelines}` : ''}
${targetAudience ? `AUDIENCE: ${targetAudience}` : ''}
${bannedPhrases ? `BANNED PHRASES (never use): ${bannedPhrases}` : ''}
${marketingDirectives ? `STRATEGIC DIRECTIVES (from brand owner — top priority):\n${marketingDirectives}` : ''}

BRAND KNOWLEDGE BASE:
${knowledgeBase}

${tweetExamples ? `CONTENT STYLE EXAMPLES (match this tone, length, spacing):
${tweetExamples}` : ''}

═══════════════════════════════════════════
LIVE DATA INPUTS
═══════════════════════════════════════════
${duneMetrics ? `ON-CHAIN: Volume $${duneMetrics.totalVolume?.toLocaleString() || 'N/A'} | Active Wallets: ${duneMetrics.activeWallets || 'N/A'}` : 'ON-CHAIN: Not available'}

MENTIONS (direct tags/replies):
${mentionsBlock}

WEB3 MARKET TRENDS (live news):
${trendsBlock}

${competitorTweetsBlock ? `COMPETITOR TWEETS:\n${competitorTweetsBlock}` : ''}

${trendingTweetsBlock ? `VIRAL CRYPTO TWITTER (trending tweets from top KOLs — QRT these, react to, or hijack):\n${trendingTweetsBlock}` : ''}

═══════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════
Think through these 4 strategic perspectives before formulating actions:

1. SOCIAL LISTENER: What narratives are shifting? What conversations should ${brandName} enter? Any mentions needing response?
2. PERFORMANCE ANALYST: What content formats/topics perform best? What engagement patterns exist in the data?
3. CONTENT PLANNER: What gaps exist in content strategy? What themes should ${brandName} own this week?
4. KNOWLEDGE CURATOR: What brand differentiators map to current market opportunities?

Then produce EXACTLY 5 diverse, actionable marketing recommendations.

Each action must be a DIFFERENT type from: TWEET, THREAD, CAMPAIGN, REPLY, TREND_JACK, GAP_FILL, QRT

CRITICAL RULES:
- TODAY IS ${today}. NEVER recommend posting about past events or milestones. Only forward-looking content.
- TREND_JACK requires a REAL, SPECIFIC trend from the TRENDS list. Name the exact headline.
- QRT requires a REAL tweet from VIRAL CRYPTO TWITTER, mentions, or competitor tweets. Include originalTweet with exact author and text. Prefer tweets with 100+ likes for maximum QRT visibility.
- READ THE FULL TWEET before QRTing. Many tweets start with a smart take but end shilling a specific token or memecoin (e.g. "AI will change trading... $SPX6900 is the LEADER"). If the tweet promotes a token/memecoin unrelated to ${brandName}, DO NOT QRT it — it makes the brand look like it endorses that token. Only QRT tweets where the ENTIRE message aligns with ${brandName}'s narrative.
- Every recommendation must be specific to ${brandName} — reference actual products, features, ecosystem.
- No generic "web3 is growing" filler. Be specific or pick a different action type.
- NEVER use hashtags. No #anything.
- Do NOT default to REPLY unless there's a genuine question/FUD in mentions.
${tweetExamples ? `- Match the EXACT style, tone, and length of the CONTENT STYLE EXAMPLES above. If examples use short punchy sentences, do the same.` : ''}

CONTENT QUALITY GATE — each recommendation MUST pass ALL of these:
✓ "Could this tweet ONLY come from ${brandName}?" — if yes, keep. If another brand could post it unchanged, rewrite.
✓ "Is there a real signal behind this?" — cite the specific mention, trend headline, metric, or KB entry.
✓ "Does instructions contain the actual copy?" — for TWEET/TREND_JACK/QRT/REPLY: it must be a complete, ready-to-post tweet (under 280 chars). For THREAD: hook + first 3 tweets numbered 1/ 2/ 3/. For CAMPAIGN/GAP_FILL: campaign brief + opening tweet draft.

EXAMPLE OUTPUT QUALITY:
BAD instructions: "Post about our technology being fast and decentralized"
GOOD instructions (TWEET): "institutional custody isn't waiting for L2 maturity. we built native MPC key management into our sequencer so traders can self-custody at sequencer-level speed. first protocol to do this."
BAD hook: "Technology Thread"
GOOD hook: "The Custody Speed Trap"

═══════════════════════════════════════════
OUTPUT FORMAT (strict JSON)
═══════════════════════════════════════════
{
    "analysis": {
        "summary": "2-3 sentence market context citing specific data points from the LIVE DATA above",
        "keyThemes": ["theme1 with data evidence", "theme2", "theme3"],
        "opportunities": ["Specific opportunity 1 tied to a named trend or metric", "Opportunity 2 citing a competitor gap"],
        "risks": ["Risk 1 with data", "Risk 2"],
        "strategicAngle": "The bold counter-narrative only ${brandName} can credibly own — name a specific brand capability vs a specific market assumption"
    },
    "actions": [
        {
            "type": "TWEET | THREAD | CAMPAIGN | REPLY | TREND_JACK | GAP_FILL | QRT",
            "topic": "Specific topic grounded in data — NOT a generic category",
            "goal": "Measurable outcome (e.g. 'drive 50+ RTs from DeFi researchers', 'capture institutional trader attention')",
            "instructions": "THE ACTUAL TWEET TEXT, ready to copy-paste and post. TWEET/TREND_JACK/QRT/REPLY = complete tweet under 280 chars. THREAD = hook tweet + first 3 tweets labeled 1/ 2/ 3/. CAMPAIGN = campaign brief paragraph + opening tweet draft.",
            "reasoning": "2-3 sentences citing the SPECIFIC signal: name the exact trend headline, mention author, metric delta, or KB entry that triggered this recommendation.",
            "hook": "Bold internal code name with edge — 3-5 words (e.g. 'The MEV Shield', 'Sequencer Supremacy', 'Operation Phantom Growth')",
            "strategicAlignment": "References [specific KB entry or brand feature] because [specific market gap or competitive weakness]",
            "contentIdeas": ["Contrarian angle", "Data-backed variant", "Narrative tie-in to trending topic"],
            "dataSource": "SPECIFIC signal: exact trend headline / '@handle tweet text' / metric name + value / KB entry snippet",
            "originalTweet": { "author": "handle_without_at_symbol", "text": "quoted text — exact tweet being QRT'd", "tweetUrl": "url from source data if available" }
        }
    ]
}

"originalTweet" is ONLY for QRT/REPLY types — omit for others.
Return exactly 5 actions, each a DIFFERENT type.
`;

        const text = await generateText({
            userMessage: prompt,
            jsonMode: true,
            preferGroq: true,  // Groq first — saves Gemini quota for client-side
            model: 'gemini-2.5-flash',  // Gemini model if Groq fails
            temperature: 0.7,
            _source: 'agent-cron', _endpoint: 'brain.analyzeState',
            _brandId: brandProfile.brandId || null,
        });

        // JSON cleanup
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        // Strip hashtags from all drafts/instructions (LLMs sometimes ignore prompt rules)
        const stripHashtags = (txt) => (typeof txt === 'string' ? txt : String(txt || '')).replace(/#\w+/g, '').replace(/  +/g, ' ').trim();

        // Normalize actions — support both new rich format and legacy format
        if (parsed.actions && Array.isArray(parsed.actions)) {
            parsed.actions.forEach(a => {
                // Ensure text fields are strings (LLM sometimes returns objects)
                if (a.instructions && typeof a.instructions !== 'string') a.instructions = JSON.stringify(a.instructions);
                if (a.draft && typeof a.draft !== 'string') a.draft = JSON.stringify(a.draft);
                if (a.instructions) a.instructions = stripHashtags(a.instructions);
                if (a.draft) a.draft = stripHashtags(a.draft);
                // Strip leading @ from originalTweet.author (UI adds it)
                if (a.originalTweet?.author) a.originalTweet.author = a.originalTweet.author.replace(/^@/, '');
                // Ensure backward compat: map 'type' to 'action' for legacy consumers
                if (a.type && !a.action) a.action = a.type;
            });
            return parsed; // { analysis, actions: [...] }
        }
        // Legacy single action — wrap in array
        if (parsed.draft) parsed.draft = stripHashtags(parsed.draft);
        if (parsed.type && !parsed.action) parsed.action = parsed.type;
        return { actions: [parsed] };

    } catch (e) {
        console.error("[Agent/Brain] Analysis Failed:", e);
        return { action: "ERROR", reason: e.message };
    }
};
