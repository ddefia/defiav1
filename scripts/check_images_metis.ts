
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf'; // Hardcoded for script
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkImages() {
    console.log("Checking Metis Images...");
    const { data, error } = await supabase
        .from('brain_memory')
        .select('*')
        .ilike('brand_id', 'Metis')
        .limit(20);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${data.length} items.`);
    data.forEach((item, idx) => {
        console.log(`Item ${idx}: content-start="${item.content?.substring(0, 20)}..."`);
        console.log(`   metadata:`, item.metadata);
        if (item.metadata?.mediaUrl) {
            console.log(`   MEDIA FOUND: ${item.metadata.mediaUrl}`);
        } else {
            console.log(`   NO MEDIA.`);
        }
    });
}

checkImages();
