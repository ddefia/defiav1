import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const supabaseKey = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function compareBrands() {
    const brands = ['Netswap', 'Metis', 'metis']; // Check lowercase Metis too

    for (const brand of brands) {
        console.log(`\n--- Checking Brand: '${brand}' ---`);
        const { data, error } = await supabase
            .from('brain_memory')
            .select('id, created_at, metadata, content')
            .eq('brand_id', brand)
            .not('content', 'ilike', '%MIGRATED LOG%')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error("Error:", error);
            continue;
        }

        console.log(`Found ${data?.length} rows.`);
        if (data && data.length > 0) {
            console.log("Top 3 items:");
            data.slice(0, 3).forEach(d => {
                const date = d.metadata?.date || d.created_at;
                console.log(`- Date: ${date} | Content: ${d.content?.substring(0, 30)}...`);
            });
        }
    }
}

compareBrands();
