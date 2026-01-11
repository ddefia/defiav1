import 'dotenv/config';
// import fetch from 'node-fetch'; // Built-in fetch used

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

// CONFIG
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '../server/cache');
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// BRANDS TO SYNC
const TARGET_BRANDS = {
    'metis': 'MetisL2',
    'lazai': 'LazAI_Official',
    'defia': 'DefiaLabs'
};

// INIT SUPABASE
const supabase = (SUPABASE_URL && SUPABASE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

if (!APIFY_TOKEN) {
    console.error("❌ Missing APIFY_API_TOKEN in .env");
    process.exit(1);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function backfill() {
    console.log("🚀 Starting Deep Backfill Engine...");

    if (!supabase) console.warn("⚠️  No Supabase credentials found. Saving to JSON only.");

    for (const [key, handle] of Object.entries(TARGET_BRANDS)) {
        console.log(`\n📥 Fetching history for: ${key} (@${handle})`);

        try {
            // 1. CALL APIFY (Twitter Scraper)
            const run = await fetch(`https://api.apify.com/v2/acts/61RPP7dywgiy0JPD0/runs?token=${APIFY_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    "searchTerms": [`from:${handle}`],
                    "maxItems": 100, // Start with 100 to save credits, user can increase
                    "sort": "Latest",
                    "tweetLanguage": "en"
                })
            }).then(r => r.json());

            console.log(`   > Scraper Run ID: ${run.data.id} (Status: ${run.data.status})`);

            // Wait for finish
            let status = run.data.status;
            let datasetId = run.data.defaultDatasetId;

            while (status !== 'SUCCEEDED' && status !== 'FAILED') {
                await sleep(5000);
                const check = await fetch(`https://api.apify.com/v2/acts/61RPP7dywgiy0JPD0/runs/${run.data.id}?token=${APIFY_TOKEN}`).then(r => r.json());
                status = check.data.status;
                datasetId = check.data.defaultDatasetId;
                process.stdout.write('.');
            }

            if (status === 'FAILED') {
                console.error(`\n❌ Scrape failed for ${handle}`);
                continue;
            }

            // Fetch Items
            const items = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`).then(r => r.json());
            console.log(`\n   ✅ Retrieved ${items.length} tweets.`);

            // 2. SAVE TO CACHE (JSON)
            const cachePath = path.join(CACHE_DIR, `history_${key}.json`);
            fs.writeFileSync(cachePath, JSON.stringify(items, null, 2));
            console.log(`   > Saved backup to ${cachePath}`);

            // 3. PUSH TO SUPABASE
            if (supabase) {
                const rows = items.map(item => ({
                    brand_id: key,
                    platform: 'twitter',
                    external_id: item.id_str || item.id,
                    content: item.full_text || item.text,
                    author: item.user?.screen_name || handle,
                    created_at: item.created_at,
                    metrics: {
                        likes: item.favorite_count || 0,
                        retweets: item.retweet_count || 0,
                        replies: item.reply_count || 0,
                        views: item.view_count || 0,
                        media_urls: item.media ? item.media.map(m => m.media_url_https || m.url) : [] // Capture Images
                    }
                }));

                const { error } = await supabase
                    .from('brand_memory')
                    .upsert(rows, { onConflict: 'brand_id,external_id' });

                if (error) {
                    console.error(`   ❌ DB Insert Error:`, error.message);
                } else {
                    console.log(`   > Synced ${rows.length} rows to 'brand_memory' table.`);
                }
            }

        } catch (e) {
            console.error(`\n❌ Error processing ${key}:`, e);
        }
    }
    console.log("\n✨ Backfill Complete.");
}

backfill();
