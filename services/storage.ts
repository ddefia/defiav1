import { BrandConfig, PulseCache, CalendarEvent } from "../types";
import { DEFAULT_PROFILES } from './brandData';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'ethergraph_brand_profiles_v16';
const PULSE_STORAGE_PREFIX = 'defia_pulse_cache_v1_';
const CALENDAR_STORAGE_KEY = 'defia_calendar_events_v1';
const KEYS_STORAGE_KEY = 'defia_integrations_v1';

// --- HELPER: App Storage Table Interaction ---

const fetchFromCloud = async (key: string): Promise<any | null> => {
    try {
        const { data, error } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', key)
            .maybeSingle();

        if (error) {
            if (error.code !== 'PGRST116') { // Ignore "Row not found"
                console.warn(`Supabase fetch error for ${key}:`, error.message);
            }
            return null;
        }
        return data?.value || null;
    } catch (e) {
        console.error("Cloud fetch failed:", e);
        return null;
    }
};

const saveToCloud = async (key: string, value: any) => {
    try {
        const { error } = await supabase
            .from('app_storage')
            .upsert({ key, value, updated_at: new Date().toISOString() });

        if (error) console.error(`Supabase save error for ${key}:`, error.message);
    } catch (e) {
        console.error("Cloud save failed:", e);
    }
};

// --- BRAND PROFILES ---

// NOTE: We keep the synchronous signature for initial render compatibility, 
// but we quietly sync with cloud in the background and update localStorage.
// A full refactor to async hooks would be better, but this bridges the gap.

export const loadBrandProfiles = (): Record<string, BrandConfig> => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const localData = stored ? JSON.parse(stored) : DEFAULT_PROFILES;

        // Background Cloud Sync
        fetchFromCloud(STORAGE_KEY).then((cloudData) => {
            if (cloudData) {
                // If cloud data is different/newer, we should technically assume it's truth
                // But for now let's just save it to local storage for next reload
                const currentStr = JSON.stringify(localData);
                const cloudStr = JSON.stringify(cloudData);
                if (currentStr !== cloudStr) {
                    console.log("Cloud data found. Updating local cache for next session.");
                    localStorage.setItem(STORAGE_KEY, cloudStr);
                    // In a real app we'd trigger a React context update here
                }
            } else {
                // If cloud is empty but we have local, push to cloud
                // (Only if local is not just defaults)
                if (stored) {
                    saveToCloud(STORAGE_KEY, localData);
                }
            }
        });

        return mergeWithDefaults(localData);
    } catch (e) {
        console.error("Failed to load brand profiles", e);
        return DEFAULT_PROFILES;
    }
};

const mergeWithDefaults = (storedData: any): Record<string, BrandConfig> => {
    const merged = { ...DEFAULT_PROFILES };
    Object.keys(storedData).forEach(key => {
        if (storedData[key]) {
            const def = DEFAULT_PROFILES[key] || {};
            const stored = storedData[key];

            const preferStoredArray = (field: keyof BrandConfig) => {
                const sArr = stored[field];
                const dArr = def[field];
                if (Array.isArray(sArr) && sArr.length > 0) return sArr;
                if (Array.isArray(dArr) && dArr.length > 0) return dArr;
                return sArr || [];
            };

            merged[key] = {
                ...def,
                ...stored,
                colors: preferStoredArray('colors'),
                referenceImages: preferStoredArray('referenceImages'),
                tweetExamples: preferStoredArray('tweetExamples'),
                knowledgeBase: preferStoredArray('knowledgeBase'),
            };
        }
    });
    return merged;
};

export const saveBrandProfiles = (profiles: Record<string, BrandConfig>): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
        saveToCloud(STORAGE_KEY, profiles);
    } catch (e) {
        console.error("Failed to save brand profiles", e);
    }
};

export const getBrandDefault = (name: string): BrandConfig | null => {
    return DEFAULT_PROFILES[name] || null;
};

// --- PULSE PERSISTENCE ---

export const loadPulseCache = (brandName: string): PulseCache => {
    try {
        const key = `${PULSE_STORAGE_PREFIX}${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);

        // Background Sync
        fetchFromCloud(key).then(cloudCache => {
            if (cloudCache) {
                localStorage.setItem(key, JSON.stringify(cloudCache));
            }
        });

        if (!stored) return { lastUpdated: 0, items: [] };

        const cache: PulseCache = JSON.parse(stored);
        const now = Date.now();
        const twoDaysMs = 48 * 60 * 60 * 1000;
        const freshItems = cache.items.filter(item => (now - (item.createdAt || 0)) < twoDaysMs);

        if (freshItems.length !== cache.items.length) {
            savePulseCache(brandName, { ...cache, items: freshItems });
        }

        return { ...cache, items: freshItems };
    } catch (e) {
        return { lastUpdated: 0, items: [] };
    }
};

export const savePulseCache = (brandName: string, cache: PulseCache): void => {
    try {
        const key = `${PULSE_STORAGE_PREFIX}${brandName.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(cache));
        saveToCloud(key, cache);
    } catch (e) {
        console.error("Failed to save Pulse cache", e);
    }
};

// --- CALENDAR PERSISTENCE ---

export const loadCalendarEvents = (brandName: string): CalendarEvent[] => {
    try {
        const key = `${CALENDAR_STORAGE_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);

        // Background Sync
        fetchFromCloud(key).then(cloudEvents => {
            if (cloudEvents) {
                localStorage.setItem(key, JSON.stringify(cloudEvents));
            }
        });

        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
};

export const saveCalendarEvents = (brandName: string, events: CalendarEvent[]): void => {
    try {
        const key = `${CALENDAR_STORAGE_KEY}_${brandName.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(events));
        saveToCloud(key, events);
    } catch (e) {
        console.error("Failed to save calendar events", e);
    }
};

// --- API KEYS PERSISTENCE ---

export interface IntegrationKeys {
    dune?: string;
    apify?: string;
}

export const loadIntegrationKeys = (): IntegrationKeys => {
    const stored = localStorage.getItem(KEYS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
};

export const saveIntegrationKeys = (keys: IntegrationKeys): void => {
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys));
    // NOTE: Not syncing keys to cloud for security reasons in this basic implementation
};
