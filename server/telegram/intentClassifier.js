/**
 * TELEGRAM INTENT CLASSIFIER
 * Server-side Gemini-based intent classification for incoming Telegram messages.
 * Mirrors the client-side classifyAndPopulate() from services/gemini.ts.
 */

import { GoogleGenAI } from '@google/genai';

const GEMINI_TIMEOUT_MS = 15000;

const withTimeout = (promise, ms = GEMINI_TIMEOUT_MS) => {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('AI classification timed out')), ms);
        }),
    ]).finally(() => clearTimeout(timer));
};

const INTENTS = {
    DRAFT_CONTENT: 'DRAFT_CONTENT',       // "Create a tweet about X"
    GENERATE_IMAGE: 'GENERATE_IMAGE',     // "Make a graphic for X" or image + caption
    ANALYZE_TRENDS: 'ANALYZE_TRENDS',     // "What's trending?"
    USE_RECOMMENDATION: 'USE_RECOMMENDATION', // "Use recommendation #2"
    GET_BRIEFING: 'GET_BRIEFING',         // "What's the daily brief?"
    GENERAL_CHAT: 'GENERAL_CHAT',         // Everything else
};

const classifyMessage = async (text, hasImage, chatHistory = [], brandProfile = {}) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('[IntentClassifier] Missing GEMINI_API_KEY');
        return { intent: INTENTS.GENERAL_CHAT, params: {} };
    }

    const brandName = brandProfile.name || 'the brand';
    const historyContext = chatHistory.length > 0
        ? chatHistory.slice(-6).map(m => `${m.role}: ${m.text}`).join('\n')
        : 'No previous context.';

    const systemPrompt = `You are an intent classifier for a Telegram marketing bot for "${brandName}".
Classify the user's message into one intent and extract parameters.

INTENTS:
- DRAFT_CONTENT: User wants to create/draft a tweet, post, or social media content. Extract the topic.
- GENERATE_IMAGE: User wants to generate a visual/graphic/banner/image. Extract the prompt/description. IMPORTANT: If user says something like "now make a graphic for that" or "create an image for the tweet above" — this IS GENERATE_IMAGE. Use the conversation history to understand what "that" refers to and include it in imagePrompt.
- ANALYZE_TRENDS: User wants to know what's trending, market analysis, recent news.
- USE_RECOMMENDATION: User references a specific recommendation number. Extract the number.
- GET_BRIEFING: User asks for the daily brief, morning report, strategy summary.
- GENERAL_CHAT: Any other question, conversation, or request.

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
        const genAI = new GoogleGenAI({ apiKey, httpOptions: { timeout: GEMINI_TIMEOUT_MS } });
        const response = await withTimeout(genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [{ text: `User message: "${text || '(image only)'}"` }] },
            config: {
                systemInstruction: { parts: [{ text: systemPrompt }] },
                responseMimeType: 'application/json',
                temperature: 0.1,
            },
        }));

        const raw = response.text || '{}';
        const parsed = JSON.parse(raw);

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
