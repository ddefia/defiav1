import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'ethergraph_brand_profiles_v17';
const AUTOMATION_STORAGE_KEY = 'defia_automation_settings_v1';

export const getSupabaseClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
};

export const fetchBrandProfile = async (supabase, brandId) => {
    try {
        const { data, error } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', STORAGE_KEY)
            .maybeSingle();

        if (error || !data) return null;

        const allProfiles = data.value;
        const key = Object.keys(allProfiles).find(k => k.toLowerCase() === brandId.toLowerCase());
        return key ? allProfiles[key] : null;
    } catch (e) {
        console.error("Failed to load brand profiles from DB", e);
        return null;
    }
};

export const fetchAutomationSettings = async (supabase, brandId) => {
    try {
        const key = `${AUTOMATION_STORAGE_KEY}_${brandId.toLowerCase()}`;
        const { data, error } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', key)
            .maybeSingle();

        if (error || !data?.value) {
            return { enabled: true };
        }

        return { enabled: data.value.enabled !== false };
    } catch (e) {
        console.warn("Failed to load automation settings from DB", e);
        return { enabled: true };
    }
};
