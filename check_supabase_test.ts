
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fwvqrdxgcugullcwkfiq.supabase.co'
const supabaseKey = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf'

const supabase = createClient(supabaseUrl, supabaseKey)

async function listCalendarKeys() {
    const { data, error } = await supabase
        .from('app_storage')
        .select('key, updated_at')
        .like('key', 'defia_calendar_%')

    if (error) {
        console.error("Query Failed:", error)
    } else {
        console.log("--- Found Calendar Data ---")
        if (data && data.length > 0) {
            data.forEach(d => console.log(`Key: ${d.key} | Last Update: ${d.updated_at}`))
        } else {
            console.log("No calendar data found for any brand yet.")
        }
        console.log("---------------------------")
    }
}

listCalendarKeys()
