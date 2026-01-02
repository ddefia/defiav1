
import { createClient } from '@supabase/supabase-js';

const url = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const key = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';

const supabase = createClient(url, key);

async function checkBuckets() {
    console.log("Checking Storage Buckets...");
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error("List Error:", error.message);
    } else {
        console.log("Buckets found:", data.map(b => b.name));
        const assets = data.find(b => b.name === 'brand-assets');
        if (assets) {
            console.log("✅ 'brand-assets' bucket exists!");
        } else {
            console.log("❌ 'brand-assets' bucket MISSING.");
        }
    }
}

checkBuckets();
