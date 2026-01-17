import 'dotenv/config';
import fetch from 'node-fetch'; // Ensure node-fetch is available or use global fetch if Node 18+

console.log("Checking Apify Integration...");
const token = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN;

if (!token) {
    console.error("❌ No API Token found in env!");
    process.exit(1);
}

console.log("Token present. Length:", token.length);

// Test Params matching backfill_tweets.js
const TEST_HANDLE = 'MetisL2';
const ACTOR_ID = '61RPP7dywgiy0JPD0'; // quacker/twitter-scraper

async function runTest() {
    try {
        console.log(`\n🚀 Testing Actor ${ACTOR_ID} for @${TEST_HANDLE}...`);

        // 1. Start Run
        const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // "searchTerms": ["#Bitcoin"],
                "twitterHandles": [TEST_HANDLE],
                "maxItems": 5, // Small test
                "sort": "Latest",
                "tweetLanguage": "en"
            })
        });

        const runData = await runRes.json();
        console.log("Run Init Response:", JSON.stringify(runData, null, 2));

        if (!runData.data || !runData.data.id) {
            console.error("❌ Failed to start run.");
            return;
        }

        const runId = runData.data.id;
        console.log(`Run started: ${runId}. Waiting...`);

        // 2. Poll for completion
        let status = runData.data.status;
        let datasetId = runData.data.defaultDatasetId;

        while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED') {
            await new Promise(r => setTimeout(r, 2000));
            const check = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs/${runId}?token=${token}`).then(r => r.json());
            status = check.data.status;
            datasetId = check.data.defaultDatasetId;
            process.stdout.write(`[${status}] `);
        }

        console.log(`\nFinal Status: ${status}`);

        if (status === 'SUCCEEDED') {
            // 3. Fetch Data
            const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
            const items = await itemsRes.json();
            console.log(`\n✅ Success! Scraped ${items.length} tweets.`);
            if (items.length > 0) {
                console.log("Sample Tweet JSON:", JSON.stringify(items[0], null, 2));
                console.log("Sample Tweet:", items[0].full_text || items[0].text);
            }
        } else {
            console.error("❌ Run failed.");
            // Check log?
        }

    } catch (e) {
        console.error("❌ Test Exception:", e);
    }
}

runTest();
