
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

const BRAND_MAPPING = {
    'metis': { id: 'Metis', handle: 'MetisL2' },
    'lazai': { id: 'LazAI', handle: 'LazAINetwork' },
    'defia': { id: 'Defia', handle: 'DefiaLabs' },
    'netswap': { id: 'Netswap', handle: 'netswapofficial' },
    'enki': { id: 'ENKI Protocol', handle: 'ENKIProtocol' }
};

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase Credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function repair() {
    console.log("🛠️  Starting Memory Repair...");

    for (const [fileKey, config] of Object.entries(BRAND_MAPPING)) {
        console.log(`\n📂 Processing cache for: ${fileKey} (DB ID: ${config.id})`);
        const cachePath = path.join(CACHE_DIR, `history_${fileKey}.json`);

        if (!fs.existsSync(cachePath)) {
            console.warn(`   ⚠️  Cache not found for ${fileKey}. Skipping.`);
            continue;
        }

        const items = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        console.log(`   > Loaded ${items.length} tweets from cache.`);

        const rows = items.map(item => {
            // Mapping for Apify V2 JSON (camelCase)
            const mediaUrls = item.media ? item.media.map(m => m.media_url_https || m.url) : [];

            // Handle Defia edge case where createdAt might be missing or different
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
        }).filter(r => r.content.length > 0); // Filter empty rows

        // First purge existing tweets to avoid duplicates (optional but safer for "repair")
        // Check if we can identify them? Filtering is hard without unique key.
        // For now, simple insert.
        const { error } = await supabase
            .from('brain_memory')
            .insert(rows);

        if (error) {
            console.error(`   ❌ Repair Failed:`, error.message);
        } else {
            console.log(`   ✅ Repaired ${rows.length} rows in Supabase.`);
        }
    }
    console.log("\n✨ Repair Complete.");
}

repair();
