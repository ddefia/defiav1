
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Define minimal types to avoid full import issues
interface ReferenceImage {
    id: string;
    data?: string;
    url?: string;
    name: string;
}

interface BrandConfig {
    referenceImages: ReferenceImage[];
    [key: string]: any;
}

const STORAGE_KEY = 'ethergraph_brand_profiles_v17';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const run = async () => {
    console.log("🚀 Starting Image Migration...");

    // 1. Fetch Ingested Images
    // We only want rows with mediaUrl in metadata
    // We can't filter JSON b in Supabase easily without exact keys (or specific Postgres syntax), 
    // so let's fetch all social_history and filter locally.
    const { data: tweets, error } = await supabase
        .from('brain_memory')
        .select('brand_id, metadata')
        .contains('metadata', { type: 'social_history' })
        .limit(1000);

    if (error) {
        console.error("DB Error:", error);
        return;
    }

    if (!tweets || tweets.length === 0) {
        console.log("No tweets found.");
        return;
    }

    // Filter for images
    const imagesToMigrate = tweets.filter((t: any) => t.metadata?.mediaUrl);
    console.log(`Found ${imagesToMigrate.length} tweets with images.`);

    // 2. Fetch Current Brand Profiles from Cloud Storage
    const { data: storageData, error: storageError } = await supabase
        .from('app_storage')
        .select('value')
        .eq('key', STORAGE_KEY)
        .single();

    if (storageError) {
        console.error("Storage Fetch Error:", storageError);
        return;
    }

    const profiles: Record<string, BrandConfig> = storageData.value || {};
    let addedCount = 0;

    // 3. Merge Images
    for (const item of imagesToMigrate) {
        const brandName = item.brand_id; // e.g., 'ENKI Protocol', 'Netswap', etc.
        const url = item.metadata.mediaUrl;
        const date = item.metadata.date ? new Date(item.metadata.date).toISOString().split('T')[0] : 'undated';

        if (!profiles[brandName]) {
            console.warn(`Brand '${brandName}' not found in profiles. Skipping.`);
            continue;
        }

        const currentImages = profiles[brandName].referenceImages || [];

        // Duplicate Check (by URL)
        const exists = currentImages.some(img => img.url === url);

        if (!exists) {
            profiles[brandName].referenceImages.push({
                id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                url: url,
                name: `History: ${date}`
            });
            addedCount++;
        }
    }

    // 4. Save Back
    if (addedCount > 0) {
        const { error: saveError } = await supabase
            .from('app_storage')
            .update({
                value: profiles,
                updated_at: new Date().toISOString()
            })
            .eq('key', STORAGE_KEY);

        if (saveError) {
            console.error("Failed to save updates:", saveError);
        } else {
            console.log(`✅ Success! Added ${addedCount} new reference images.`);
        }
    } else {
        console.log("No new images to add (all duplicates or no targets).");
    }
};

run();
