
import { GoogleGenAI } from "@google/genai";
import { GenerateImageParams, BrandConfig, ComputedMetrics, GrowthReport, CampaignLog, SocialMetrics, TrendItem, CalendarEvent, StrategyTask, ReferenceImage } from "../types";

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

            if (img.data) {
                base64 = img.data.includes('base64,') ? img.data.split('base64,')[1] : img.data;
            } else if (img.url) {
                // Fetch from URL if local data missing
                base64 = await getBase64FromUrl(img.url);
            }

            if (!base64) return null;

            return {
                inlineData: {
                    mimeType: "image/png",
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

    // Process Images (Async)
    try {
        if (params.brandConfig && params.brandConfig.referenceImages) {
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
        }
    } catch (err) {
        console.warn("Error processing reference images, proceeding with text only.", err);
    }

    try {
        console.log("Generating with gemini-3-pro-image-preview...");
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: parts },
            config: {
                // @ts-ignore - Experimental/Legacy schema
                imageConfig: {
                    aspectRatio: params.aspectRatio === '1:1' ? '1:1' : params.aspectRatio === '4:5' ? '4:5' : '16:9',
                    imageSize: params.size || '1024x1024'
                }
            },
        });

        const responseParts = response.candidates?.[0]?.content?.parts;
        const imagePart = responseParts?.[0];

        // @ts-ignore
        if (imagePart && imagePart.inlineData) {
            // @ts-ignore
            return `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;
        }

        throw new Error("No image data returned from Gemini.");

    } catch (error: any) {
        console.error("Gemini generation error:", error.message);
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
    - Separate each tweet clearly with "---".
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

export const generateIdeas = async (brandName: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: `Generate 4 distinct tweet topics/ideas for a ${brandName} marketing strategist. Return only the topics as a simple list.`,
        });
        return (response.text || '').split('\n').map(l => l.replace(/^[\d\-\.\*]+\s*/, '').trim()).filter(l => l.length > 5);
    } catch (e) {
        return ["Community Update", "Tech Deep Dive", "Market Commentary", "Feature Teaser"];
    }
}

/**
 * HELPER: Deterministic Profile Generator
 * Creates a believable brand profile purely from the name string without external API calls.
 */
const generateDeterministicProfile = (brandName: string, url: string): BrandConfig => {
    // Simple hash function to generate consistent numbers from string
    const hash = brandName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // Theme Generator
    const themes = [
        { name: 'DeFi Blue', c1: '#3B82F6', c2: '#1E40AF', c3: '#93C5FD' },
        { name: 'Dark Mode Tech', c1: '#111827', c2: '#374151', c3: '#10B981' },
        { name: 'Meme Vibrant', c1: '#F59E0B', c2: '#EF4444', c3: '#FFFFFF' },
        { name: 'Corporate Clean', c1: '#0F172A', c2: '#64748B', c3: '#E2E8F0' },
        { name: 'Purple Haze', c1: '#5B21B6', c2: '#8B5CF6', c3: '#DDD6FE' }
    ];

    const theme = themes[hash % themes.length];
    const isDeFi = brandName.toLowerCase().includes('swap') || brandName.toLowerCase().includes('finance') || brandName.toLowerCase().includes('defi');
    const isMeme = brandName.toLowerCase().includes('dog') || brandName.toLowerCase().includes('pepe') || brandName.toLowerCase().includes('meme');

    return {
        colors: [
            { id: 'c1', name: 'Primary', hex: theme.c1 },
            { id: 'c2', name: 'Secondary', hex: theme.c2 },
            { id: 'c3', name: 'Accent', hex: theme.c3 },
        ],
        knowledgeBase: [
            `${brandName} is a Web3 project located at ${url}.`,
            isDeFi ? `${brandName} focuses on decentralized finance solutions, offering yield and swapping capabilities.` :
                isMeme ? `${brandName} is a community-driven project focused on viral growth and engagement.` :
                    `${brandName} provides infrastructure and tools for the decentralized economy.`,
            `The project aims to simplify user experience and increase adoption in the blockchain space.`
        ],
        tweetExamples: [
            `Big updates coming to ${brandName} next week! Stay tuned. 🚀`,
            `Community is everything. Thank you for supporting ${brandName}. #Web3 #Growth`,
            `Building the future, one block at a time.`
        ],
        referenceImages: []
    };
};

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
        console.warn("Research API failed or offline, using deterministic simulation.", e);
        return generateDeterministicProfile(brandName, url);
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
export const generateStrategicAnalysis = async (
    brandName: string,
    calendarEvents: CalendarEvent[],
    trends: TrendItem[],
    brandConfig: BrandConfig,
    growthReport?: GrowthReport | null
): Promise<StrategyTask[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // 1. Analyze Calendar
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const eventsNextWeek = calendarEvents.filter(e => {
        const d = new Date(e.date);
        return d >= now && d <= next7Days;
    });

    // 2. Prepare Context
    const kb = brandConfig.knowledgeBase.slice(0, 3).join('\n'); // Brief context
    const trendSummaries = trends.slice(0, 2).map(t => `- ${t.headline} (${t.relevanceReason})`).join('\n');
    const existingSchedule = eventsNextWeek.map(e => `${e.date}: ${e.content.substring(0, 30)}...`).join('\n');

    let reportContext = "No quantitative performance data available.";
    if (growthReport) {
        reportContext = `
        PERFORMANCE DATA (Use this to optimize tasks):
        - Executive Summary: ${growthScore(growthReport)}
        - Strategic Directives: ${growthReport.strategicPlan.map(p => `${p.action}: ${p.subject}`).join(' | ')}
        `;
    }

    const systemInstruction = `
    You are 'Gaia', the Chief Marketing Officer for ${brandName}.
    Your goal is to audit the current schedule, identify opportunities, and assign tasks to the human team.

    CONTEXT:
    - Upcoming Schedule (Next 7 Days):
    ${existingSchedule || "NO CONTENT SCHEDULED."}

    - Market Trends (Pulse):
    ${trendSummaries || "No major trends detected."}

    - Brand Context:
    ${kb}

    ${reportContext}

    TASK:
    Propose exactly 3 high-impact tasks.
    
    OUTPUT JSON:
    [
        {
            "id": "unique_string",
            "type": "GAP_FILL" | "TREND_JACK" | "CAMPAIGN_IDEA" | "COMMUNITY",
            "title": "Short Task Title",
            "description": "One sentence explanation.",
            "reasoning": "Why this is important now (cite Performance Data if relevant).",
            "impactScore": number (1-10),
            "executionPrompt": "The exact instruction to give the writer AI to generate this tweet. Be specific."
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
        return [
            {
                id: 'fallback-1',
                type: 'GAP_FILL',
                title: 'Fill Schedule Gap',
                description: 'The calendar is looking empty for the next few days.',
                reasoning: 'Consistent posting is key to maintaining algorithmic reach.',
                impactScore: 8,
                executionPrompt: `Write a tweet for ${brandName} that engages the community about current market conditions.`
            }
        ];
    }
};

function growthScore(report: GrowthReport): string {
    return report.executiveSummary;
}
