
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const ACTOR_TWEETS = '61RPP7dywgiy0JPD0';
const TOKEN = process.env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;

async function debugApify() {
    if (!TOKEN) {
        console.error("No API Token found in .env");
        return;
    }

    console.log(`Using Token: ${TOKEN.slice(0, 5)}...`);

    const input = {
        "twitterHandles": ["enkiprotocol"],
        "maxItems": 2,
        "sort": "Latest",
        "tweetLanguage": "en",
        "author": "enkiprotocol",
        "proxy": { "useApifyProxy": true }
    };

    try {
        console.log("Starting Apify Actor Run...");
        const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_TWEETS}/runs?token=${TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });

        const runData = await runRes.json();
        const runId = runData.data.id;
        const datasetId = runData.data.defaultDatasetId;
        console.log(`Run ID: ${runId}, Dataset ID: ${datasetId}`);

        // Poll for completion
        let status = 'RUNNING';
        while (status === 'RUNNING' || status === 'READY') {
            await new Promise(r => setTimeout(r, 5000));
            const statusRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_TWEETS}/runs/${runId}?token=${TOKEN}`);
            const statusData = await statusRes.json();
            status = statusData.data.status;
            console.log(`Status: ${status}`);
        }

        if (status === 'SUCCEEDED') {
            const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${TOKEN}`);
            const items = await itemsRes.json();

            const item = items[0];
            if (!item) { console.log("No items returned"); return; }

            // Write to file to check structure
            fs.writeFileSync('debug_output.json', JSON.stringify(item, null, 2));
            console.log("Dumped full item to debug_output.json");

        } else {
            console.error("Run failed:", status);
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

debugApify();
