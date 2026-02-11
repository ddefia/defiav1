
import { GoogleGenAI } from '@google/genai';

/**
 * BRAIN SERVICE (Server-Side)
 * "The Intelligence"
 */

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const analyzeState = async (duneMetrics, lunarTrends, mentions, pulseTrends, brandProfile = {}) => {
    try {
        const brandName = brandProfile.name || brandProfile.brandName || "Web3 Protocol";
        const voice = brandProfile.voiceGuidelines || "Professional";
        const knowledgeBase = Array.isArray(brandProfile.knowledgeBase)
            ? brandProfile.knowledgeBase.slice(0, 5).join('\n')
            : "No additional brand context provided.";

        const prompt = `
        You are the Autonomous Marketing Agent for ${brandName}.
        BRAND VOICE: ${voice}
        BRAND KNOWLEDGE BASE:
        ${knowledgeBase}
        
        CURRENT STATE:
        ${duneMetrics ? `- On-Chain Volume: $${duneMetrics.totalVolume?.toLocaleString() || 'N/A'}\n        - Active Wallets: ${duneMetrics.activeWallets || 'N/A'}` : '- On-Chain Data: Not available (no Dune integration configured)'}
        
        LATEST SPECIFIC POSTS (DIRECT MENTIONS/TAGS):
        ${mentions.map(m => `- [${m.author}] "${m.text}"`).join('\n')}

        MARKET TRENDS (PULSE):
        ${pulseTrends.map(t => `- ${t.headline}: ${t.summary}`).join('\n')}

        RECENT ACTIVITY (LUNARCRUSH):
        ${lunarTrends.map(t => `- [${t.sentiment}] "${t.body}" (Interactions: ${t.interactions})`).join('\n')}
        
        TASK:
        Act as a multi-role agent. Check for these 5 triggers (in priority order):

        1. COMMUNITY MANAGER (High Priority): Are there any direct questions or FUD in "SPECIFIC POSTS" that need a reply?
        2. NEWSROOM: Is there a "MARKET TREND" that is highly relevant to our brand that we should "Trend Jack"?
        3. ANALYST: Is there a notable change in On-Chain metrics that warrants a data-driven tweet?
        4. CAMPAIGN PLANNER: Is there a strategic opportunity for a multi-day campaign based on current trends, upcoming events, or market momentum?
        5. CONTENT STRATEGIST: Is there a content gap — a topic our audience cares about that we haven't addressed recently?

        IMPORTANT: Do NOT default to REPLY. Consider CAMPAIGN and GAP_FILL equally. Only choose REPLY if there is a genuine question or FUD that demands a direct response.

        Generate a JSON response with 3 DIVERSE actions to take. Each action MUST be a DIFFERENT type. Never return multiple actions with the same type.

        FORMAT:
        {
            "actions": [
                {
                    "action": "REPLY" | "TREND_JACK" | "Tweet" | "CAMPAIGN" | "GAP_FILL",
                    "targetId": "ID of tweet/trend acting upon (or empty string)",
                    "reason": "Why this is important",
                    "draft": "The content to post or campaign brief"
                },
                {
                    "action": "(DIFFERENT type from above)",
                    "targetId": "",
                    "reason": "Why this action matters",
                    "draft": "Content draft or brief"
                },
                {
                    "action": "(DIFFERENT type from both above)",
                    "targetId": "",
                    "reason": "Strategic rationale",
                    "draft": "Content draft or brief"
                }
            ]
        }
        `;

        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt
        });

        const text = response.text;

        // SimpleJSON cleanup
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        // Support both new multi-action format and legacy single-action format
        if (parsed.actions && Array.isArray(parsed.actions)) {
            return parsed; // New format: { actions: [...] }
        }
        // Legacy single action — wrap in array
        return { actions: [parsed] };

    } catch (e) {
        console.error("[Agent/Brain] Analysis Failed:", e);
        return { action: "ERROR", reason: e.message };
    }
};
