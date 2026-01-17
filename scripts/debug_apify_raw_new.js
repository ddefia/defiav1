import 'dotenv/config';
import fetch from 'node-fetch';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN;

async function debugApify() {
    console.log("🔍 Debugging Apify Response for MetisL2...");

    if (!APIFY_TOKEN) {
        console.error("Missing Token");
        return;
    }

    // ACTOR: 61RPP7dywgiy0JPD0 (Current)
    const run = await fetch(`https://api.apify.com/v2/acts/61RPP7dywgiy0JPD0/runs?token=${APIFY_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "searchTerms": ["from:MetisL2"],
            "maxItems": 5,
            "sort": "Latest",
            "proxy": { "useApifyProxy": true }
        })
    }).then(r => r.json());

    console.log(`Run ID: ${run.data.id}`);

    // Poll
    let status = run.data.status;
    let datasetId = run.data.defaultDatasetId;
    while (status !== 'SUCCEEDED' && status !== 'FAILED') {
        await new Promise(r => setTimeout(r, 2000));
        const check = await fetch(`https://api.apify.com/v2/acts/61RPP7dywgiy0JPD0/runs/${run.data.id}?token=${APIFY_TOKEN}`).then(r => r.json());
        status = check.data.status;
        datasetId = check.data.defaultDatasetId;
        process.stdout.write('.');
    }

    console.log(`\nStatus: ${status}`);

    // Fetch Items
    const items = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`).then(r => r.json());

    console.log("\n--- RAW ITEMS (First 3) ---");
    console.log(JSON.stringify(items.slice(0, 3), null, 2));
}

debugApify();
