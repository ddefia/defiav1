/**
 * TELEGRAM NOTIFIER
 * Push notifications to linked Telegram groups.
 * Called from the agent scheduler after briefings and decisions.
 */

import { sendMessage, isConfigured } from './telegramClient.js';
import { getLinkedChats } from './linkManager.js';
import { formatDailyBriefing, formatAgentDecision } from './messageFormatter.js';

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
            .select('config')
            .eq('id', brandId)
            .maybeSingle();
        if (brandRow?.config?.name) brandName = brandRow.config.name;
    } catch { /* ignore */ }

    switch (type) {
        case 'briefing': {
            // Fetch the latest report from app_storage
            const storageKey = `defia_growth_report_v1_${brandId.toLowerCase()}`;
            const { data, error } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', storageKey)
                .maybeSingle();

            if (error || !data?.value) {
                console.warn(`[Telegram Notifier] No briefing found for ${brandId}`);
                return;
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
