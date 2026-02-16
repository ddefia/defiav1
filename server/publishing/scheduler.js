import cron from 'node-cron';
import { fetchActiveBrands } from '../agent/brandRegistry.js';
import { fetchAutomationSettings, getSupabaseClient } from '../agent/brandContext.js';
import { isXConfigured, postTweet, uploadMedia } from './xClient.js';

const CALENDAR_STORAGE_KEY = 'defia_calendar_events_v1';

const normalizeKey = (value) => String(value || '').toLowerCase();

const fetchCalendarEvents = async (supabase, brandName) => {
    const suffix = `${CALENDAR_STORAGE_KEY}_${normalizeKey(brandName)}`;

    // Client stores with user-scoped keys like "abc12345:abc12345_defia_calendar_events_v1_brand"
    // Try pattern match first, then fall back to exact key for legacy data
    const { data: scopedRows } = await supabase
        .from('app_storage')
        .select('key, value')
        .like('key', `%${suffix}`)
        .order('updated_at', { ascending: false })
        .limit(1);

    if (scopedRows && scopedRows.length > 0 && scopedRows[0].value) {
        const row = scopedRows[0];
        return { key: row.key, events: Array.isArray(row.value) ? row.value : [] };
    }

    // Fallback: try exact key (legacy unscoped)
    const { data, error } = await supabase
        .from('app_storage')
        .select('key, value')
        .eq('key', suffix)
        .maybeSingle();

    if (error || !data?.value) {
        return { key: suffix, events: [] };
    }
    return { key: data.key, events: Array.isArray(data.value) ? data.value : [] };
};

const saveCalendarEvents = async (supabase, key, events) => {
    await supabase
        .from('app_storage')
        .upsert({ key, value: events, updated_at: new Date().toISOString() });
};

const parseEventDateTime = (event) => {
    if (!event) return null;
    if (event.scheduledAt) {
        const parsed = new Date(event.scheduledAt);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (!event.date) return null;
    const time = event.time && event.time.length >= 4 ? event.time : '09:00';
    const parsed = new Date(`${event.date}T${time}:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const shouldPublish = (event, now) => {
    if (!event || event.status !== 'scheduled') return false;
    if (event.approvalStatus && event.approvalStatus !== 'approved') return false;
    const eventDateTime = parseEventDateTime(event);
    if (!eventDateTime) return false;
    return eventDateTime.getTime() <= now.getTime();
};

const shouldRetry = (event) => {
    const attempts = event.publishAttempts || 0;
    if (attempts < 3) return true;
    const lastAttempt = event.lastPublishAttemptAt ? new Date(event.lastPublishAttemptAt).getTime() : 0;
    if (!lastAttempt) return true;
    return Date.now() - lastAttempt > 12 * 60 * 60 * 1000;
};

const truncateTweet = (text) => {
    const trimmed = String(text || '').trim();
    if (trimmed.length <= 280) return trimmed;
    return `${trimmed.slice(0, 277).trim()}...`;
};

const publishEvent = async (event, credentials) => {
    const text = truncateTweet(event.content || '');
    if (!text) throw new Error('Empty content');

    let mediaIds = [];
    if (event.image) {
        const mediaId = await uploadMedia(event.image, credentials);
        if (mediaId) mediaIds = [mediaId];
    }

    const result = await postTweet({ text, mediaIds }, credentials);
    return {
        postId: result?.id || result?.data?.id || null,
        raw: result
    };
};

export const runPublishingCycle = async ({ label = 'Scheduled Publish Run', brandIdentifier } = {}) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return { error: 'Supabase not configured' };
    }
    const now = new Date();
    const brands = await fetchActiveBrands(supabase);
    const registry = brands.length > 0 ? brands : [];

    const results = [];

    for (const brand of registry) {
        if (brandIdentifier && normalizeKey(brand.id) !== normalizeKey(brandIdentifier) && normalizeKey(brand.name) !== normalizeKey(brandIdentifier)) {
            continue;
        }

        const automation = await fetchAutomationSettings(supabase, brand.id);
        if (!automation.enabled) {
            results.push({ brandId: brand.id, skipped: true, reason: 'Automation disabled' });
            continue;
        }

        const { data: integration } = await supabase
            .from('brand_integrations')
            .select('metadata')
            .eq('brand_id', brand.id)
            .maybeSingle();

        const xCredentials = integration?.metadata?.xCredentials || null;
        const brandCredentials = isXConfigured(xCredentials) ? xCredentials : null;
        const hasCredentials = Boolean(brandCredentials) || isXConfigured();
        if (!hasCredentials) {
            results.push({ brandId: brand.id, skipped: true, reason: 'Missing X credentials' });
            continue;
        }

        const { key, events } = await fetchCalendarEvents(supabase, brand.name || brand.id);
        if (!events.length) {
            results.push({ brandId: brand.id, published: 0 });
            continue;
        }

        let changed = false;
        let publishedCount = 0;

        for (const event of events) {
            if (!event.platform || String(event.platform).toLowerCase() !== 'twitter') continue;
            if (!shouldPublish(event, now)) continue;
            if (!shouldRetry(event)) continue;

            event.lastPublishAttemptAt = new Date().toISOString();
            event.publishAttempts = (event.publishAttempts || 0) + 1;

            try {
                const result = await publishEvent(event, brandCredentials || undefined);
                event.status = 'published';
                event.approvalStatus = 'published';
                event.publishedAt = new Date().toISOString();
                event.platformPostId = result.postId;
                event.publishError = null;
                publishedCount += 1;
            } catch (e) {
                event.publishError = e?.message || 'Publish failed';
            } finally {
                changed = true;
            }
        }

        if (changed) {
            await saveCalendarEvents(supabase, key, events);
        }

        results.push({ brandId: brand.id, published: publishedCount });
    }

    return { label, processed: results.length, results };
};

export const startPublishing = () => {
    console.log("🚀 Publisher: Online & Monitoring...");
    cron.schedule('*/10 * * * *', async () => {
        await runPublishingCycle({ label: 'Cron Publish Run' });
    });
};
