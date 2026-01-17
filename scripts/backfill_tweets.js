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

// BRANDS TO SYNC (Use validated IDs)
const BRAND_MAPPING = {
    'metis': { id: 'Metis', handle: 'MetisL2' },
    'lazai': { id: 'LazAI', handle: 'LazAINetwork' },
    'defia': { id: 'Defia', handle: 'DefiaLabs' },
    'netswap': { id: 'Netswap', handle: 'netswapofficial' },
    'enki': { id: 'ENKI Protocol', handle: 'ENKIProtocol' }
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
    console.log("🚀 Starting Deep Backfill Engine (Fresh Fetch)...");

    if (!supabase) console.warn("⚠️  No Supabase credentials found. Saving to JSON only.");

    // for (const [fileKey, config] of Object.entries(BRAND_MAPPING)) {
    const fileKey = 'metis';
    const config = BRAND_MAPPING['metis'];
    {
        console.log(`\n📥 Fetching history for: ${fileKey} (@${config.handle}) -> DB ID: ${config.id}`);

        try {
            // 1. CALL APIFY (Twitter Scraper)
            console.log("   > Contacting Apify...");
            const run = await fetch(`https://api.apify.com/v2/acts/61RPP7dywgiy0JPD0/runs?token=${APIFY_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    "searchTerms": [`from:${config.handle}`],
                    "maxItems": 20, // Lower fetch for test
                    "sort": "Latest",
                    "tweetLanguage": "en",
                    // "author": config.handle,
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
                console.error(`\n❌ Scrape failed for ${config.handle} (Status: ${status})`);
                return; // Was continue
            }

            // Fetch Items
            const items = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`).then(r => r.json());

            // Check for "User not found" error
            if (items.length > 0 && items[0].error && items[0].code === 'C017') {
                console.error(`\n❌ User not found: ${config.handle}. Please verify the handle.`);
                return; // Was continue
            }

            console.log(`\n   ✅ Retrieved ${items.length} tweets.`);

            // 2. SAVE TO CACHE (JSON)
            const cachePath = path.join(CACHE_DIR, `history_${fileKey}.json`);
            fs.writeFileSync(cachePath, JSON.stringify(items, null, 2));
            console.log(`   > Saved backup to ${cachePath}`);

            // 3. PUSH TO SUPABASE
            if (supabase) {
                const rows = items.map(item => {
                    // Mapping for Apify V2 JSON (camelCase)
                    const mediaUrls = item.media ? item.media.map(m => m.media_url_https || m.url) : [];
                    const createdAt = item.createdAt || item.created_at || new Date().toISOString();
                    const content = item.fullText || item.text || item.content || "";

                    return {
                        // id: Let DB generate UUID
                        brand_id: config.id, // Use Proper Case ID
                        memory_type: 'tweet',
                        content: content,
                        created_at: createdAt,
                        metadata: {
                            external_id: item.id || item.id_str,
                            platform: 'twitter',
                            author: item.author?.userName || item.author?.name || config.handle,
                            metrics: {
                                likes: item.likeCount || item.favorite_count || 0,
                                retweets: item.retweetCount || item.retweet_count || 0,
                                replies: item.replyCount || item.reply_count || 0,
                                views: item.viewCount || item.view_count || 0,
                                media_urls: mediaUrls
                            },
                            mediaUrl: mediaUrls[0], // For storage.ts compatibility
                            date: createdAt
                        }
                    };
                }).filter(r => r.content.length > 0);

                // Insert into 'brain_memory' (not 'brand_memory')
                const { error } = await supabase
                    .from('brain_memory')
                    .insert(rows);

                if (error) {
                    console.error(`   ❌ DB Insert Error:`, error.message);
                } else {
                    console.log(`   > Synced ${rows.length} rows to 'brain_memory' table.`);
                }
            }

        } catch (e) {
            console.error(`\n❌ Error processing ${fileKey}:`, e);
        }
    }
    console.log("\n✨ Backfill Complete.");
}

backfill();
