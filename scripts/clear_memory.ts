
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const run = async () => {
    console.log("Clearing social history...");
    const { error, count } = await supabase
        .from('brain_memory')
        .delete({ count: 'exact' })
        .eq('memory_type', 'Twitter/@EnkiProtocol')
        .or('memory_type.eq.Twitter/@NetswapOfficial,memory_type.eq.Twitter/@MetisL2,memory_type.eq.Twitter/@LazAINetwork');

    // Actually simpler: check metadata->type logic or just wipe keys we know.
    // Let's iterate the 4 handles.

    // Better: delete where brand_id in list
    const brands = ['ENKI Protocol', 'Netswap', 'Metis', 'LazAI'];
    for (const b of brands) {
        const { error } = await supabase.from('brain_memory').delete().eq('brand_id', b);
        if (error) console.error(error);
        else console.log(`Cleared ${b}`);
    }
};
run();
