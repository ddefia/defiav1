
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const run = async () => {
    console.log("Checking Dates for 'Metis'...");

    const { data: dataMetis } = await supabase
        .from('brain_memory')
        .select('brand_id, metadata, content')
        .eq('brand_id', 'Metis');

    if (dataMetis && dataMetis.length > 0) {
        console.log(`Found ${dataMetis.length} tweets for 'Metis'.`);
        dataMetis.slice(0, 10).forEach(d => {
            const hasMedia = d.metadata?.mediaUrl ? 'No' : 'No';
            const mediaPreview = d.metadata?.mediaUrl ? `(IMG: ${d.metadata.mediaUrl.substring(0, 20)}...)` : 'No Image';
            console.log(`[Metis] Date: ${d.metadata?.date} | Media: ${mediaPreview}`);
        });
    } else {
        console.log("No tweets for 'Metis'. Checking 'MetisL2'...");
        const { data: dataMetisL2 } = await supabase
            .from('brain_memory')
            .select('brand_id, metadata')
            .eq('brand_id', 'MetisL2');

        if (dataMetisL2 && dataMetisL2.length > 0) {
            console.log(`Found ${dataMetisL2.length} for 'MetisL2'. Needs fix.`);
        } else {
            console.log("No tweets found for Metis or MetisL2.");
        }
    }
};
run();
