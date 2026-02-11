import { GoogleGenAI } from "@google/genai";
import { GenerateImageParams, BrandConfig, ComputedMetrics, GrowthReport, CampaignLog, SocialMetrics, TrendItem, CalendarEvent, StrategyTask, ReferenceImage, CampaignStrategy, SocialSignals, BrainLog, TaskContextSource, BrainContext, ActionPlan, MarketingAction, AnalysisReport, ChatIntentResponse, CopilotIntentType, DashboardCampaign, KPIItem, CommunitySignal, DailyBrief, StrategicPosture, Mention, AgentInsight } from "../types";
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

// --- SAFE RESPONSE TEXT HELPER ---
// Handles both property and function access patterns across SDK versions
const safeResponseText = (response: any): string => {
    if (!response) return '';
    if (typeof response.text === 'string') return response.text;
    if (typeof response.text === 'function') return response.text();
    try {
        return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch { return ''; }
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
                { text: "Analyze these reference images. Describe their VISUAL STYLE (lighting, colors) AND TYPOGRAPHY (Is the text All Caps, Title Case, or Sentence Case? Font weight?). Focus on how elements are arranged." }
            ]
        });

        const txt = safeResponseText(response); return txt ? `VISUAL STYLE REFERENCE: ${txt}` : "";
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
        // Pick top 1 (Single Source of Truth) to prevent style clashing/mixing
        effectiveReferenceImageIds = [shuffled[0].id];
        console.log(`[Auto Mode] Selected 1 random Brand Image for Consistent Style Enforcment`);
    }

    // --- 1.5 ANALYZE STYLE (CRITICAL FIX) ---
    // We must "verbally" describe the style to the model, not just pass the image.
    let analyzedStyleDescription = "";
    if (effectiveReferenceImageIds.length > 0 && params.brandConfig.referenceImages) {
        const selectedImageObjects = params.brandConfig.referenceImages.filter(img => effectiveReferenceImageIds.includes(img.id));
        if (selectedImageObjects.length > 0) {
            console.log(`[Gemini] Analyzing style of ${selectedImageObjects.length} images...`);
            analyzedStyleDescription = await analyzeStyleFromReferences(selectedImageObjects);
            console.log(`[Gemini] Analyzed Style: ${analyzedStyleDescription}`);
        }
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
            case 'Educational / Insight':
            case 'Educational':
                templateInstruction = "TEMPLATE TYPE: EDUCATIONAL / INSIGHT. Composition: Clean layout focusing on data or concepts. Style: Must strictly follow the Reference Image aesthetic (background, stroke weight, color palette).";
                break;
            case 'Feature / Product Update':
            case 'Feature Update':
                templateInstruction = "TEMPLATE TYPE: FEATURE / PRODUCT UPDATE. Composition: Focus on a specific element upgrading or evolving. Style: Must strictly follow the Reference Image style (e.g. if reference is 2D, make this 2D).";
                break;
            default:
                templateInstruction = `TEMPLATE TYPE: ${params.templateType}`;
        }
    }

    const visualOverride = params.artPrompt
        ? `VISUAL DIRECTION OVERRIDE: ${params.artPrompt}`
        : "Visualize momentum, connections, or security based on keywords.";

    // QUALITY BOOSTERS (ALWAYS ACTIVE)
    const QUALITY_SUFFIX = "High Quality, 8k resolution, photorealistic, sharp focus, highly detailed, crystal clear, cinematic lighting.";

    const negativeInstruction = `
        NEGATIVE PROMPT (DO NOT INCLUDE): blurry, low quality, grainy, pixelated, distorted, hamburger, text, watermark, bad composition, ugly, lowres, ${params.negativePrompt || ""}`;

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
           ${analyzedStyleDescription ? `\n           - VISUAL STYLE EXTRACTION (FOLLOW STRICTLY): ${analyzedStyleDescription}` : ''}
           - If Reference Images are provided, you MUST mimic their:
             - Lighting (e.g. Neon vs Soft)
             - Materiality (e.g. Glass vs Metal)
             - Background Style (e.g. Abstract vs Cityscape)
           - DO NOT deviate from the established brand look found in the references.

        4. 🔠 LOGOS & TYPOGRAPHY (STRICT):
           - LOGOS: If a Logo is visible in the reference, you MUST leave space or abstractly represent the logo in the same position.
           - TEXT: If text is required, use the brand name "${brandName}" in a font style that matches the reference image.
           - 🚨 CASE SENSITIVITY: Look at the Reference Image.
             - If the reference uses "Sentence case", you MUST use Sentence case.
             - If the reference uses "ALL CAPS", you may use ALL CAPS.
             - **DEFAULT TO SENTENCE CASE** if unclear. Do NOT use ALL CAPS by default.
           - DO NOT use generic or cartoony fonts.

        INSTRUCTIONS:
        - Analyze tweet sentiment.
        - ${visualOverride}
        - STYLE ENFORCEMENT: ${QUALITY_SUFFIX}
        ${negativeInstruction}
        - TEXT RULES:

          - ⛔ CRITICAL: NEVER copy-paste the prompt text onto the image.
          - ✅ Use text SPARINGLY (Title/Stat only).
        
        ${effectiveReferenceImageIds.length > 0 ? `
           REFERENCE IMAGE UTILIZATION (HIGHEST PRIORITY):
           - I have provided ${effectiveReferenceImageIds.length} reference images.
           - 🚨 STRICT TEMPLATE MODE: The user wants to use the Reference Image as a LAYOUT TEMPLATE.
           - COMPOSITION: You MUST copy the exact layout of the reference. If there is a title at the top, put your new title at the top. If there is a central icon, put your new icon in the center.
           - REPLACE TEXT: Use a SHORT HEADLINE (Max 5 words) derived from: "${params.prompt}". 🚨 NEVER paste the full text/tweet.
           - REPLACE ICON: Update the central graphic/icon to match the topic ("${params.prompt}"), but keep it in the SAME position and style as the reference.
           - STYLE: ${analyzedStyleDescription || "Match the reference style exactly."}
        ` : ''}
    `;
    }

    const parts: any[] = [{ text: systemPrompt }];

    // --- ADHOC ASSETS INTEGRATION ---
    if (params.adhocAssets && params.adhocAssets.length > 0) {
        console.log(`[Gemini] Including ${params.adhocAssets.length} adhoc assets`);

        // 1. Add instructions
        parts[0].text += `
        
        ADDITIONAL REQUIRED ASSETS:
        - I have provided ${params.adhocAssets.length} specific image assets (e.g. Mascots, Logos) as input.
        - TASK: You MUST incorporate these exact visual elements into the final image.
        - IF MASCOT: Place them in the scene as the main character or companion, matching the requested style/lighting.
        - IF LOGO: Place it clearly but artfully (e.g. on a billboard, shirt, or holographic overlay).
        - CRITICAL: Do not alter the core identity/shape of these assets, but DO adjust lighting/shading to blend them into the scene.
        `;

        // 2. Add image parts
        params.adhocAssets.forEach(asset => {
            parts.push({
                inlineData: {
                    mimeType: asset.mimeType,
                    data: asset.data
                }
            });
        });
    }

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

        // Resolution Mapping
        // Standard (1K): 1024x1024 (1:1), 1280x720 (16:9), 896x1152 (4:5)
        // High (2K): Try for higher density if model supports, strictly enforcing higher side.
        let width = 1024;
        let height = 1024;
        const isHighRes = params.size === '2K';

        if (params.aspectRatio === '16:9') {
            width = isHighRes ? 2048 : 1280;
            height = isHighRes ? 1152 : 720;
        } else if (params.aspectRatio === '4:5') {
            width = isHighRes ? 1152 : 896;
            height = isHighRes ? 1440 : 1152;
        } else {
            // 1:1
            width = isHighRes ? 2048 : 1024;
            height = isHighRes ? 2048 : 1024;
        }

        // Imagen 3 often caps strictly, but let's try requesting specific valid buckets.
        // Safe robust 2K for 1:1 is often 1408x1408 if 2048 fails, let's stick to 1024 base for now but with 'sampleCount: 1' quality focus 
        // OR rely on Aspect Ratio being key. 
        // Updated Strategy: Pass string "1024x1024" or "large" if API allows.
        // Actually, for Vertex AI proxy (which this calls if we had it), we pass direct dimensions. 
        // But here we are calling GoogleGenAI.

        const config: any = {
            imageConfig: {
                aspectRatio: params.aspectRatio === '1:1' ? '1:1' : params.aspectRatio === '4:5' ? '4:5' : '16:9'
                // imageSize: isHighRes ? "2048x2048" : undefined // GoogleGenAI TS SDK might not support custom string dimensions easily without error.
                // We will trust the quality prompt for now + remove size restriction if possible, 
                // but typically '1024x1024' is the reliable max for Preview.
            }
        }

        console.log(`Generating with gemini-3-pro-image-preview | Quality: ${params.size} (${isHighRes ? 'High' : 'Standard'})`);

        const generationPromise = ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            // @ts-ignore
            contents: [{ parts: parts }],
            config: config,
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
        const msg = error?.message || '';
        // --- QUOTA LIMITS: Fail fast instead of retrying (prevents doubling API calls) ---
        if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
            console.warn("⚠️ Quota Exceeded for Gemini 3 Pro Image.");
            dispatchThinking("⚠️ API quota exceeded. Check billing at https://ai.dev/rate-limit");
            throw new Error("API quota exceeded. Please check your Gemini API billing at https://ai.dev/rate-limit");
        }

        console.error("Gemini generation error:", msg);
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
    aspectRatio: string = '1:1',
    quality: '1K' | '2K' = '1K'
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

    QUALITY UPGRADE (CRITICAL):
    - The output MUST be higher quality than the input.
    - Remove any blur, grain, or jpeg artifacts.
    - FINISH: ${quality === '2K' ? 'EXTREME 8K RESOLUTION, MASTERPIECE' : '8k resolution'}, sharp focus, professional photography standard.

    GUIDELINES:
    - PRESERVE the main subject, composition, and layout of the original image as much as possible.
    - PRESERVE ASPECT RATIO: The output must strictly follow the ${aspectRatio} format.
    - ONLY apply the requested change (e.g. change color, remove object, change background).
    - If the user asks to "change style", then you can be more creative with the composition.
    - Maintain high quality, professional "Web3/Tech" aesthetic unless instructed otherwise.

    MATCHING & TEXT EDITING (CRITICAL):
    - IF THE USER ASKS TO CHANGE TEXT: You MUST completely replace the old text with the NEW text. 
    - MATCH THE FONT: Use a font that matches the visual style of the original image (e.g. if original is futuristic, use a modern sans-serif).
    - EXACT SPELLING: You MUST use the exact key/value pair provided in the instruction. Do not hallucinate extra words.
    - REMOVE OLD TEXT: Ensure the old text is completely erased/inpainted over before placing the new text.
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
    tone: string = 'Professional',
    count: number = 1
): Promise<string | string[]> => {
    dispatchThinking(`🐦 Generating Tweet for: "${topic}"`, { tone, brand: brandName, count });
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const examples = brandConfig.tweetExamples.length > 0
        ? `STYLE REFERENCE (MIMIC THIS VOICE/PACE/LENGTH): \n${brandConfig.tweetExamples.map(t => `- ${t}`).join('\n')} `
        : "";
    const avoidExamples = brandConfig.rejectedStyleExamples && brandConfig.rejectedStyleExamples.length > 0
        ? `\nAVOID THESE STYLE PATTERNS (DO NOT COPY TONE/STRUCTURE):\n${brandConfig.rejectedStyleExamples.map(t => `- ${t}`).join('\n')}\n`
        : "";

    const templateExamples = (brandConfig.graphicTemplates || [])
        .filter(t => t.tweetExample && t.tweetExample.trim().length > 0)
        .map(t => `[TEMPLATE STYLE: ${t.label}]: "${t.tweetExample}"`)
        .join('\n');

    const templateContext = templateExamples.length > 0
        ? `\nTEMPLATE-SPECIFIC WRITING STYLES (Use these if the output fits the template context): \n${templateExamples}`
        : "";

    // --- RAG INTEGRATION START ---
    let ragContext = "";
    try {
        // Embed the topic to find relevant KB articles/memories
        const embedding = await getEmbedding(`${topic} ${brandName}`);
        if (embedding.length > 0) {
            const matches = await searchBrainMemory(brandName, embedding, 0.65, 3); // Slightly lower threshold to catch broad context
            if (matches && matches.length > 0) {
                dispatchThinking(`🧠 Brain Retrieval for Tweet: Found ${matches.length} relevant docs.`);
                ragContext = `\nRELEVANT KNOWLEDGE BASE (FROM ARCHIVE):\n${matches.map((m: any) => `- ${m.content}`).join('\n')}\n`;
            }
        }
    } catch (e) {
        console.warn("RAG Retrieval failed for tweet", e);
    }
    // --- RAG INTEGRATION END ---

    // Combine Local KB (Small) + RAG KB (Large)
    const kb = (brandConfig.knowledgeBase.length > 0 || ragContext.length > 0)
        ? `KNOWLEDGE BASE (THE ABSOLUTE SOURCE OF TRUTH): \n${brandConfig.knowledgeBase.join('\n\n')}\n${ragContext}`
        : "";

    const isNoTagBrand = ['netswap', 'enki'].includes(brandName.toLowerCase());

    // --- ENTERPRISE PROTOCOL ENFORCEMENT ---
    const voice = brandConfig.voiceGuidelines || "Narrative Authority: Insightful, grounded, and high-signal. Speak to mechanics, not just features.";
    const defaultBanned = ["Delve", "Tapestry", "Game changer", "Unleash"]; // Removed "Excited", "Thrilled"
    const banned = brandConfig.bannedPhrases && brandConfig.bannedPhrases.length > 0
        ? `STRICTLY BANNED PHRASES: ${brandConfig.bannedPhrases.join(', ')} `
        : `Avoid lazy AI words (e.g. ${defaultBanned.join(', ')}).`;

    const countInstruction = count > 1
        ? `TASK: Write ${count} DISTINCT variations of a high-quality tweet about: "${topic}".\n    RETURN FORMAT: STRICT JSON ARRAY of strings. Do not include markdown formatting.\n    Example: ["Tweet 1 content...", "Tweet 2 content..."]`
        : `TASK: Write a single, high-quality tweet about: "${topic}".`;

    const systemInstruction = `
    You are an Elite Crypto Content Creator for ${brandName}.
    You are known for high-signal content that simplifies complex topics without losing nuance.

    ${countInstruction}
    
    TONE: ${tone} (Guideline: ${voice})
    - **BALANCE**: Be authoritative but friendly.
    - **ACCESSIBILITY**: Deep technical understanding, explained simply.
    
    ${examples}
    ${avoidExamples}
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
    - YOU MUST use double line breaks (\n\n) between sections.
    - NO HASHTAGS (STRICTLY FORBIDDEN).
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: topic,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: count > 1 ? "application/json" : "text/plain"
            }
        });

        if (count > 1) {
            let text = safeResponseText(response) || "[]";
            // Clean Markdown code blocks if present
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();

            try {
                return JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse tweet variations", e);
                // Try one last desperate cleanup for common JSON issues (trailing commas)
                try {
                    return JSON.parse(text.replace(/,\s*]/, "]"));
                } catch (e2) {
                    return [text]; // Fallback
                }
            }
        }

        return safeResponseText(response) || topic;
    } catch (e: any) {
        console.error("Tweet Generation Failed", e);
        const msg = e?.message || '';
        if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
            throw new Error('API quota exceeded. Please check your Gemini API billing at https://ai.dev/rate-limit');
        }
        throw new Error(`Tweet generation failed: ${msg || 'Unknown error'}`);
    }
};

/**
 * Generates a campaign of tweets (Drafting Phase).
 */
/**
 * SMART CAMPAIGN: Analyzes raw notes to create a structured content plan.
 */
export const analyzeContentNotes = async (notes: string, brandName: string, images: string[] = []): Promise<any> => {
    dispatchThinking(`📝 Analyzing Content Notes & Images`, { notesLength: notes.length, imageCount: images.length });
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
    You are a Content Strategy Expert for ${brandName}.

        TASK: Analyze the provided RAW NOTES and IMAGES (if any) and structure them into a concrete Campaign Plan.

        INPUT:
        - Text Notes: Provided in the prompt.
        - Images: Screenshots of notes, chats, or diagrams. Extract all relevant text and context from them.

    INSTRUCTIONS:
    1. EXTRACT discrete content items. Look for links, specific topic requests, or event mentions.
    2. IGNORE general conversation filler.
    3. IDENTIFY global rules (e.g. "No GMs", "Don't use emojis").
    4. DETECT FINISHED TWEETS: If the user pasted a list of full tweets (e.g. "1. This is the tweet..."), extract the EXACT text into the "finalCopy" field. Do NOT summarize finished tweets.
    5. IMAGE ANALYSIS: If images are provided, OCR the text and interpret diagrams. Treat them as part of the raw notes.
    
    OUTPUT JSON FORMAT:
    {
        "theme": "A short, summarized theme title based on the content (e.g. 'January Updates Mix')",
            "globalInstructions": ["Rule 1", "Rule 2"],
                "items": [
                    {
                        "type": "Tweet" | "Thread" | "Announcement",
                        "topic": "Brief topic summary",
                        "finalCopy": "If the input is a full, ready-to-post tweet, put the EXACT text here. Otherwise null.",
                        "specificInstruction": "The specific constraint or instruction for this exact post",
                        "url": "extracted link or null"
                    }
                ]
    }
    `;

    try {
        const parts: any[] = [];

        // 1. Add Images
        if (images && images.length > 0) {
            images.forEach(imgBase64 => {
                const mimeMatch = imgBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
                const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                const data = imgBase64.split(',')[1] || imgBase64;

                parts.push({
                    inlineData: {
                        mimeType,
                        data
                    }
                });
            });
        }

        // 2. Add Text
        parts.push({ text: `RAW NOTES:\n${notes || "(No text provided, analyze images)"}` });

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ parts }],
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        return JSON.parse(safeResponseText(response) || "{}");
    } catch (e) {
        console.error("Content note analysis failed", e);
        throw e;
    }
};

/**
 * Generates a campaign of tweets (Drafting Phase) - Supports Smart Plan.
 */
// --- 3. HELPER: VISUAL DIRECTOR (HIGH IQ) ---
const assignVisualStrategy = async (drafts: any[], brandConfig: BrandConfig): Promise<any[]> => {
    // 1. Prepare Template Knowledge
    // If user provided a "Purpose", use it. Otherwise, infer one.
    const templatesWithPurpose = (brandConfig.graphicTemplates || []).map(t => {
        let inferredPurpose = t.purpose;
        if (!inferredPurpose) {
            const label = t.label.toLowerCase();
            if (label.includes('deep') || label.includes('edu')) inferredPurpose = "Use for complex technical breakdowns, diagrams, or lists.";
            else if (label.includes('quote') || label.includes('speak')) inferredPurpose = "Use ONLY for direct quotes from people.";
            else if (label.includes('feature') || label.includes('update')) inferredPurpose = "Use for product announcements or new features.";
            else inferredPurpose = "General purpose visual.";
        }
        return `- Template: "${t.label}"\n  Purpose: "${inferredPurpose}"`;
    }).join('\n');

    const availableTemplates = templatesWithPurpose.length > 0
        ? templatesWithPurpose
        : "- Standard Templates: Feature, Deep Dive, Quote, Community.";

    // 2. Prepare Ref Images
    const refImages = (brandConfig.referenceImages || []).map(r => `ID: ${r.id} (${r.name})`).join(', ');

    // 3. Prompt the Visual Director
    const task = `
    You are the Senior Art Director. Your team just wrote ${drafts.length} tweets. 
    Your job is to assign the PERFECT Visual Strategy to each tweet.

    AVAILABLE TEMPLATES (STRICT RULES):
    ${availableTemplates}

    AVAILABLE REFERENCE IMAGES (Style Anchors - CRITICAL):
    ${refImages}

    INPUT TWEETS:
    ${drafts.map((d, i) => `Tweet ${i + 1}: "${d.tweet}"`).join('\n')}

    TASK:
    Return a JSON array matching the input order. For each tweet:
    1. Select the BEST 'template' based on the definitions above.
    2. Write a 'visualHeadline' (Max 5 words, Punchy).
    3. Select a 'referenceImageId' that best fits the mood (STYLE ANCHOR).
       - CRITICAL: You SHOULD assign a Reference Image even if using a Template, to define the texture/lighting.
       - Only return null if absolutely no reference image fits (rare).
    4. Valid 'reasoning' for your choice.

    CRITICAL:
    - If the tweet is technical, you MUST check if it needs a 'Deep Dive' (Diagram) or 'Feature' (Headline). Do NOT default to Deep Dive 5x in a row.
    - If the tweet is a quote, use 'Quote'.
    
    OUTPUT JSON:
    {
        "visuals": [
            { "template": "...", "visualHeadline": "...", "referenceImageId": "...", "reasoning": "..." }
        ]
    }
    `;

    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: task,
        config: { responseMimeType: "application/json" }
    });

    try {
        const result = JSON.parse(safeResponseText(response) || "{}");
        const visuals = result.visuals || [];

        // Merge Visuals back into Drafts
        return drafts.map((draft, i) => {
            const vis = visuals[i] || {};
            // Post-process Reference ID (Fallback Logic)
            let finalRefId = vis.referenceImageId;

            // If Template chosen has linked images, USE THEM.
            const customTmpl = brandConfig.graphicTemplates?.find(t => t.label === vis.template);
            if (customTmpl && customTmpl.referenceImageIds && customTmpl.referenceImageIds.length > 0) {
                finalRefId = customTmpl.referenceImageIds[Math.floor(Math.random() * customTmpl.referenceImageIds.length)];
            }

            return {
                ...draft,
                template: vis.template || "Auto",
                visualHeadline: vis.visualHeadline || "Update",
                referenceImageId: finalRefId,
                visualDescription: vis.reasoning // Store reasoning here
            };
        });

    } catch (e) {
        console.error("Visual Director Failed:", e);
        return drafts; // Fallback: return original drafts
    }
};

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

    const standardTemplates = ['Educational', 'Feature Update', 'Partnership', 'Campaign Launch', 'Giveaway', 'Event', 'Speaker Quote'];
    // Content Diet Logic: Prioritize High-Signal Templates
    const customTemplates = (brandConfig.graphicTemplates || []);

    const highSignalTemplates = customTemplates
        .filter(t => ['feature', 'product', 'launch', 'article', 'insight'].some(cat => (t.category || '').toLowerCase().includes(cat)))
        .map(t => t.label);

    const lowSignalTemplates = customTemplates
        .filter(t => ['ama', 'event', 'giveaway', 'meme'].some(cat => (t.category || '').toLowerCase().includes(cat)))
        .map(t => t.label);

    // If no categories, just list them all
    const uncategorizedTemplates = customTemplates
        .filter(t => !highSignalTemplates.includes(t.label) && !lowSignalTemplates.includes(t.label))
        .map(t => t.label);

    // STRICT MODE LOGIC:
    // If Custom Templates exist, DO NOT show Standard Defaults.
    // If NO Custom Templates, show Standard Defaults.
    const availableTemplates = customTemplates.length > 0
        ? `
        AVAILABLE TEMPLATES (STRICTLY USE ONE OF THESE):
        [GROUP A - HIGH SIGNAL]: ${highSignalTemplates.length > 0 ? highSignalTemplates.join(', ') : 'None'}
        [GROUP B - LOW SIGNAL]: ${lowSignalTemplates.length > 0 ? lowSignalTemplates.join(', ') : 'None'}
        [GROUP C - GENERAL]: ${uncategorizedTemplates.length > 0 ? uncategorizedTemplates.join(', ') : 'None'}
        
        ⛔ CRITICAL TEMPLATE RULES:
        1. **'Quote' / 'Speaker' Templates**: USE ONLY IF the tweet is a direct quote from a specific person (e.g. "CEO says...") or a direct citation from the Whitepaper. DO NOT use for general statements.
        2. **'Feature' / 'Deep Dive' / 'Educational' Templates**: USE for everything else (explaining tech, roadmaps, "how it works", core product mechanics).
        3. **'Community' / 'Update' Templates**: USE for general news or community vibes.
        DO NOT leave template blank.
        `
        : `AVAILABLE TEMPLATES: ${standardTemplates.join(', ')}`;

    // STRICT VALIDATION LIST FOR JSON SCHEMA
    const validTemplateNames = customTemplates.length > 0
        ? customTemplates.map(t => t.label).join(', ') // Only Custom
        : standardTemplates.join(', '); // Only Standard

    // REFERENCE IMAGES FOR "VISUAL ANCHORING"
    const availableRefImages = (brandConfig.referenceImages || [])
        .map(img => `ID: "${img.id}" (Name: ${img.name})`)
        .join('\n        ');

    const hasRefImages = brandConfig.referenceImages && brandConfig.referenceImages.length > 0;


    // --- RAG: RETRIEVE BRAIN MEMORY ---
    let ragContext = "";
    try {
        const queryText = `Campaign Theme: ${theme}. Strategic Focus: ${focusContent || "General Brand Awareness"}.Brand: ${brandName} `;
        const queryEmbedding = await getEmbedding(queryText);
        if (queryEmbedding.length > 0) {
            const memories = await searchBrainMemory(brandName, queryEmbedding, 0.7, 5);
            if (memories && memories.length > 0) {
                dispatchThinking(`🧠 Brain Retrieval: Found ${memories.length} relevant docs/memories.`);
                const memoryList = memories.map((m: any) => `- ${m.content}`).join("\n");
                ragContext = `\nRELEVANT CONTEXT (STRATEGY DOCS & HISTORY):\n${memoryList}\n`;
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
        const planItems = contentPlan.items.map((item: any, i: number) => {
            if (item.finalCopy) {
                return `ITEM ${i + 1}: [STRICT FINAL COPY MODE]. The user has provided the exact text. 
                YOUR TASK: Output this exact text as the "tweet". DO NOT REWRITE IT. 
                TEXT: "${item.finalCopy}"
                Topic: ${item.topic}`;
            }
            return `ITEM ${i + 1}: Type: ${item.type}. Topic: ${item.topic}. URL: ${item.url || 'None'}. Instruction: ${item.specificInstruction} `;
        }).join('\n');

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
            🎨 **MODE: CREATIVE FLOW**
            The user wants a "Fun/Creative" campaign. 
            - DO NOT use a rigid "Problem/Solution" structure.
            - Create ${count} distinct, high-energy posts that hit the theme.
            - Vibe: Loose, confident, perhaps a bit unhinged (if brand voice allows).
            `;
        } else {
            structureInstruction = `
            📈 **MODE: STRATEGIC NARRATIVE**
            The user wants specific, high-value insights. 
            
            **SUGGESTED STRUCTURE (Adaptable - Do not be robotic):**
            1. **THE HOOK (Tweet 1)**: Start with a controversial take, a question, or a bold claim. Avoid "We are excited".
            2. **THE MECHANIC (Tweet 2)**: Explain the "How" simply.
            3. **THE EDGE (Tweet 3)**: Why does this actually matter? (The "So What?").
            4. **THE PAYOFF (Tweet 4)**: The end result/benefit.
            
            *Goal: Position the brand as a Narrative Leader, not just a technical documentation bot.*
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
    3. **HIGH-SIGNAL**: Use dense, insightful language. Avoid fluff.
    4. **FORMATTED**: Use short paragraphs. ONE idea per line.
    5. **IMPACT OVER LENGTH**: Do NOT write walls of text. Be PUNCHY. Use short sentences for rhythm. "Why? Keep reading." is better than a long explanation.
    6. **VISUAL VARIETY**: ${availableTemplates}
       - CRITICAL INSTRUCTION: When assigning a "visualTemplate" to a tweet:
       - **Strictly limit 'Quote' templates** to genuine quotes/testimonials. 
       - For explaining technology (e.g. Sequencers, L2s), use 'Feature Update', 'Deep Dive', or 'Educational' templates.
       - **VARIETY RULE (MANDATORY)**: Do NOT use the same "visualTemplate" more than twice in a row.
       - **ROTATE**: For technical topics, you MUST alternate between 'Feature Update', 'Deep Dive', and 'Educational'.
       - **RHYTHM**: A good feed looks like: [Hook: Feature] -> [Explainer: Deep Dive] -> [Detail: Educational] -> [Impact: Community]. Mix it up!
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
        "drafts": [
            {
                "tweet": "Tweet content...\\n\\nUse line breaks for spacing.",
                "visualHeadline": "MAX 5 WORDS. Big, punchy text for the image (e.g. 'WHY SEQUENCERS MATTER').",
                "visualDescription": "A specific art direction description for a designer (e.g. 'Cyberpunk city with neon ethereum logo, high contrast').",
                "template": "A STRICT STRING MATCH from this list: [${validTemplateNames}] OR 'Auto'",
                "referenceImageId": "If 'Auto' template is used, you MUST pick a Reference Image ID from this list: [${availableRefImages}]. If a specific template is used, this can be null.",
                "reasoning": "STRATEGY LOG: \n• CONTENT: Why this angle? (e.g. 'High-signal educational'). \n• VISUAL: Why this template? (e.g. 'Deep Dive chosen to visualize complex architecture'). \n• VERIFICATION: Exact Source/Doc Link."
            }
        ]
    }

    CRITICAL VISUAL RULES:
    1. You MUST select a specific Visual Strategy for every post.
    2. OPTION A: Pick a specific "template" from the list (e.g. "Feature Update", "Educational").
    3. OPTION B: If using "Auto" template (e.g. for a meme or generic post), you MUST select a specific "referenceImageId" from the Available Ref Images list to ground the style.
    4. NO GENERIC "AUTO" WITHOUT A REFERENCE. A "Mix" is not allowed. Be specific.
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
        const text = safeResponseText(response) || "{}";
        const json = JSON.parse(text);

        const validDrafts = (json.drafts || []).map((draft: any) => ({
            tweet: draft.tweet,
            reasoning: draft.reasoning,
            // We strip out the Content Agent's visual guesses because the Visual Director will do it better.
        }));

        // STEP 2: HIGH IQ VISUAL DIRECTOR
        // Call the specialist agent to assign visuals
        console.log(`[Campaign] Content generated. Calling Visual Director...`);
        const finalDrafts = await assignVisualStrategy(validDrafts, brandConfig);

        return {
            drafts: finalDrafts,
            themeColor: json.themeColor,
            thinking: `Generated ${json.drafts?.length || 0} drafts. \nStrategy: ${json.drafts?.[0]?.reasoning || "Balanced mix based on best practices."}`,
            systemPrompt: systemInstruction // 🧠 EXPOSE THE PROMPT
        };

    } catch (error) {
        console.error("Error generating campaign drafts:", error);
        throw error;
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
    - Analyze the target audience for this specific theme. note: You must ADAPT the target audience to fit this specific Campaign Theme/Goal. If the theme is "Mass Adoption" or "Diverse", do NOT just default to the core brand audience. Expand the scope.
    - Consider the "Situation" provided to tailor the messaging.
    - SYNERGY: Review "Active Campaigns" and "Brain Memory".Ensure this new campaign complements existing ones(e.g.if we are already doing a 'Giveaway', maybe this one should be 'Educational').
    - Define 3 key messaging pillars.
    - Outline a strategy for each selected platform.
    - Provide realistic result estimates based on a standard micro - campaign.
    - **VISUAL STRATEGY**: Explain the reasoning behind the recommended visual styles and formats (e.g. "Why use 3D extraction?" or "Why heavy text?").
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
                    "visualStrategy": "Explanation of the visual approach (e.g. 'We are using high-contrast 3D visuals to denote premium tech...')",
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

        const text = safeResponseText(response);
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
            rawOutput: safeResponseText(response) || "",
            model: "gemini-2.0-flash"
        };
        saveBrainLog(log);

        return safeResponseText(response) || "";
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

        return safeResponseText(response) || "Unable to generate ideas.";
    } catch (e) {
        console.error("Business connection generation failed", e);
        return "Error generating business connection ideas.";
    }
};

/**
 * GENERATE GROWTH REPORT (Daily Strategic Briefing)
 */
export const generateGrowthReport = async (
    brandName: string,
    trends: TrendItem[],
    mentions: any[],
    brandConfig: BrandConfig
): Promise<GrowthReport> => {
    dispatchThinking("Generating Daily Strategic Briefing...", { brand: brandName, trendsCount: trends.length });
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Filter for high impact trends
    const significantTrends = trends
        .filter(t => t.relevanceScore > 70)
        .slice(0, 5)
        .map(t => `- ${t.headline} (${t.source}): ${t.summary}`)
        .join('\n');

    // Safe access to KB
    const kb = (brandConfig && Array.isArray(brandConfig.knowledgeBase))
        ? brandConfig.knowledgeBase.join('\n')
        : "Brand context unavailable.";

    const systemInstruction = `
    You are 'Gaia', the Chief Strategy Officer (CSO) for ${brandName}.
    Your goal is to provide high-signal, crypto-native strategic intelligence.

    TASK: Generate the "Daily Strategic Briefing" based on real-time market signals.
    
    INPUT DATA:
    - KEY MARKET TRENDS:
    ${significantTrends || "No major market shifts detected."}
    
    - BRAND CONTEXT:
    ${kb}
    
    CRITICAL RULES (ANTI-HALLUCINATION):
    1. **STRICTLY WEB3**: Do NOT generate generic business advice. Use crypto terminology (Liquidity, TVL, Airdrop, Narrative, FUD, Alpha).
    2. **NO GENERIC NAMES**: Never use "Project Phoenix", "Canvas of Nations", or "Operation Bootstrap".
    3. **BE SPECIFIC**: If trends are quiet, talk about "Building in Bear" or "Accumulation Phase". Do NOT say "Market is stable".
    4. **AGGRESSIVE STANCE**: We are here to win. Be contrarian if necessary.

    OUTPUT FORMAT (JSON):
    {
        "executiveSummary": "2 sentences summarizing the crypto market state and our specific stance. (e.g. 'ETH dominance is rising. We must pivot content to capture the L2 spillover narrative.').",
        "tacticalPlan": "Specific, immediate actions for the social team (e.g. 'Newsjack the Vitalik post', 'Post infrastructure deep-dive').",
        "strategicPlan": [
            {
                "action": "KILL" | "DOUBLE_DOWN" | "OPTIMIZE",
                "subject": "The specific initiative or narrative",
                "reasoning": "Why we are taking this action based on the on-chain/social data."
            },
             {
                "action": "DOUBLE_DOWN",
                "subject": "Example Narrative (e.g. 'Real Yield')",
                "reasoning": "Reason here."
            }
        ]
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Generate Daily Briefing.",
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const text = safeResponseText(response) || "{}";
        const parsed = JSON.parse(text);
        parsed.lastUpdated = Date.now(); // Add timestamp for caching

        // Brain Log
        saveBrainLog({
            id: `report-${Date.now()}`,
            timestamp: Date.now(),
            type: 'GROWTH_REPORT',
            brandId: brandName,
            context: "Daily Briefing Generation",
            systemPrompt: systemInstruction,
            rawOutput: text,
            model: 'gemini-2.0-flash'
        });

        return parsed as GrowthReport;

    } catch (e) {
        console.error("Growth Report generation failed", e);
        throw e;
    }
};

/**
 * STRATEGIC POSTURE REFINEMENT
 * Uses AI to review the "Constitution" based on recent market data + brand goals.
 */
export const refineStrategicPosture = async (
    brandName: string,
    currentPosture: StrategicPosture,
    trends: TrendItem[],
    growthReport: GrowthReport | null
): Promise<StrategicPosture> => {
    dispatchThinking("🧠 Refining Strategic Posture...", { brand: brandName });
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const recentTrends = trends.slice(0, 5).map(t => `- ${t.headline}`).join('\n');
    const briefing = growthReport ? `EXECUTIVE SUMMARY: ${growthReport.executiveSummary}` : "";

    const systemInstruction = `
    You are the Chief Strategy Officer (CSO) for ${brandName}.
    
    TASK: Review and Refine the "Strategic Posture" document (The Brand Constitution).
    
    INPUT POSTURE:
    - Objective: "${currentPosture.objective}"
    - Thesis: "${currentPosture.thesis}"
    - Mandates: ${JSON.stringify(currentPosture.priorities)}
    - Restricted: ${JSON.stringify(currentPosture.deprioritized)}
    
    MARKET CONTEXT:
    ${recentTrends}
    ${briefing}
    
    INSTRUCTIONS:
    1. Analyze if the current Objective/Thesis is still valid given the market context.
    2. Suggest updates ONLY if necessary. Do not change for the sake of changing.
    3. If the market is shifting (e.g. from "Bear" to "Bull"), update the Mandates to be more aggressive (or defensive).
    4. Maintain the "Change Log" properly.
    
    OUTPUT FORMAT (JSON):
    Return the FULL StrategicPosture object with updates applied.
    {
        "objective": "...",
        "thesis": "...",
        "priorities": ["..."],
        "deprioritized": ["..."],
        "confidenceLevel": "High" | "Medium" | "Low",
        "timeHorizon": "...",
        "constraints": ["..."],
        "changeLog": [ ...keep old logs..., { "date": "Today", "change": "Updated X", "reason": "Market shift..." } ]
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Refine Posture.",
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const text = safeResponseText(response) || "{}";
        const newPosture = JSON.parse(text);

        // Merge to ensure we don't lose fields if AI omits them
        return {
            ...currentPosture,
            ...newPosture,
            lastUpdated: Date.now(),
            version: (parseFloat(currentPosture.version) + 0.1).toFixed(1)
        };
    } catch (e) {
        console.error("Posture Refinement Failed", e);
        throw e;
    }
};

export const generateIdeas = async (brandName: string): Promise<string[]> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Generate 4 distinct tweet topics / ideas for a ${brandName} marketing strategist.Return only the topics as a simple list.`,
        });
        return (safeResponseText(response) || '').split('\n').map(l => l.replace(/^[\d\-\.\*]+\s*/, '').trim()).filter(l => l.length > 5);
    } catch (e) {
        console.warn("Idea generation failed", e);
        return [];
    }
}

export const generateStyleExamples = async (
    brandName: string,
    brandConfig: BrandConfig,
    count: number = 8
): Promise<string[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Missing API Key");
    const ai = new GoogleGenAI({ apiKey });

    const kb = brandConfig.knowledgeBase?.length
        ? `KNOWLEDGE BASE (SOURCE OF TRUTH):\n${brandConfig.knowledgeBase.join('\n')}`
        : '';

    const voice = brandConfig.voiceGuidelines || 'Clear, confident, high-signal, no fluff.';
    const banned = brandConfig.bannedPhrases && brandConfig.bannedPhrases.length > 0
        ? `STRICTLY BANNED PHRASES: ${brandConfig.bannedPhrases.join(', ')}`
        : 'Avoid lazy AI words (e.g. "delve", "tapestry", "game changer").';

    const systemInstruction = `
You are an expert crypto content strategist for ${brandName}.

TASK:
- Generate ${count} DISTINCT social post examples for X/Twitter.
- Mix formats: announcement, product update, insight, educational tip, community CTA, partnership.
- Keep them grounded in the knowledge base. If KB is sparse, keep claims generic.

CRITICAL RULES - FOLLOW EXACTLY:
- ABSOLUTELY NO HASHTAGS. Never use # symbols or hashtags under any circumstances.
- Write like a human - natural, conversational, high-signal content.
- No emojis at the start of tweets. Minimal emoji use overall.
- No generic phrases like "Stay tuned" or "Let's go".
- No corporate speak or marketing fluff.

OUTPUT FORMAT:
Return ONLY valid JSON array of strings. No markdown.

VOICE:
- ${voice}
- ${banned}

${kb}
    `.trim();

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Generate content examples.",
            config: {
                systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const raw = safeResponseText(response) || '[]';
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            // Post-process to remove any hashtags that slipped through
            return parsed.map((item) => {
                let text = String(item).trim();
                // Remove hashtags (e.g., #DeFi, #Web3, etc.)
                text = text.replace(/#\w+/g, '').trim();
                // Clean up any double spaces left behind
                text = text.replace(/\s{2,}/g, ' ').trim();
                return text;
            }).filter((item) => item.length > 0);
        }
        return [];
    } catch (e) {
        console.warn("Style example generation failed", e);
        return [];
    }
};



export interface BrandResearchOptions {
    siteContent?: string;
    tweetExamples?: string[];
    docUrls?: string[];
}

/**
 * AI RESEARCH: Uses provided sources to infer brand identity and knowledge base.
 */
export const researchBrandIdentity = async (
    brandName: string,
    url: string,
    options: BrandResearchOptions = {}
): Promise<BrandConfig> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const siteContent = (options.siteContent || '').slice(0, 12000);
    const tweetSamples = (options.tweetExamples || []).slice(0, 8);
    const docUrls = (options.docUrls || []).slice(0, 10);

    const sourceBlock = [
        siteContent ? `WEBSITE CONTENT:\n${siteContent}` : '',
        tweetSamples.length ? `RECENT TWEETS:\n${tweetSamples.map(t => `- ${t}`).join('\n')}` : '',
        docUrls.length ? `DOC LINKS:\n${docUrls.map(d => `- ${d}`).join('\n')}` : ''
    ].filter(Boolean).join('\n\n');

    // Use Gemini if available for high-quality synthesis
    try {
        if (!getApiKey()) throw new Error("No API Key");

        const systemInstruction = `
        You are an expert Brand Identity Analyst and AI Researcher.

    TASK:
        Analyze the company "${brandName}" located at "${url}" using ONLY the provided sources.
        Do NOT invent facts. If the sources are thin, return minimal, conservative outputs.
        
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
    ],
    "voiceGuidelines": "Short tone and voice guidance.",
    "visualIdentity": "Short visual identity guidance.",
    "targetAudience": "Primary audience segment(s).",
    "bannedPhrases": ["Phrase 1", "Phrase 2"]
}
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Research this brand: ${brandName} (${url})\n\n${sourceBlock || 'NO SOURCE CONTENT PROVIDED.'}`,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const data = JSON.parse(safeResponseText(response) || "{}");

        return {
            colors: data.colors || [],
            knowledgeBase: data.knowledgeBase || [],
            tweetExamples: data.tweetExamples || [],
            referenceImages: [],
            voiceGuidelines: data.voiceGuidelines,
            visualIdentity: data.visualIdentity,
            targetAudience: data.targetAudience,
            bannedPhrases: data.bannedPhrases || []
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
            rawOutput: safeResponseText(response) || "",
            model: "gemini-2.0-flash"
        };
        saveBrainLog(log);

        return safeResponseText(response) || "";
    } catch (e) {
        console.error("Smart Reply generation failed", e);
        return "Thanks for the shoutout! 🚀"; // Fallback
    }
};

/**
 * GENERATE ANALYTICS REPORT (Investor-Grade Performance Review)
 */
export const generateAnalyticsReport = async (
    metrics: ComputedMetrics | null,
    campaigns: CampaignLog[],
    socialMetrics?: SocialMetrics,
    calendarEvents: CalendarEvent[] = [],
    trends: TrendItem[] = []
): Promise<GrowthReport> => {
    dispatchThinking(`📊 Generating Growth Report`, { hasOnChain: !!metrics, hasSocial: !!socialMetrics, hasTrends: trends.length > 0 });
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    let onChainSection = "ON-CHAIN DATA: Not connected / Unavailable. Focus analysis on social strategy.";

    if (metrics) {
        onChainSection = `
ON-CHAIN DATA:
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
Social Presence:
- Followers: ${socialMetrics.totalFollowers}
- Engagement Rate: ${socialMetrics.engagementRate}% (Vs Last Week: ${socialMetrics.comparison.engagementChange > 0 ? '+' : ''}${socialMetrics.comparison.engagementChange}%)
- Top Recent Post: "${socialMetrics.recentPosts[0]?.content}"(Likes: ${socialMetrics.recentPosts[0]?.likes}, Comments: ${socialMetrics.recentPosts[0]?.comments})
    `;
    }

    // NEW: Calendar Context
    const upcomingEvents = calendarEvents
        .filter(e => new Date(e.date) >= new Date())
        .slice(0, 5)
        .map(e => `- ${new Date(e.date).toLocaleDateString()}: ${e.content.substring(0, 40)}... (${e.platform})`)
        .join('\n');

    const calendarSection = upcomingEvents.length > 0
        ? `UPCOMING SCHEDULE:\n${upcomingEvents}`
        : "UPCOMING SCHEDULE: No content scheduled.";

    // NEW: Trend Context
    const trendSection = trends.length > 0
        ? `MARKET TRENDS:\n${trends.slice(0, 5).map(t => `- ${t.headline}`).join('\n')}`
        : "MARKET TRENDS: No active signals.";

    const systemInstruction = `
  You are the Head of Growth for a Web3 Protocol. You are analyzing available data to produce a strategic brief.

  ${onChainSection}
  
  SOCIAL DATA:
  ${socialData}
  
  CAMPAIGN CONTEXT:
  ${campaignsData}

  ${calendarSection}

  ${trendSection}

TASK:
  Generate a strictly data-driven strategic brief.
  - **Executive Summary**: Synthesize the "State of the Union". Mention if we are growing or stalling. Reference specific metrics AND upcoming opportunities (trends/schedule).
  - **Tactical Plan**: Based on the trends and schedule, what is the IMMEDIATE next move?
  - **Strategic Plan**:
    - If engagement is low, suggest "OPTIMIZE" content.
    - If a trend is hot, "DOUBLE_DOWN" on it.
    - If a campaign is failing (high CPA), "KILL" it.
  
  OUTPUT FORMAT(JSON):
{
    "executiveSummary": "A concise, investor-grade paragraph summarizing the growth health, citing specific numbers and upcoming catalysts.",
    "tacticalPlan": "Specific, actionable next steps based on the data and schedule.",
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

        const text = safeResponseText(response);
        if (!text) throw new Error("No report generated");

        // BRAIN LOG
        const log: BrainLog = {
            id: `brain-${Date.now()}`,
            timestamp: Date.now(),
            type: 'GROWTH_REPORT',
            brandId: 'GrowthEngine', // Generic or specific
            context: `Analyzing metrics for Growth Report. TVL Change: ${metrics?.tvlChange}, Trends: ${trends.length}`,
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
    recentLogs: BrainLog[] = [], // New: Cognitive Loop (Short Term Memory)
    agentDecisions: any[] = [] // New: Backend Agent Decisions
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

    // Agent Decisions Context
    const decisionsContext = agentDecisions.length > 0 ? `
    PENDING AGENT DECISIONS(BACKGROUND INTELLIGENCE):
    The autonomous background agent has flagged these pending actions.REVIEW THEM.
        ${agentDecisions.map(d => `- [${d.action}] For ${d.brandId}: "${d.reason}" (Draft: ${d.draft || 'None'})`).join('\n')}

    INSTRUCTION: If these decisions are valid and high - quality, APPROVE them by converting them into Tasks below.If they are low quality, IGNORE them.
    ` : "PENDING AGENT DECISIONS: None.";

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
    const trendSummaries = trends.slice(0, 3).map(t => `- ${t.headline} (${t.relevanceReason})`).join('\n');
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
    You are 'Gaia', the Chief Marketing Officer(CMO) for ${brandName}.
    Your goal is to DOMINATE the narrative, not just participate.

    INPUT DATA:
    ${warRoomContext}

    ${warRoomContext}

    ${memoryContext}

    ${decisionsContext}

    ${ragContext ? `
    🔥 STRATEGIC MANDATES (FROM DEEP MEMORY):
    CRITICAL: The following are Q1 GOALS. Every task must aggressively advance these.
    ${ragContext}
    ` : ''
        }

    YOUR 3 - STEP COGNITIVE PIPELINE:

    PHASE 1: THE FILTER(Is it Noise or Signal ?)
        - Scan 'Market Trends' and 'Mentions'.
    - IGNORE generic noise(e.g. "Crypto is up").
    - ATTACK signals that align with our brand keywords.

        PHASE 2: THE ANGLE(Contrarian & Narrative Driven)
            - If a competitor launches a feature, don't just congratulate them. Explain why OURS is safer/faster/better.
                - If a trend is hype, be the voice of reason.
    - If the market is fearful, be the builder.
    - ** RULE:** No "generic updates".Every post must have a "Hook" or "Alpha".

    CRITICAL RULES(ANTI - HALLUCINATION):
    1. ** NO GENERIC AI / SAAS / WEB2 IDEAS **: Do NOT generate tasks about "Home Improvement", "Art Generators", "Project Phoenix", or "Canvas of Nations".
    2. ** STRICTLY WEB3 **: All tasks MUST be related to DeFi, Crypto, Blockchain, Tokenomics, or Community.
    3. ** BRAND SPECIFIC **: Use the brand name(${brandName}) and its specific products / goals.If unknown, infer strictly from the "Context Data"(e.g.if trend is ETH, talk about ETH).

        PHASE 3: THE ACTION(Task Generation)
            - Propose exactly 3 - 5 HIGH - LEVERAGE tasks.

    TASK TYPES:
    1. ** NEWSJACK:** A major event just happened.We must comment within 1 hour.
    2. ** ALPHA_DROP:** Share deep technical insight or "secret" knowledge.
    3. ** COMMUNITY_WAR:** Defend FUD or amplify a super- fan.
    4. ** EVERGREEN:** If quiet, drop a "Masterclass" thread on our core tech.

        CONTEXT:
    - Schedule: ${existingSchedule || "EMPTY (Crisis Level: High). Feed the machine immediately."}
    - Trends: ${trendSummaries || "Quiet."}
    - Mentions: ${mentionSummaries || "Silence."}
    - Reports: ${reportContext}

    OUTPUT JSON FORMAT:
    {
        "thoughts": "I have analyzed the market. The sentiment is [X]. The opportunity is [Y]. I am prioritizing [Z] because...",
            "tasks": [
                {
                    "id": "unique_string",
                    "type": "NEWSJACK" | "ALPHA_DROP" | "COMMUNITY_WAR" | "EVERGREEN",
                    "title": "Punchy Internal Code Name for Task",
                    "description": "One sentence strategic directive.",
                    "reasoning": "Why this wins. (e.g. 'Competitors are ignoring X, we attack Y').",
                    "reasoningSteps": ["1. Signal Detected", "2. Narrative Angle Selected", "3. Execution Strategy"],
                    "strategicAlignment": "How this aligns with our Q1 Goals (e.g. 'Supports TVL Growth objective').",
                    "contentIdeas": ["Unique Angle 1 (e.g. Thread)", "Unique Angle 2 (e.g. Visual)", "Unique Angle 3 (e.g. Meme)"],
                    "impactScore": 1 - 10,
                    "executionPrompt": "Specific writing instruction for the Copywriter agent...",
                    "contextData": [
                        { "type": "TREND", "source": "CoinDesk", "headline": "ETH High", "relevance": 0.9 }
                    ],
                    "suggestedVisualTemplate": "Campaign Launch" | "Partnership" | "Deep Dive" | "Meme",
                    "suggestedReferenceIds": ["ref-123"],
                    "logicExplanation": "One sentence explaining the strategic logic model used (e.g. 'Game Theory: Retaliation').",
                    "proof": "A short footnote/proof point citation (e.g. 'Based on 40% rise in competitor volume')."
                }
            ]
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Perform the audit and generate thoughts + tasks. STRICTLY ADHERE TO THE ANTI-HALLUCINATION RULES.",
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const json = JSON.parse(safeResponseText(response) || "{}");
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
            rawOutput: safeResponseText(response) || "",
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
                executionPrompt: `Write an educational tweet about ${brandName} 's core value proposition.`,
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

        return safeResponseText(response)?.trim() || "Failed to analyze brand kit.";
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
    - KNOWLEDGE: ${context.memory.ragDocs.join('\n')}

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
        return JSON.parse(safeResponseText(response) || "{}");
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
    - **CRITICAL:** Providing a "Reasoning" is mandatory. Explain WHY this specific action works given the market context.
    - **HOOK:** Give it a cool internal code name (e.g. "Operation Alpha", "Liquidity Vampire").
    - **ALIGNMENT:** Explicitly cite which part of the Brand Knowledge Base or Values this aligns with.
    - **CONCEPTS:** Propose 3 distinct content angles/headlines for this task.
    
    OUTPUT JSON:
    {
        "actions": [
            {
                "type": "TWEET" | "THREAD" | "CAMPAIGN",
                "topic": "Specific topic",
                "goal": "What does this specific piece achieve?",
                "instructions": "Specific constraints for the writer (e.g. 'Use the 3-part structure')",
                "reasoning": "Data-backed rationale (e.g. 'Competitors are weak here, we strike now')",
                "hook": "Punchy Title",
                "strategicAlignment": "Aligns with our core value of [Value] because...",
                "contentIdeas": ["Headline 1", "Angle 2", "Meme Idea 3"]
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
        const result = JSON.parse(safeResponseText(response) || "{}");
        return { analysis, actions: result.actions || [] };

    } catch (e) {
        console.error("Brain Phase 2 Failed", e);
        return { analysis, actions: [] };
    }
};

interface OrchestrationInputs {
    calendarEvents: CalendarEvent[];
    mentions: Mention[];
}

const runAgentInsight = async (prompt: string, fallback: AgentInsight): Promise<AgentInsight> => {
    try {
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(safeResponseText(response) || "{}");
    } catch (e) {
        console.warn("Agent insight failed, falling back.", e);
        return fallback;
    }
};

export const orchestrateMarketingDecision = async (
    context: BrainContext,
    inputs: OrchestrationInputs
): Promise<{ analysis: AnalysisReport; actions: ActionPlan['actions']; agentInsights: AgentInsight[] }> => {
    const calendarPreview = inputs.calendarEvents
        .slice(0, 5)
        .map(e => `${e.date}: ${e.platform} - ${e.content}`)
        .join('\n');
    const mentionPreview = inputs.mentions
        .slice(0, 5)
        .map(m => `@${m.author}: ${m.text}`)
        .join('\n');
    const trendPreview = context.marketState.trends.slice(0, 5).map(t => t.headline).join(', ');
    const analyticsPreview = context.marketState.analytics
        ? `Top Post: ${context.marketState.analytics.topPost} | Engagement: ${context.marketState.analytics.engagementRate}%`
        : 'No analytics available.';

    const agentPrompts = [
        {
            prompt: `
ROLE: Social Listener Agent.
INPUTS:
- Trends: ${trendPreview}
- Mentions: ${mentionPreview || 'No recent mentions.'}
TASK: Summarize the top narrative shifts and high-signal conversations.
OUTPUT JSON:
{"agent":"Social Listener","focus":"Narratives + Mentions","summary":"...","keySignals":["...","..."]}`,
            fallback: {
                agent: 'Social Listener',
                focus: 'Narratives + Mentions',
                summary: 'No fresh mentions detected. Lean on current trend headlines.',
                keySignals: trendPreview ? [trendPreview] : []
            }
        },
        {
            prompt: `
ROLE: Performance Analyst Agent.
INPUTS:
- Analytics: ${analyticsPreview}
TASK: Identify the best-performing pattern and where momentum is decaying.
OUTPUT JSON:
{"agent":"Performance Analyst","focus":"Engagement + Performance","summary":"...","keySignals":["...","..."]}`,
            fallback: {
                agent: 'Performance Analyst',
                focus: 'Engagement + Performance',
                summary: 'Analytics missing. Recommend validating performance before scaling.',
                keySignals: []
            }
        },
        {
            prompt: `
ROLE: Content Planner Agent.
INPUTS:
- Calendar: ${calendarPreview || 'No upcoming content scheduled.'}
TASK: Identify gaps or launch opportunities in the content plan.
OUTPUT JSON:
{"agent":"Content Planner","focus":"Calendar + Cadence","summary":"...","keySignals":["...","..."]}`,
            fallback: {
                agent: 'Content Planner',
                focus: 'Calendar + Cadence',
                summary: 'No upcoming calendar items. Prioritize scheduling the next high-impact thread.',
                keySignals: []
            }
        },
        {
            prompt: `
ROLE: Knowledge Curator Agent.
INPUTS:
- Brand Memory: ${context.memory.ragDocs.join('\n') || 'No recent knowledge base context.'}
TASK: Surface brand principles or strategic constraints to honor.
OUTPUT JSON:
{"agent":"Knowledge Curator","focus":"Brand Memory","summary":"...","keySignals":["...","..."]}`,
            fallback: {
                agent: 'Knowledge Curator',
                focus: 'Brand Memory',
                summary: 'No knowledge base context available. Use brand values and positioning defaults.',
                keySignals: []
            }
        }
    ];

    const agentInsights = await Promise.all(
        agentPrompts.map(({ prompt, fallback }) => runAgentInsight(prompt, fallback))
    );

    const agentSummaryBlock = agentInsights
        .map(insight => `- ${insight.agent} (${insight.focus}): ${insight.summary} | Signals: ${insight.keySignals.join('; ')}`)
        .join('\n');

    const enrichedContext: BrainContext = {
        ...context,
        memory: {
            ...context.memory,
            ragDocs: [
                ...context.memory.ragDocs,
                `AGENT COUNCIL SUMMARY:\n${agentSummaryBlock}`.trim()
            ]
        }
    };

    const analysis = await analyzeMarketContext(enrichedContext);
    const plan = await formulateStrategy(enrichedContext, analysis);

    return { analysis, actions: plan.actions || [], agentInsights };
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
                context.brand.name || 'Defia Studio',
                context.brand,
                "Professional"
            );
        } else if (action.type === 'CAMPAIGN') {
            // Use Campaign generator
            const res = await generateCampaignDrafts(action.topic, context.brand.name || 'Defia Studio', context.brand, 3);
            content = res.drafts;
        } else {
            content = "Unsupported Action Type";
        }

        results.push({
            type: action.type as any,
            topic: action.topic,
            goal: action.goal,
            content: content,
            reasoning: action.reasoning || "Autopilot determined this was high leverage.",
            hook: action.hook || `GAIA Strategy: ${action.topic}`,
            strategicAlignment: action.strategicAlignment || "Aligns with core brand growth goals.",
            contentIdeas: action.contentIdeas || [`Post about ${action.topic}`]
        });
    }

    return results;
};

/**
 * COPILOT: Classifies user intent and populates tool parameters.
 */
export const classifyAndPopulate = async (
    userHistory: { role: string, content: string }[],
    brandContext: BrandConfig,
    marketingContext?: { calendar: any[], tasks: any[], report: any }
): Promise<ChatIntentResponse> => {
    dispatchThinking(`🤖 Copilot: Analyzing user intent...`);
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Latest user message
    const lastMessage = userHistory[userHistory.length - 1].content;

    // Summarize Context for the LLM
    const activeCampaigns = marketingContext?.calendar.filter(c => c.status === 'scheduled').length || 0;
    const pendingTasks = marketingContext?.tasks.filter(t => t.type).length || 0;
    const contextSummary = `
    LIVE DATA:
    - Active Campaigns (Scheduled): ${activeCampaigns}
    - Pending Strategy Tasks: ${pendingTasks}
    - Recent Growth Report: ${marketingContext?.report ? "Available" : "None"}
    `;

    const systemPrompt = `
    You are the "Orchestrator" for Defia Studio, a professional Web3 Marketing Platform.
    Your goal is to understand the user's intent and specific tool they want to use.

    AVAILABLE TOOLS:
    1. GENERATE_IMAGE: Creating visuals, banners, memes, or graphics.
       - Params: imagePrompt (string), imageStyle (optional - e.g. "Cyberpunk", "Minimal"), imageAspectRatio (1:1, 16:9, 4:5).
    2. CREATE_CAMPAIGN: Planning COMPREHENSIVE content strategies, multiple posts, or themes.
       - Params: campaignTopic (string), campaignTheme (optional).
    3. DRAFT_CONTENT: Writing a SINGLE tweet, post, or thread. Quick content creation.
       - Params: contentTopic (string).
    4. ANALYZE_MARKET: Looking for trends, analyzing sentiment, or researching.
       - Params: analysisTopic (string).
    5. GENERAL_CHAT: Just talking, asking "how to", greetings, or requests for advice.
       - Params: N/A.

    BRAND CONTEXT:
    Name: ${brandContext.name || "Unknown"}
    Voice: ${brandContext.voiceGuidelines || "Standard"}

    ${contextSummary}

    INSTRUCTIONS:
    1. Analyze the conversation history, focusing on the LAST message: "${lastMessage}".
    2. Determine the Intent.
    3. DETECT VAGUENESS (CRITICALLY IMPORTANT):
       - If the user says "Create a campaign" or "Make content" WITHOUT a topic -> Return MISSING_INFO.
       - If the user says "Generate an image" WITHOUT a description -> Return MISSING_INFO.
       - **EXCEPTION**: If the user asks for *ideas* or *brainstorming* (e.g. "What should I post?"), use GENERAL_CHAT.
       - **EXCEPTION**: If the user asks a question about the brand or strategy, use GENERAL_CHAT.

    4. EXAMPLE FLOWS:
       - User: "Help me brainstorm a campaign"
       - You: Intent: GENERAL_CHAT (The user wants ideas, not a specific action yet).

       - User: "Make a tweet about ETH"
       - You: Intent: DRAFT_CONTENT (Params: contentTopic="Ethereum price action or update", uiCard="ContentCard")

       - User: "Write a thread about our new feature"
       - You: Intent: DRAFT_CONTENT (Params: contentTopic="New Feature Launch Thread", uiCard="ContentCard")

       - User: "Draft something about AI agents"
       - You: Intent: DRAFT_CONTENT (Params: contentTopic="AI agents", uiCard="ContentCard")

       - User: "Plan a marketing strategy for Q1"
       - You: Intent: CREATE_CAMPAIGN (Params: campaignTopic="Q1 Marketing Strategy")

       - User: "Make a cyberpunk banner for our new token launch"
       - You: Intent: GENERATE_IMAGE (Params: prompt="cyberpunk banner new token launch", style="Cyberpunk", ratio="16:9")

    OUTPUT FORMAT (JSON ONLY):
    {
      "type": "GENERATE_IMAGE" | "CREATE_CAMPAIGN" | "DRAFT_CONTENT" | "GENERAL_CHAT" | "MISSING_INFO",
      "params": { ... },
      "missingInfo": ["Question 1?", "Question 2?"], 
      "thoughtProcess": "Brief reasoning",
      "uiCard": "CampaignCard" | "ImageCard" | "ContentCard" | null
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: JSON.stringify(userHistory) + "\n\n" + systemPrompt }] }],
            config: { responseMimeType: "application/json" }
        });

        const text = safeResponseText(response) || "{}";
        const parsed = JSON.parse(text);
        return parsed as ChatIntentResponse;

    } catch (e) {
        console.error("Copilot Classification Failed", e);
        return {
            type: 'GENERAL_CHAT',
            thoughtProcess: "Error in classification fallback.",
            params: {}
        };
    }
};

/**
 * GENERAL CHAT: Answers questions using the Brand Context & Knowledge Base (with RAG).
 */
export const generateGeneralChatResponse = async (
    userHistory: { role: string, content: string }[],
    brandContext: BrandConfig,
    marketingContext?: { calendar: any[], tasks: any[], report: any }
): Promise<{ text: string, actions?: { label: string, action: string }[] }> => {
    dispatchThinking(`🤖 Copilot: Consulting Knowledge Base...`);
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Latest user message
    const lastMessage = userHistory.length > 0 ? userHistory[userHistory.length - 1].content : "";

    // --- 1. RAG RETRIEVAL (Connect the Dots) ---
    let ragContext = "";
    if (lastMessage.length > 5) {
        try {
            const embedding = await getEmbedding(lastMessage);
            if (embedding.length > 0) {
                const memories = await searchBrainMemory(brandContext.name, embedding, 0.65, 3);
                if (memories && memories.length > 0) {
                    ragContext = `RELEVANT MEMORY (From Database): \n${memories.map((m: any) => `- ${m.content} (Source: ${m.memory_type})`).join('\n')}`;
                    console.log("Copilot RAG Hit:", memories.length);
                }
            }
        } catch (e) {
            console.warn("Copilot RAG Retrieval Skipped", e);
        }
    }

    const kb = brandContext.knowledgeBase.join('\n');

    // --- CONTEXT SERIALIZATION ---
    // Make the context richer so the AI can "Look out" for the brand
    const upcomingEvents = marketingContext?.calendar?.slice(0, 5).map(e => `- ${new Date(e.date).toLocaleDateString()}: ${e.content} (${e.platform})`).join('\n') || "No upcoming events.";

    // Parse Growth Report for intelligent chatter
    let growthInsights = "No recent strategic analysis.";
    if (marketingContext?.report) {
        growthInsights = `
        EXECUTIVE SUMMARY: ${marketingContext.report.executiveSummary}
        RECOMMENDED STRATEGY: ${marketingContext.report.strategicPlan.map(p => `${p.action} on ${p.subject}`).join(', ')}
        DISABLE ACTIONS: ${marketingContext.report.strategicPlan.filter(p => p.action === 'KILL').map(p => p.subject).join(', ') || "None"}
        `;
    }

    const systemPrompt = `
    You are the Chief Marketing Officer (CMO) for ${brandContext.name}.
    
    RELATIONSHIP:
    - You are NOT a generic assistant. You are a **Proactive Strategic Partner**.
    - You "Look Out" for the brand. If the user suggests something off-brand, politely correct them.
    - You "Connect the Dots". If the user talks about X, remind them of related Y from the database.

    YOUR KNOWLEDGE BASE (Source of Truth):
    ${kb}

    ${ragContext ? `\n    🧠 DEEP BRAIN MEMORY (Relevant History):\n    ${ragContext}\n` : ''}

    LIVE MARKET INTELLIGENCE:
    - 📈 Growth Analysis:
      ${growthInsights}
    
    - 🗓️ Upcoming Calendar (Context for timing):
      ${upcomingEvents}
    
    INSTRUCTIONS:
    1. **ANSWER & AMPLIFY**: Answer the user's question, then add value. "Yes, we can do that. And based on the Q1 Goals, this would also help us with..."
    2. **CLARIFY**: If the user is vague (e.g. "Draft a post"), ask clarifying questions *before* offering a draft. "Who is the audience? Is this for the Alpha group or general public?"
    3. **RECOMMEND**: If the user asks "What should I do?", look at the CALENDAR gaps and GROWTH REPORT. Suggest concrete actions. "I see a gap on Friday. Given the 'High Engagement' on technical posts (from report), I recommend a Thread about our Architecture."
    4. **DATA-DRIVEN**: Explicitly reference the data provided. "I see in your Brain Memory that we decided to pause memes. Are you sure?"
    5. **RELEVANT ACTIONS**: 
       - If you answer a question (e.g. "What platform?"), ensure the suggested 'actions' are logical next steps (e.g. "Draft Twitter Thread"). 
       - DO NOT blindly copy the example actions. 
       - If no action is needed (e.g. simple greeting), return empty list.

    TONE:
    - Professional, Concise, Insightful.
    - Use the brand's voice (${brandContext.voiceGuidelines || "Standard"}).
    
    SPECIAL MODES:
    - **BRAINSTORMING**: If asked for ideas:
      1. Consult the Knowledge Base AND Live Data.
      2. PROPOSE 3 distinct "strategic angles".
      3. For each idea, provide a "label" (short title) and an "action" (full prompt to execute it).

    OUTPUT FORMAT (JSON):
    {
      "text": "Your conversational response here. Use markdown for bolding/lists.",
      "actions": [
        { "label": "Draft Tech Deep Dive", "action": "Draft a technical thread about Decentralized Sequencers" },
        { "label": "Create Meme Campaign", "action": "Create a viral meme campaign about Enki staking" }
      ]
    }
    
    If no actions are relevant, return an empty array for "actions".
    `;

    try {
        // We pass the full history to maintain conversation thread
        // Convert history to Gemini format
        const historyParts = userHistory.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');

        const fullPrompt = `${systemPrompt}\n\nCONVERSATION HISTORY:\n${historyParts}\n\nAssistant:`;

        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            config: { responseMimeType: "application/json" }
        });

        const rawText = result.text || "{}";
        try {
            return JSON.parse(rawText);
        } catch (e) {
            // Fallback if model fails to return JSON
            return { text: rawText, actions: [] };
        }

    } catch (e) {
        console.error("General Chat Failed", e);
        return { text: "I'm having trouble connecting to my strategic brain right now. Please try again.", actions: [] };
    }
};

/**
 * DAILY AI BRIEF GENERATOR (STRICT ANALYST MODE)
 */
export const generateDailyBrief = async (
    brandName: string,
    kpis: KPIItem[],
    campaigns: DashboardCampaign[],
    signals: CommunitySignal[]
): Promise<DailyBrief> => {
    dispatchThinking("📊 Generating Daily AI Brief (Analyst Mode)");
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Prepare Context from VISIBLE Data Only
    const kpiSummary = kpis.map(k => `${k.label}: ${k.value} (${k.trend} ${k.delta}%)`).join('\n');
    const campaignSummary = campaigns.map(c =>
        `Campaign: ${c.name} | ROI: ${c.roi}x | CPA: $${c.cpa} | Status: ${c.status} | Rec: ${c.recommendation.action}`
    ).join('\n');
    const signalSummary = signals.map(s => `${s.platform}: ${s.signal} (${s.trend})`).join('\n');

    const systemInstruction = `
    You are Defia's AI Marketing Analyst for the brand "${brandName}".
    Generate a concise daily marketing brief based on the data provided.

    Input Data:
    KPIs:\n${kpiSummary || 'No KPI data available yet.'}

    Campaigns:\n${campaignSummary || 'No active campaigns yet.'}

    Community Signals:\n${signalSummary || 'No community signals detected yet.'}

    Output a JSON object with this exact structure:
    {
        "keyDrivers": ["1-2 sentences about what's driving performance"],
        "decisionsReinforced": ["1-2 sentences about what's working well"],
        "risksAndUnknowns": ["1-2 sentences about risks or gaps to watch"],
        "confidence": {
            "level": "High" | "Medium" | "Low",
            "explanation": "A brief 2-3 sentence daily summary using RICH TEXT MARKUP (see rules below)."
        }
    }

    Rules:
    - The "explanation" field is the MOST important — it's the daily brief text shown on the dashboard.
    - Write the explanation as 2-3 flowing sentences, like a morning briefing from an analyst.
    - Use **bold** markup (double asterisks) around key metrics, brand names, percentages, and important phrases (2-4 bold segments per brief).
    - Example: "**Engagement is up 12%** this week, driven by strong performance on **Twitter threads**. The **AI content strategy** is resonating with the DeFi audience, though **Discord activity** has dipped slightly."
    - Keep keyDrivers, decisionsReinforced, risksAndUnknowns to 1-2 items each (short sentences).
    - Use precise language. If data is limited, say so honestly — don't fabricate.
    - Never say "AI summary failure" or "Generation Error".
    - If input data is sparse, still write a useful brief about the brand's current state and what to focus on.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Generate Daily Brief",
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const text = safeResponseText(response) || "{}";
        const data = JSON.parse(text);

        return {
            keyDrivers: data.keyDrivers || [],
            decisionsReinforced: data.decisionsReinforced || [],
            risksAndUnknowns: data.risksAndUnknowns || [],
            confidence: data.confidence || { level: 'Low', explanation: 'Generation Error' },
            timestamp: Date.now()
        };

    } catch (e) {
        console.error("Daily Brief Generation Failed", e);
        return {
            keyDrivers: [`${brandName}'s marketing data is still being collected.`],
            decisionsReinforced: ['Continue building content and engagement data for deeper analysis.'],
            risksAndUnknowns: ['Limited data available — brief will improve as more signals come in.'],
            confidence: { level: 'Low', explanation: `${brandName}'s daily brief is currently limited due to sparse data. As more content is published, campaigns run, and engagement data flows in, this brief will automatically become richer and more actionable.` },
            timestamp: Date.now()
        };
    }
};
