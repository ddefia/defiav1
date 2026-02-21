
import { generateText } from '../telegram/llm.js';

/**
 * BRAIN SERVICE (Server-Side)
 * "The Intelligence"
 */

export const analyzeState = async (duneMetrics, lunarTrends, mentions, pulseTrends, brandProfile = {}) => {
    try {
        const brandName = brandProfile.name || brandProfile.brandName || "Web3 Protocol";
        const voice = brandProfile.voiceGuidelines || "Professional";
        const knowledgeBase = Array.isArray(brandProfile.knowledgeBase)
            ? brandProfile.knowledgeBase.slice(0, 5).join('\n')
            : "No additional brand context provided.";

        const mentionsBlock = mentions.length > 0
            ? mentions.map(m => `- [${m.author}] "${m.text}"`).join('\n')
            : '- No direct mentions/tags found recently';

        const trendsBlock = pulseTrends.length > 0
            ? pulseTrends.map(t => `- ${t.headline}: ${t.summary}`).join('\n')
            : '- No market trends available';

        const prompt = `
        You are the Autonomous Marketing Agent for ${brandName}.
        BRAND VOICE: ${voice}
        BRAND KNOWLEDGE BASE:
        ${knowledgeBase}

        CURRENT STATE:
        ${duneMetrics ? `- On-Chain Volume: $${duneMetrics.totalVolume?.toLocaleString() || 'N/A'}\n        - Active Wallets: ${duneMetrics.activeWallets || 'N/A'}` : '- On-Chain Data: Not available'}

        LATEST SPECIFIC POSTS (DIRECT MENTIONS/TAGS):
        ${mentionsBlock}

        WEB3 MARKET TRENDS (live news):
        ${trendsBlock}

        TASK:
        You work FOR ${brandName}. Every recommendation must be specific to ${brandName} — reference its actual products, features, audience, or ecosystem.

        Check these 5 triggers (priority order):
        1. COMMUNITY MANAGER: Are there direct questions or FUD in "SPECIFIC POSTS" needing a reply?
        2. NEWSROOM: Is there a market trend we can "Trend Jack" with a ${brandName}-specific angle?
        3. ANALYST: Notable on-chain metric change worth a data-driven tweet?
        4. CAMPAIGN PLANNER: Strategic multi-day campaign opportunity based on current trends?
        5. CONTENT STRATEGIST: Content gap — topic our audience cares about that we haven't covered?

        RULES:
        - Do NOT default to REPLY. Only REPLY if there's a genuine question/FUD.
        - Every draft must mention ${brandName} by name or reference its specific capabilities.
        - No generic "web3 is growing" posts. Be specific.
        - Drafts should be tweet-length (under 280 chars) unless it's a CAMPAIGN brief.
        - NEVER use hashtags in drafts. No #anything. This is strictly forbidden.
        - Space out tweets properly — use double line breaks between sections so they read like real tweets.

        FORMAT RULES BY ACTION TYPE:
        - TREND_JACK: The "reason" field should explain the trend (what is happening in the market). The "draft" field is the suggested tweet angle for ${brandName}.
        - Tweet: The "reason" field is a brief why. The "draft" is the ready-to-post tweet.
        - CAMPAIGN: The "reason" is the opportunity. The "draft" is a brief campaign concept (2-3 sentences max).
        - REPLY / GAP_FILL: Standard format.

        Return 3 DIVERSE actions (each a DIFFERENT type) as JSON:
        {
            "actions": [
                {
                    "action": "REPLY" | "TREND_JACK" | "Tweet" | "CAMPAIGN" | "GAP_FILL",
                    "targetId": "ID of tweet/trend acting upon (or empty string)",
                    "reason": "1-sentence why (reference specific data)",
                    "draft": "The content to post or campaign brief"
                }
            ]
        }
        `;

        const text = await generateText({
            userMessage: prompt,
            _source: 'agent-cron', _endpoint: 'brain.analyzeState',
            _brandId: brandProfile.brandId || null,
        });

        // SimpleJSON cleanup
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        // Strip hashtags from all drafts (LLMs ignore prompt rules sometimes)
        const stripHashtags = (txt) => (txt || '').replace(/#\w+/g, '').replace(/  +/g, ' ').trim();

        // Support both new multi-action format and legacy single-action format
        if (parsed.actions && Array.isArray(parsed.actions)) {
            parsed.actions.forEach(a => { if (a.draft) a.draft = stripHashtags(a.draft); });
            return parsed; // New format: { actions: [...] }
        }
        // Legacy single action — wrap in array
        if (parsed.draft) parsed.draft = stripHashtags(parsed.draft);
        return { actions: [parsed] };

    } catch (e) {
        console.error("[Agent/Brain] Analysis Failed:", e);
        return { action: "ERROR", reason: e.message };
    }
};
