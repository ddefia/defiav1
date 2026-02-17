import { BrandConfig, PulseCache, CalendarEvent, ReferenceImage, CampaignLog } from "../types";
import { DEFAULT_PROFILES } from './brandData';
import { supabase } from './supabaseClient';
import { loadUserProfile } from './auth';
import { createDefaultSubscription } from './subscription';

// --- USER-SCOPED STORAGE ---
// Prefix all storage keys with user ID to prevent data leaking between users on the same device.
let _cachedUserPrefix: string | null = null;

const getUserPrefix = (): string => {
    if (_cachedUserPrefix) return _cachedUserPrefix;
    try {
        // Read directly from Supabase auth token in localStorage
        const keys = Object.keys(localStorage);
        const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (authKey) {
            const session = JSON.parse(localStorage.getItem(authKey) || '{}');
            const userId = session?.user?.id;
            if (userId) {
                _cachedUserPrefix = userId.slice(0, 8);
                return _cachedUserPrefix;
            }
        }
    } catch { /* ignore parse errors */ }
    return 'anon';
};

// Reset cached prefix on auth change (call after login/logout)
export const resetUserPrefix = () => { _cachedUserPrefix = null; };

const userKey = (base: string) => `${getUserPrefix()}_${base}`;

const STORAGE_KEY_BASE = 'ethergraph_brand_profiles_v17';
const PULSE_STORAGE_PREFIX_BASE = 'defia_pulse_cache_v2_';
const POSTURE_STORAGE_KEY_BASE = 'defia_strategic_posture_v1';
const CALENDAR_STORAGE_KEY_BASE = 'defia_calendar_events_v1';
const KEYS_STORAGE_KEY_BASE = 'defia_integrations_v1';
const META_STORAGE_KEY_BASE = 'defia_storage_meta_v1';
const AUTOMATION_STORAGE_KEY_BASE = 'defia_automation_settings_v1';
const BRAND_REGISTRY_KEY_BASE = 'defia_brand_registry_v1';

// Computed user-scoped keys (with migration fallback)
const getStorageKey = () => userKey(STORAGE_KEY_BASE);
const getPulsePrefix = () => userKey(PULSE_STORAGE_PREFIX_BASE);
const getPostureKey = () => userKey(POSTURE_STORAGE_KEY_BASE);
const getCalendarKey = () => userKey(CALENDAR_STORAGE_KEY_BASE);
const getKeysKey = () => userKey(KEYS_STORAGE_KEY_BASE);
const getMetaKey = () => userKey(META_STORAGE_KEY_BASE);
const getAutomationKey = () => userKey(AUTOMATION_STORAGE_KEY_BASE);
const getRegistryKey = () => userKey(BRAND_REGISTRY_KEY_BASE);

// Legacy unscoped keys (for migration on first load)
const LEGACY_STORAGE_KEY = 'ethergraph_brand_profiles_v17';
const LEGACY_CALENDAR_KEY = 'defia_calendar_events_v1';
const LEGACY_POSTURE_KEY = 'defia_strategic_posture_v1';
const LEGACY_KEYS_KEY = 'defia_integrations_v1';
const LEGACY_REGISTRY_KEY = 'defia_brand_registry_v1';

// One-time migration: move unscoped data to user-scoped keys
const migrateToUserScoped = () => {
    const prefix = getUserPrefix();
    if (prefix === 'anon') return; // Don't migrate if no user

    const migrationFlag = `defia_migrated_${prefix}`;
    if (localStorage.getItem(migrationFlag)) return; // Already migrated

    const migrations = [
        [LEGACY_STORAGE_KEY, getStorageKey()],
        [LEGACY_CALENDAR_KEY, getCalendarKey()],
        [LEGACY_POSTURE_KEY, getPostureKey()],
        [LEGACY_KEYS_KEY, getKeysKey()],
        [LEGACY_REGISTRY_KEY, getRegistryKey()],
    ];

    for (const [oldKey, newKey] of migrations) {
        if (oldKey === newKey) continue; // Same key, skip
        const data = localStorage.getItem(oldKey);
        if (data && !localStorage.getItem(newKey)) {
            localStorage.setItem(newKey, data);
        }
    }

    localStorage.setItem(migrationFlag, '1');
};

// Run migration on module load
try { migrateToUserScoped(); } catch { /* ignore */ }

// Backward-compatible aliases used throughout the file
const STORAGE_KEY = getStorageKey();
const PULSE_STORAGE_PREFIX = getPulsePrefix();
const POSTURE_STORAGE_KEY = getPostureKey();
const CALENDAR_STORAGE_KEY = getCalendarKey();
const KEYS_STORAGE_KEY = getKeysKey();
const META_STORAGE_KEY = getMetaKey();
const AUTOMATION_STORAGE_KEY = getAutomationKey();
const BRAND_REGISTRY_KEY = getRegistryKey();

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
        // User-scope cloud storage keys to prevent cross-user data leakage
        const scopedKey = `${getUserPrefix()}:${key}`;
        const { data, error } = await supabase
            .from('app_storage')
            .select('value, updated_at')
            .eq('key', scopedKey)
            .maybeSingle();

        if (error) {
            if (error.code !== 'PGRST116') { // Ignore "Row not found"
                console.warn(`Supabase fetch error for ${scopedKey}:`, error.message);
            }
            // Fallback: try legacy unscoped key for migration
            const { data: legacyData } = await supabase
                .from('app_storage')
                .select('value, updated_at')
                .eq('key', key)
                .maybeSingle();
            return legacyData ? { value: legacyData.value, updated_at: legacyData.updated_at } : null;
        }
        return data ? { value: data.value, updated_at: data.updated_at } : null;
    } catch (e) {
        console.error("Cloud fetch failed:", e);
        return null;
    }
};

const saveToCloud = async (key: string, value: any) => {
    try {
        // User-scope cloud storage keys
        const scopedKey = `${getUserPrefix()}:${key}`;
        const { error } = await supabase
            .from('app_storage')
            .upsert({ key: scopedKey, value, updated_at: new Date().toISOString() });

        if (error) {
            console.error(`Supabase save error for ${scopedKey}:`, error.message);
        }
    } catch (e) {
        console.error("Cloud save failed:", e);
    }
};

// --- EVENTS ---
export const STORAGE_EVENTS = {
    CALENDAR_UPDATE: 'defia_calendar_update',
    BRAND_UPDATE: 'defia_brand_update',
    POSTURE_UPDATE: 'defia_posture_update',
    AUTOMATION_UPDATE: 'defia_automation_update',
    INTEGRATIONS_UPDATE: 'defia_integrations_update',
    CAMPAIGN_LOG_UPDATE: 'defia_campaign_log_update',
    CONTENT_ITEMS_UPDATE: 'defia_content_items_update',
};

const dispatchStorageEvent = (eventName: string, detail: any) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
};

// --- HYDRATION LOCK ---
// Prevents the App from overwriting Cloud data with stale Local data during the initial async fetch race.
let isHydrating = true;

// --- BRAND PROFILES ---

export const loadBrandProfiles = (): Record<string, BrandConfig> => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        let localData = stored ? JSON.parse(stored) : DEFAULT_PROFILES;

        // Fix: If parsed data is empty object (data loss), force defaults
        if (Object.keys(localData).length === 0) {
            console.warn("Storage empty or corrupted. Restoring defaults.");
            localData = DEFAULT_PROFILES;
        }

        const localTs = getLocalTimestamp(STORAGE_KEY);

        // Background Cloud Sync - IMPROVED PRIORITY
        fetchFromCloud(STORAGE_KEY).then((result) => {
            isHydrating = false; // RELEASE LOCK

            if (result) {
                const cloudTs = new Date(result.updated_at).getTime();
                // FIX: Trust Cloud if it has more data (e.g. images) OR is newer
                // We check if Cloud has significantly more reference images than local to detect the "overwrite" issue
                const cloudProfiles = result.value;
                let cloudHasMoreImages = false;

                // Simple heuristic: check if any brand has > 10 images in cloud but < 10 locally
                Object.keys(cloudProfiles).forEach(key => {
                    const cCount = cloudProfiles[key]?.referenceImages?.length || 0;
                    const lCount = localData[key]?.referenceImages?.length || 0;
                    if (cCount > 20 && lCount < 20) cloudHasMoreImages = true;
                });

                if (cloudTs > localTs || cloudHasMoreImages) {
                    console.log("Cloud data found (Newer or More Complete). Updating local cache.");
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(result.value));
                    setLocalTimestamp(STORAGE_KEY, cloudTs);

                    // Dispatch event to force UI reload immediately
                    dispatchStorageEvent(STORAGE_EVENTS.BRAND_UPDATE, {});
                } else {
                    console.log("Cloud data found but stale/older. Ignoring.");
                }
            } else {
                // If cloud is empty but we have local, push to cloud
                if (stored) {
                    saveToCloud(STORAGE_KEY, localData);
                }
            }
        }).catch(() => {
            isHydrating = false; // Release lock on error too
        });

        // Set a timeout to release lock just in case fetch hangs
        setTimeout(() => { isHydrating = false; }, 2000);

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
                // SRICT PERSISTENCE: If the user has saved data for this field (even an empty array),
                // we use it effectively as the "Source of Truth" and do NOT merge defaults back in.
                // This fix ensures that if a user deletes items (colors, docs), they stay deleted on refresh.
                if (field in stored && Array.isArray(stored[field])) {
                    return stored[field];
                }

                // Fallback: Only use defaults if the user has never saved this field (e.g. new profile)
                return Array.isArray(def[field]) ? def[field] : [];
            };

            merged[key] = {
                ...def,
                ...stored,
                colors: preferStoredArray('colors'),
                referenceImages: preferStoredArray('referenceImages'),
                tweetExamples: preferStoredArray('tweetExamples'),
                knowledgeBase: preferStoredArray('knowledgeBase'),
                graphicTemplates: preferStoredArray('graphicTemplates'),
                // Backfill subscription for brands that predate the plan system
                subscription: stored.subscription || def.subscription || createDefaultSubscription('growth'),
            };
        }
    });
    return merged;
};

export const saveBrandProfiles = (profiles: Record<string, BrandConfig>, suppressEvent = false): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
        setLocalTimestamp(STORAGE_KEY, Date.now());
        if (!suppressEvent) {
            dispatchStorageEvent(STORAGE_EVENTS.BRAND_UPDATE, {});
        }

        if (isHydrating) {
            console.log("Skipping Cloud Save: Hydration in progress...");
            return;
        }

        saveToCloud(STORAGE_KEY, profiles);
    } catch (e) {
        console.error("Failed to save brand profiles", e);
    }
};

export const getBrandDefault = (name: string): BrandConfig | null => {
    return DEFAULT_PROFILES[name] || null;
};

/**
 * Force seed/reset the default brands (ENKI, Netswap, Metis, LazAI)
 * This will merge the default profiles into the current storage without
 * overwriting any user customizations.
 *
 * Call this from browser console: await window.forceSeedDefaultBrands()
 */
export const forceSeedDefaultBrands = async (): Promise<{
    success: boolean;
    brands: string[];
    error?: string;
}> => {
    try {
        const BRANDS_TO_SEED = ['ENKI Protocol', 'Netswap', 'Metis', 'LazAI'];
        const currentProfiles = loadBrandProfiles();
        const seededBrands: string[] = [];

        for (const brandName of BRANDS_TO_SEED) {
            const defaultProfile = DEFAULT_PROFILES[brandName];
            if (!defaultProfile) continue;

            // Check if brand already exists
            if (currentProfiles[brandName]) {
                // Merge: keep user data but add any missing defaults
                const existing = currentProfiles[brandName];
                currentProfiles[brandName] = {
                    ...defaultProfile,
                    ...existing,
                    // Merge arrays - add defaults that don't exist
                    colors: existing.colors?.length ? existing.colors : defaultProfile.colors,
                    referenceImages: existing.referenceImages?.length ? existing.referenceImages : defaultProfile.referenceImages,
                    tweetExamples: existing.tweetExamples?.length ? existing.tweetExamples : defaultProfile.tweetExamples,
                    knowledgeBase: existing.knowledgeBase?.length ? existing.knowledgeBase : defaultProfile.knowledgeBase,
                    graphicTemplates: existing.graphicTemplates?.length ? existing.graphicTemplates : defaultProfile.graphicTemplates,
                };
            } else {
                // Add new brand
                currentProfiles[brandName] = defaultProfile;
            }
            seededBrands.push(brandName);
        }

        // Save locally and to cloud
        saveBrandProfiles(currentProfiles, false);

        console.log('✅ Seeded brands:', seededBrands);
        return { success: true, brands: seededBrands };
    } catch (e: any) {
        console.error('❌ Failed to seed brands:', e);
        return { success: false, brands: [], error: e.message };
    }
};

/**
 * Reset a specific brand to its default profile
 */
export const resetBrandToDefault = async (brandName: string): Promise<boolean> => {
    const defaultProfile = DEFAULT_PROFILES[brandName];
    if (!defaultProfile) {
        console.error(`No default profile found for ${brandName}`);
        return false;
    }

    const currentProfiles = loadBrandProfiles();
    currentProfiles[brandName] = { ...defaultProfile };
    saveBrandProfiles(currentProfiles);

    console.log(`✅ Reset ${brandName} to default`);
    return true;
};

/**
 * Get the brand owned by the current user
 * Returns null if no user is logged in or user has no brand
 */
export const getCurrentUserBrand = (): { brandName: string; config: BrandConfig } | null => {
    const user = loadUserProfile();
    if (!user) return null;

    const allProfiles = loadBrandProfiles();

    // First check if user has a brandId set (matches profile key)
    if (user.brandId && allProfiles[user.brandId]) {
        return { brandName: user.brandId, config: allProfiles[user.brandId] };
    }

    // Check if user has a brandName set (from Supabase metadata, e.g., "ENKI Protocol")
    if (user.brandName && allProfiles[user.brandName]) {
        return { brandName: user.brandName, config: allProfiles[user.brandName] };
    }

    // Check by ownerId
    for (const [name, config] of Object.entries(allProfiles)) {
        if (config.ownerId === user.id) {
            return { brandName: name, config };
        }
    }

    // Fallback: Check demo accounts by email pattern (dev only)
    if (import.meta.env.DEV) {
        const demoMapping: Record<string, string> = {
            'enki@defia.io': 'ENKI Protocol',
            'netswap@defia.io': 'Netswap',
            'metis@defia.io': 'Metis',
            'lazai@defia.io': 'LazAI',
        };

        if (user.email && demoMapping[user.email] && allProfiles[demoMapping[user.email]]) {
            return { brandName: demoMapping[user.email], config: allProfiles[demoMapping[user.email]] };
        }
    }

    return null;
};

/**
 * Mapping from brand names to their folder names in Supabase storage bucket
 */
const BRAND_FOLDER_MAP: Record<string, string> = {
    'ENKI Protocol': 'enki_protocol',
    'Netswap': 'netswap',
    'Metis': 'metis',
    'LazAI': 'lazai',
};

/**
 * Fetch brand assets (images) from Supabase storage bucket and sync to brand config
 * This pulls reference images from the 'brand-assets' bucket
 */
export const syncBrandAssetsFromStorage = async (brandName: string): Promise<{
    success: boolean;
    imagesAdded: number;
    error?: string;
}> => {
    try {
        const folderName = BRAND_FOLDER_MAP[brandName];
        if (!folderName) {
            console.warn(`No folder mapping for brand: ${brandName}`);
            return { success: false, imagesAdded: 0, error: `No storage folder for ${brandName}` };
        }

        console.log(`🔄 Syncing brand assets for ${brandName} from folder: ${folderName}`);

        // List files in the brand's folder
        const { data: files, error: listError } = await supabase.storage
            .from('brand-assets')
            .list(folderName, {
                limit: 100,
                sortBy: { column: 'name', order: 'asc' }
            });

        if (listError) {
            console.error('Failed to list brand assets:', listError);
            return { success: false, imagesAdded: 0, error: listError.message };
        }

        if (!files || files.length === 0) {
            console.log(`No assets found for ${brandName}`);
            return { success: true, imagesAdded: 0 };
        }

        // Filter for image files only
        const imageFiles = files.filter(f =>
            !f.name.startsWith('.') &&
            /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name)
        );

        console.log(`Found ${imageFiles.length} image files for ${brandName}`);

        // Convert to ReferenceImage objects with public URLs
        const newImages: ReferenceImage[] = imageFiles.map((file, index) => {
            const filePath = `${folderName}/${file.name}`;
            const { data: { publicUrl } } = supabase.storage
                .from('brand-assets')
                .getPublicUrl(filePath);

            return {
                id: `${folderName}_${file.name.replace(/\.[^/.]+$/, '')}_${index}`,
                url: publicUrl,
                name: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
                category: 'Reference', // Default category
            };
        });

        // Load current profiles and merge new images
        const allProfiles = loadBrandProfiles();
        const currentConfig = allProfiles[brandName];

        if (!currentConfig) {
            console.error(`Brand config not found for ${brandName}`);
            return { success: false, imagesAdded: 0, error: `Brand ${brandName} not found` };
        }

        // Merge: Add images that don't already exist (by URL)
        const existingUrls = new Set(
            (currentConfig.referenceImages || [])
                .map(img => img.url)
                .filter(Boolean)
        );

        const imagesToAdd = newImages.filter(img => img.url && !existingUrls.has(img.url));

        if (imagesToAdd.length > 0) {
            currentConfig.referenceImages = [
                ...(currentConfig.referenceImages || []),
                ...imagesToAdd
            ];

            allProfiles[brandName] = currentConfig;
            saveBrandProfiles(allProfiles);

            console.log(`✅ Added ${imagesToAdd.length} new images to ${brandName}`);
        } else {
            console.log(`No new images to add for ${brandName}`);
        }

        return { success: true, imagesAdded: imagesToAdd.length };
    } catch (e: any) {
        console.error('syncBrandAssetsFromStorage failed:', e);
        return { success: false, imagesAdded: 0, error: e.message };
    }
};

/**
 * Sync assets for all demo brands from Supabase storage
 */
export const syncAllBrandAssets = async (): Promise<{
    results: Record<string, { success: boolean; imagesAdded: number; error?: string }>;
}> => {
    const results: Record<string, { success: boolean; imagesAdded: number; error?: string }> = {};

    for (const brandName of Object.keys(BRAND_FOLDER_MAP)) {
        results[brandName] = await syncBrandAssetsFromStorage(brandName);
    }

    console.log('Brand asset sync complete:', results);
    return { results };
};

// Export for browser console access
if (typeof window !== 'undefined') {
    (window as any).syncBrandAssets = syncBrandAssetsFromStorage;
    (window as any).syncAllBrandAssets = syncAllBrandAssets;
}

/**
 * Create or update a brand and assign it to the current user
 */
export const createBrandForUser = (brandName: string, config: Partial<BrandConfig>): BrandConfig | null => {
    const user = loadUserProfile();
    if (!user) {
        console.error('No user logged in');
        return null;
    }

    const allProfiles = loadBrandProfiles();

    const fullConfig: BrandConfig = {
        colors: config.colors || [],
        referenceImages: config.referenceImages || [],
        tweetExamples: config.tweetExamples || [],
        knowledgeBase: config.knowledgeBase || [],
        name: brandName,
        ownerId: user.id,
        ...config,
    };

    allProfiles[brandName] = fullConfig;
    saveBrandProfiles(allProfiles);

    // Update user profile with brandId
    const updatedUser = { ...user, brandId: brandName };
    localStorage.setItem('defia_user_profile_v1', JSON.stringify(updatedUser));

    return fullConfig;
};

/**
 * Check if the current user owns a specific brand
 */
export const userOwnsBrand = (brandName: string): boolean => {
    const user = loadUserProfile();
    if (!user) return false;

    const allProfiles = loadBrandProfiles();
    const brand = allProfiles[brandName];

    if (!brand) return false;

    // Check if user is the owner
    return brand.ownerId === user.id || user.brandId === brandName;
};

// Expose to window for easy console access
if (typeof window !== 'undefined') {
    (window as any).forceSeedDefaultBrands = forceSeedDefaultBrands;
    (window as any).resetBrandToDefault = resetBrandToDefault;
}

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

        // Background Sync (Safe Logic)
        fetchFromCloud(key).then(result => {
            if (result) {
                const cloudTs = new Date(result.updated_at).getTime();

                // SAFETY: If we have existing local data (stored) but no timestamp (localTs=0),
                // we assume local is valid/fresh (e.g. just created) and should NOT be overwritten by an empty/stale cloud state.
                const hasLocalData = stored && stored.length > 5; // "[]" has length 2

                if (cloudTs > localTs && localTs !== 0) {
                    console.log(`[Calendar] Cloud strictly newer for ${brandName}. Updating local.`);
                    localStorage.setItem(key, JSON.stringify(result.value));
                    setLocalTimestamp(key, cloudTs);
                    dispatchStorageEvent(STORAGE_EVENTS.CALENDAR_UPDATE, { brandName });
                } else if (localTs === 0 && hasLocalData) {
                    console.log(`[Calendar] Local data exists without timestamp. Trusting Local and syncing UP.`);
                    setLocalTimestamp(key, Date.now());
                    saveToCloud(key, JSON.parse(stored!));
                } else if (cloudTs > localTs && !hasLocalData) {
                    // Local is empty/missing, Cloud has something (or is newer empty). Sync Down.
                    console.log(`[Calendar] Local empty/stale, downloading from Cloud.`);
                    localStorage.setItem(key, JSON.stringify(result.value));
                    setLocalTimestamp(key, cloudTs);
                    dispatchStorageEvent(STORAGE_EVENTS.CALENDAR_UPDATE, { brandName });
                } else {
                    console.log(`[Calendar] Cloud stale or Local prioritized. Ignoring Cloud.`);
                    // Ensure cloud is caught up if local is newer
                    if (localTs > cloudTs && stored) {
                        saveToCloud(key, JSON.parse(stored));
                    }
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
        // dispatchStorageEvent(STORAGE_EVENTS.CALENDAR_UPDATE, { brandName }); // Local update trigger - REMOVED TO PREVENT INFINITE LOOP WITH APP.TSX LISTENER
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
    duneAutoGenerated?: boolean;
    apify?: string;
    lunarCrush?: string;
    supabaseUrl?: string; // New
    supabaseKey?: string; // New
}

export interface AutomationSettings {
    enabled: boolean;
    updatedAt: number;
}

export const loadAutomationSettings = (brandName: string): AutomationSettings => {
    try {
        const key = `${AUTOMATION_STORAGE_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);

        fetchFromCloud(key).then(result => {
            if (result && result.value) {
                localStorage.setItem(key, JSON.stringify(result.value));
            }
        });

        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.warn("Failed to load automation settings", e);
    }

    return { enabled: true, updatedAt: Date.now() };
};

export const saveAutomationSettings = (brandName: string, settings: AutomationSettings): void => {
    try {
        const key = `${AUTOMATION_STORAGE_KEY}_${brandName.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(settings));
        saveToCloud(key, settings);
        dispatchStorageEvent(STORAGE_EVENTS.AUTOMATION_UPDATE, { brandName, settings });
    } catch (e) {
        console.error("Failed to save automation settings", e);
    }
};

export interface BrandRegistryEntry {
    brandId: string;
    brandName: string;
    updatedAt: number;
}

export const loadBrandRegistry = (): Record<string, BrandRegistryEntry> => {
    try {
        const stored = localStorage.getItem(BRAND_REGISTRY_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.warn("Failed to load brand registry", e);
        return {};
    }
};

export const saveBrandRegistryEntry = (brandName: string, brandId: string): void => {
    try {
        const registry = loadBrandRegistry();
        registry[brandName.toLowerCase()] = { brandId, brandName, updatedAt: Date.now() };
        localStorage.setItem(BRAND_REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
        console.warn("Failed to save brand registry entry", e);
    }
};

export const getBrandRegistryEntry = (brandName: string): BrandRegistryEntry | null => {
    const registry = loadBrandRegistry();
    return registry[brandName.toLowerCase()] || null;
};

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
    dispatchStorageEvent(STORAGE_EVENTS.INTEGRATIONS_UPDATE, { brandName });
    // NOTE: Not syncing keys to cloud for security reasons in this basic implementation
};

// --- DECISION LOOP SCHEDULE ---

const DECISION_LOOP_LAST_RUN_KEY = 'defia_decision_loop_last_run_v1';

export const loadDecisionLoopLastRun = (brandName: string): number => {
    try {
        const key = `${DECISION_LOOP_LAST_RUN_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);
        return stored ? Number(stored) : 0;
    } catch (e) {
        return 0;
    }
};

export const saveDecisionLoopLastRun = (brandName: string, timestamp: number = Date.now()): void => {
    try {
        const key = `${DECISION_LOOP_LAST_RUN_KEY}_${brandName.toLowerCase()}`;
        localStorage.setItem(key, String(timestamp));
    } catch (e) {
        console.warn("Failed to save decision loop timestamp", e);
    }
};

// --- STRATEGY TASKS PERSISTENCE ---

const STRATEGY_STORAGE_KEY = 'defia_strategy_tasks_v1';

export const loadStrategyTasks = (brandName: string): any[] => {
    try {
        const key = `${STRATEGY_STORAGE_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);

        // Background Sync (Simple fallback)
        fetchFromCloud(key).then(result => {
            if (result && result.value) {
                localStorage.setItem(key, JSON.stringify(result.value));
            }
        });

        const parsed = stored ? JSON.parse(stored) : [];

        // Default Seeding: If no tasks, provide a welcome task
        if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
            return [{
                id: 'welcome-1',
                title: 'Welcome to Defia Studio',
                description: 'Your command center is online. The AI is currently scanning for strategic opportunities. This dashboard will update automatically.',
                priority: 'high',
                status: 'new',
                type: 'general',
                createdAt: Date.now()
            }];
        }

        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

export const saveStrategyTasks = (brandName: string, tasks: any[]): void => {
    try {
        const key = `${STRATEGY_STORAGE_KEY}_${brandName.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(tasks));
        saveToCloud(key, tasks);
    } catch (e) {
        console.error("Failed to save strategy tasks", e);
    }
};


// --- BRAIN LOGS PERSISTENCE ---

const BRAIN_LOGS_KEY = 'defia_brain_logs_v1';
const MAX_LOGS = 50; // Keep storage light

export const loadBrainLogs = (brandName: string): any[] => {
    try {
        const key = `${BRAIN_LOGS_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);
        // We could sync this to cloud too, similar to above pattern
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
};

export const saveBrainLog = (log: any): void => {
    try {
        if (!log.brandId) return;
        const key = `${BRAIN_LOGS_KEY}_${log.brandId.toLowerCase()}`;

        // Load existing
        const existing = loadBrainLogs(log.brandId);

        // Prepend new log
        const updated = [log, ...existing].slice(0, MAX_LOGS);

        localStorage.setItem(key, JSON.stringify(updated));

        // Optional: Fire event for real-time UI update if needed
        // dispatchStorageEvent('BRAIN_UPDATE', { brandName: log.brandId });
    } catch (e) {
        console.error("Failed to save brain log", e);
    }
};

// --- CAMPAIGN DRAFTS PERSISTENCE ---

const CAMPAIGN_STORAGE_KEY = 'defia_campaign_drafts_v1';
const STUDIO_STORAGE_KEY = 'defia_studio_state_v1';
const CONTENT_ITEMS_KEY = 'defia_content_items_v1';

export const loadCampaignState = (brandName: string): any => {
    try {
        const key = `${CAMPAIGN_STORAGE_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);
        // Fire async cloud fetch to sync if newer
        fetchFromCloud(key).then(res => {
            if (res && res.value && JSON.stringify(res.value) !== stored) {
                // If cloud has different data, we could prompt user or auto-update. 
                // For now, let's just log it. Real-time sync requires more complex merging.
                console.log("Cloud campaign state found via fetchFromCloud");
            }
        });
        return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
};

export const saveCampaignState = (brandName: string, state: any): void => {
    try {
        const key = `${CAMPAIGN_STORAGE_KEY}_${brandName.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(state));
        saveToCloud(key, state);
    } catch (e) {
        console.error("Failed to save campaign state", e);
    }
};

// --- CAMPAIGN LOGS (Attribution Metadata) ---
const CAMPAIGN_LOGS_KEY = 'defia_campaign_logs_v1';

export const loadCampaignLogs = (brandName: string): CampaignLog[] => {
    try {
        const key = `${CAMPAIGN_LOGS_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);
        fetchFromCloud(key).then(res => {
            if (res && res.value && JSON.stringify(res.value) !== stored) {
                console.log("Cloud campaign logs found via fetchFromCloud");
            }
        }).catch(() => {});
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Failed to load campaign logs", e);
        return [];
    }
};

export const saveCampaignLogs = (brandName: string, logs: CampaignLog[]): void => {
    try {
        const key = `${CAMPAIGN_LOGS_KEY}_${brandName.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(logs));
        saveToCloud(key, logs);
    } catch (e) {
        console.error("Failed to save campaign logs", e);
    }
};

export const loadStudioState = (brandName: string): any => {
    try {
        const key = `${STUDIO_STORAGE_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
};

export const saveStudioState = (brandName: string, state: any): void => {
    try {
        const key = `${STUDIO_STORAGE_KEY}_${brandName.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(state));
        saveToCloud(key, state);
    } catch (e) {
        console.error("Failed to save studio state", e);
    }
};

// --- CONTENT ITEMS PERSISTENCE ---

export const loadContentItems = (brandName: string): any[] => {
    try {
        const key = `${CONTENT_ITEMS_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);
        fetchFromCloud(key).then(res => {
            if (res && res.value && JSON.stringify(res.value) !== stored) {
                console.log("Cloud content items found via fetchFromCloud");
            }
        }).catch(() => {});
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Failed to load content items", e);
        return [];
    }
};

export const saveContentItems = (brandName: string, items: any[]): void => {
    try {
        const key = `${CONTENT_ITEMS_KEY}_${brandName.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(items));
        saveToCloud(key, items);
        dispatchStorageEvent(STORAGE_EVENTS.CONTENT_ITEMS_UPDATE, { brandName });
    } catch (e) {
        console.error("Failed to save content items", e);
    }
};

/**
 * One-time migration: move kickoff drafts from campaign state to content items.
 * For users who completed onboarding before this change.
 */
export const migrateKickoffToContentItems = (brandName: string): boolean => {
    try {
        const migrationKey = `defia_kickoff_migrated_v1_${brandName.toLowerCase()}`;
        if (localStorage.getItem(migrationKey)) return false;

        const contentItems = loadContentItems(brandName);
        if (contentItems.some((i: any) => String(i?.id || '').startsWith('kickoff-'))) {
            localStorage.setItem(migrationKey, '1');
            return false;
        }

        const campaignState = loadCampaignState(brandName);
        const campaignItems = Array.isArray(campaignState?.campaignItems) ? campaignState.campaignItems : [];
        const kickoffDrafts = campaignItems.filter((item: any) => String(item?.id || '').startsWith('kickoff-'));

        if (kickoffDrafts.length === 0) {
            localStorage.setItem(migrationKey, '1');
            return false;
        }

        const migratedItems = kickoffDrafts.map((draft: any) => ({
            id: draft.id,
            type: 'twitter' as const,
            title: String(draft.tweet || '').slice(0, 80) + (String(draft.tweet || '').length > 80 ? '…' : ''),
            description: draft.tweet,
            status: 'draft' as const,
            date: new Date().toISOString().split('T')[0],
            reasoning: draft.reasoning,
            template: draft.template,
            visualHeadline: draft.visualHeadline,
            visualDescription: draft.visualDescription,
            referenceImageId: draft.referenceImageId,
            campaignColor: draft.campaignColor,
            kickoffTheme: campaignState?.campaignTheme,
        }));

        const merged = [...migratedItems, ...contentItems];
        saveContentItems(brandName, merged);
        localStorage.setItem(migrationKey, '1');
        return true;
    } catch (e) {
        console.error("Failed to migrate kickoff content items", e);
        return false;
    }
};

// --- IMAGE GALLERY PERSISTENCE ---

const IMAGE_GALLERY_KEY = 'defia_image_gallery_v1';
const MAX_GALLERY_IMAGES = 10;

export interface GalleryImage {
    id: string;
    data: string; // base64 data URL (thumbnail — resized to ~300px)
    fullData?: string; // full resolution (only stored if small enough)
    prompt?: string;
    timestamp: number;
    source: 'generated' | 'edited' | 'uploaded';
}

export const loadImageGallery = (brandName: string): GalleryImage[] => {
    try {
        const key = `${IMAGE_GALLERY_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
};

export const saveImageToGallery = (brandName: string, image: GalleryImage): void => {
    try {
        const key = `${IMAGE_GALLERY_KEY}_${brandName.toLowerCase()}`;
        const gallery = loadImageGallery(brandName);
        // Prepend and limit to MAX_GALLERY_IMAGES
        const updated = [image, ...gallery.filter(g => g.id !== image.id)].slice(0, MAX_GALLERY_IMAGES);
        localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
        console.error("Failed to save image to gallery", e);
    }
};

export const removeFromGallery = (brandName: string, imageId: string): void => {
    try {
        const key = `${IMAGE_GALLERY_KEY}_${brandName.toLowerCase()}`;
        const gallery = loadImageGallery(brandName);
        localStorage.setItem(key, JSON.stringify(gallery.filter(g => g.id !== imageId)));
    } catch (e) {
        console.error("Failed to remove image from gallery", e);
    }
};

/** Resize an image to a thumbnail for gallery storage (max 300px) */
export const createThumbnail = (dataUrl: string, maxSize = 300): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            } else {
                resolve(dataUrl);
            }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
};

// --- GROWTH REPORT PERSISTENCE ---

const GROWTH_STORAGE_KEY = 'defia_growth_report_v1';

export const loadGrowthReport = (brandName: string): any => {
    try {
        const key = `${GROWTH_STORAGE_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);

        // Background Sync
        fetchFromCloud(key).then(res => {
            if (res && res.value) {
                localStorage.setItem(key, JSON.stringify(res.value));
            }
        });

        if (stored) {
            const parsed = JSON.parse(stored);
            // Valid report check: must have executiveSummary
            if (parsed && parsed.executiveSummary) return parsed;
        }

        // SEEDING: Default Daily Briefing
        return {
            executiveSummary: "Market conditions are stabilizing. AI analysis detects rising sentiment for L2 narratives. Recommend increasing engagement frequency to capture early momentum.",
            tacticalPlan: "Execute 2-3 high-impact replies on trending threads. Monitor competitor announcements for 'vampire attack' opportunities.",
            strategicPlan: [
                {
                    action: 'DOUBLE_DOWN',
                    subject: 'Community Engagement',
                    reasoning: 'High organic mentions suggest a breakout moment. Capitalize immediately.'
                },
                {
                    action: 'OPTIMIZE',
                    subject: 'Content Distribution',
                    reasoning: 'Tweet threads are outperforming single posts by 40%.'
                }
            ],
            lastUpdated: 0 // Mark as stale/seed so it auto-regenerates
        };
    } catch (e) {
        // Fallback to seed on ANY error (e.g. corrupt storage)
        return {
            executiveSummary: "Market conditions are stabilizing. AI analysis detects rising sentiment for L2 narratives. Recommend increasing engagement frequency to capture early momentum.",
            tacticalPlan: "Execute 2-3 high-impact replies on trending threads. Monitor competitor announcements for 'vampire attack' opportunities.",
            strategicPlan: [
                {
                    action: 'DOUBLE_DOWN',
                    subject: 'Community Engagement',
                    reasoning: 'High organic mentions suggest a breakout moment. Capitalize immediately.'
                },
                {
                    action: 'OPTIMIZE',
                    subject: 'Content Distribution',
                    reasoning: 'Tweet threads are outperforming single posts by 40%.'
                }
            ],
            metrics: null,
            lastUpdated: 0
        };
    }
};

export const saveGrowthReport = (brandName: string, report: any): void => {
    try {
        const key = `${GROWTH_STORAGE_KEY}_${brandName.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(report));
        saveToCloud(key, report);
    } catch (e) {
        console.error("Failed to save growth report", e);
    }
};

export const fetchGrowthReportFromCloud = async (brandName: string): Promise<any | null> => {
    try {
        const key = `${GROWTH_STORAGE_KEY}_${brandName.toLowerCase()}`;
        const res = await fetchFromCloud(key);
        if (res && res.value) {
            // Update local cache immediately to persist it
            localStorage.setItem(key, JSON.stringify(res.value));
            return res.value;
        }
        return null;
    } catch (e) {
        return null;
    }
};

// --- STRATEGIC POSTURE PERSISTENCE ---

export const loadStrategicPosture = (brandName: string): any => {
    try {
        const key = `${POSTURE_STORAGE_KEY}_${brandName.toLowerCase()}`;
        const stored = localStorage.getItem(key);

        // Background Sync
        fetchFromCloud(key).then(res => {
            if (res && res.value) {
                // If cloud is newer/different, update local & dispatch
                // Simple version: just overwrite local cache if exists
                localStorage.setItem(key, JSON.stringify(res.value));
            }
        });

        if (stored) return JSON.parse(stored);

        // DEFAULT SEED (Migration from hardcoded component)
        return {
            lastUpdated: Date.now(),
            version: "1.0",
            objective: "Establish Defia as the premier authority on DeFi infrastructure and L2 scaling solutions.",
            thesis: "The market is shifting from speculative trading to infrastructure maturity. Defia must position itself not just as a participant, but as a knowledgeable guide through this transition, prioritizing educational depth over engagement farming.",
            timeHorizon: "Q1 - Q2 2026",
            confidenceLevel: "High",
            marketEvidence: [
                { label: "L2 Narrative Strength", value: "High", signal: "positive" },
                { label: "Competitor Saturation", value: "Medium", signal: "neutral" },
                { label: "DeFi Interest", value: "+15% YoY", signal: "positive" }
            ],
            priorities: [
                "Education before promotion",
                "Retention over raw acquisition",
                "Narrative consistency",
                "Measured experimentation"
            ],
            deprioritized: [
                "Short-term hype narratives",
                "Influencer-led speculation",
                "High-frequency posting",
                "Reactionary commentary"
            ],
            constraints: [
                "Adhere to strict compliance regarding financial advice",
                "Maintain neutral tone during market volatility",
                "Resource allocation focused on high-fidelity content"
            ],
            changeLog: [
                { date: "Oct 12, 2025", change: "Shifted focus to L2 Scaling", reason: "Market maturity indicates consolidated interest in scaling solutions." },
                { date: "Jan 10, 2026", change: "Deprioritized Meme-coin coverage", reason: "Brand risk and alignment with long-term infrastructure thesis." }
            ]
        };

    } catch (e) {
        return null; // Should fall back
    }
};

export const saveStrategicPosture = (brandName: string, posture: any): void => {
    try {
        const key = `${POSTURE_STORAGE_KEY}_${brandName.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(posture));
        saveToCloud(key, posture);
        dispatchStorageEvent(STORAGE_EVENTS.POSTURE_UPDATE, { brandName });
    } catch (e) {
        console.error("Failed to save strategic posture", e);
    }
};

// --- HISTORY EVENTS (READ-ONLY) ---

export const fetchBrainHistoryEvents = async (brandName: string): Promise<CalendarEvent[]> => {
    try {
        const registry = getBrandRegistryEntry(brandName);
        const dbBrandId = registry?.brandId;

        if (!dbBrandId) {
            console.warn(`[History] No brand registry entry for ${brandName}.`);
            return [];
        }

        console.log(`[History] Fetching events for brand: "${dbBrandId}"`);

        const { data, error } = await supabase
            .from('brand_memory')
            .select('id, created_at, metadata, content, brand_id')
            .eq('brand_id', dbBrandId)
            .not('content', 'ilike', '%MIGRATED LOG%') // Filter out system logs
            // FIX: Exclude Campaign assets from "History" view as they are managed in the Campaign Scheduler
            // This prevents the "Double Entry" issue and keeps History clean for actual past posts.
            .not('metadata->>source', 'eq', 'Campaigns')
            .order('created_at', { ascending: false })
            .limit(500);

        if (error) {
            console.error('[History] Supabase fetch error:', error);
            // alert(`Error fetching data: ${error.message}`);
            return [];
        }

        const count = data ? data.length : 0;
        console.log(`[History] Found ${count} events for ${dbBrandId}`);

        if (!data || data.length === 0) {
            console.log(`[History] No data found for brand: ${dbBrandId}`);
            return [];
        }

        // Map to Calendar Events
        return data.map((item: any) => {
            // Robust Date Parsing
            const dateStr = parseSocialDate(item.metadata?.date, item.created_at);

            // Content Cleanup
            let displayContent = item.content || "";
            if (displayContent.startsWith('Tweet by @')) {
                // Clean up the prefix for display: "Tweet by @X: "Content"" -> "Content"
                const parts = item.content.split(': "');
                if (parts.length > 1) {
                    displayContent = parts.slice(1).join(': "').slice(0, -1); // Join back in case content had colons, remove last quote
                }
            }

            // Ensure Image Mapping (use mediaUrl from metadata)
            const mediaUrl = item.metadata?.mediaUrl || undefined;

            return {
                id: `history-${item.id}`,
                date: dateStr,
                title: displayContent.substring(0, 50) + (displayContent.length > 50 ? '...' : ''),
                content: displayContent,
                platform: 'Twitter', // Could infer from metadata
                status: 'published',
                campaignName: 'History',
                image: mediaUrl
            };
        });
    } catch (e) {
        console.warn("Failed to fetch history events", e);
        return [];
    }
};

const parseSocialDate = (dateVal: any, createdAt: string): string => {
    try {
        if (!dateVal) return new Date(createdAt).toISOString().split('T')[0];

        // Handle Verbose Format: "Sunday, December 14, 2025 at 3:19 PM"
        let cleanDate = dateVal.toString();
        // Remove day name prefix (e.g. "Sunday, ")
        if (cleanDate.includes(',')) {
            cleanDate = cleanDate.split(', ').slice(1).join(', '); // "December 14, 2025 at 3:19 PM"
        }
        // Replace " at " with space
        cleanDate = cleanDate.replace(' at ', ' ');

        const d = new Date(cleanDate);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }

        // Fallback for Twitter/Other: "Fri Jan 12..."
        const d2 = new Date(dateVal);
        if (!isNaN(d2.getTime())) {
            return d2.toISOString().split('T')[0];
        }

        console.warn(`[History] Date parse failed for: ${dateVal}, falling back to ${createdAt}`);
        return new Date(createdAt).toISOString().split('T')[0];
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
};

// --- SYNC HISTORY IMAGES TO REFERENCE ---
// DEPRECATED: Auto-import disabled to prevent referenceImages bloat
// Images should only be added when explicitly saved/posted by user
export const importHistoryToReferences = async (brandName: string) => {
    console.log(`[Storage] importHistoryToReferences DISABLED - images should only be added explicitly`);
    // NOTE: Auto-import of history images to Brand Kit DISABLED
    // Images should only be added to referenceImages when explicitly:
    // 1. Saved by user from generated content
    // 2. Added to a campaign
    // 3. Posted/published
    // This prevents referenceImages from bloating with every historical tweet
    return;
};
