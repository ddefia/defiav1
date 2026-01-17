import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const supabaseKey = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHandleId() {
    const idsToCheck = ['MetisL2', '@MetisL2', 'metisl2'];
    console.log(`Checking brand_ids: ${idsToCheck.join(', ')}...`);

    for (const id of idsToCheck) {
        const { count, error } = await supabase
            .from('brain_memory')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', id);

        if (error) console.error(`Error checking ${id}:`, error.message);
        else console.log(`Rows for '${id}': ${count}`);
    }
}

checkHandleId();
