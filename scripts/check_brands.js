import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase Credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkBrands() {
    console.log("🔍 Checking Distinct Brand IDs in brain_memory...");

    // We can't do distinct easily with js client without rpc, so we fetch generic and set
    const { data, error } = await supabase
        .from('brain_memory')
        .select('brand_id')
        .limit(1000);

    if (error) {
        console.error("❌ Error fetching brands:", error.message);
    } else {
        const brands = [...new Set(data.map(d => d.brand_id))];
        console.log("Found Brand IDs:", brands);
    }
}

checkBrands();
