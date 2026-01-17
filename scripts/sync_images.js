
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// CONFIG
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const STORAGE_KEY = 'ethergraph_brand_profiles_v17';

// MAPPING: brand_memory.brand_id -> BrandConfig Key
const BRAND_MAPPING = {
    'metis': 'Metis',
    'lazai': 'LazAI',
    'defia': 'Defia',
    'netswap': 'Netswap',
    'enki': 'ENKI Protocol'
};

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase Credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncImages() {
    console.log("🚀 Starting Persistent Image Sync Service...");

    // 1. Load Current Brand Config from App Storage
    console.log("📥 Loading Brand Profiles from Cloud...");
    const { data: storageData, error: storageError } = await supabase
        .from('app_storage')
        .select('value')
        .eq('key', STORAGE_KEY)
        .single();

    if (storageError || !storageData) {
        console.error("❌ Failed to load brand profiles:", storageError?.message);
        process.exit(1);
    }

    const profiles = storageData.value;
    let totalAdded = 0;

    // 2. Iterate Brands
    for (const [dbId, configKey] of Object.entries(BRAND_MAPPING)) {
        console.log(`\n🔍 Scanning images for: ${configKey} (DB: ${dbId})`);

        const config = profiles[configKey];
        if (!config) {
            console.warn(`   ⚠️  Brand '${configKey}' not found in profiles. Skipping.`);
            continue;
        }

        // 3. Fetch Tweets with Media
        const { data: tweets, error: tweetsError } = await supabase
            .from('brand_memory')
            .select('external_id, created_at, metrics, content')
            .eq('brand_id', dbId)
            // Filter where metrics->media_urls is not empty
            .limit(200);

        if (tweetsError) {
            console.error(`   ❌ Failed to fetch tweets:`, tweetsError.message);
            continue;
        }

        const existingImages = config.referenceImages || [];
        let brandAddedCount = 0;

        for (const tweet of tweets) {
            const mediaUrls = tweet.metrics?.media_urls || [];
            if (!mediaUrls || mediaUrls.length === 0) continue;

            for (let i = 0; i < mediaUrls.length; i++) {
                const sourceUrl = mediaUrls[i];
                // Debug log
                if (!sourceUrl || typeof sourceUrl !== 'string') {
                    console.log(`     ⚠️  Skipping invalid URL at index ${i}:`, sourceUrl);
                    continue;
                }

                const imageId = `tweet-${tweet.external_id}-${i}`;

                // Check if already exists (by ID)
                const exists = existingImages.some(img => img.id === imageId);
                // We don't check via URL match anymore because the new URL will be Supabase hosted
                if (exists) continue;

                try {
                    console.log(`     ⬇️  Downloading: ${sourceUrl.substring(0, 40)}...`);

                    // A. Download from Twitter
                    const response = await fetch(sourceUrl);
                    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    // B. Upload to Supabase Storage
                    // Sanitize brand name for folder usage
                    const cleanBrand = configKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    const fileName = `${cleanBrand}/${imageId}.jpg`; // Assuming JPG for simplicity, or extract extension

                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('brand-assets')
                        .upload(fileName, buffer, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });

                    if (uploadError) {
                        // RLS Policy might prevent overwrite (UPDATE), but the file likely exists from a previous run.
                        // We proceed to link it.
                        console.warn(`     ⚠️  Upload notice for ${imageId}: ${uploadError.message} (Using existing)`);
                    }

                    // C. Get Public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('brand-assets')
                        .getPublicUrl(fileName);

                    // D. Add to Brand Kit
                    const newRefImage = {
                        id: imageId,
                        url: publicUrl,
                        name: `Tweet ${new Date(tweet.created_at).toISOString().split('T')[0]}`,
                        // data: "" // No base64 needed
                    };

                    existingImages.unshift(newRefImage); // Add to top
                    brandAddedCount++;

                } catch (e) {
                    console.error(`     ❌ Failed to process image ${imageId}:`, e.message);
                }
            }
        }

        if (brandAddedCount > 0) {
            console.log(`   ✅ Synced ${brandAddedCount} images to Supabase Storage.`);
            config.referenceImages = existingImages;
            profiles[configKey] = config; // Update object
            totalAdded += brandAddedCount;
        } else {
            console.log(`   • No new images found.`);
        }
    }

    // 4. Save Back
    if (totalAdded > 0) {
        console.log(`\n💾 Saving updated profiles to Cloud...`);
        // Debug: Check count before save
        for (const [key, profile] of Object.entries(profiles)) {
            if (BRAND_MAPPING[key.toLowerCase()] || Object.keys(BRAND_MAPPING).includes(key.toLowerCase())) { // Loose match
                console.log(`   -> ${key}: ${profile.referenceImages?.length || 0} images in payload.`);
            }
        }

        const { error: saveError } = await supabase
            .from('app_storage')
            .update({
                value: profiles,
                updated_at: new Date().toISOString()
            })
            .eq('key', STORAGE_KEY);

        if (saveError) {
            console.error("❌ Failed to save updates:", saveError.message);
        } else {
            console.log("✨ Sync Complete! Images are now persistently hosted in Supabase.");
        }
    } else {
        console.log("\n✨ Sync Complete. No updates needed.");
    }
}

syncImages();
