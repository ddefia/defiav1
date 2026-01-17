import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const supabaseKey = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNullContent() {
    console.log("Checking for 'Metis' rows with null content...");

    // Fetch all Metis data
    const { data, error } = await supabase
        .from('brain_memory')
        .select('*')
        .eq('brand_id', 'Metis')
        .not('content', 'ilike', '%MIGRATED LOG%')
        .limit(1000);

    if (error) {
        console.error("Error:", error);
        return;
    }

    const crashCandidates = data.filter(d => {
        // Condition for crash: type is social (so it passes filter) BUT content is falsy
        const isSocial = d.metadata?.type === 'social_history';
        const hasNoContent = !d.content;
        return isSocial && hasNoContent;
    });

    if (crashCandidates.length > 0) {
        console.error("CRITICAL: Found entries that will crash the app!");
        crashCandidates.forEach(c => {
            console.log(`ID: ${c.id}, Type: ${c.metadata?.type}, Content: ${c.content}`);
        });
    } else {
        console.log("No crash candidates found. All social entries have content.");
    }
}

checkNullContent();
