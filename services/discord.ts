
/**
 * DISCORD LISTENING SERVICE
 * "The Ears" - Channel Scraper
 */

import { ingestContext } from './rag';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

export interface DiscordMessage {
    id: string;
    content: string;
    author: {
        username: string;
        id: string;
    };
    timestamp: string;
}

/**
 * Fetch latest messages from a specific Discord Channel
 * Requires DISCORD_BOT_TOKEN in env.
 */
export const fetchDiscordMessages = async (channelId: string, limit: number = 50): Promise<DiscordMessage[]> => {
    const token = process.env.DISCORD_BOT_TOKEN || process.env.NEXT_PUBLIC_DISCORD_BOT_TOKEN;

    if (!token) {
        console.warn("Missing DISCORD_BOT_TOKEN");
        return [];
    }

    try {
        const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages?limit=${limit}`, {
            headers: {
                Authorization: `Bot ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`Discord API Error: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        return data as DiscordMessage[];

    } catch (error) {
        console.error("Failed to fetch Discord messages", error);
        return [];
    }
};

/**
 * Scan a channel and ingest relevant messages into RAG memory.
 */
export const scanDiscordChannel = async (channelId: string, channelName: string) => {
    console.log(`[Discord] Scanning channel: ${channelName} (${channelId})...`);

    // 1. Fetch Messages
    // Note: If no token is present, this returns []
    const messages = await fetchDiscordMessages(channelId);

    if (messages.length === 0) {
        return { success: false, count: 0, message: "No messages found or configuration missing." };
    }

    // 2. Filter & Ingest
    let ingestedCount = 0;
    for (const msg of messages) {
        // Skip short messages or bot commands
        if (msg.content.length < 10 || msg.content.startsWith('!')) continue;

        const content = `[DISCORD] @${msg.author.username} in #${channelName}: ${msg.content}`;

        // Ingest into RAG
        // We use the message ID as part of the source to avoid duplicates if specific logic existed,
        // but `ingestContext` handles dedupe by content content mostly.
        await ingestContext(content, 'DISCORD', {
            type: 'social_sentiment',
            platform: 'discord',
            channel: channelName,
            author: msg.author.username,
            timestamp: msg.timestamp
        });

        ingestedCount++;
    }

    return { success: true, count: ingestedCount, message: `Successfully scanned ${ingestedCount} messages.` };
};
