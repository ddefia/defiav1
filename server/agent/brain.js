
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
            ? brandProfile.knowledgeBase.slice(0, 8).join('\n')
            : "No additional brand context provided.";

        // Pull in the full brand kit — tweet examples, tone, audiences, banned phrases
        const tweetExamples = Array.isArray(brandProfile.tweetExamples) && brandProfile.tweetExamples.length > 0
            ? brandProfile.tweetExamples.slice(0, 5).join('\n---\n')
            : '';
        const toneGuidelines = brandProfile.toneGuidelines || '';
        const bannedPhrases = Array.isArray(brandProfile.bannedPhrases) && brandProfile.bannedPhrases.length > 0
            ? brandProfile.bannedPhrases.join(', ')
            : '';
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

        const prompt = `
        You are the Autonomous Marketing Agent for ${brandName}.

        BRAND VOICE: ${voice}
        ${toneGuidelines ? `TONE GUIDELINES: ${toneGuidelines}` : ''}
        ${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}
        ${bannedPhrases ? `BANNED PHRASES (never use these): ${bannedPhrases}` : ''}

        BRAND KNOWLEDGE BASE:
        ${knowledgeBase}

        ${tweetExamples ? `CONTENT STYLE EXAMPLES (study these carefully — match this tone, length, spacing, and style):
${tweetExamples}` : ''}

        CURRENT STATE:
        ${duneMetrics ? `- On-Chain Volume: $${duneMetrics.totalVolume?.toLocaleString() || 'N/A'}\n        - Active Wallets: ${duneMetrics.activeWallets || 'N/A'}` : '- On-Chain Data: Not available'}

        LATEST SPECIFIC POSTS (DIRECT MENTIONS/TAGS):
        ${mentionsBlock}

        WEB3 MARKET TRENDS (live news):
        ${trendsBlock}

        TASK:
        You work FOR ${brandName}. Produce 3 actionable marketing recommendations.

        Check these 5 triggers (priority order):
        1. COMMUNITY MANAGER: Are there direct questions or FUD in "SPECIFIC POSTS" needing a reply?
        2. NEWSROOM: Is there a SPECIFIC market trend we can "Trend Jack"? The trend must be clearly identified from the TRENDS list above — name it explicitly.
        3. ANALYST: Notable on-chain metric change worth a data-driven tweet?
        4. CAMPAIGN PLANNER: Strategic multi-day campaign opportunity based on a SPECIFIC current trend?
        5. CONTENT STRATEGIST: Content gap — topic our audience cares about that we haven't covered?

        CRITICAL RULES:
        - TREND_JACK requires a REAL, SPECIFIC trend from the TRENDS list. Name the exact trend in the reason. Do NOT invent trends or use generic market commentary.
        - Every draft must be specific to ${brandName} — reference actual products, features, or ecosystem.
        - No generic "web3 is growing" or "crypto is evolving" filler. Be specific or skip the action.
        - Drafts should be tweet-length (under 280 chars) unless it's a CAMPAIGN brief.
        - NEVER use hashtags in drafts. No #anything. This is strictly forbidden.
        - Space out tweets properly — use double line breaks between sections.
        - Do NOT default to REPLY. Only REPLY if there's a genuine question/FUD in the mentions.
        - Do NOT mention random brand features just to fill space. Only reference features that connect to the trend or topic.
        ${tweetExamples ? `- Match the style, tone, and length of the CONTENT STYLE EXAMPLES above. These are the gold standard.` : ''}

        FORMAT RULES BY ACTION TYPE:
        - TREND_JACK: "reason" = explain the SPECIFIC trend (what is happening, cite the headline). "draft" = the tweet angle connecting ${brandName} to that trend.
        - Tweet: "reason" = brief why. "draft" = ready-to-post tweet.
        - CAMPAIGN: "reason" = the opportunity (cite specific trend/data). "draft" = campaign concept (2-3 sentences max).
        - REPLY / GAP_FILL: Standard format.

        Return 3 DIVERSE actions (each a DIFFERENT type) as JSON:
        {
            "actions": [
                {
                    "action": "REPLY" | "TREND_JACK" | "Tweet" | "CAMPAIGN" | "GAP_FILL",
                    "targetId": "ID of tweet/trend acting upon (or empty string)",
                    "reason": "1-sentence why (reference specific data or trend headline)",
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
