import { BrandConfig, PulseCache, CalendarEvent } from "../types";
import { DEFAULT_PROFILES } from './brandData';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'ethergraph_brand_profiles_v16';
const PULSE_STORAGE_PREFIX = 'defia_pulse_cache_v2_';
const CALENDAR_STORAGE_KEY = 'defia_calendar_events_v1';
const KEYS_STORAGE_KEY = 'defia_integrations_v1';
const META_STORAGE_KEY = 'defia_storage_meta_v1';

// --- HELPER: Timestamp Management ---
const getLocalTimestamp = (key: string): number => {
    try {
        const meta = JSON.parse(localStorage.getItem(META_STORAGE_KEY) || '{}');
        return meta[key] || 0;
    } catch { return 0; }
};

const setLocalTimestamp = (key: string, ts: number) => {
    try {
        const meta = JSON.parse(localStorage.getItem(META_STORAGE_KEY) || '{}');
        meta[key] = ts;
        localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
    } catch { }
};

// --- HELPER: App Storage Table Interaction ---

const fetchFromCloud = async (key: string): Promise<{ value: any, updated_at: string } | null> => {
    try {
        const { data, error } = await supabase
            .from('app_storage')
            .select('value, updated_at')
            .eq('key', key)
            .maybeSingle();

        if (error) {
            if (error.code !== 'PGRST116') { // Ignore "Row not found"
                console.warn(`Supabase fetch error for ${key}:`, error.message);
            }
            return null;
        }
        return data ? { value: data.value, updated_at: data.updated_at } : null;
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

        if (error) {
            console.error(`Supabase save error for ${key}:`, error.message);
            // Optionally notify user of save failure via a toast (not implemented here yet)
        }
    } catch (e) {
        console.error("Cloud save failed:", e);
    }
};

// --- EVENTS ---
export const STORAGE_EVENTS = {
    CALENDAR_UPDATE: 'defia_calendar_update',
    BRAND_UPDATE: 'defia_brand_update',
};

const dispatchStorageEvent = (eventName: string, detail: any) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
};

// --- BRAND PROFILES ---

export const loadBrandProfiles = (): Record<string, BrandConfig> => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const localData = stored ? JSON.parse(stored) : DEFAULT_PROFILES;
        const localTs = getLocalTimestamp(STORAGE_KEY);

        // Background Cloud Sync
        fetchFromCloud(STORAGE_KEY).then((result) => {
            if (result) {
                const cloudTs = new Date(result.updated_at).getTime();
                // Only overwrite if cloud is newer than local last-write
                if (cloudTs > localTs) {
                    console.log("Cloud data found (Newer). Updating local cache for next session.");
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(result.value));
                    setLocalTimestamp(STORAGE_KEY, cloudTs);
                    // Force reload if needed, but for now relies on next refresh
                } else {
                    console.log("Cloud data found but stale/older. Ignoring.");
                }
            } else {
                // If cloud is empty but we have local, push to cloud
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
        setLocalTimestamp(STORAGE_KEY, Date.now());
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

        // Background Sync (Simple fallback for cache)
        fetchFromCloud(key).then(result => {
            if (result && result.value) {
                localStorage.setItem(key, JSON.stringify(result.value));
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
        const localTs = getLocalTimestamp(key);

        // Background Sync
        fetchFromCloud(key).then(result => {
            if (result) {
                const cloudTs = new Date(result.updated_at).getTime();
                // Check if cloud is newer OR if we have no local timestamp yet (first load)
                if (cloudTs > localTs || localTs === 0) {
                    console.log(`[Calendar] Cloud newer for ${brandName}. Updating local & UI.`);
                    localStorage.setItem(key, JSON.stringify(result.value));
                    setLocalTimestamp(key, cloudTs);
                    // Trigger UI Refresh
                    dispatchStorageEvent(STORAGE_EVENTS.CALENDAR_UPDATE, { brandName });
                } else {
                    console.log(`[Calendar] Cloud stale for ${brandName}. Ignoring.`);
                }
            } else if (stored) {
                // Cloud empty, push local
                saveToCloud(key, JSON.parse(stored));
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
        setLocalTimestamp(key, Date.now());
        dispatchStorageEvent(STORAGE_EVENTS.CALENDAR_UPDATE, { brandName }); // Local update trigger
        saveToCloud(key, events);
    } catch (e) {
        console.error("Failed to save calendar events", e);
    }
};

// --- API KEYS PERSISTENCE ---

export interface IntegrationKeys {
    dune?: string;
    duneQueryIds?: {
        volume?: string;
        users?: string;
        retention?: string;
    };
    apify?: string;
    lunarCrush?: string;
}

export const loadIntegrationKeys = (brandName?: string): IntegrationKeys => {
    // If brandName is provided, try to load specific keys, otherwise fallback to global
    // or migration strategy: checks specific first, then global
    const key = brandName ? `${KEYS_STORAGE_KEY}_${brandName.toLowerCase()}` : KEYS_STORAGE_KEY;
    const stored = localStorage.getItem(key);

    // Fallback: If no specific key found for this brand, try the global one (legacy support)
    if (!stored && brandName) {
        const globalParams = localStorage.getItem(KEYS_STORAGE_KEY);
        return globalParams ? JSON.parse(globalParams) : {};
    }

    return stored ? JSON.parse(stored) : {};
};

export const saveIntegrationKeys = (keys: IntegrationKeys, brandName?: string): void => {
    // Save to brand-specific slot if provided, otherwise global (not recommended for new flow)
    const key = brandName ? `${KEYS_STORAGE_KEY}_${brandName.toLowerCase()}` : KEYS_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(keys));
    // NOTE: Not syncing keys to cloud for security reasons in this basic implementation
};
