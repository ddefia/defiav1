import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase Credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkBrandsDetailed() {
    const brandsToCheck = ['Metis', 'metis'];

    for (const bid of brandsToCheck) {
        console.log(`\n🔍 Checking brand_id: '${bid}'`);

        // Count
        const { count, error } = await supabase
            .from('brain_memory')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', bid);

        if (error) console.error("Error:", error.message);
        else console.log(`   Count: ${count}`);

        if (count > 0) {
            // Fetch sample to check filter compatibility
            const { data } = await supabase
                .from('brain_memory')
                .select('content, metadata')
                .eq('brand_id', bid)
                .limit(3);

            data.forEach((row, i) => {
                const isSocial = row.metadata?.type === 'social_history';
                const isTweet = (row.content || "").toString().startsWith('Tweet by');
                console.log(`   [Row ${i}] Social: ${isSocial}, TweetPrefix: ${isTweet}`);
                console.log(`       Content: ${row.content?.substring(0, 50)}...`);
                console.log(`       Metadata:`, JSON.stringify(row.metadata));
            });
        }
    }
}

checkBrandsDetailed();
