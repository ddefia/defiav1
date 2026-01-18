import { GoogleGenAI } from "@google/genai";
import { GenerateImageParams, BrandConfig, ComputedMetrics, GrowthReport, CampaignLog, SocialMetrics, TrendItem, CalendarEvent, StrategyTask, ReferenceImage, CampaignStrategy, SocialSignals, BrainLog, TaskContextSource, BrainContext, ActionPlan, MarketingAction, AnalysisReport } from "../types";
import { saveBrainLog } from "./storage";
import { supabase, searchBrainMemory } from "./supabase"; // Add Supabase

// Global constant defined in vite.config.ts
// Global constant removed



// --- API KEY HELPER ---
// --- API KEY HELPER ---
const getApiKey = (): string => {
    // 1. Check Build-Time Injections (Vite 'define' replacements)
    // We try/catch these because if Vite replaces them, they become strings.
    // If not, 'process' might be undefined, which we catch.
    try {
        // @ts-ignore
        if (process.env.API_KEY) return process.env.API_KEY;
    } catch (e) { }

    try {
        // @ts-ignore
        if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    } catch (e) { }

    // 2. Check Standard Vite Envs
    const metaEnv = (import.meta as any).env;
    if (metaEnv) {
        if (metaEnv.VITE_GEMINI_API_KEY) return metaEnv.VITE_GEMINI_API_KEY;
        if (metaEnv.GEMINI_API_KEY) return metaEnv.GEMINI_API_KEY;
    }

    // 3. Fallback to Local Storage (User Settings)
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('defia_integrations_v1');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.geminiKey) return parsed.geminiKey;
            }
        } catch (e) { }
    }

    console.warn("⚠️ API Key Missing! Check Vercel Env Vars or Settings.");
    return "";
};

// --- THINKING EVENT BUS ---
const dispatchThinking = (message: string, detail?: any) => {
    try {
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('defia-thinking', { detail: { message, detail, timestamp: Date.now() } });
            window.dispatchEvent(event);
        }
    } catch (e) {
        // Ignore if no window (e.g. server side)
    }
};

/**

 * Helper to generate embeddings for RAG.
 */
export const getEmbedding = async (text: string): Promise<number[]> => {
    const apiKey = getApiKey();
    if (!apiKey) console.error("MISSING API KEY in getEmbedding");
    const ai = new GoogleGenAI({ apiKey });
    try {
        const result = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: [{ parts: [{ text }] }]
        });

        if (result.embeddings && result.embeddings.length > 0 && result.embeddings[0].values) {
            return result.embeddings[0].values;
        }
        return [];
    } catch (e) {
        console.error("Embedding Error", e);
        return [];
    }
}


/**
 * HELPER: Analyze reference images to extract style directions.
 */
const getBase64FromUrl = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                // Remove header if present
                resolve(base64.split(',')[1] || base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Failed to convert image URL to base64", url, e);
        return "";
    }
};

/**
 * HELPER: Analyze reference images to extract style directions.
 */
const analyzeStyleFromReferences = async (images: ReferenceImage[]): Promise<string> => {
    if (!images || images.length === 0) return "";

    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Limits consistency to first 3 images to avoid token overload
    // Prioritize images with data, then url
    const targetImages = images.slice(0, 3);

    try {
        // Prepare image parts asynchronously
        const imagePartsPromises = targetImages.map(async (img) => {
            let base64 = "";
            let mimeType = "image/png";

            if (img.data) {
                const match = img.data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)/);
                if (match) {
                    mimeType = match[1];
                    base64 = match[2];
                } else {
                    base64 = img.data.includes('base64,') ? img.data.split('base64,')[1] : img.data;
                }
            } else if (img.url) {
                try {
                    const res = await fetch(img.url);
                    const blob = await res.blob();
                    mimeType = blob.type || "image/png";
                    const readerRes = await new Promise<string>((resolve) => {
                        const r = new FileReader();
                        r.onloadend = () => resolve(r.result as string);
                        r.readAsDataURL(blob);
                    });
                    base64 = readerRes.split(',')[1];
                } catch (e) {
                    console.warn("Failed to fetch image for analysis", e);
                    return null;
                }
            }

            if (!base64) return null;

            return {
                inlineData: {
                    mimeType: mimeType,
                    data: base64
                }
            };
        });

        const resolvedParts = await Promise.all(imagePartsPromises);
        const validParts = resolvedParts.filter(p => p !== null) as { inlineData: { mimeType: string, data: string } }[];

        if (validParts.length === 0) return "";

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
                ...validParts,
                { text: "Analyze these reference images. Describe their visual style, color grading, lighting, and composition in 2 sentences. Focus on keywords that a 3D designer would use. Do not describe the subject matter, only the STYLE." }
            ]
        });

        return response.text ? `VISUAL STYLE REFERENCE: ${response.text}` : "";
    } catch (e) {
        console.warn("Failed to analyze reference images", e);
        return "";
    }
};

/**
 * Generates an image using the gemini-3-pro-image-preview model.
 */
/**
 * Generates an image using the gemini-3-pro-image-preview model (Restored to Imagen 3).
 */
/**
 * Generates an image using the Backend Proxy (connecting to Vertex AI/Imagen 3).
 * This bypasses the client-side SDK limitation for Imagen 3.
 */
export const generateWeb3Graphic = async (params: GenerateImageParams): Promise<string> => {
    dispatchThinking(`🎨 Generating Graphic for: "${params.prompt}"`, { template: params.templateType, style: params.artPrompt });

    // Robust Key Loading
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error("FATAL: No API Key found.");
        throw new Error("API Key is missing. Check Vercel Env Vars.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const colorPalette = params.brandConfig.colors.map(c => `${c.name} (${c.hex})`).join(', ');
    const brandName = params.brandName || "Web3";
    const isMeme = brandName === 'Meme';
    const visualIdentity = params.brandConfig.visualIdentity ? `VISUAL IDENTITY GUIDELINES (FROM PDF):\n${params.brandConfig.visualIdentity}` : "";


    // Logic: If specific images are selected, use them.
    // If NOT, but a Template is selected that has linked images, PICK ONE randomly.
    // This enforces "Strict Mode" for that specific style (e.g. Dark) instead of mixing Dark + Light.
    // --- 1. REFERENCE IMAGE LOGIC (MOVED UP FOR PROMPT AWARENESS) ---
    // Logic: If specific images are selected, use them.
    // If NOT, but a Template is selected that has linked images, PICK ONE randomly (Strict Mode).
    // If NOT, and no template, PICK 3 RANDOM images from the brand to ensure style consistency (Auto Mode).
    let effectiveReferenceImageIds = params.selectedReferenceImages || [];

    // Case A: Template Strict Mode
    if (effectiveReferenceImageIds.length === 0 && params.templateType && params.brandConfig.graphicTemplates) {
        const tmpl = params.brandConfig.graphicTemplates.find(t => t.id === params.templateType || t.label === params.templateType);
        if (tmpl && tmpl.referenceImageIds && tmpl.referenceImageIds.length > 0) {
            const randomIndex = Math.floor(Math.random() * tmpl.referenceImageIds.length);
            effectiveReferenceImageIds = [tmpl.referenceImageIds[randomIndex]];
            console.log(`[Template Strict Mode] Selected Ref Image: ${effectiveReferenceImageIds[0]} from Template: ${tmpl.label}`);
        }
    }

    // Case B: Auto Mode (Generic Style Reinforcement) - ONLY if not meme
    // If we have no references yet, grab random ones to define the "Brand Look"
    if (effectiveReferenceImageIds.length === 0 && !isMeme && params.brandConfig.referenceImages && params.brandConfig.referenceImages.length > 0) {
        const allImages = params.brandConfig.referenceImages;
        // Fisher-Yates Shuffle
        const shuffled = [...allImages];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        // Pick top 2 for consistent style injection
        effectiveReferenceImageIds = shuffled.slice(0, 2).map(i => i.id);
        console.log(`[Auto Mode] Selected 2 random Brand Images for Style Enforcment`);
    }

    // --- 2. TEMPLATE LOGIC ---
    let templateInstruction = "";
    const customTmpl = params.brandConfig?.graphicTemplates?.find(t => t.id === params.templateType || t.label === params.templateType);

    if (customTmpl) {
        templateInstruction = `TEMPLATE TYPE: ${customTmpl.label}. INSTRUCTION: ${customTmpl.prompt}`;
        console.log(`Using Custom Template: ${customTmpl.label}`);
    } else if (params.templateType) {
        switch (params.templateType) {
            case 'Partnership':
                templateInstruction = "TEMPLATE TYPE: PARTNERSHIP ANNOUNCEMENT. Composition: Split screen or handshake motif. Showcase two entities joining forces. High trust, official look.";
                break;
            case 'Campaign':
                templateInstruction = "TEMPLATE TYPE: MAJOR CAMPAIGN LAUNCH. Composition: Bold, poster-style, central focal point. High energy, call to action vibe.";
                break;
            case 'Giveaway':
                templateInstruction = "TEMPLATE TYPE: GIVEAWAY / AIRDROP. Composition: Gift box, tokens, or chest motif. Exciting, rewarding, flashy visual style.";
                break;
            case 'Events':
                templateInstruction = "TEMPLATE TYPE: EVENT / SAVE THE DATE. Composition: Calendar, stage, or pass motif. Inviting, spatial, celebratory.";
                break;
            case 'Speaker Scenes':
                templateInstruction = "TEMPLATE TYPE: SPEAKER QUOTE / HIGHLIGHT. Composition: Portrait layout preference. Space for text/quote. Professional, spotlight lighting.";
                break;
            default:
                templateInstruction = `TEMPLATE TYPE: ${params.templateType}`;
        }
    }

    const visualOverride = params.artPrompt
        ? `VISUAL DIRECTION OVERRIDE: ${params.artPrompt}`
        : "Visualize momentum, connections, or security based on keywords.";

    const negativeInstruction = params.negativePrompt
        ? `\n        NEGATIVE PROMPT (DO NOT INCLUDE): ${params.negativePrompt}`
        : "";

    let systemPrompt = '';

    if (isMeme) {
        systemPrompt = `
      You are a legendary crypto twitter meme creator.
      TASK: Create a viral, humorous, high-impact meme image for: "${params.prompt}"
      ${params.artPrompt ? `SPECIFIC INSTRUCTION: ${params.artPrompt}` : ''}
      STYLE: Internet culture, Wojak/Pepe influenced, High Contrast.
      COLORS: ${colorPalette}.
      INSTRUCTIONS: Make it funny, relatable, and use reference images as templates.
      `;
    } else {

        const isStructuredTemplate = params.templateType && params.templateType !== 'Campaign' && params.templateType !== 'Default';

        systemPrompt = `
        You are an expert 3D graphic designer for ${brandName}, a leading Web3 company.
        TASK: Create a professional social media graphic for: "${params.prompt}"
        ${templateInstruction}
        
        BRANDING ENFORCEMENT (CRITICAL):
        The user requires STRICT adherence to the brand identity.
        
        1. 🎨 COLORS:
           - PRIMARY PALETTE: ${colorPalette}.
           - RULE: You MUST prioritize these exact colors.
           ${effectiveReferenceImageIds.length > 0 ? `- REFERENCE ALIGNMENT: Match the color grading and saturation of the provided Reference Images EXACTLY.` : ''}

        ${visualIdentity ? `
        2. 📐 VISUAL IDENTITY SYSTEM:
        ${visualIdentity}
        - RULE: Follow these guidelines for composition, lighting, and texture.
        ` : ''}
        
        3. 🖼️ STYLE & VIBE:
           - Style: PROFESSIONAL, HIGH-END, PREMIUM.
           - If Reference Images are provided, you MUST mimic their:
             - Lighting (e.g. Neon vs Soft)
             - Materiality (e.g. Glass vs Metal)
             - Background Style (e.g. Abstract vs Cityscape)
           - DO NOT deviate from the established brand look found in the references.

        INSTRUCTIONS:
        - Analyze tweet sentiment.
        - ${visualOverride}
        ${negativeInstruction}
        - TEXT RULES:
          - ⛔ CRITICAL: NEVER copy-paste the prompt text onto the image.
          - ✅ Use text SPARINGLY (Title/Stat only).
        
        ${effectiveReferenceImageIds.length > 0 ? `
           REFERENCE IMAGE UTILIZATION:
           - I have provided ${effectiveReferenceImageIds.length} reference images from the brand's history.
           - 🚨 STRICTLY MIMIC the visual style of these images.
           - If a Logo is visible in the references, position a similar abstract logo to maintain branding.
           
           ${isStructuredTemplate ? `
           - 🏗️ TEMPLATE MODE: Preserve the EXACT LAYOUT of the reference. Only change the subject matter.` : `
           - 🟢 CREATIVE HARMONY MODE: Use the references for Art Direction (Lighting, Colors, Vibe) but create a NEW composition for the prompt.`}
        ` : ''}
    `;
    }

    const parts: any[] = [{ text: systemPrompt }];

    // Conversion Helper
    const urlToBase64 = async (url: string): Promise<string | null> => {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn("Failed to fetch reference image from URL:", url, e);
            return null;
        }
    };

    // Process Images (Async)
    try {
        if (params.brandConfig && params.brandConfig.referenceImages && effectiveReferenceImageIds.length > 0) {
            const allImages = params.brandConfig.referenceImages;

            // Get the actual image objects for the IDs we selected
            const sourceImages = allImages.filter(img => effectiveReferenceImageIds.includes(img.id));

            if (sourceImages.length > 0) console.log(`[Gemini] Using ${sourceImages.length} images for reference.`);

            const imageParts = await Promise.all(sourceImages.map(async (img) => {
                let finalData = img.data;

                // If URL is provided and data is missing, fetch it
                if (!finalData && img.url) {
                    const fetched = await urlToBase64(img.url);
                    if (fetched) finalData = fetched;
                }

                if (!finalData) return null;

                const base64Data = finalData.split(',')[1] || finalData;
                const mimeTypeMatch = finalData.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';

                return { inlineData: { mimeType: mimeType, data: base64Data } };
            }));

            imageParts.forEach(part => {
                if (part) parts.push(part);
            });
        }
    } catch (err) {
        console.warn("Error processing reference images, proceeding with text only.", err);
    }

    try {
        console.log("Generating with gemini-3-pro-image-preview...");

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Generation timed out after 60s")), 60000)
        );

        const generationPromise = ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            // @ts-ignore
            contents: [{ parts: parts }],
            config: {
                // @ts-ignore - Experimental/Legacy schema
                imageConfig: {
                    aspectRatio: params.aspectRatio === '1:1' ? '1:1' : params.aspectRatio === '4:5' ? '4:5' : '16:9',
                    imageSize: params.size || '1024x1024'
                }
            },
        });

        const response = await Promise.race([generationPromise, timeoutPromise]) as any;

        const responseParts = response.candidates?.[0]?.content?.parts;
        const imagePart = responseParts?.[0];

        // @ts-ignore
        if (imagePart && imagePart.inlineData) {
            // @ts-ignore
            return `data:${imagePart.inlineData.mimeType || 'image/png'}; base64, ${imagePart.inlineData.data} `;
        }

        throw new Error("No image data returned from Gemini.");

    } catch (error: any) {
        console.error("Gemini generation error:", error.message);
        throw error;
    }
};

/**
 * EDIT Image using Multimodal Prompting (Image + Text -> New Image)
 */
export const editWeb3Graphic = async (
    imageBase64: string,
    prompt: string,
    brandConfig?: BrandConfig,
    aspectRatio: string = '1:1'
): Promise<string> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Prepare Image Part
    const mimeMatch = imageBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    const imagePart = {
        inlineData: {
            mimeType: mimeType,
            data: cleanBase64
        }
    };

    const systemPrompt = `
    TASK: Edit this image based on the user's instruction.
    INSTRUCTION: "${prompt}"

    GUIDELINES:
    - PRESERVE the main subject, composition, and layout of the original image as much as possible.
    - PRESERVE ASPECT RATIO: The output must strictly follow the ${aspectRatio} format.
    - ONLY apply the requested change (e.g. change color, remove object, change background).
    - If the user asks to "change style", then you can be more creative with the composition.
    - Maintain high quality, professional "Web3/Tech" aesthetic unless instructed otherwise.
    `;

    try {
        console.log(`Editing image with gemini-2.0-flash (Simulated Edit) | Target Ratio: ${aspectRatio}...`);

        // CLEANUP: Previous code called Flash then ignored it.
        // We will attempt to use the Image model directly if supported, or fallback to text if image-to-image is not available on this key.

        // ATTEMPT 1: Try Gemini 2.0 Flash for "Edit Instructions" -> New Image (If supported)
        // Note: Currently Flash is mostly text-out. 
        // We will use the 'gemini-3-pro-image-preview' directly for generation.

        console.log("Generating edit with gemini-3-pro-image-preview...");

        const generationPromise = ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            // @ts-ignore
            contents: [{ parts: [imagePart, { text: systemPrompt }] }],
            config: {
                // @ts-ignore
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: '1024x1024'
                }
            },
        });

        const result = await generationPromise as any;

        if (!result || !result.candidates || result.candidates.length === 0) {
            throw new Error("No candidates returned from API.");
        }

        const responseParts = result.candidates?.[0]?.content?.parts;
        const resultImagePart = responseParts?.[0];

        // @ts-ignore
        if (resultImagePart && resultImagePart.inlineData) {
            // @ts-ignore
            return `data:${resultImagePart.inlineData.mimeType || 'image/png'}; base64, ${resultImagePart.inlineData.data} `;
        }

        // If we got text back instead of image (error case):
        if (result.response && typeof result.response.text === 'function') {
            const text = result.response.text();
            throw new Error("Model returned text instead of image: " + text.substring(0, 100));
        }

        throw new Error("No image data found in response.");

    } catch (error: any) {
        console.error("Gemini Edit Error:", error);
        // Robust Error Message
        const msg = error.message || "Unknown error";
        if (msg.includes("400")) throw new Error("Image Edit Failed: Bad Request (Image might be too large or format unsupported).");
        if (msg.includes("403")) throw new Error("Image Edit Failed: API Permission Denied (Check Keys).");
        throw new Error("Image Editing Failed: " + msg);
    }
};

/**
 * Generates a tweet based on topic, using Brand Knowledge Base and Style Examples.
 */
export const generateTweet = async (
    topic: string,
    brandName: string,
    brandConfig: BrandConfig,
    tone: string = 'Professional'
): Promise<string> => {
    dispatchThinking(`🐦 Generating Tweet for: "${topic}"`, { tone, brand: brandName });
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const examples = brandConfig.tweetExamples.length > 0
        ? `STYLE REFERENCE (MIMIC THIS VOICE/PACE/LENGTH): \n${brandConfig.tweetExamples.map(t => `- ${t}`).join('\n')} `
        : "";

    const templateExamples = (brandConfig.graphicTemplates || [])
        .filter(t => t.tweetExample && t.tweetExample.trim().length > 0)
        .map(t => `[TEMPLATE STYLE: ${t.label}]: "${t.tweetExample}"`)
        .join('\n');

    const templateContext = templateExamples.length > 0
        ? `\nTEMPLATE-SPECIFIC WRITING STYLES (Use these if the output fits the template context): \n${templateExamples}`
        : "";

    const kb = brandConfig.knowledgeBase.length > 0
        ? `KNOWLEDGE BASE (THE ABSOLUTE SOURCE OF TRUTH): \n${brandConfig.knowledgeBase.join('\n\n')} `
        : "";

    const isNoTagBrand = ['netswap', 'enki'].includes(brandName.toLowerCase());

    // --- ENTERPRISE PROTOCOL ENFORCEMENT ---
    const voice = brandConfig.voiceGuidelines || "Narrative Authority: Insightful, grounded, and high-signal. Speak to mechanics, not just features.";
    const defaultBanned = ["Delve", "Tapestry", "Game changer", "Unleash"]; // Removed "Excited", "Thrilled"
    const banned = brandConfig.bannedPhrases && brandConfig.bannedPhrases.length > 0
        ? `STRICTLY BANNED PHRASES: ${brandConfig.bannedPhrases.join(', ')} `
        : `Avoid lazy AI words (e.g. ${defaultBanned.join(', ')}).`;

    const systemInstruction = `
    You are an Elite Crypto Content Creator for ${brandName}.
    You are known for high-signal content that simplifies complex topics without losing nuance.

    TASK: Write a single, high-quality tweet about: "${topic}".
    
    TONE: ${tone} (Guideline: ${voice})
    - **BALANCE**: Be authoritative but friendly.
    - **ACCESSIBILITY**: Deep technical understanding, explained simply.
    
    ${examples}
    ${templateContext}
    
    ${kb}

    CRITICAL RULES:
    1. **PRIORITIZE KNOWLEDGE BASE**: If the Knowledge Base contains specific facts, terminology, or goals, you MUST use them.
    2. **VALUE INFERENCE**: If the topic is vague, logically infer specific benefits (Liquidity, Speed, Yield).
    3. **AUTHENTIC PROFESSIONALISM**: It is okay to say "We are excited" for major news, but avoid overusing it. Be human.
    4. **FORMATTING**: Use short paragraphs. Use bullet points (•) if listing benefits.

    INSTRUCTIONS:
    - ${banned}
    - LENGTH: Optimal ~280 chars, but prioritize DEPTH. Do NOT sacrifice detail for brevity.
    
    **INTENT RECOGNITION & ADAPTATION**:
    - **IF ANNOUNCEMENT/PARTNERSHIP**: 
      - Start with a strong Hook/Headline (e.g. PARTNERSHIP SECURED).
      - Use limited emojis (🚨, 🤝) for impact.
      - **CRITICAL**: List 2-3 specific benefits. If not provided, infer them from the context of the brands.
      - **STORYTELLING**: Do not just announce. Explain the "Journey" that led here.
    - **IF INSIGHT/THOUGHT**:
      - Focus on the "Alpha". Why does this matter? What is the mechanic?
      - **DEEP DIVE**: Explain the technical nuance. Assume the reader is smart.
    
    STRICT STRUCTURE:
    1. HOOK: A punchy, 1-sentence insight or headline.
    2. BODY: Explain the "Why" in detail. Use bullets if helpful. MAKE IT DENSE.
    3. CTA: Clear directive.

    FORMATTING REQUIREMENTS:
    - YOU MUST use double line breaks (\\n\\n) between sections.
    - NO HASHTAGS (STRICTLY FORBIDDEN).
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: topic,
            config: { systemInstruction: systemInstruction }
        });
        return response.text || topic;
    } catch (error) {
        console.error("Tweet generation error", error);
        throw error;
    }
}

/**
 * Generates a campaign of tweets (Drafting Phase).
 */
/**
 * SMART CAMPAIGN: Analyzes raw notes to create a structured content plan.
 */
export const analyzeContentNotes = async (notes: string, brandName: string): Promise<any> => {
    dispatchThinking(`📝 Analyzing Content Notes`, { notesLength: notes.length });
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
    You are a Content Strategy Expert for ${brandName}.

        TASK: Analyze the provided RAW NOTES and structure them into a concrete Campaign Plan.

            INPUT:
    ${notes}

    INSTRUCTIONS:
    1. EXTRACT discrete content items.Look for links, specific topic requests, or event mentions.
    2. IGNORE general conversation filler.
    3. IDENTIFY global rules(e.g. "No GMs", "Don't use emojis").
    4. For each item, capture specific instructions(e.g. "Credit the interviewer").
    
    OUTPUT JSON FORMAT:
    {
        "theme": "A short, summarized theme title based on the content (e.g. 'January Updates Mix')",
            "globalInstructions": ["Rule 1", "Rule 2"],
                "items": [
                    {
                        "type": "Tweet" | "Thread" | "Announcement",
                        "topic": "Brief topic summary",
                        "specificInstruction": "The specific constraint or instruction for this exact post",
                        "url": "extracted link or null"
                    }
                ]
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Analyze these notes.",
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error("Content note analysis failed", e);
        throw e;
    }
};

/**
 * Generates a campaign of tweets (Drafting Phase) - Supports Smart Plan.
 */
export const generateCampaignDrafts = async (
    theme: string,
    brandName: string,
    brandConfig: BrandConfig,
    count: number,
    contentPlan?: any, // OPTIONAL: Smart Plan
    focusContent?: string, // NEW: Optional Focus Document
    recentPosts: any[] = [] // NEW: Analytics History
): Promise<{ drafts: any[], thinking: string, themeColor?: string, systemPrompt?: string }> => {
    dispatchThinking(`🚀 Drafting Campaign: "${theme}"`, { count, focus: focusContent ? 'Yes' : 'No' });
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // FORMATTING: STRICTLY FORBID COPYING, BUT ENCOURAGE STYLE MIMICRY
    const examples = brandConfig.tweetExamples.length > 0
        ? `STYLE DNA (VIBE CHECK ONLY - DO NOT COPY): \n${brandConfig.tweetExamples.slice(0, 5).map(t => `- ${t}`).join('\n')} `
        : "";

    const templateExamples = (brandConfig.graphicTemplates || [])
        .filter(t => t.tweetExample && t.tweetExample.trim().length > 0)
        .map(t => `[TEMPLATE STYLE: ${t.label}]: "${t.tweetExample}"`)
        .join('\n');

    const templateContext = templateExamples.length > 0
        ? `\nTEMPLATE-SPECIFIC WRITING STYLES (If assigning a template, MATCH its writing style): \n${templateExamples}`
        : "";

    const kb = brandConfig.knowledgeBase.length > 0
        ? `CORE KNOWLEDGE (SOURCE OF TRUTH): \n${brandConfig.knowledgeBase.join('\n\n')} `
        : "";

    const standardTemplates = ['Partnership', 'Campaign Launch', 'Giveaway', 'Event', 'Speaker Quote'];
    // Content Diet Logic: Prioritize High-Signal Templates
    const customTemplates = (brandConfig.graphicTemplates || []);

    const highSignalTemplates = customTemplates
        .filter(t => ['feature', 'product', 'launch', 'article', 'insight'].some(cat => (t.category || '').toLowerCase().includes(cat)))
        .map(t => t.label);

    const lowSignalTemplates = customTemplates
        .filter(t => ['ama', 'event', 'giveaway', 'meme'].some(cat => (t.category || '').toLowerCase().includes(cat)))
        .map(t => t.label);

    // If no categories, just list them all
    const availableTemplates = customTemplates.length > 0
        ? `
        AVAILABLE TEMPLATES (PRIORITIZE GROUP A):
        [GROUP A - HIGH SIGNAL (60%)]: ${highSignalTemplates.join(', ')}
        [GROUP B - LOW SIGNAL (20%)]: ${lowSignalTemplates.join(', ')}
        `
        : `AVAILABLE TEMPLATES: ${standardTemplates.join(', ')}`;

    // --- RAG: RETRIEVE BRAIN MEMORY ---
    let ragContext = "";
    try {
        const queryText = `Campaign Theme: ${theme}. Strategic Focus: ${focusContent || "General Brand Awareness"}.Brand: ${brandName} `;
        const queryEmbedding = await getEmbedding(queryText);
        if (queryEmbedding.length > 0) {
            const memories = await searchBrainMemory(brandName, queryEmbedding, 0.7, 5);
            if (memories && memories.length > 0) {
                dispatchThinking(`🧠 Brain Retrieval: Found ${memories.length} relevant memories.`, memories.map((m: any) => m.content));
                const memoryList = memories.map((m: any) => `- ${m.content}`).join("\n");
                ragContext = `[NARRATIVE HISTORY - BUILD ON THIS]:\n${memoryList}`;
            }
        }
    } catch (err) {
        console.warn("🧠 Brain RAG: Failed to retrieve memory", err);
    }

    const winningPosts = recentPosts
        .filter(p => p.likes > 5)
        .slice(0, 3)
        .map(p => `"${p.content}"`).join('\n');

    const recentContext = winningPosts.length > 0
        ? `RECENT PROVEN HITS (MATCH THIS ENERGY): \n${winningPosts} `
        : "";

    let taskInstruction = '';

    // SMART MODE OR LEGACY MODE
    if (contentPlan && contentPlan.items && contentPlan.items.length > 0) {
        const planItems = contentPlan.items.map((item: any, i: number) =>
            `ITEM ${i + 1}: Type: ${item.type}. Topic: ${item.topic}. URL: ${item.url || 'None'}. Instruction: ${item.specificInstruction} `
        ).join('\n');

        const rules = contentPlan.globalInstructions ? `GLOBAL RULES: ${contentPlan.globalInstructions.join(', ')} ` : "";

        taskInstruction = `
    TASK: Execute this Content Plan strictly.
    TARGET COUNT: ${count}.
    
    PLAN:
    ${planItems}
    
    ${rules}
    `;
    } else {
        const isCampaign = count >= 3;

        // DYNAMIC LOGIC: Detect intent (Fun vs Edu)
        const lowerTheme = theme.toLowerCase();
        const isCreative = lowerTheme.includes('meme') || lowerTheme.includes('fun') || lowerTheme.includes('vibes') || lowerTheme.includes('hype');

        let structureInstruction = "";

        if (isCreative) {
            structureInstruction = `
            🎨 **MODE: CREATIVE FLOW (NO RULES)**
            The user wants a "Fun/Creative" campaign. 
            - DO NOT use a rigid "Problem/Solution" structure.
            - JUST JAM on the idea. 
            - Create ${count} distinct, high-energy, or funny posts that hit the theme.
            - Vibe: Loose, confident, perhaps a bit unhinged (if brand voice allows).
            `;
        } else {
            structureInstruction = `
            🎓 **MODE: HIGH-SIGNAL EDUCATION (DEEP DIVE)**
            The user wants to EDUCATE the audience.
            
            **REQUIRED STRUCTURE (The "Alpha" Flow):**
            1. **THE THESIS (Tweet 1)**: Immediate Alpha. No buildup. State the core insight or value proposition upfront.
            2. **THE MECHANIC (Tweet 2)**: Technical breakdown. How does it actually work? (Use Knowledge Base).
            3. **THE NUANCE/EDGE (Tweet 3)**: Address a misconception or explain why this specific approach wins.
            4. **THE OUTCOME (Tweet 4)**: What is the end result for the user? (Yield, Speed, etc).
            5. **THE RESOURCE (Tweet 5)**: Link to docs or app.

            *Goal: Position the brand as a Technical Authority.*
            `;
        }

        taskInstruction = `
    TASK: Generate ${count} tweets about "${theme}".
    
    ${isCampaign ? structureInstruction : ''}

    STRATEGY: Align with the Roadmap and Documents below.
    INTENT RECOGNITION: If "${theme}" is a broad topic, treat this as a request for a "Masterclass Campaign" - deep diving into every aspect of the topic.
    `;
    }

    const voice = brandConfig.voiceGuidelines || "Narrative Authority: Insightful, grounded, and forward-looking. Speak to mechanics, not just features.";

    const defaults = ["We are excited to announce", "Revolutionizing", "Game changer", "In the rapidly evolving landscape", "Delve", "Tapestry", "Hone in", "Unleash", "Thrilled"];
    const banned = (brandConfig.bannedPhrases && brandConfig.bannedPhrases.length > 0) ? [...brandConfig.bannedPhrases, ...defaults] : defaults;
    const bannedInstruction = banned.length > 0 ? `BANNED (INSTANT FAIL IF USED): ${banned.join(', ')}.` : "";

    const audience = brandConfig.targetAudience ? `AUDIENCE: ${brandConfig.targetAudience} ` : "";

    const systemInstruction = `
    You are a World-Class Crypto Narrative Designer for ${brandName}.
    
    OBJECTIVE:
    Write ${count} tweets that are:
    1. **STRATEGIC**: Strictly aligned with the "Strategic Focus Document" and "Core Knowledge".
    2. **REASONED**: Every tweet must have a clear "Why". Connecting it to a roadmap goal.
    3. **HIGH-SIGNAL**: Use dense, insightful language. "Alpha" > "Marketing".
    4. **FORMATTED**: Perfect vertical spacing, clean hooks.
    5. **DETAILED**: Do NOT be brief. Be COMPREHENSIVE. Use the full character limit to explain the nuance.
    6. **VISUAL VARIETY**: ${availableTemplates}
       - CRITICAL INSTRUCTION: When assigning a "visualTemplate" to a tweet, prioritize [GROUP A - HIGH SIGNAL] templates (Features, Articles) for the majority of posts.
       - Use [GROUP B] (AMAs, Giveaways) SPARINGLY, only if the content specifically demands it.
       - Do NOT default to "Generic" if a High Signal template fits.

    INPUT DATA (HIERARCHY OF TRUTH):
    1. [HIGHEST PRIORITY] STRATEGIC FOCUS DOCUMENT: ${focusContent || "None Provided"} (If this exists, it OVERRIDES everything).
    2. CORE KNOWLEDGE BASE: ${brandConfig.knowledgeBase.length > 0 ? "See below." : "None."}
    3. BRAIN MEMORY: ${ragContext ? "See below" : "None"}
    4. GENERAL KNOWLEDGE

    ${kb}

    ${ragContext}
    
    STYLE REFERENCES (DO NOT COPY TEXT, MIMIC THE VIBE):
    STYLE REFERENCES (DO NOT COPY TEXT, MIMIC THE VIBE):
    ${examples}
    ${templateContext}
    ${recentContext}

    PROTOCOL:
    ${audience}
    VOICE: "${voice}"
    ${bannedInstruction}

    EXECUTION GUIDELINES:
    1. **UNPREDICTABLE FLOW**: Mix up the structure (Short / List / Quote / Contrarian).
    2. **SUBSTANCE**: Cite the "Strategic Focus Document" or "Core Knowledge" where possible.
    3. **NO FLUFF**: If a sentence doesn't add value, remove it.
    4. **FORMATTING**: Use '\\n' for line breaks inside the JSON string to make it readable.

    OUTPUT FORMAT (JSON ONLY):
    Output a RAW JSON object.
    
    {
        "themeColor": "#HEXCODE",
        "drafts": [
            {
                "tweet": "Tweet content...\\n\\nUse line breaks for spacing.",
                "visualHeadline": "A short, punchy 3-5 word headline for the image (e.g. 'DEFI REVOLUTION ARRIVES').",
                "visualDescription": "A specific art direction description for a designer (e.g. 'Cyberpunk city with neon ethereum logo, high contrast').",
                "template": "One of: ${allTemplates}",
                "reasoning": "VERIFICATION: Cite the exact Knowledge Base fact, Strategy Doc section, or URL that validates this tweet. (e.g. 'Source: KB Fact #3 re: L2 Security' or 'Source: Whitepaper p.4')."
            }
        ]
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: taskInstruction,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        dispatchThinking(`✅ Campaign Drafts Generated`);
        const text = response.text || "{}";
        const json = JSON.parse(text);

        return {
            drafts: json.drafts || [],
            themeColor: json.themeColor,
            thinking: `Generated ${json.drafts?.length || 0} drafts. \nStrategy: ${json.drafts?.[0]?.reasoning || "Balanced mix based on best practices."}`,
            systemPrompt: systemInstruction // 🧠 EXPOSE THE PROMPT
        };
    } catch (error) {
        console.error("Campaign generation error", error);
        return { drafts: [], thinking: "Generation Failed.", systemPrompt: "Error" };
    }
};

/**
 * STRATEGY: Generates a full marketing campaign brief.
 */
export const generateCampaignStrategy = async (
    goal: string,
    theme: string,
    platforms: string[],
    userContext: string,
    activeCampaigns: string[],
    brandName: string,
    brandConfig: BrandConfig,
    brainContext: string = "", // NEW (History)
    focusContent: string = "", // NEW (User Doc)
    ragContext: string = "" // NEW (Deep Search)
): Promise<CampaignStrategy> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // SYSTEM THINKING
    dispatchThinking("Generating Campaign Strategy", {
        theme,
        hasContext: !!userContext,
        hasBrainHistory: !!brainContext,
        hasDeepContext: !!ragContext
    });

    const kb = brandConfig.knowledgeBase.join('\n');
    const examples = brandConfig.tweetExamples.slice(0, 3).join('\n');

    const activeCampaignsList = activeCampaigns.length > 0
        ? activeCampaigns.join('\n')
        : "None";


    // --- ENTERPRISE PROTOCOL ENFORCEMENT ---
    const voice = brandConfig.voiceGuidelines || "Strategic, Professional, Market-Leading.";
    const audienceProtocol = brandConfig.targetAudience ? `TARGET AUDIENCE PROTOCOL: ${brandConfig.targetAudience} ` : "";
    const bannedProtocol = brandConfig.bannedPhrases ? `BANNED PHRASES: ${brandConfig.bannedPhrases.join(', ')} ` : "";

    const systemInstruction = `
    You are the Chief Marketing Officer for ${brandName}.
    You are a strategic genius known for precision, ROI-focus, and clarity.
    
    
    CAMPAIGN CONTEXT:
    - Goal: ${goal}
    - Theme / Topic: ${theme}
    - Platforms: ${platforms.join(', ')}
    - Situation / Context: ${userContext || "None provided"}
    
    ACTIVE CAMPAIGNS & CONTENT (Analyze for synergy / conflicts):
    ${activeCampaignsList}

    MARKETING BRAIN MEMORY (Recent decisions / insights):
    ${brainContext || "No recent context."}

    DEEP KNOWLEDGE BASE (Strategic Docs & Best Performers):
    ${ragContext || "No deep context found."}
    
    BRAND KNOWLEDGE:
    ${kb}

    ${focusContent ? `PRIMARY STRATEGIC FOCUS DOCUMENT (OVERRIDES GENERAL KNOWLEDGE): \n${focusContent}` : ''}

    BRAND PROTOCOLS:
    ${audienceProtocol}
    VOICE: ${voice} (Do not deviate).
    ${bannedProtocol}

    TONE EXAMPLES:
    ${examples}

TASK:
    Develop a comprehensive campaign strategy brief.
    - Analyze the target audience for this specific theme.
    - Consider the "Situation" provided to tailor the messaging.
    - SYNERGY: Review "Active Campaigns" and "Brain Memory".Ensure this new campaign complements existing ones(e.g.if we are already doing a 'Giveaway', maybe this one should be 'Educational').
    - Define 3 key messaging pillars.
    - Outline a strategy for each selected platform.
    - Provide realistic result estimates based on a standard micro - campaign.
    - ** CRITICAL **: For every key decision, explicitly optional "rationale" citing which 'Strategy Doc' or 'Brain Memory' influenced it. (e.g. "Focusing on DeFi Gaming because: 'Q1 Goal: Capture Gamer Share'").

    OUTPUT FORMAT(JSON):
{
    "targetAudience": "Detailed description of who we are targeting.",
        "strategicRationale": "Short explanation of WHY this audience/theme was chosen based on Brain Memory/Goals.",
            "keyMessaging": ["Message 1", "Message 2", "Message 3"],
                "channelStrategy": [
                    { "channel": "Twitter", "focus": "Viral threads", "rationale": "High engage..." },
                    { "channel": "LinkedIn", "focus": "Thought leadership", "rationale": "B2B..." }
                ],
                    "contentMix": "One sentence description of the content variety (e.g. 30% educational, 20% memes...)",
                        "estimatedResults": {
        "impressions": "10k - 50k",
            "engagement": "2% - 5%",
                "conversions": "50+ Leads"
    }
}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Generate strategy brief.",
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const text = response.text;
        if (!text) throw new Error("No strategy generated");

        // BRAIN LOG
        const log: BrainLog = {
            id: `brain - ${Date.now()} `,
            timestamp: Date.now(),
            type: 'CAMPAIGN',
            brandId: brandName,
            context: `Goal: ${goal}, Theme: ${theme}, Platforms: ${platforms.join(', ')} `,
            systemPrompt: systemInstruction,
            userPrompt: "Generate strategy brief.",
            rawOutput: text,
            structuredOutput: JSON.parse(text),
            model: "gemini-2.0-flash"
        };
        saveBrainLog(log);

        return JSON.parse(text) as CampaignStrategy;
    } catch (e) {
        console.error("Strategy generation failed", e);
        throw e;
    }
};

/**
 * Pulse Engine: Generates a reaction to a specific market trend.
 */
export const generateTrendReaction = async (
    trend: TrendItem,
    brandName: string,
    brandConfig: BrandConfig,
    type: 'Tweet' | 'Meme'
): Promise<string> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const examples = brandConfig.tweetExamples.length > 0
        ? `STYLE EXAMPLES: \n${brandConfig.tweetExamples.slice(0, 2).map(t => `- ${t}`).join('\n')} `
        : "";

    const templateExamples = (brandConfig.graphicTemplates || [])
        .filter(t => t.tweetExample && t.tweetExample.trim().length > 0)
        .map(t => `[TEMPLATE STYLE: ${t.label}]: "${t.tweetExample}"`)
        .join('\n');

    const templateContext = templateExamples.length > 0
        ? `\nTEMPLATE STYLES (Use if relevant): \n${templateExamples}`
        : "";

    const kb = brandConfig.knowledgeBase.length > 0
        ? `OUR BRAND CONTEXT(USE THIS TO CONNECT TREND TO PRODUCT): \n${brandConfig.knowledgeBase.join('\n\n')} `
        : "";

    const isNoTagBrand = ['netswap', 'enki'].includes(brandName.toLowerCase());
    const hashtagInstruction = isNoTagBrand ? "- Do NOT use any hashtags." : "- Use 1-2 relevant hashtags.";

    let outputGuidance = "";
    if (type === 'Tweet') {
        outputGuidance = `
    Output: A single, high-impact tweet based on the trend.
    Strategy: Explicitly connect the news ("${trend.headline}") to ${brandName}'s value proposition (from Knowledge Base).
    Structure: Hook -> Insight -> Soft CTA.
    Structure: Hook -> Insight -> Soft CTA.
    Style: Minimalist, confident, NO HASHTAGS.
    Formatting: Use line breaks.
    Formatting: Use line breaks.
        `;
    } else {
        outputGuidance = `
    Output: A short, funny text caption or concept for a meme.
    Strategy: Use internet humor to react to ("${trend.headline}"). Make it relatable to holders of ${brandName}.
    Strategy: Use internet humor to react to ("${trend.headline}"). Make it relatable to holders of ${brandName}.
    - NO HASHTAGS.
    `;
    }

    // --- ENTERPRISE PROTOCOL ENFORCEMENT ---
    const voice = brandConfig.voiceGuidelines || "Casual, Fast, Degen.";
    const banned = brandConfig.bannedPhrases ? `BANNED PHRASES: ${brandConfig.bannedPhrases.join(', ')} ` : "";

    const systemInstruction = `
    You are the Real - time Newsroom Manager for ${brandName}.
    
    TRENDING NEWS:
    Headline: ${trend.headline}
Summary: ${trend.summary}
Source: ${trend.source}
    WHY IT MATTERS: ${trend.relevanceReason}
    
    ${kb}
    
    ${examples}
    ${templateContext}

    BRAND PROTOCOLS:
VOICE: ${voice}
    ${banned}

TASK:
    Generate a ${type} reaction to this trend.
    ${outputGuidance}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "React to this trend now.",
            config: { systemInstruction: systemInstruction }
        });
        // BRAIN LOG
        const log: BrainLog = {
            id: `brain - ${Date.now()} `,
            timestamp: Date.now(),
            type: 'REACTION',
            brandId: brandName,
            context: `Reacting to Trend: ${trend.headline} (Relevance: ${trend.relevanceScore})`,
            systemPrompt: systemInstruction,
            userPrompt: "React to this trend now.",
            rawOutput: response.text || "",
            model: "gemini-2.0-flash"
        };
        saveBrainLog(log);

        return response.text || "";
    } catch (error) {
        console.error("Trend reaction error", error);
        throw error;
    }
};

/**
 * CONNECT: Generates business connection ideas from trends.
 */
export const generateBusinessConnections = async (
    trends: TrendItem[],
    brandName: string,
    brandConfig: BrandConfig
): Promise<string> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Filter top 10 trends for prompt
    const topTrends = trends.slice(0, 10).map(t => `- ${t.headline}: ${t.summary} `).join('\n');
    const kb = brandConfig.knowledgeBase.join('\n');

    const systemInstruction = `
    You are the Chief Strategy Officer for ${brandName}.
    
    YOUR OBJECTIVE:
    Identify high - value strategic opportunities by connecting real - time market trends to ${brandName} 's unique value propositions.
    
    BRAND KNOWLEDGE BASE:
    ${kb}

    CURRENT MARKET TRENDS:
    ${topTrends}

    YOUR TASK:
    For the top 3 most relevant trends provided above, generate specific, actionable business opportunities.
    
    CRITICAL INSTRUCTIONS:
1. ** Direct Correlation **: explicitly explain HOW this trend affects ${brandName}.
2. ** Actionable Strategy **: Suggest a concrete marketing angle, partnership idea, or product feature emphasis.
    3. ** Tone **: Executive, insightful, and growth - oriented.
    
    OUTPUT FORMAT(Markdown):
    ###[Trend Name]
    ** Relevance:** [Why this matters to ${brandName}]
    ** Strategy:** [Specific action we should take]
        ** Content Angle:** [What we should post / write about]
            `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Generate business connections.",
            config: { systemInstruction: systemInstruction }
        });

        return response.text || "Unable to generate ideas.";
    } catch (e) {
        console.error("Business connection generation failed", e);
        return "Error generating business connection ideas.";
    }
};

export const generateIdeas = async (brandName: string): Promise<string[]> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: `Generate 4 distinct tweet topics / ideas for a ${brandName} marketing strategist.Return only the topics as a simple list.`,
        });
        return (response.text || '').split('\n').map(l => l.replace(/^[\d\-\.\*]+\s*/, '').trim()).filter(l => l.length > 5);
    } catch (e) {
        console.warn("Idea generation failed", e);
        return [];
    }
}



/**
 * AI RESEARCH: Scrapes (Simulated) and infers brand identity from URL/Name.
 */
export const researchBrandIdentity = async (brandName: string, url: string): Promise<BrandConfig> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Use Gemini if available for high-quality hallucination
    try {
        if (!getApiKey()) throw new Error("No API Key");

        const systemInstruction = `
        You are an expert Brand Identity Analyst and AI Researcher.

    TASK:
        Analyze the company "${brandName}" located at "${url}".
        Since you cannot browse the live web, use your internal knowledge base to infer their brand identity, visual style, and value proposition.
        
        If the brand is unknown or fictitious, HALLUCINATE a plausible, professional Web3 brand identity based on the name and URL structure.
        
        OUTPUT FORMAT(JSON):
{
    "colors": [
        { "id": "c1", "name": "Primary", "hex": "#HEX" },
        { "id": "c2", "name": "Secondary", "hex": "#HEX" },
        { "id": "c3", "name": "Accent", "hex": "#HEX" }
    ],
        "knowledgeBase": [
            "Fact 1 about what they do.",
            "Fact 2 about their products.",
            "Fact 3 about their target audience."
        ],
            "tweetExamples": [
                "Example tweet 1 (reflecting their tone).",
                "Example tweet 2."
            ]
}
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Research this brand: ${brandName} (${url})`,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const data = JSON.parse(response.text || "{}");

        return {
            colors: data.colors || [],
            knowledgeBase: data.knowledgeBase || [],
            tweetExamples: data.tweetExamples || [],
            referenceImages: []
        };

    } catch (e) {
        console.warn("Research API failed or offline.", e);
        // Fail gracefully without fallback
        throw new Error("Brand research failed. Please check API Key.");
    }
}

/**
 * SOCIAL BRAIN: Generates a contextual reply based on sentiment and post content.
 */
export const generateSmartReply = async (
    postText: string,
    postAuthor: string,
    sentimentScore: number,
    brandName: string,
    brandConfig: BrandConfig
): Promise<string> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Determine stance based on 'War Room' sentiment
    const stance = sentimentScore > 60 ? "BULLISH/CONFIDENT" : sentimentScore < 40 ? "DEFENSIVE/REASSURING" : "NEUTRAL/PROFESSIONAL";

    const systemInstruction = `
    You are the Social Media Manager for ${brandName}.

    CONTEXT:
    - We are replying to a user: @${postAuthor}
- They said: "${postText}"
    - Current Market Mood: ${stance} (Score: ${sentimentScore}/100)

TASK:
    Draft a short, engaging reply(under 280 chars).Keep it professional and minimized.

    GUIDELINES:
- If the user is FUDding, be polite but correct them with facts.
    - If the user is Hype / Alpha, amplify the energy.
    - If the mood is checking is Bearish, be reassuring.
    - Use the brand's tone from examples below.
    
    TONE EXAMPLES:
    ${brandConfig.tweetExamples.slice(0, 2).map(t => `- ${t}`).join('\n')}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Draft reply.",
            config: { systemInstruction }
        });
        // BRAIN LOG
        const log: BrainLog = {
            id: `brain - ${Date.now()} `,
            timestamp: Date.now(),
            type: 'REPLY',
            brandId: brandName,
            context: `Replying to @${postAuthor}: "${postText}"(Sentiment: ${sentimentScore})`,
            systemPrompt: systemInstruction,
            userPrompt: "Draft reply.",
            rawOutput: response.text || "",
            model: "gemini-2.0-flash"
        };
        saveBrainLog(log);

        return response.text || "";
    } catch (e) {
        console.error("Smart Reply generation failed", e);
        return "Thanks for the shoutout! 🚀"; // Fallback
    }
};

/**
 * Generates an Investor-Grade Growth Report based on metrics.
 */
export const generateGrowthReport = async (
    metrics: ComputedMetrics | null,
    campaigns: CampaignLog[],
    socialMetrics?: SocialMetrics
): Promise<GrowthReport> => {
    dispatchThinking(`📊 Generating Growth Report`, { hasOnChain: !!metrics, hasSocial: !!socialMetrics });
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    let onChainSection = "ON-CHAIN DATA: Not connected / Unavailable. Focus analysis on social strategy.";

    if (metrics) {
        onChainSection = `
ON - CHAIN DATA:
- Total TVL Change: $${metrics.tvlChange.toLocaleString()}
- Total Volume: $${metrics.totalVolume.toLocaleString()}
- Net New Wallets: ${metrics.netNewWallets}
- Active Wallets: ${metrics.activeWallets}
- Retention Rate: ${metrics.retentionRate.toFixed(1)}%
    `;
    }

    // Safety check for campaigns
    const safeCampaigns = campaigns || [];

    const campaignsData = safeCampaigns.map(c => {
        const m = metrics?.campaignPerformance.find(p => p.campaignId === c.id);
        return `
    - Campaign: "${c.name}"(${c.channel})
Budget: $${c.budget}
      ${m ? `CPA: $${m.cpa}
      Lift Multiplier: ${m.lift.toFixed(1)}x
      Whales Acquired: ${m.whalesAcquired}
      ROI: ${m.roi.toFixed(1)}x` : 'Attribution: Unavailable'
            }
`;
    }).join('\n');

    let socialData = "No social data available.";
    if (socialMetrics) {
        socialData = `
Followers: ${socialMetrics.totalFollowers}
      Engagement Rate: ${socialMetrics.engagementRate}% (Vs Last Week: ${socialMetrics.comparison.engagementChange > 0 ? '+' : ''}${socialMetrics.comparison.engagementChange}%)
      Top Recent Post: "${socialMetrics.recentPosts[0]?.content}"(Likes: ${socialMetrics.recentPosts[0]?.likes}, Comments: ${socialMetrics.recentPosts[0]?.comments})
    `;
    }

    const systemInstruction = `
  You are the Head of Growth for a Web3 Protocol.You are analyzing available data to produce a strategic brief.

    ${onChainSection}
  
  SOCIAL DATA:
  ${socialData}
  
  CAMPAIGN CONTEXT:
  ${campaignsData}

TASK:
  Generate a strictly data - driven strategic brief.
  If on - chain data is missing, base your recommendations entirely on social engagement, content performance, and brand sentiment.
  
  OUTPUT FORMAT(JSON):
{
    "executiveSummary": "A concise, investor-grade paragraph summarizing the growth health. ${metrics ? 'Correlate social buzz with on-chain volume.' : 'Focus on community sentiment and engagement trends.'}",
        "tacticalPlan": "Specific, actionable next steps based on the data.",
            "strategicPlan": [
                { "action": "KILL" | "DOUBLE_DOWN" | "OPTIMIZE", "subject": "Campaign Name or Content Strategy", "reasoning": "1 sentence data-backed reason." }
            ]
}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Analyze the data and generate the report.",
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const text = response.text;
        if (!text) throw new Error("No report generated");

        // BRAIN LOG
        const log: BrainLog = {
            id: `brain - ${Date.now()} `,
            timestamp: Date.now(),
            type: 'GROWTH_REPORT',
            brandId: 'GrowthEngine', // Generic or specific
            context: `Analyzing metrics for Growth Report.TVL Change: ${metrics?.tvlChange}, Social Engagement: ${socialMetrics?.engagementRate}% `,
            systemPrompt: systemInstruction,
            userPrompt: "Analyze the data and generate the report.",
            rawOutput: text,
            structuredOutput: JSON.parse(text),
            model: "gemini-2.0-flash"
        };
        saveBrainLog(log);

        return JSON.parse(text) as GrowthReport;
    } catch (error) {
        console.error("Growth report error", error);
        // Fallback if JSON parsing fails
        return {
            executiveSummary: "Analysis complete. Data indicates mixed performance across campaigns. Review individual KPIs for details.",
            tacticalPlan: "Review current tracking configurations and ensure data sources are connected.",
            strategicPlan: [],
            metrics: metrics || undefined
        };
    }
};


/**
 * STRATEGY BRAIN: "The Employee"
 */
// Update imports to include Mention from analytics (we need to export it from types or analytics, assuming analytics for now based on previous step)
// Note: Since Mention is defined in analytics in previous step, we might need to move it to types.ts or just use 'any' if import is tricky without seeings exports. 
// Ideally Mention should be in types.ts. I will assume it is passed as 'any[]' for now or 'Mentions[]' if I can fix types.
// For safety, I will define a local interface or use existing types.

export const generateStrategicAnalysis = async (
    brandName: string,
    calendarEvents: CalendarEvent[],
    trends: TrendItem[],
    brandConfig: BrandConfig,
    growthReport?: GrowthReport | null,
    mentions: any[] = [], // New: Incoming mentions for Community Manager
    ragContext: string = "", // New: RAG Memory Context

    signals?: SocialSignals, // New: War Room Context
    recentLogs: BrainLog[] = [] // New: Cognitive Loop (Short Term Memory)
): Promise<{ tasks: StrategyTask[], systemPrompt?: string, thoughts?: string }> => {
    dispatchThinking(`🤖 Generating Strategic Analysis (Gaia)`, { brand: brandName, trendCount: trends.length });
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // War Room Context
    const warRoomContext = signals ? `
    WAR ROOM INTELLIGENCE:
- Sentiment Score: ${signals.sentimentScore}/100 (${signals.sentimentTrend})
    - Active Narratives: ${signals.activeNarratives.join(', ')}

` : "";

    // Cognitive Loop (Short Term Memory)
    const memoryContext = recentLogs.length > 0 ? `
    SHORT TERM MEMORY(Your Recent Decisions):
    ${recentLogs.slice(0, 5).map(l => `- [${l.type}] ${new Date(l.timestamp).toLocaleTimeString()}: ${l.context}`).join('\n')}

INSTRUCTION: Review your recent memory.Do not repeat actions you just took.If you just reacted to a trend, look for replies.If you just posted, check for engagement.
    ` : "SHORT TERM MEMORY: Empty (Fresh Start).";

    // 1. Analyze Calendar (Content Machine)
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const eventsNextWeek = calendarEvents.filter(e => {
        const d = new Date(e.date);
        return d >= now && d <= next7Days;
    });
    const isScheduleEmpty = eventsNextWeek.length < 3;

    // 2. Prepare Context
    const kb = brandConfig.knowledgeBase.slice(0, 3).join('\n'); // Brief context
    const trendSummaries = trends.slice(0, 3).map(t => `- ${t.headline}(${t.relevanceReason})`).join('\n');
    const existingSchedule = eventsNextWeek.map(e => `${e.date}: ${e.content.substring(0, 30)}... ${e.campaignName ? `[Campaign: ${e.campaignName}]` : ''} `).join('\n');
    const mentionSummaries = mentions.slice(0, 3).map(m => `- ${m.author}: "${m.text}"`).join('\n');

    let reportContext = "No quantitative performance data available.";
    if (growthReport) {
        reportContext = `
        PERFORMANCE DATA(Use this to optimize tasks):
- Executive Summary: ${growthReport.executiveSummary}
- Strategic Directives: ${growthReport.strategicPlan.map(p => `${p.action}: ${p.subject}`).join(' | ')}
`;
    }

    const systemInstruction = `
    You are 'Gaia', the AI Marketing Employee for ${brandName}.
    You assume three specific roles to audit the current state and assign tasks:

    ${warRoomContext}

    ${memoryContext}

    ${ragContext ? `
    IMPORTANT - STRATEGIC MANDATES (FROM DEEP MEMORY):
    The following is retrieved context (Strategy Docs + Past Performance). 
    CRITICAL: You MUST PRIORITIZE these goals above general trends. If a Q1 Goal is listed, every task must align with it.
    
    ${ragContext}
    ` : ''
        }

    ROLE 1: THE NEWSROOM(Trend Jacking)
    - Monitor 'Market Trends' for any news specifically matching our brand keywords or high - impact sector news.
    - If a match is found, create a 'REACTION' task.

    ROLE 2: THE COMMUNITY MANAGER(Auto - Reply)
        - Review 'Incoming Mentions'.
    - If a mention requires a response(question, praise, FUD), create a 'REPLY' task.
    - Ignore spam.

    ROLE 3: THE CONTENT MACHINE(Evergreen)
        - Review 'Upcoming Schedule'.
    - If there are fewer than 3 items scheduled for the next 7 days, create 'EVERGREEN' tasks to fill the gaps.
    - Topics: Educational, Brand Values, Feature Highlights(from Knowledge Base).
    - CRITICAL: In 'contextData', cite { "type": "CALENDAR", "source": "Schedule Audit", "headline": "Content Gap Identified", "relevance": 10 }.

CONTEXT:
- Upcoming Schedule:
    ${existingSchedule || "NO CONTENT SCHEDULED (Active Content Machine needed)."}

- Market Trends:
    ${trendSummaries || "No major trends detected."}

- Incoming Mentions:
    ${mentionSummaries || "No new mentions."}

- Brand Context:
    ${kb}

    ${reportContext}

TASK:
1. First, write a "Strategic Analysis" paragraph(3 - 4 sentences).Analyze the input data, identify relationships(e.g. "Calendar is empty BUT trending topic X is relevant"), and define the high - level strategy for this session.
    2. Then, propose exactly 3 - 5 high - impact tasks based on that analysis.
    3. For each task, suggest the most appropriate 'Visual Template'(e.g.use 'Partnership' for collabs, 'Campaign Launch' for big news).If unsure, use 'Campaign Launch'.
    
    OUTPUT JSON FORMAT:
{
    "thoughts": "Strategic analysis text here...",
        "tasks": [
            {
                "id": "unique_string",
                "type": "GAP_FILL" | "TREND_JACK" | "CAMPAIGN_IDEA" | "COMMUNITY" | "REACTION" | "REPLY" | "EVERGREEN",
                "title": "Short Task Title",
                "description": "One sentence explanation.",
                "reasoning": "Why this is important now (Summary).",
                "reasoningSteps": ["Step 1: Analyzed trend X", "Step 2: Identified gap Y", "Step 3: Determined action Z"],
                "impactScore": number(1 - 10),
                "executionPrompt": "Instruction...",
                "contextData": [
                    { "type": "TREND", "source": "CoinDesk", "headline": "ETH High", "relevance": 9 },
                    { "type": "MENTION", "source": "User @user", "headline": "Asked about staking", "relevance": 10 }
                ],
                "suggestedVisualTemplate": "Campaign Launch" | "Partnership" | "Event",
                "suggestedReferenceIds": ["ref-123"]
            }
        ]
}

CRITICAL:
- 'contextData' must cite REAL inputs from the provided 'Market Trends', 'Incoming Mentions', or 'System Memory'. 
    - You MUST include at least 1 item in 'contextData' for every task to prove why it was generated.
    - Do NOT hallucinate sources.If you use a trend, cite the specific headline.
    - 'reasoningSteps' should show your logic chain.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Perform the audit and generate thoughts + tasks.",
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const json = JSON.parse(response.text || "{}");
        const tasks = (json.tasks || []) as StrategyTask[];
        const thoughts = json.thoughts || "No analysis provided.";

        const log: BrainLog = {
            id: `brain - ${Date.now()} `,
            timestamp: Date.now(),
            type: 'STRATEGY',
            brandId: brandName,
            context: `
[SOURCE: CALENDAR_AUDIT]
Scan Depth: ${eventsNextWeek.length} items found.
    ${existingSchedule || "No records found."}

[SOURCE: LIVE_MARKET_TRENDS]
Scan Depth: ${trends.length} active signals.
    ${trendSummaries || "No signals detected."}

[SOURCE: COMMUNITY_MENTIONS]
Scan Depth: ${mentions.length} interactions.
    ${mentionSummaries || "No recent activity."}

[SOURCE: SYSTEM_MEMORY]
${recentLogs.length > 0 ? "Retrieved previous " + recentLogs.length + " logs." : "Memory initialized."}
`.trim(),
            systemPrompt: systemInstruction,
            userPrompt: "Perform the audit and generate tasks.",
            rawOutput: response.text || "",
            structuredOutput: tasks,
            thoughts: thoughts,
            model: "gemini-2.0-flash"
        };
        saveBrainLog(log);

        // Link Tasks to Log
        const linkedTasks = tasks.map(t => ({ ...t, sourceLogId: log.id }));

        return {
            tasks: linkedTasks,
            systemPrompt: systemInstruction,
            thoughts: thoughts
        };
    } catch (error) {
        console.error("Strategy generation error", error);
        // Fallback
        const fallbackTasks: StrategyTask[] = [];

        if (isScheduleEmpty) {
            fallbackTasks.push({
                id: 'fallback-evg',
                type: 'EVERGREEN',
                title: 'Schedule Gaps Detected',
                description: 'The calendar is light. Generating educational content.',
                reasoning: 'Consistent presence is key.',
                impactScore: 7,
                executionPrompt: `Write an educational tweet about ${brandName}'s core value proposition.`,
                suggestedVisualTemplate: 'Campaign Launch',
                contextData: [{
                    type: 'CALENDAR',
                    source: 'Growth Engine',
                    headline: 'Schedule Gap Detected',
                    relevance: 9
                }]
            });
        }

        const validFallbackTasks = fallbackTasks.length > 0 ? fallbackTasks : [{
            id: 'fallback-1',
            type: 'GAP_FILL', // Using 'GAP_FILL' which is valid per String Literal type, assuming StrategyTask type allows it or it's a string. If not, use 'EVERGREEN'.
            title: 'Fill Schedule Gap',
            description: 'The calendar is looking empty for the next few days.',
            reasoning: 'Consistent posting is key to maintaining algorithmic reach.',
            executionPrompt: `Write a tweet for ${brandName} that engages the community about current market conditions.`,
            impactScore: 8,
            contextData: [{
                type: 'CALENDAR',
                source: 'Growth Engine',
                headline: 'Consistency Warning',
                relevance: 8
            }]
        }] as StrategyTask[];

        return {
            tasks: validFallbackTasks,
            systemPrompt: "Error during generation.",
            thoughts: `Error traceback: ${error}`
        };
    }

};

function growthScore(report: GrowthReport): string {
    return report.executiveSummary;
}
/**
 * CLASSIFIER: Categorizes an image into a specific template bucket.
 */
export const classifyImage = async (imageUrl: string, categories: string[]): Promise<string | null> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    try {
        // Fetch Base64
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
        const cleanBase64 = base64.split(',')[1];
        const mimeType = blob.type || 'image/png';

        const prompt = `
        Analyze this image and classify it into exactly ONE of the following categories:
        ${categories.map(c => `- "${c}"`).join('\n')}
        
        INSTRUCTIONS:
        - Analyze the layout, composition, and content.
        - Return ONLY the exact category name from the list above.
        - If it doesn't fit well, pick the closest one.
        - Do not output any other text or markdown.
        `;

        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
                { inlineData: { mimeType, data: cleanBase64 } },
                { text: prompt }
            ]
        });

        const text = result.text?.trim() || "";
        // Clean up quotes or extra spaces
        const cleanText = text.replace(/['"]/g, '').trim();

        // Verify it matches a known category (fuzzy logic or exact)
        const match = categories.find(c => c.toLowerCase() === cleanText.toLowerCase());
        return match || cleanText; // Return what AI said if exact match fails, might be useful
    } catch (e) {
        console.error("Classification failed", e);
        return null;
    }
};

/**
 * ANALYZE BRAND KIT PDF
 * Extracts visual style guidelines from raw PDF text.
 */
export const analyzeBrandKit = async (text: string): Promise<string> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Truncate if too long (Gemini 2.0 has big context, but let's be safe/efficient)
    const truncatedText = text.substring(0, 50000);

    const systemInstruction = `
    You are a Creative Director for a top-tier design agency.
    
    TASK: Analyze the provided Brand Kit text and distill it into a comprehensive "Visual Identity Guide" for 3D/Digital Artists.
    
    INPUT TEXT:
    ${truncatedText}
    
    INSTRUCTIONS:
    - IGNORE: Mission statements, typography details (fonts are not used in image gen), and logo spacing rules.
    - EXTRACT & SUMMARIZE:
        1. CORE AESTHETIC: What is the overall vibe? (e.g. "Futuristic Minimalist", "Organic & Warm").
        2. COLOR USAGE: How should colors be applied? (e.g. "Dark backgrounds only", "Use gradients", "Minimalist white"). Be specific about primary vs accent usage.
        3. COMPOSITION & LAYOUT: Preferred layouts? (e.g. "Centred assignments", "Asymmetrical", "Negative space", "Bento grids").
        4. LIGHTING/MOOD: (e.g. "Neon cyber", "Soft daylight", "Studio lighting", "Dramatic shadows").
        5. SHAPES & FORMS: What kind of geometry is used? (e.g. "Rounded corners", "Sharp angles", "Fluid blobs").
        6. TEXTURE/MATERIAL: (e.g. "Glass", "Matte", "Metallic", "Grainy", "Paper").
        7. DO NOTS: What is explicitly forbidden visually? (e.g. "No drop shadows", "No real photos").
    
    OUTPUT FORMAT:
    - Structured Bullet points.
    - Capture Nuance: If the brand kit specifies distinct styles for different contexts, include them.
    - Focus ONLY on visual descriptors that a prompt engineer would use.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: "Analyze this brand kit." }] }],
            config: { systemInstruction: systemInstruction }
        });

        return response.text?.trim() || "Failed to analyze brand kit.";
    } catch (e) {
        console.error("Brand Kit Analysis Failed", e);
        throw e;
    }
};

// --- UNIFIED MARKETING BRAIN LOGIC ---

/**
 * STEP 1: UNDERSTANDING (The Analyst)
 * Analyzes the raw context (Trends, Docs, Goals) and outputs a Strategic Analysis.
 */
export const analyzeMarketContext = async (context: BrainContext): Promise<AnalysisReport> => {
    dispatchThinking("🧠 Brain Phase 1: Analyzing Market Context...");
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
    ROLE: Chief Marketing Analyst.
    
    INPUT DATA:
    - OBJECTIVE: "${context.userObjective}"
    - TRENDS: ${context.marketState.trends.slice(0, 5).map(t => t.headline).join(', ')}
    - PERFORMANCE: ${context.marketState.analytics ? `Top Post: ${context.marketState.analytics.topPost}` : 'No Data'}
    - KNOWLEDGE: ${context.memory.ragDocs.join('\n').slice(0, 500)}... (truncated)

    TASK: Analyze the situation.
    1. Identify the core "Market Vibe" (Bearish/Bullish/Hype/Quiet).
    2. Spot opportunities to insert the brand narrative.
    3. Define a "Strategic Angle" (e.g. "Contrarian take on the current hype").

    OUTPUT JSON:
    {
        "summary": "Brief 1-line market summary.",
        "keyThemes": ["Theme A", "Theme B"],
        "opportunities": ["Opp 1", "Opp 2"],
        "risks": ["Risk 1"],
        "strategicAngle": "The specific narrative angle we should take."
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error("Brain Phase 1 Failed", e);
        return {
            summary: "Analysis failed",
            keyThemes: [],
            opportunities: [],
            risks: [],
            strategicAngle: "General Brand Update"
        };
    }
};

/**
 * STEP 2: PLANNING (The Strategist)
 * Takes the Analysis and decides WHAT to do (The Action Plan).
 */
export const formulateStrategy = async (context: BrainContext, analysis: AnalysisReport): Promise<ActionPlan> => {
    dispatchThinking("🧠 Brain Phase 2: Formulating Action Plan...", { angle: analysis.strategicAngle });
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
    ROLE: Chief Marketing Strategist.
    CONTEXT: ${analysis.summary}
    STRATEGIC ANGLE: ${analysis.strategicAngle}
    OBJECTIVE: ${context.userObjective}

    TASK: Create a concrete Action Plan to execute this strategy.
    
    GUIDELINES:
    - If the objective is specific (e.g. "Write a thread"), plan just that.
    - If broad (e.g. "Grow awareness"), plan a mix (Tweet + Reply).
    
    OUTPUT JSON:
    {
        "actions": [
            {
                "type": "TWEET" | "THREAD" | "CAMPAIGN",
                "topic": "Specific topic",
                "goal": "What does this specific piece achieve?",
                "instructions": "Specific constraints for the writer (e.g. 'Use the 3-part structure')"
            }
        ]
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const result = JSON.parse(response.text || "{}");
        return { analysis, actions: result.actions || [] };

    } catch (e) {
        console.error("Brain Phase 2 Failed", e);
        return { analysis, actions: [] };
    }
};

/**
 * STEP 3: EXECUTION (The Creator) - MASTER FUNCTION
 * Orchestrates the full loop.
 */
export const executeMarketingAction = async (context: BrainContext): Promise<MarketingAction[]> => {
    // 1. ANALYZE
    const analysis = await analyzeMarketContext(context);

    // 2. PLAN
    const plan = await formulateStrategy(context, analysis);

    const results: MarketingAction[] = [];

    // 3. EXECUTE
    for (const action of plan.actions) {
        dispatchThinking(`🧠 Brain Phase 3: Executing ${action.type}...`, { topic: action.topic });

        // Dynamic Delegation based on Action Type
        let content;
        if (action.type === 'TWEET' || action.type === 'REPLY') {
            // Re-use our "Deep Dive" tweet generator but with enhanced context
            // TODO: In future, pass the specific "action.instructions" as a new param?
            // For now, we rely on the topic carrying the instruction.
            const enhancedTopic = `${action.topic}. GOAL: ${action.goal}. INSTRUCTION: ${action.instructions}`;

            content = await generateTweet(
                enhancedTopic,
                'Enki', // TODO: Get from context.brand
                context.brand,
                "Professional"
            );
        } else if (action.type === 'CAMPAIGN') {
            // Use Campaign generator
            const res = await generateCampaignDrafts(action.topic, 'Enki', context.brand, 3);
            content = res.drafts;
        } else {
            content = "Unsupported Action Type";
        }

        results.push({
            type: action.type as any,
            topic: action.topic,
            goal: action.goal,
            content: content
        });
    }

    return results;
};
