import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const supabaseKey = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetadata() {
    console.log("--- Checking Metadata Types ---");
    const brands = ['Netswap', 'Metis'];

    for (const brand of brands) {
        const { data } = await supabase
            .from('brain_memory')
            .select('metadata')
            .eq('brand_id', brand)
            .limit(1);

        if (data && data.length > 0) {
            const meta = data[0].metadata;
            console.log(`Brand: ${brand}`);
            console.log(`  Type of metadata: ${typeof meta}`);
            if (typeof meta === 'object') {
                console.log(`  Is Array? ${Array.isArray(meta)}`);
                console.log(`  Has date? ${meta?.date}`);
            } else {
                console.log(`  Value sample: ${String(meta).substring(0, 50)}`);
            }
        } else {
            console.log(`Brand: ${brand} - No Rows`);
        }
    }
}

checkMetadata();
