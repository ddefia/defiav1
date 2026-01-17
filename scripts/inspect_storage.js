
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const STORAGE_KEY = 'ethergraph_brand_profiles_v17';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
    console.log("🔍 Inspecting Cloud Storage...");

    const { data, error } = await supabase
        .from('app_storage')
        .select('value')
        .eq('key', STORAGE_KEY)
        .single();

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    const profiles = data.value;
    const metis = profiles['Metis'];

    console.log("Metis Config Found:", !!metis);
    if (metis) {
        console.log("Reference Images Count:", metis.referenceImages?.length || 0);
        if (metis.referenceImages?.length > 0) {
            console.log("First 5 Images:");
            console.log(JSON.stringify(metis.referenceImages.slice(0, 5), null, 2));
        }
    }
}

inspect();
