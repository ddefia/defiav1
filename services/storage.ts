import { BrandConfig, PulseCache, CalendarEvent } from "../types";
import { DEFAULT_PROFILES } from './brandData';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'ethergraph_brand_profiles_v17';
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
    apify?: string;
    lunarCrush?: string;
    supabaseUrl?: string; // New
    supabaseKey?: string; // New
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

// --- HISTORY EVENTS (READ-ONLY) ---

export const fetchBrainHistoryEvents = async (brandName: string): Promise<CalendarEvent[]> => {
    try {
        // Robust Brand ID Sanitization
        // 1. Trim whitespace
        // 2. Handles case-insensitivity at DB level
        const dbBrandId = brandName.trim();

        console.log(`[History] Fetching events for brand: "${dbBrandId}"`);

        const { data, error } = await supabase
            .from('brain_memory')
            .select('id, created_at, metadata, content, brand_id')
            .ilike('brand_id', dbBrandId) // Case insensitive match ('Metis' == 'metis')
            .not('content', 'ilike', '%MIGRATED LOG%') // Filter out system logs
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
export const importHistoryToReferences = async (brandName: string) => {
    try {
        if (!brandName) return;
        const profiles = loadBrandProfiles();
        const profile = profiles[brandName];
        if (!profile) return;

        // Fetch History
        const events = await fetchBrainHistoryEvents(brandName);
        const imageEvents = events.filter(e => e.image && e.image.startsWith('http'));

        if (imageEvents.length === 0) return;

        let hasUpdates = false;
        const existingUrls = new Set(profile.referenceImages.map(r => r.url));

        imageEvents.forEach(e => {
            if (e.image && !existingUrls.has(e.image)) {
                profile.referenceImages.push({
                    id: `ref-${e.id}`,
                    url: e.image,
                    name: `Tweet Image ${e.date}`
                });
                existingUrls.add(e.image);
                hasUpdates = true;
            }
        });

        if (hasUpdates) {
            console.log(`[Storage] Importing ${imageEvents.length} new images from history to references.`);
            profiles[brandName] = profile;
            saveBrandProfiles(profiles, true); // save and dispatch update
            // alert(`Imported ${imageEvents.length} images from History to Brand KIt.`);
        }

    } catch (e) {
        console.error("Failed to import history images:", e);
    }
};
