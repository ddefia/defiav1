/**
 * TELEGRAM INTENT CLASSIFIER
 * Server-side intent classification for incoming Telegram messages.
 * Uses generateText() with Gemini → Groq fallback.
 */

import { generateText } from './llm.js';

const INTENTS = {
    DRAFT_CONTENT: 'DRAFT_CONTENT',       // "Create a tweet about X"
    GENERATE_IMAGE: 'GENERATE_IMAGE',     // "Make a graphic for X" or image + caption
    ANALYZE_TRENDS: 'ANALYZE_TRENDS',     // "What's trending?"
    USE_RECOMMENDATION: 'USE_RECOMMENDATION', // "Use recommendation #2"
    GET_BRIEFING: 'GET_BRIEFING',         // "What's the daily brief?"
    GENERAL_CHAT: 'GENERAL_CHAT',         // Everything else
};

const classifyMessage = async (text, hasImage, chatHistory = [], brandProfile = {}) => {
    const brandName = brandProfile.name || 'the brand';
    const historyContext = chatHistory.length > 0
        ? chatHistory.slice(-6).map(m => `${m.role}: ${m.text}`).join('\n')
        : 'No previous context.';

    const systemPrompt = `You are an intent classifier for a Telegram marketing bot for "${brandName}".
Classify the user's message into one intent and extract parameters.

INTENTS:
- DRAFT_CONTENT: User explicitly wants you to WRITE/CREATE/DRAFT a specific tweet, post, or social media content RIGHT NOW. They want finished copy they can publish. Examples: "write a tweet about X", "draft a post about X", "create a thread about X".
- GENERATE_IMAGE: User wants to generate a visual/graphic/banner/image. Extract the prompt/description. IMPORTANT: If user says something like "now make a graphic for that" or "create an image for the tweet above" — this IS GENERATE_IMAGE. Use the conversation history to understand what "that" refers to and include it in imagePrompt.
- ANALYZE_TRENDS: User wants to know what's trending, market analysis, recent news.
- USE_RECOMMENDATION: User references a specific recommendation number. Extract the number.
- GET_BRIEFING: User asks for the daily brief, morning report, strategy summary.
- GENERAL_CHAT: Brainstorming, strategy discussion, asking for ideas/suggestions, questions, opinions, or any other conversation. This includes requests like "give me content ideas", "suggest topics", "what should we post about", "brainstorm some angles" — these are GENERAL_CHAT because the user wants IDEAS and DISCUSSION, not a finished draft.

IMPORTANT DISTINCTION:
- "Write a tweet about X" → DRAFT_CONTENT (user wants finished content)
- "Give me content ideas about X" → GENERAL_CHAT (user wants brainstorming/suggestions)
- "What should we post about next week?" → GENERAL_CHAT (user wants strategy advice)
- "Draft something about X" → DRAFT_CONTENT (user wants finished copy)
- "Suggest some topics for X" → GENERAL_CHAT (user wants ideas, not finished content)

CRITICAL — CONVERSATION CONTINUITY:
When the user says "that", "this", "it", "the tweet", "the post", "above", or references something from earlier, YOU MUST look at the conversation history below to understand what they're referring to. Include the referenced content in your extracted params.

CONTEXT:
- Has image attached: ${hasImage ? 'YES' : 'NO'}
- Recent conversation:
${historyContext}

Respond with ONLY valid JSON (no markdown fences):
{
  "intent": "INTENT_NAME",
  "params": {
    "topic": "extracted topic or null",
    "imagePrompt": "image description or null",
    "recommendationNumber": null or number,
    "query": "search/analysis query or null"
  },
  "confidence": 0.0-1.0
}`;

    try {
        const raw = await generateText({
            systemPrompt,
            userMessage: `User message: "${text || '(image only)'}"`,
            temperature: 0.1,
            jsonMode: true,
        });

        const parsed = JSON.parse(raw || '{}');

        // Validate intent
        if (!parsed.intent || !Object.values(INTENTS).includes(parsed.intent)) {
            parsed.intent = INTENTS.GENERAL_CHAT;
        }

        // If image is present but intent wasn't classified as image, check if it should be
        if (hasImage && parsed.intent !== INTENTS.GENERATE_IMAGE && text) {
            const lowerText = text.toLowerCase();
            if (lowerText.includes('like this') || lowerText.includes('similar') || lowerText.includes('reference') || lowerText.includes('create') || lowerText.includes('make') || lowerText.includes('post')) {
                parsed.intent = INTENTS.GENERATE_IMAGE;
                parsed.params = parsed.params || {};
                parsed.params.imagePrompt = text;
            }
        }

        return {
            intent: parsed.intent,
            params: parsed.params || {},
            confidence: parsed.confidence || 0.5,
        };
    } catch (e) {
        console.error('[IntentClassifier] Classification failed:', e.message);
        return { intent: INTENTS.GENERAL_CHAT, params: {}, confidence: 0 };
    }
};

export { classifyMessage, INTENTS };
