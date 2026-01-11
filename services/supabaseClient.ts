import { createClient } from '@supabase/supabase-js';


const envUrl = process.env.VITE_SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL || '';
const envKey = process.env.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

let clientInstance: any = null;

export const getSupabase = () => {
    if (clientInstance) return clientInstance;

    // 1. Try Environment Variables
    let url = envUrl;
    let key = envKey;

    // 2. Try LocalStorage (UI Overrides) if client-side
    if ((!url || !key) && typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('defia_integrations_v1');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.supabaseUrl) url = parsed.supabaseUrl;
                if (parsed.supabaseKey) key = parsed.supabaseKey;
            }
        } catch (e) {
            console.warn("Failed to load Supabase keys from storage");
        }
    }

    if (url && key) {
        clientInstance = createClient(url, key);
        return clientInstance;
    }

    // Return dummy client if no keys (prevents crashes, logs warning on use)
    return {
        from: () => ({
            select: () => ({ maybeSingle: async () => ({ data: null, error: { message: "No Supabase Credentials" } }) }),
            upsert: async () => ({ error: { message: "No Supabase Credentials" } })
        })
    };
};

// Legacy export compatibility
export const supabase = getSupabase();

