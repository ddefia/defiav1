
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fwvqrdxgcugullcwkfiq.supabase.co'
const supabaseKey = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf'

const supabase = createClient(supabaseUrl, supabaseKey)

async function listKeys() {
    const { data, error } = await supabase.from('app_storage').select('key')

    if (error) {
        console.error("Query Failed:", error)
    } else {
        console.log("Found keys:", data?.map(d => d.key))
    }
}

listKeys()
