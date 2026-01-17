import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTables() {
    console.log("Checking DB Tables...");

    // 1. Check brain_memory (Expected Main Table)
    const { count: brainCount, error: brainError } = await supabase
        .from('brain_memory')
        .select('*', { count: 'exact', head: true });

    if (brainError) console.log("❌ brain_memory: Error/Missing (" + brainError.message + ")");
    else console.log(`✅ brain_memory: ${brainCount} rows`);

    // 2. Check brand_memory (Possible Typo Table)
    const { count: brandCount, error: brandError } = await supabase
        .from('brand_memory')
        .select('*', { count: 'exact', head: true });

    if (brandError) console.log("❌ brand_memory: Error/Missing (" + brandError.message + ")");
    else console.log(`⚠️ brand_memory: ${brandCount} rows (Exist!)`);

}

checkTables();
