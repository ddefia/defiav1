
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const run = async () => {
    console.log("Checking Dates for 'Netswap'...");

    // We expect 'Netswap' because fix_brand_map.ts set it.
    const { data } = await supabase
        .from('brain_memory')
        .select('brand_id, metadata')
        .eq('brand_id', 'Netswap');

    if (!data || data.length === 0) {
        console.log("No tweets found for 'Netswap'. Checking 'NetswapOfficial'...");
        const { data: data2 } = await supabase
            .from('brain_memory')
            .select('brand_id, metadata')
            .eq('brand_id', 'NetswapOfficial');

        if (data2 && data2.length > 0) {
            console.log(`Found ${data2.length} for 'NetswapOfficial' (Mapping issue?)`);
        } else {
            console.log("No tweets found for either ID.");
        }
        return;
    }

    console.log(`Found ${data.length} tweets for 'Netswap'.`);
    data.forEach(d => {
        console.log(`Date: ${d.metadata?.date}`);
    });
};
run();
