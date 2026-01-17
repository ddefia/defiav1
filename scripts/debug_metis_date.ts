import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const supabaseKey = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetis2026() {
    console.log("Searching for 'Metis' tweets in 2026...");

    // Fetch most recent VALID tweets
    const { data, error } = await supabase
        .from('brain_memory')
        .select('*')
        .eq('brand_id', 'Metis')
        .not('content', 'ilike', '%MIGRATED LOG%')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No valid tweets found.");
        return;
    }

    console.log("Most recent tweet date:", data[0].metadata?.date || data[0].created_at);

    // Check if any are from 2026
    const has2026 = data.some(d => {
        const dateStr = d.metadata?.date || d.created_at;
        return dateStr.includes("2026");
    });

    console.log("Has 2026 data?", has2026);

    // Check 'metis' lowercase just in case
    const { count } = await supabase
        .from('brain_memory')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', 'metis')
        .not('content', 'ilike', '%MIGRATED LOG%');

    console.log("Count of lowercase 'metis' valid rows:", count);
}

checkMetis2026();
