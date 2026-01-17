import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase Credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTweetCount() {
    console.log("🔍 Checking Brain Memory for Metis Tweets...");

    // Check raw count
    const { count, error } = await supabase
        .from('brain_memory')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', 'Metis');

    if (error) {
        console.error("❌ Error fetching count:", error.message);
    } else {
        console.log(`✅ Total Tweets in DB (brand_id='metis'): ${count}`);
    }

    // Check sample content
    const { data, error: dataError } = await supabase
        .from('brain_memory')
        .select('created_at, content, metadata')
        .eq('brand_id', 'Metis')
        .limit(5);

    if (data && data.length > 0) {
        console.log("\nSample Tweet:");
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log("\n⚠️ No tweets found in sample query.");
    }
}

checkTweetCount();
