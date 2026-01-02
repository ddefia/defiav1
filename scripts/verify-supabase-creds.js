
import { createClient } from '@supabase/supabase-js';

const url = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const key = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';

console.log("Testing connection to:", url);
console.log("Key:", key);

try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('app_storage').select('*').limit(1);

    if (error) {
        console.error("Connection Error:", error.message);
    } else {
        console.log("Connection Success! Data:", data);
    }
} catch (e) {
    console.error("Crash:", e.message);
}
