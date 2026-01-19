
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

    AVAILABLE REFERENCE IMAGES (If using 'Auto' template):
    ${refImages}

    INPUT TWEETS:
    ${drafts.map((d, i) => `Tweet ${i + 1}: "${d.tweet}"`).join('\n')}

    TASK:
    Return a JSON array matching the input order. For each tweet:
    1. Select the BEST 'template' based on the definitions above.
    2. Write a 'visualHeadline' (Max 5 words, Punchy).
    3. Select a 'referenceImageId' if needed (otherwise null).
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
        const result = JSON.parse(response.text || "{}");
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
