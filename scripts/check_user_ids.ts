import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const supabaseKey = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserIds() {
    console.log("--- Checking User IDs ---");

    const brands = ['Netswap', 'Metis', 'Lazai'];

    for (const brand of brands) {
        // Try to select user_id. If column doesn't exist, it will error (handled).
        const { data, error } = await supabase
            .from('brain_memory')
            .select('brand_id, user_id, created_at')
            .eq('brand_id', brand)
            .limit(5);

        if (error) {
            console.error(`Error for ${brand}:`, error.message);
        } else {
            console.log(`Brand: ${brand}`);
            data.forEach((row, i) => {
                console.log(`  Row ${i}: user_id=${row.user_id}, created=${row.created_at}`);
            });
            if (data.length === 0) console.log("  No rows found via Anon Client.");
        }
    }
}

checkUserIds();
