
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

// CONFIG
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '../server/cache');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const TARGET_BRANDS = {
    'metis': 'MetisL2',
    'lazai': 'LazAINetwork',
    'defia': 'DefiaLabs',
    'netswap': 'netswapofficial',
    'enki': 'ENKIProtocol'
};

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase Credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function repair() {
    console.log("🛠️  Starting Memory Repair...");

    for (const [key, handle] of Object.entries(TARGET_BRANDS)) {
        console.log(`\n📂 Processing cache for: ${key}`);
        const cachePath = path.join(CACHE_DIR, `history_${key}.json`);

        if (!fs.existsSync(cachePath)) {
            console.warn(`   ⚠️  Cache not found for ${key}. Skipping.`);
            continue;
        }

        const items = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        console.log(`   > Loaded ${items.length} tweets from cache.`);

        const rows = items.map(item => {
            // FIX MEDIA EXTRACTION
            let mediaUrls = [];

            if (item.media && Array.isArray(item.media)) {
                // Check if string or object
                if (typeof item.media[0] === 'string') {
                    mediaUrls = item.media;
                } else {
                    // Fallback to object mapping if needed (though we found strings)
                    mediaUrls = item.media.map(m => m.media_url_https || m.url).filter(Boolean);
                }
            }

            return {
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
                    media_urls: mediaUrls
                }
            };
        });

        const { error } = await supabase
            .from('brand_memory')
            .upsert(rows, { onConflict: 'brand_id,external_id' });

        if (error) {
            console.error(`   ❌ Repair Failed:`, error.message);
        } else {
            console.log(`   ✅ Repaired ${rows.length} rows in Supabase.`);
        }
    }
    console.log("\n✨ Repair Complete.");
}

repair();
