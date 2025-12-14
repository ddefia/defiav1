
import { TrendItem } from "../types";

// In a real app, this would call a backend scraping service (Apify/Twitter API)
// For this demo, we simulate "Live" data fetching based on the Brand's niche.


// Helper for Apify (Simulated import if we refactored, but defining here for safety)
const runApifyActor = async (actorId: string, input: any, token: string) => {
    const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}&waitForFinish=90`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    const runData = await response.json();
    if (!runData.data || (runData.data.status !== 'SUCCEEDED' && runData.data.status !== 'RUNNING')) {
        throw new Error(`Actor Status: ${runData.data?.status}`);
    }
    const datasetId = runData.data.defaultDatasetId;
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
    return await itemsRes.json();
};

export const fetchMarketPulse = async (brandName: string): Promise<TrendItem[]> => {
    const token = process.env.APIFY_API_TOKEN;
    const now = Date.now();

    // 1. Try Real API Fetch if Token Exists
    if (token) {
        try {
            console.log("Fetching live trends via Apify...");
            // Using a generic Twitter Scraper for "Crypto Trends" or specific brand keywords
            // Actor: 'quacker/twitter-scraper' or similar (using the one from analytics for consistency: 61RPP7dywgiy0JPD0)
            const keywords = ['#web3', '#crypto', brandName, 'Ethereum', 'Bitcoin'].join(' OR ');

            const items = await runApifyActor('61RPP7dywgiy0JPD0', {
                "searchTerms": [keywords],
                "maxItems": 5,
                "sort": "Latest"
            }, token);

            if (items && items.length > 0) {
                return items.map((item: any) => ({
                    id: item.id_str || `trend-${Math.random()}`,
                    source: 'Twitter',
                    headline: item.full_text ? item.full_text.substring(0, 50) + "..." : "Trend",
                    summary: item.full_text || "No summary",
                    relevanceScore: 85, // Simple default
                    relevanceReason: "Live market topic",
                    sentiment: 'Neutral',
                    timestamp: 'Live',
                    createdAt: now
                }));
            }
        } catch (e) {
            console.warn("Apify fetch failed for Pulse, falling back to mock.", e);
        }
    }

    // 2. Fallback to Mock Data
    await new Promise(resolve => setTimeout(resolve, 800));

    // Determine context based on Brand Name
    if (brandName === 'ENKI') {
        return [
            {
                id: 't1',
                source: 'Twitter',
                headline: "Metis Sequencer Revenue Hits ATH",
                summary: "On-chain data confirms daily sequencer revenue on Metis has surpassed $50k. Community buzzing about sustainability.",
                relevanceScore: 98,
                relevanceReason: "Directly impacts ENKI's yield generation.",
                sentiment: 'Positive',
                timestamp: '10m ago',
                createdAt: now
            },
            {
                id: 't2',
                source: 'News',
                headline: "Ethereum Dencun Upgrade Imminent",
                summary: "Blob transactions ready for mainnet. Expected to reduce L2 fees by 90%.",
                relevanceScore: 92,
                relevanceReason: "Lowers bridging costs for ENKI users.",
                sentiment: 'Positive',
                timestamp: '1h ago',
                createdAt: now
            }
        ];
    }

    // Default Mock
    return [
        {
            id: 'm1',
            source: 'Twitter',
            headline: "Bitcoin Breaks $69k",
            summary: "Crypto Twitter is in a frenzy as Bitcoin breaks ATH.",
            relevanceScore: 99,
            relevanceReason: "Market euphoria drives retail into high-risk assets.",
            sentiment: 'Positive',
            timestamp: 'Just now',
            createdAt: now
        },
        {
            id: 'm2',
            source: 'News',
            headline: "Market Volatility Alert",
            summary: "Traders bracing for impact ahead of FOMC meeting.",
            relevanceScore: 85,
            relevanceReason: "Macro event.",
            sentiment: 'Neutral',
            timestamp: '20m ago',
            createdAt: now
        }
    ];
};

