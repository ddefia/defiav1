import { createClient } from '@supabase/supabase-js';

// Hardcoded for debugging (from check_supabase_test.ts)
const supabaseUrl = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const supabaseKey = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetis() {
    console.log("Searching for valid tweets for 'Metis' (filtering logs)...");

    const { data, error } = await supabase
        .from('brain_memory')
        .select('*')
        .eq('brand_id', 'Metis')
        .not('content', 'ilike', '%MIGRATED LOG%')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${data?.length} VALID rows.`);

    if (data && data.length > 0) {
        data.forEach((row, i) => {
            console.log(`\n--- Row ${i} ---`);
            console.log("ID:", row.id);
            console.log("Content:", row.content?.substring(0, 100));
            console.log("Date:", row.metadata?.date || row.created_at);
            console.log("Metadata:", JSON.stringify(row.metadata, null, 2));
        });
    } else {
        console.log("No valid tweets found after filtering.");
    }
}

checkMetis();
