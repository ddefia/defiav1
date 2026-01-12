
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // OR SECRET ROLE IF NEEDED FOR UPDATE? With RLS, Anon might fail.
// I should use generic key if possible. But usually RLS allows update own?
// Assuming Anon has access or RLS is permissive (policy "Public Access").

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase Env", process.env.VITE_SUPABASE_URL);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BRAND_MAP: Record<string, string> = {
    'EnkiProtocol': 'ENKI Protocol',
    'NetswapOfficial': 'Netswap',
    'MetisL2': 'Metis',
    'LazAINetwork': 'LazAI',
    // Fallbacks
    'LazaNetwork': 'LazAI'
};

const run = async () => {
    console.log("🔧 Fixing brand_ids...");

    // 1. Fetch rows with null brand_id
    const { data: rows, error } = await supabase
        .from('brain_memory')
        .select('id, metadata')
        .is('brand_id', null);

    if (error) {
        console.error("Fetch failed", error);
        return;
    }

    if (!rows || rows.length === 0) {
        console.log("No rows to fix.");
        return;
    }

    console.log(`Found ${rows.length} rows to fix.`);

    for (const row of rows) {
        const handle = row.metadata?.handle;
        if (handle) {
            const correctBrandId = BRAND_MAP[handle];
            if (correctBrandId) {
                // Update
                const { error: uErr } = await supabase
                    .from('brain_memory')
                    .update({ brand_id: correctBrandId })
                    .eq('id', row.id);

                if (uErr) {
                    console.error(`Failed to update ${row.id} (${handle} -> ${correctBrandId})`, uErr.message);
                } else {
                    console.log(`✅ Fixed ${row.id}: ${handle} -> ${correctBrandId}`);
                }
            } else {
                console.warn(`No mapping for handle: ${handle}`);
            }
        }
    }
};

run();
