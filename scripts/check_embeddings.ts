
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkEmbeddings() {
    console.log("Checking Embeddings for Metis...");
    const { data: countData, error: countError } = await supabase
        .from('brain_memory')
        .select('id', { count: 'exact' })
        .ilike('brand_id', 'Metis');

    if (countError) {
        console.error("Error counting:", countError);
        return;
    }
    console.log(`Total Metis Rows: ${countData.length} (Sample)`);

    // Check Nulls
    const { data: nulls, error: nullError } = await supabase
        .from('brain_memory')
        .select('id, content')
        .ilike('brand_id', 'Metis')
        .is('embedding', null)
        .limit(5);

    if (nullError) {
        console.error("Error checking nulls:", nullError);
        return;
    }

    if (nulls.length > 0) {
        console.log("⚠️ FOUND ROWS WITH MISSING EMBEDDINGS!");
        console.log(`Sample content: ${nulls[0].content}`);
    } else {
        console.log("✅ All checked rows have embeddings.");
    }
}

checkEmbeddings();
