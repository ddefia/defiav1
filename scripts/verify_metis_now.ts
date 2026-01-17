import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const supabaseKey = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyNow() {
    console.log("--- Verifying Metis Data Now ---");

    // 1. Check strict 'Metis'
    const { data, count, error } = await supabase
        .from('brain_memory')
        .select('*', { count: 'exact' })
        .eq('brand_id', 'Metis')
        .not('content', 'ilike', '%MIGRATED LOG%');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${count} VALID tweets under brand_id 'Metis'.`);
        if (data && data.length > 0) {
            console.log("Sample Tweet:");
            console.log(data[0].content?.substring(0, 100));
            console.log("Metadata Date:", data[0].metadata?.date);
        }
    }

    // 2. Check 'MetisL2' just in case
    const check2 = await supabase
        .from('brain_memory')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', 'MetisL2');
    console.log(`Rows under brand_id 'MetisL2': ${check2.count}`);
}

verifyNow();
