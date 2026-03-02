/**
 * TELEGRAM NOTIFIER
 * Push notifications to linked Telegram groups.
 * Called from the agent scheduler after briefings and decisions.
 */

import { sendMessage, isConfigured } from './telegramClient.js';
import { getLinkedChats } from './linkManager.js';
import { formatDailyBriefing, formatAgentDecision, formatRecommendationsBatch } from './messageFormatter.js';

// ━━━ Main Notify Function ━━━

const notifyLinkedChats = async (supabase, brandId, type, payload = null) => {
    if (!isConfigured()) return; // Telegram not set up — silently skip
    if (!supabase || !brandId) return;

    const chats = await getLinkedChats(supabase, brandId);
    if (chats.length === 0) return;

    // Only notify chats with notifications enabled
    const activeChats = chats.filter(c => c.notifications_enabled !== false);
    if (activeChats.length === 0) return;

    let message = '';

    // Resolve brand name
    let brandName = brandId;
    try {
        const { data: brandRow } = await supabase
            .from('brands')
            .select('name')
            .eq('id', brandId)
            .maybeSingle();
        if (brandRow?.name) brandName = brandRow.name;
    } catch { /* ignore */ }

    switch (type) {
        case 'briefing': {
            // Fetch the latest report from app_storage
            const storageKey = `defia_growth_report_v1_${brandId.toLowerCase()}`;
            const { data, error } = await supabase
                .from('app_storage')
                .select('value, updated_at')
                .eq('key', storageKey)
                .maybeSingle();

            if (error || !data?.value) {
                console.warn(`[Telegram Notifier] No briefing found for ${brandId}`);
                return;
            }

            // Don't re-send stale briefings — only notify if updated within last 4 hours
            // This prevents sending the same old briefing when generation fails
            if (data.updated_at) {
                const age = Date.now() - new Date(data.updated_at).getTime();
                if (age > 4 * 60 * 60 * 1000) {
                    console.warn(`[Telegram Notifier] Briefing for ${brandId} is ${Math.round(age / 3600000)}h old — skipping stale notification`);
                    return;
                }
            }

            message = formatDailyBriefing(data.value, brandName);
            break;
        }

        case 'decision': {
            if (!payload || !payload.action || payload.action === 'NO_ACTION' || payload.action === 'ERROR') {
                return; // Don't notify for non-actions
            }
            message = formatAgentDecision(payload);
            break;
        }

        case 'recommendations': {
            // Batch notification — payload is array of actions (supports both old and rich format)
            if (!payload || !Array.isArray(payload) || payload.length === 0) return;
            const validActions = payload.filter(a => {
                const actionType = a.type || a.action;
                return actionType && actionType !== 'NO_ACTION' && actionType !== 'ERROR';
            });
            if (validActions.length === 0) return;
            const siteUrl = process.env.FRONTEND_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
            message = formatRecommendationsBatch(validActions, brandName, siteUrl);
            break;
        }

        case 'raw_text': {
            // Pre-formatted message from client — send as-is
            if (!payload || typeof payload !== 'string') return;
            message = payload;
            break;
        }

        default:
            console.warn(`[Telegram Notifier] Unknown notification type: ${type}`);
            return;
    }

    if (!message) return;

    // Send to all active chats with small delay between messages (rate limiting)
    for (let i = 0; i < activeChats.length; i++) {
        const chat = activeChats[i];
        try {
            await sendMessage(chat.chat_id, message, { parseMode: 'MarkdownV2' });
        } catch (e) {
            console.warn(`[Telegram Notifier] Failed to notify chat ${chat.chat_id}: ${e.message}`);

            // If bot was kicked from group (403), clean up the link
            if (e.message?.includes('403') || e.message?.includes('bot was kicked') || e.message?.includes('chat not found')) {
                console.log(`[Telegram Notifier] Removing stale link for chat ${chat.chat_id}`);
                try {
                    await supabase.from('telegram_links').delete().eq('chat_id', chat.chat_id);
                } catch { /* ignore cleanup failures */ }
            }
        }

        // Small delay between messages to respect Telegram rate limits
        if (i < activeChats.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
};

export { notifyLinkedChats };
