
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Define types
interface ReferenceImage {
    id: string;
    data?: string;
    url?: string;
    name: string;
}

interface BrandConfig {
    referenceImages: ReferenceImage[];
    graphicTemplates?: { id: string; label: string; prompt: string }[];
    [key: string]: any;
}

const STORAGE_KEY = 'ethergraph_brand_profiles_v17';
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

// Simple keyword mapping helper
const getCategoryFromText = (text: string, templates: string[]): string | null => {
    const lower = text.toLowerCase();

    // 1. Check Custom Templates first
    for (const t of templates) {
        if (lower.includes(t.toLowerCase())) return t;
    }

    // 2. Standard Heuristics
    if (lower.includes('partner') || lower.includes('collab') || lower.includes('alliance')) return 'Partnership';
    if (lower.includes('giveaway') || lower.includes('win') || lower.includes('prize') || lower.includes('airdrop') || lower.includes('gleam')) return 'Giveaway';
    if (lower.includes('event') || lower.includes('space') || lower.includes('live') || lower.includes('ama') || lower.includes('meetup')) return 'Event';
    if (lower.includes('launch') || lower.includes('live now') || lower.includes('introducing') || lower.includes('new')) return 'Launch';
    if (lower.includes('thread') || lower.includes('👇')) return 'Educational';

    return null;
};

const run = async () => {
    console.log("🚀 Starting Text-Based Image Classification...");

    // 1. Fetch Brain Memory (Tweets with images)
    const { data: tweets, error } = await supabase
        .from('brain_memory')
        .select('brand_id, content, metadata')
        .contains('metadata', { type: 'social_history' })
        .not('metadata->mediaUrl', 'is', null);

    if (error || !tweets) {
        console.error("DB Error fetching tweets:", error);
        return;
    }

    // Map URL -> Content
    const urlToText: Record<string, string> = {};
    tweets.forEach((t: any) => {
        if (t.metadata?.mediaUrl) {
            urlToText[t.metadata.mediaUrl] = t.content || '';
        }
    });

    console.log(`Loaded ${Object.keys(urlToText).length} mapping contexts from history.`);

    // 2. Fetch Storage
    const { data: storageData, error: storageError } = await supabase
        .from('app_storage')
        .select('value')
        .eq('key', STORAGE_KEY)
        .single();

    if (storageError) {
        console.error("Storage Error:", storageError);
        return;
    }

    const profiles: Record<string, BrandConfig> = storageData.value || {};
    let updatedCount = 0;

    // 3. Classify
    for (const brandName of Object.keys(profiles)) {
        const config = profiles[brandName];
        if (!config.referenceImages) continue;

        const templates = (config.graphicTemplates || []).map(t => t.label);

        config.referenceImages = config.referenceImages.map(img => {
            // Only process unclassified History items
            if (img.name.startsWith('History:') && !img.name.includes('[')) {
                const text = urlToText[img.url || ''];
                if (text) {
                    const category = getCategoryFromText(text, templates);
                    if (category) {
                        updatedCount++;
                        return { ...img, name: `[${category}] ${img.name.replace('History: ', '')}` };
                    }
                }
            }
            return img;
        });
    }

    // 4. Save
    if (updatedCount > 0) {
        const { error: saveError } = await supabase
            .from('app_storage')
            .update({ value: profiles, updated_at: new Date().toISOString() })
            .eq('key', STORAGE_KEY);

        if (saveError) console.error("Save failed", saveError);
        else console.log(`✅ Classified ${updatedCount} images using tweet text!`);
    } else {
        console.log("No images matched any categories.");
    }
};

run();
