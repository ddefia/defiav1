
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase Env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const run = async () => {
    console.log("🔍 Checking brain_memory connectivity...");
    console.log("URL:", supabaseUrl);

    // 1. Count All
    const { count, error: cErr } = await supabase
        .from('brain_memory')
        .select('*', { count: 'exact', head: true });

    if (cErr) console.error("Count Error:", cErr);
    else console.log("Total Rows in brain_memory:", count);

    // 2. Fetch Sample
    const { data: rows, error: rErr } = await supabase
        .from('brain_memory')
        .select('id, brand_id, content, metadata')
        .limit(5);

    if (rErr) console.error("Fetch Error:", rErr);
    else {
        console.log("--- First 5 Rows ---");
        console.log(JSON.stringify(rows, null, 2));
    }
};

run();
