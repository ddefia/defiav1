
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';
const STORAGE_KEY = 'ethergraph_brand_profiles_v17';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const NEW_TEMPLATES = [
    {
        id: 'tmpl-metis-1',
        label: 'Tech Announcement',
        prompt: 'A futuristic, high-tech announcement graphic using Metis Cyan (#00D2FF) and Black. Geometric shapes, circuit board patterns, and a central focal point for text. Professional and clean.',
        referenceImageIds: [] // Will default to random 5
    },
    {
        id: 'tmpl-metis-2',
        label: 'Ecosystem Update',
        prompt: 'A grid-style layout showcasing multiple elements or logos. Connected nodes, network visualization. Dark mode background with glowing neon accents. Represents growth and connectivity.',
        referenceImageIds: []
    },
    {
        id: 'tmpl-metis-3',
        label: 'Community/Culture',
        prompt: 'A vibrant, energetic visual style. Less rigid, more organic shapes. Uses the Metis Cyan glow but with more artistic flair. Suitable for community calls or soft updates.',
        referenceImageIds: []
    }
];

async function addTemplates() {
    console.log("Fetching current profiles...");
    const { data, error } = await supabase
        .from('app_storage')
        .select('*')
        .eq('key', STORAGE_KEY)
        .single();

    if (error) {
        console.error("Error fetching storage:", error);
        return;
    }

    const profiles = data.value;
    if (!profiles['Metis']) {
        console.error("Metis profile not found in storage!");
        return;
    }

    console.log("Current Metis Templates:", profiles['Metis'].graphicTemplates || "None");

    // Add Templates
    profiles['Metis'].graphicTemplates = NEW_TEMPLATES;

    // Save back
    console.log("Saving new templates...");
    const { error: saveError } = await supabase
        .from('app_storage')
        .update({
            value: profiles,
            updated_at: new Date().toISOString()
        })
        .eq('key', STORAGE_KEY);

    if (saveError) {
        console.error("Error saving:", saveError);
    } else {
        console.log("Success! Templates added to Metis.");
    }
}

addTemplates();
