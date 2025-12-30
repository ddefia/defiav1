
import 'dotenv/config';
import fetch from 'node-fetch'; // Standard node-fetch

// --- REPLICATE LOGIC FROM ANALYTICS.TS ---

const runApifyActor = async (actorId, input, token) => {
    console.log(`[Test] Running Actor ${actorId}...`);
    try {
        const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}&waitForFinish=90`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });

        const runData = await response.json();
        console.log("FULL RUN DATA:", JSON.stringify(runData, null, 2));

        if (!runData.data || (runData.data.status !== 'SUCCEEDED' && runData.data.status !== 'RUNNING')) {
            console.error(`[Test] Actor status:`, runData.data?.status);
            throw new Error(`Actor Status: ${runData.data?.status || 'Unknown'}`);
        }

        const datasetId = runData.data.defaultDatasetId;
        console.log(`[Test] Fetching results from dataset ${datasetId}...`);

        const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
        const items = await itemsRes.json();
        return items;
    } catch (e) {
        console.error(`[Test] Apify Error:`, e.message);
        throw e;
    }
};

const main = async () => {
    const token = process.env.APIFY_API_TOKEN;
    const brandName = "Enki";
    const handle = "ENKIProtocol"; // Mocking getHandle

    console.log(`[Test] Token: ${token ? 'Present' : 'MISSING'}`);
    if (!token) return;

    // 1. Fetch Tweets replicate
    try {
        const tweetItems = await runApifyActor('61RPP7dywgiy0JPD0', {
            "twitterHandles": [handle],
            "maxItems": 3,
            "sort": "Latest",
            "tweetLanguage": "en",
            "author": handle,
            "proxy": { "useApifyProxy": true }
        }, token);

        console.log(`[Test] Tweets Found: ${tweetItems.length}`);
        if (tweetItems.length > 0) {
            console.log(`[Test] First Tweet:`, tweetItems[0].full_text?.substring(0, 50));
        } else {
            console.log("[Test] No Tweets Found??");
        }

    } catch (e) {
        console.error("[Test] logic failed:", e);
    }
};

main();
