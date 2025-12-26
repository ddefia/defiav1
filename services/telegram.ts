
/**
 * TELEGRAM LISTENING SERVICE
 * "The Ears" - Public Group/Channel Scraper
 */

import { ingestContext } from './rag';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export interface TelegramMessage {
    message_id: number;
    text?: string;
    caption?: string; // For images
    date: number;
    from?: {
        username?: string;
        first_name?: string;
    };
    chat: {
        title?: string;
        username?: string;
    }
}

/**
 * Fetch updates/messages from Telegram.
 * Note: Telegram Bot API "getUpdates" is for the bot's own chat history.
 * For scraping public channels, proper Telegram Client API (MTProto) is usually needed.
 * However, simpler bots can read messages if they are added to the group.
 * 
 * For this implementation, we assume the bot is in the group and calls `getUpdates` 
 * or we use a web-scraping fallback key if available (like Apify/Telegram-Scraper).
 * 
 * We will assume a standard Bot API `getUpdates` approach for now.
 */
export const fetchTelegramUpdates = async (): Promise<any[]> => {
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;

    if (!token) {
        console.warn("Missing TELEGRAM_BOT_TOKEN");
        return [];
    }

    try {
        const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getUpdates`);
        const data = await response.json();

        if (!data.ok) {
            console.error("Telegram API Error:", data.description);
            return [];
        }

        return data.result;
    } catch (e) {
        console.error("Failed to fetch Telegram updates", e);
        return [];
    }
};

/**
 * Scan connected Telegram chats and ingest into RAG.
 */
export const scanTelegramChats = async () => {
    console.log(`[Telegram] Scanning connected chats...`);

    const updates = await fetchTelegramUpdates();

    if (updates.length === 0) {
        return { success: false, count: 0, message: "No updates found or configuration missing." };
    }

    let ingestedCount = 0;

    for (const update of updates) {
        const msg = update.message || update.channel_post;
        if (!msg) continue;

        const text = msg.text || msg.caption;
        if (!text || text.length < 10) continue;

        const sender = msg.from?.username || msg.from?.first_name || "Unknown";
        const chatName = msg.chat.title || msg.chat.username || "Telegram Chat";

        const content = `[TELEGRAM] ${sender} in ${chatName}: ${text}`;

        await ingestContext(content, 'TELEGRAM', {
            type: 'social_sentiment',
            platform: 'telegram',
            chat: chatName,
            author: sender,
            timestamp: msg.date
        });

        ingestedCount++;
    }

    return { success: true, count: ingestedCount, message: `Successfully scanned ${ingestedCount} messages.` };
};
