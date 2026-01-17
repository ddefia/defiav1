import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

// CONFIG
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '../server/cache');
const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// BRANDS TO SYNC
const TARGET_BRANDS = {
    'metis': 'MetisL2',
    'lazai': 'LazAINetwork',
    'defia': 'DefiaLabs',
    'netswap': 'netswapofficial',
    'enki': 'ENKIProtocol'
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

async function backfillSafe() {
    console.log("🚀 Starting SAFE Deep Backfill Engine...");

    if (!supabase) {
        console.warn("⚠️  No Supabase credentials found. Aborting safe backfill.");
        return;
    }

    for (const [key, handle] of Object.entries(TARGET_BRANDS)) {
        console.log(`\n📥 Fetching history for: ${key} (@${handle})`);

        try {
            // 1. CALL APIFY (Twitter Scraper)
            const run = await fetch(`https://api.apify.com/v2/acts/61RPP7dywgiy0JPD0/runs?token=${APIFY_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    "twitterHandles": [handle],
                    "maxItems": 100,
                    "sort": "Latest",
                    "tweetLanguage": "en",
                    "author": handle,
                    "proxy": { "useApifyProxy": true }
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

            if (status === 'FAILED' || status === 'ABORTED') {
                console.error(`\n❌ Scrape failed for ${handle} (Status: ${status})`);
                continue;
            }

            // Fetch Items
            const items = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`).then(r => r.json());

            if (items.length > 0 && items[0].error && items[0].code === 'C017') {
                console.error(`\n❌ User not found: ${handle}.`);
                continue;
            }

            console.log(`\n   ✅ Retrieved ${items.length} tweets.`);

            // 2. CHECK & INSERT LOOP
            let inserted = 0;
            let skipped = 0;
            let errors = 0;

            for (const item of items) {
                const tweetId = item.id_str || item.id;

                // A. Check if exists using a metadata query
                // Note: performing one-by-one check is slower but safer for "don't mess up existing data"
                // We use 'contains' operator for JSONB to check if metadata has this external_id
                const { data: existing, error: searchError } = await supabase
                    .from('brain_memory')
                    .select('id')
                    .eq('brand_id', key)
                    .contains('metadata', { external_id: tweetId })
                    .limit(1);

                if (searchError) {
                    console.error(`   Search Check Error: ${searchError.message}`);
                    errors++;
                    continue;
                }

                if (existing && existing.length > 0) {
                    skipped++;
                    continue;
                }

                // B. Insert New
                const content = item.full_text || item.text || item.caption; // Try caption too (sometimes for pure media)

                if (!content) {
                    console.warn(`   ⚠️  Skipping item ${tweetId}: No text content found. Keys: ${Object.keys(item).join(', ')}`);
                    errors++;
                    continue;
                }

                const { error: insertError } = await supabase
                    .from('brain_memory')
                    .insert({
                        brand_id: key,
                        content: content,
                        memory_type: 'social_history', // Explicit type
                        metadata: {
                            external_id: tweetId,
                            author: item.user?.screen_name || handle,
                            date: item.created_at,
                            metrics: {
                                likes: item.favorite_count || 0,
                                retweets: item.retweet_count || 0,
                                replies: item.reply_count || 0,
                                views: item.view_count || 0,
                                media_urls: item.media ? item.media.map(m => m.media_url_https || m.url) : []
                            },
                            // Extract first image separately for convenience if needed, matching storage.ts logic
                            mediaUrl: (item.media && item.media.length > 0) ? (item.media[0].media_url_https || item.media[0].url) : null
                        }
                    });

                if (insertError) {
                    console.error(`   Insert Error (${tweetId}): ${insertError.message}`);
                    errors++;
                } else {
                    inserted++;
                }
            }

            console.log(`   > Summary for ${key}: +${inserted} new, ${skipped} existing, ${errors} errors.`);

        } catch (e) {
            console.error(`\n❌ Error processing ${key}:`, e);
        }
    }
    console.log("\n✨ Safe Backfill Complete.");
}

backfillSafe();
