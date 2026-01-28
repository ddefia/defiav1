
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
        - On-Chain Volume: $${duneMetrics?.totalVolume?.toLocaleString() || 'N/A'}
        - Active Wallets: ${duneMetrics?.activeWallets || 'N/A'}
        
        LATEST SPECIFIC POSTS (DIRECT MENTIONS/TAGS):
        ${mentions.map(m => `- [${m.author}] "${m.text}"`).join('\n')}

        MARKET TRENDS (PULSE):
        ${pulseTrends.map(t => `- ${t.headline}: ${t.summary}`).join('\n')}

        RECENT ACTIVITY (LUNARCRUSH):
        ${lunarTrends.map(t => `- [${t.sentiment}] "${t.body}" (Interactions: ${t.interactions})`).join('\n')}
        
        TASK:
        Act as a multi-role agent. check for 3 specific triggers:
        
        1. COMMUNITY MANAGER (High Priority): Are there any direct questions or FUD in "SPECIFIC POSTS" that need a reply?
        2. NEWSROOM: Is there a "MARKET TREND" that is highly relevant to our brand that we should "Trend Jack"?
        3. ANALYST: Is there a notable change in On-Chain metrics?

        Generate a JSON response with the BEST single action to take right now.
        
        FORMAT:
        { 
            "action": "REPLY" | "TREND_JACK" | "Tweet" | "NO_ACTION", 
            "targetId": "ID of tweet/trend acting upon",
            "reason": "Why this is important", 
            "draft": "The content to post" 
        }
        `;

        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [{ text: prompt }] }
        });

        const text = response.text();

        // SimpleJSON cleanup
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (e) {
        console.error("[Agent/Brain] Analysis Failed:", e);
        return { action: "ERROR", reason: e.message };
    }
};
