
import { GoogleGenAI } from "@google/genai";
import { GenerateImageParams, BrandConfig, ComputedMetrics, GrowthReport, CampaignLog, SocialMetrics, TrendItem, CalendarEvent, StrategyTask, ReferenceImage } from "../types";

/**
 * Helper to generate embeddings for RAG.
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const result = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: { parts: [{ text }] }
        });

        if (result.embeddings && result.embeddings.length > 0 && result.embeddings[0].values) {
            return result.embeddings[0].values;
        }

        return [];
    } catch (e) {
        console.error("Embedding generation failed", e);
        return [];
    }
};

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

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
export const generateWeb3Graphic = async (params: GenerateImageParams): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const colorPalette = params.brandConfig.colors.map(c => `${c.name} (${c.hex})`).join(', ');
    const brandName = params.brandName || "Web3";
    const isMeme = brandName === 'Meme';

    // Include the user's explicit art prompt override if present
    const visualOverride = params.artPrompt
        ? `VISUAL DIRECTION OVERRIDE: ${params.artPrompt}`
        : "Visualize momentum, connections, or security based on keywords.";

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
        systemPrompt = `
        You are an expert 3D graphic designer for ${brandName}, a leading Web3 company.
        TASK: Create a professional social media graphic for: "${params.prompt}"
        BRANDING:
        - Colors: ${colorPalette}.
        - Style: Glassmorphism, Ethereal, Geometric, Futuristic.
        - Typography: Minimal.
        INSTRUCTIONS:
        - Analyze tweet sentiment.
        - ${visualOverride}
        - STRICTLY follow the visual style of the reference images provided.
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

    // Process Images (Async) - Kept for potential future use or if proxy supports it, 
    // but complying with old structure which ignored them in the final call mostly.
    const imageParts = await Promise.all(params.brandConfig.referenceImages.map(async (img) => {
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

    try {
        const response = await ai.models.generateContent({
            model: 'imagen-3.0-generate-001',
            contents: { parts: [{ text: params.prompt + " " + (params.artPrompt || "") }] },
            config: {
                // @ts-ignore - SDK types might trail behind availability
                sampleCount: 1,
                aspectRatio: params.aspectRatio === '1:1' ? '1:1' : params.aspectRatio === '4:5' ? '4:5' : '16:9'
            },
        });

        const responseParts = response.candidates?.[0]?.content?.parts;
        if (!responseParts) throw new Error("No content generated.");

        for (const part of responseParts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
        }
        throw new Error("No image data found.");
    } catch (error: any) {
        console.error("Gemini generation error:", error);
        throw error;
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const examples = brandConfig.tweetExamples.length > 0
        ? `STYLE EXAMPLES (MIMIC THIS STYLE):\n${brandConfig.tweetExamples.map(t => `- ${t}`).join('\n')}`
        : "";

    const kb = brandConfig.knowledgeBase.length > 0
        ? `KNOWLEDGE BASE (USE THIS CONTEXT):\n${brandConfig.knowledgeBase.join('\n\n')}`
        : "";

    const isNoTagBrand = ['netswap', 'enki'].includes(brandName.toLowerCase());
    const hashtagInstruction = isNoTagBrand ? "- Do NOT use any hashtags." : "- Use 1-2 relevant hashtags.";

    const systemInstruction = `
    You are the Social Media Lead for ${brandName}.
    
    TASK: Write a single, engaging tweet (detailed and comprehensive, up to 280 chars) about: "${topic}".
    TONE: ${tone}
    
    ${examples}
    
    ${kb}
    
    INSTRUCTIONS:
    - STRUCTURE: Start with a compelling HOOK. End with a clear Call-To-Action (CTA).
    - If style examples are provided, strictly follow their formatting (spacing, emojis, capitalization).
    - If Knowledge Base info is relevant to the topic, ensure accuracy.
    - STRICTLY NO HASHTAGS.
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
export const generateCampaignDrafts = async (
    theme: string,
    brandName: string,
    brandConfig: BrandConfig,
    count: number
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const examples = brandConfig.tweetExamples.length > 0
        ? `STYLE EXAMPLES:\n${brandConfig.tweetExamples.slice(0, 3).map(t => `- ${t}`).join('\n')}`
        : "";

    const kb = brandConfig.knowledgeBase.length > 0
        ? `KNOWLEDGE BASE:\n${brandConfig.knowledgeBase.join('\n\n')}`
        : "";

    const isDiverse = theme === 'DIVERSE_MIX_MODE';

    let taskInstruction = '';
    if (isDiverse) {
        taskInstruction = `
        TASK: Write ${count} distinct tweets covering a DIVERSE MIX of topics for ${brandName}.
        
        TOPIC GUIDANCE:
        - Do NOT stick to a single theme.
        - Ensure the mix includes: 1 educational tweet, 1 community/engagement tweet, 1 market/industry insight, 1 product feature highlight.
        - Make them feel like a natural, varied week of content.
        `;
    } else {
        taskInstruction = `
        TASK: Write ${count} distinct tweets about the THEME: "${theme}" for ${brandName}.
        `;
    }

    const isNoTagBrand = ['netswap', 'enki'].includes(brandName.toLowerCase());
    const hashtagInstruction = isNoTagBrand ? "- Do NOT use any hashtags." : "- Use 1-2 relevant hashtags.";

    const systemInstruction = `
    You are the Social Media Lead for ${brandName}.
    
    ${taskInstruction}
    
    ${examples}
    
    ${kb}
    
    FORMATTING:
    - First line MUST be "THEME_COLOR: [Hex Code]" (e.g. THEME_COLOR: #FF5733). Choose a color that matches the vibe of the campaign theme.
    - Then separate each tweet clearly with "---".
    - Do not number the tweets.
    - Keep each tweet detailed (up to 280 characters).
    - STRUCTURE: Start with a compelling HOOK. End with a clear Call-To-Action (CTA).
    - Mimic the style of the examples provided.
    - STRICTLY NO HASHTAGS.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Generate the campaign draft now.`,
            config: { systemInstruction: systemInstruction }
        });
        return response.text || "";
    } catch (error) {
        console.error("Campaign generation error", error);
        throw error;
    }
}

/**
 * Pulse Engine: Generates a reaction to a specific market trend.
 */
export const generateTrendReaction = async (
    trend: TrendItem,
    brandName: string,
    brandConfig: BrandConfig,
    type: 'Tweet' | 'Meme'
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const examples = brandConfig.tweetExamples.length > 0
        ? `STYLE EXAMPLES:\n${brandConfig.tweetExamples.slice(0, 2).map(t => `- ${t}`).join('\n')}`
        : "";

    const kb = brandConfig.knowledgeBase.length > 0
        ? `OUR BRAND CONTEXT (USE THIS TO CONNECT TREND TO PRODUCT):\n${brandConfig.knowledgeBase.join('\n\n')}`
        : "";

    const isNoTagBrand = ['netswap', 'enki'].includes(brandName.toLowerCase());
    const hashtagInstruction = isNoTagBrand ? "- Do NOT use any hashtags." : "- Use 1-2 relevant hashtags.";

    let outputGuidance = "";
    if (type === 'Tweet') {
        outputGuidance = `
        Output: A single, punchy tweet (max 280 chars).
        Strategy: Explicitly mention ${brandName} or its products. Connect the news ("${trend.headline}") to our specific value proposition defined in the Knowledge Base.
        Structure: Start with a HOOK. End with a CTA.
        STRICTLY NO HASHTAGS.
        `;
    } else {
        outputGuidance = `
        Output: A short, funny text caption or concept for a meme.
        Strategy: Use internet humor to react to ("${trend.headline}"). Make it relatable to holders of ${brandName}.
        ${hashtagInstruction}
        `;
    }

    const systemInstruction = `
    You are the Real-time Newsroom Manager for ${brandName}.
    
    TRENDING NEWS:
    Headline: ${trend.headline}
    Summary: ${trend.summary}
    Source: ${trend.source}
    WHY IT MATTERS: ${trend.relevanceReason}
    
    ${kb}
    
    ${examples}
    
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Filter top 10 trends for prompt
    const topTrends = trends.slice(0, 10).map(t => `- ${t.headline}: ${t.summary}`).join('\n');
    const kb = brandConfig.knowledgeBase.join('\n');

    const systemInstruction = `
    You are the Chief Strategy Officer for ${brandName}.
    
    YOUR OBJECTIVE:
    Identify high-value strategic opportunities by connecting real-time market trends to ${brandName}'s unique value propositions.
    
    BRAND KNOWLEDGE BASE:
    ${kb}

    CURRENT MARKET TRENDS:
    ${topTrends}

    YOUR TASK:
    For the top 3 most relevant trends provided above, generate specific, actionable business opportunities.
    
    CRITICAL INSTRUCTIONS:
    1. **Direct Correlation**: explicitly explain HOW this trend affects ${brandName}.
    2. **Actionable Strategy**: Suggest a concrete marketing angle, partnership idea, or product feature emphasis.
    3. **Tone**: Executive, insightful, and growth-oriented.
    
    OUTPUT FORMAT (Markdown):
    ### [Trend Name]
    **Relevance:** [Why this matters to ${brandName}]
    **Strategy:** [Specific action we should take]
    **Content Angle:** [What we should post/write about]
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: `Generate 4 distinct tweet topics/ideas for a ${brandName} marketing strategist. Return only the topics as a simple list.`,
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Use Gemini if available for high-quality hallucination
    try {
        if (!process.env.API_KEY) throw new Error("No API Key");

        const systemInstruction = `
        You are an expert Brand Identity Analyst and AI Researcher.
        
        TASK:
        Analyze the company "${brandName}" located at "${url}".
        Since you cannot browse the live web, use your internal knowledge base to infer their brand identity, visual style, and value proposition.
        
        If the brand is unknown or fictitious, HALLUCINATE a plausible, professional Web3 brand identity based on the name and URL structure.
        
        OUTPUT FORMAT (JSON):
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
 * Generates an Investor-Grade Growth Report based on metrics.
 */
export const generateGrowthReport = async (
    metrics: ComputedMetrics | null,
    campaigns: CampaignLog[],
    socialMetrics?: SocialMetrics
): Promise<GrowthReport> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    - Campaign: "${c.name}" (${c.channel})
      Budget: $${c.budget}
      ${m ? `CPA: $${m.cpa}
      Lift Multiplier: ${m.lift.toFixed(1)}x
      Whales Acquired: ${m.whalesAcquired}
      ROI: ${m.roi.toFixed(1)}x` : 'Attribution: Unavailable'}
    `;
    }).join('\n');

    let socialData = "No social data available.";
    if (socialMetrics) {
        socialData = `
      Followers: ${socialMetrics.totalFollowers}
      Engagement Rate: ${socialMetrics.engagementRate}% (Vs Last Week: ${socialMetrics.comparison.engagementChange > 0 ? '+' : ''}${socialMetrics.comparison.engagementChange}%)
      Top Recent Post: "${socialMetrics.recentPosts[0]?.content}" (Likes: ${socialMetrics.recentPosts[0]?.likes}, Comments: ${socialMetrics.recentPosts[0]?.comments})
      `;
    }

    const systemInstruction = `
  You are the Head of Growth for a Web3 Protocol. You are analyzing available data to produce a strategic brief.
  
  ${onChainSection}
  
  SOCIAL DATA:
  ${socialData}
  
  CAMPAIGN CONTEXT:
  ${campaignsData}
  
  TASK:
  Generate a strictly data-driven strategic brief.
  If on-chain data is missing, base your recommendations entirely on social engagement, content performance, and brand sentiment.
  
  OUTPUT FORMAT (JSON):
  {
    "executiveSummary": "A concise, investor-grade paragraph summarizing the growth health. ${metrics ? 'Correlate social buzz with on-chain volume.' : 'Focus on community sentiment and engagement trends.'}",
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

        return JSON.parse(text) as GrowthReport;
    } catch (error) {
        console.error("Growth report error", error);
        // Fallback if JSON parsing fails
        return {
            executiveSummary: "Analysis complete. Data indicates mixed performance across campaigns. Review individual KPIs for details.",
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
    ragContext: string = "" // New: RAG Memory Context
): Promise<StrategyTask[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    const existingSchedule = eventsNextWeek.map(e => `${e.date}: ${e.content.substring(0, 30)}... ${e.campaignName ? `[Campaign: ${e.campaignName}]` : ''}`).join('\n');
    const mentionSummaries = mentions.slice(0, 3).map(m => `- ${m.author}: "${m.text}"`).join('\n');

    let reportContext = "No quantitative performance data available.";
    if (growthReport) {
        reportContext = `
        PERFORMANCE DATA (Use this to optimize tasks):
        - Executive Summary: ${growthReport.executiveSummary}
        - Strategic Directives: ${growthReport.strategicPlan.map(p => `${p.action}: ${p.subject}`).join(' | ')}
        `;
    }

    const systemInstruction = `
    You are 'Gaia', the AI Marketing Employee for ${brandName}.
    You assume three specific roles to audit the current state and assign tasks:

    ${ragContext ? `
    IMPORTANT - LONG TERM MEMORY (HISTORY & CONTEXT):
    The following is retrieved context from our historical database and on-chain analysis. 
    Use this to inform your decisions. Pay special attention to 'DECISION TAKEN' logs to avoid repeating recent actions or to follow up on them.
    
    ${ragContext}
    ` : ''}

    ROLE 1: THE NEWSROOM (Trend Jacking)
    - Monitor 'Market Trends' for any news specifically matching our brand keywords or high-impact sector news.
    - If a match is found, create a 'REACTION' task.

    ROLE 2: THE COMMUNITY MANAGER (Auto-Reply)
    - Review 'Incoming Mentions'.
    - If a mention requires a response (question, praise, FUD), create a 'REPLY' task.
    - Ignore spam.

    ROLE 3: THE CONTENT MACHINE (Evergreen)
    - Review 'Upcoming Schedule'.
    - If there are fewer than 3 items scheduled for the next 7 days, create 'EVERGREEN' tasks to fill the gaps.
    - Topics: Educational, Brand Values, Feature Highlights (from Knowledge Base).

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
    Propose exactly 3-5 high-impact tasks based on the roles above.
    
    OUTPUT JSON:
    [
        {
            "id": "unique_string",
            "type": "GAP_FILL" | "TREND_JACK" | "CAMPAIGN_IDEA" | "COMMUNITY" | "REACTION" | "REPLY" | "EVERGREEN",
            "title": "Short Task Title (e.g. 'Reply to @User', 'News: ETF Approval')",
            "description": "One sentence explanation.",
            "reasoning": "Why this is important now.",
            "impactScore": number (1-10),
            "executionPrompt": "The specific instruction to generate the content. For REPLIES, include the user's original text."
        }
    ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: "Perform the audit and generate tasks.",
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        return JSON.parse(response.text || "[]") as StrategyTask[];
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
                executionPrompt: `Write an educational tweet about ${brandName}'s core value proposition.`
            });
        }

        return fallbackTasks.length > 0 ? fallbackTasks : [{
            id: 'fallback-1',
            type: 'GAP_FILL',
            title: 'Fill Schedule Gap',
            description: 'The calendar is looking empty for the next few days.',
            reasoning: 'Consistent posting is key to maintaining algorithmic reach.',
            impactScore: 8,
            executionPrompt: `Write a tweet for ${brandName} that engages the community about current market conditions.`
        }];
    }
};

function growthScore(report: GrowthReport): string {
    return report.executiveSummary;
}
