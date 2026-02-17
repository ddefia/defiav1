/**
 * TELEGRAM WEBHOOK HANDLER
 * Main entry point for incoming Telegram messages.
 * Validates → routes → classifies → generates → responds.
 */

import { sendMessage, editMessageText, sendPhoto, getFile } from './telegramClient.js';
import { validateAndLink, getLinkedBrand, unlinkChat } from './linkManager.js';
import { classifyMessage, INTENTS } from './intentClassifier.js';
import {
    generateTweet,
    generateImage,
    generateChatResponse,
    analyzeImage,
    summarizeTrends,
    getRecentRecommendations,
    getLatestBriefing,
} from './contentGenerator.js';
import {
    formatDailyBriefing,
    formatAgentDecision,
    formatTweetDraft,
    formatTrendSummary,
    formatWelcome,
    formatHelp,
    formatChatResponse,
    formatError,
} from './messageFormatter.js';
import { fetchBrandProfile, getSupabaseClient } from '../agent/brandContext.js';

// ━━━ Chat History Helper ━━━

const HISTORY_KEY_PREFIX = 'telegram_chat_history_';
const MAX_HISTORY = 20;

const loadChatHistory = async (supabase, chatId) => {
    if (!supabase) return [];
    try {
        const { data } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', `${HISTORY_KEY_PREFIX}${chatId}`)
            .maybeSingle();
        return (data?.value || []).slice(-MAX_HISTORY);
    } catch {
        return [];
    }
};

const saveChatHistory = async (supabase, chatId, history) => {
    if (!supabase) return;
    try {
        await supabase.from('app_storage').upsert({
            key: `${HISTORY_KEY_PREFIX}${chatId}`,
            value: history.slice(-MAX_HISTORY),
            updated_at: new Date().toISOString(),
        });
    } catch (e) {
        console.warn('[Telegram] Failed to save chat history:', e.message);
    }
};

// ━━━ Main Handler ━━━

const handleTelegramWebhook = async (req, res) => {
    // Validate webhook secret
    const secret = req.params?.secret;
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
        return res.status(403).json({ error: 'Invalid webhook secret' });
    }

    // Immediately respond 200 to Telegram (prevent retries)
    res.status(200).json({ ok: true });

    // Process message asynchronously
    try {
        await processMessage(req.body);
    } catch (e) {
        console.error('[Telegram] Webhook processing error:', e.message);
    }
};

const processMessage = async (update) => {
    const message = update?.message;
    if (!message) return; // Ignore non-message updates for now

    const chatId = message.chat?.id;
    const text = message.text || message.caption || '';
    const username = message.from?.username || message.from?.first_name || 'Unknown';
    const chatTitle = message.chat?.title || '';
    const chatType = message.chat?.type || 'private';
    const hasPhoto = message.photo && message.photo.length > 0;

    if (!chatId) return;

    const supabase = getSupabaseClient();

    // ━━━ Command Routing ━━━

    if (text.startsWith('/')) {
        const [command, ...args] = text.split(/\s+/);
        const cmd = command.toLowerCase().split('@')[0]; // Remove @botname suffix

        switch (cmd) {
            case '/start': {
                // Check if there's a link code in the deep link parameter
                const startParam = args[0];
                if (startParam && supabase) {
                    const result = await validateAndLink(supabase, startParam, chatId, chatTitle, chatType, username);
                    if (result.success) {
                        await sendMessage(chatId, formatWelcome() + `\n\n\u2705 ${formatChatResponse(`Linked to ${result.brandName}! You're all set.`)}`, { parseMode: 'MarkdownV2' });
                        return;
                    }
                }
                await sendMessage(chatId, formatWelcome(), { parseMode: 'MarkdownV2' });
                return;
            }

            case '/link': {
                const code = args[0];
                if (!code) {
                    await sendMessage(chatId, formatError('Usage: /link YOUR_CODE'), { parseMode: 'MarkdownV2' });
                    return;
                }
                if (!supabase) {
                    await sendMessage(chatId, formatError('Service temporarily unavailable'), { parseMode: 'MarkdownV2' });
                    return;
                }
                const result = await validateAndLink(supabase, code, chatId, chatTitle, chatType, username);
                if (result.success) {
                    await sendMessage(chatId, formatChatResponse(`\u2705 Linked to ${result.brandName}! I'll send daily briefings and AI recommendations here. Type /help to see what I can do.`), { parseMode: 'MarkdownV2' });
                } else {
                    await sendMessage(chatId, formatError(result.error || 'Invalid or expired link code'), { parseMode: 'MarkdownV2' });
                }
                return;
            }

            case '/unlink': {
                if (!supabase) {
                    await sendMessage(chatId, formatError('Service temporarily unavailable'), { parseMode: 'MarkdownV2' });
                    return;
                }
                const result = await unlinkChat(supabase, chatId);
                if (result.success) {
                    await sendMessage(chatId, formatChatResponse('\u{1F44B} Unlinked. I won\'t send any more updates to this chat.'), { parseMode: 'MarkdownV2' });
                } else {
                    await sendMessage(chatId, formatError('Failed to unlink'), { parseMode: 'MarkdownV2' });
                }
                return;
            }

            case '/status': {
                if (!supabase) {
                    await sendMessage(chatId, formatError('Service temporarily unavailable'), { parseMode: 'MarkdownV2' });
                    return;
                }
                const linked = await getLinkedBrand(supabase, chatId);
                if (linked) {
                    await sendMessage(chatId, formatChatResponse(`\u{1F517} Linked to: ${linked.brandName}\nNotifications: ${linked.notificationsEnabled ? 'On' : 'Off'}`), { parseMode: 'MarkdownV2' });
                } else {
                    await sendMessage(chatId, formatChatResponse('Not linked to any brand. Use /link CODE to connect.'), { parseMode: 'MarkdownV2' });
                }
                return;
            }

            case '/brief': {
                await handleBriefingCommand(supabase, chatId);
                return;
            }

            case '/help': {
                await sendMessage(chatId, formatHelp(), { parseMode: 'MarkdownV2' });
                return;
            }

            default:
                // Unknown command — treat as natural language (fall through)
                break;
        }
    }

    // ━━━ Natural Language Processing ━━━

    // Resolve brand
    if (!supabase) {
        await sendMessage(chatId, formatError('Service temporarily unavailable'), { parseMode: 'MarkdownV2' });
        return;
    }

    const linked = await getLinkedBrand(supabase, chatId);
    if (!linked) {
        await sendMessage(chatId, formatChatResponse('This chat isn\'t linked to a brand yet. Use /link CODE to connect.'), { parseMode: 'MarkdownV2' });
        return;
    }

    const brandProfile = await fetchBrandProfile(supabase, linked.brandId);
    if (!brandProfile) {
        await sendMessage(chatId, formatError('Brand profile not found. Try relinking.'), { parseMode: 'MarkdownV2' });
        return;
    }

    // Send "thinking" indicator
    const thinkingMsg = await sendMessage(chatId, formatChatResponse('\u{1F914} Thinking...'), { parseMode: 'MarkdownV2' });
    const thinkingMsgId = thinkingMsg?.message_id;

    try {
        // Handle image input
        let imageBase64 = null;
        let imageAnalysis = '';
        if (hasPhoto) {
            try {
                const photos = message.photo;
                const largestPhoto = photos[photos.length - 1]; // Telegram sends multiple sizes
                const fileBuffer = await getFile(largestPhoto.file_id);
                imageBase64 = fileBuffer.toString('base64');
                imageAnalysis = await analyzeImage(imageBase64, text);
            } catch (e) {
                console.warn('[Telegram] Image processing failed:', e.message);
            }
        }

        // Load chat history for context
        const chatHistory = await loadChatHistory(supabase, chatId);

        // Classify intent
        const { intent, params } = await classifyMessage(
            text || imageAnalysis,
            hasPhoto,
            chatHistory,
            brandProfile
        );

        let responseText = '';
        let responseImage = null;

        // ━━━ Execute by Intent ━━━

        switch (intent) {
            case INTENTS.DRAFT_CONTENT: {
                const topic = params.topic || text;
                const tweet = await generateTweet(topic, brandProfile);
                responseText = formatTweetDraft(tweet);
                break;
            }

            case INTENTS.GENERATE_IMAGE: {
                const prompt = params.imagePrompt || text;
                const enrichedPrompt = imageAnalysis
                    ? `${prompt}\n\nReference image analysis: ${imageAnalysis}`
                    : prompt;
                responseImage = await generateImage(enrichedPrompt, brandProfile);
                if (responseImage) {
                    responseText = null; // Will send as photo instead
                } else {
                    responseText = formatError('Image generation failed. Try describing what you want differently.');
                }
                break;
            }

            case INTENTS.ANALYZE_TRENDS: {
                const { summary, trends } = await summarizeTrends(linked.brandId, supabase);
                if (trends.length > 0) {
                    responseText = formatTrendSummary(trends) + '\n\n' + formatChatResponse(summary);
                } else {
                    responseText = formatChatResponse(summary || 'No trends data available right now.');
                }
                break;
            }

            case INTENTS.USE_RECOMMENDATION: {
                const recommendations = await getRecentRecommendations(linked.brandId, supabase);
                if (recommendations.length === 0) {
                    responseText = formatChatResponse('No recent recommendations found. The AI agent generates these during its scheduled analysis cycles.');
                    break;
                }

                const num = params.recommendationNumber;
                const rec = num && num <= recommendations.length
                    ? recommendations[num - 1]
                    : recommendations[0];

                // Generate a tweet from the recommendation
                const topic = `${rec.action}: ${rec.reason || rec.draft || 'AI recommendation'}`;
                const tweet = await generateTweet(topic, brandProfile);
                responseText = formatAgentDecision(rec) + '\n\n' + formatTweetDraft(tweet, 'Generated from this recommendation');
                break;
            }

            case INTENTS.GET_BRIEFING: {
                await handleBriefingCommand(supabase, chatId, thinkingMsgId);
                // Save to history
                chatHistory.push({ role: 'user', text, timestamp: Date.now() });
                chatHistory.push({ role: 'assistant', text: '(briefing sent)', timestamp: Date.now() });
                await saveChatHistory(supabase, chatId, chatHistory);
                return; // Already handled
            }

            case INTENTS.GENERAL_CHAT:
            default: {
                const contextParts = [];
                if (imageAnalysis) contextParts.push(`User's image: ${imageAnalysis}`);

                const response = await generateChatResponse(
                    text || 'The user sent an image.',
                    chatHistory,
                    brandProfile,
                    contextParts.join('\n')
                );
                responseText = formatChatResponse(response);
                break;
            }
        }

        // ━━━ Send Response ━━━

        if (responseImage) {
            // Delete thinking message first
            if (thinkingMsgId) {
                try { await editMessageText(chatId, thinkingMsgId, formatChatResponse('Done!'), { parseMode: 'MarkdownV2' }); } catch { /* ignore */ }
            }
            const caption = text ? `Generated from: "${text.slice(0, 100)}"` : 'Generated image';
            await sendPhoto(chatId, responseImage, caption);
        } else if (responseText) {
            // Edit thinking message with the real response
            if (thinkingMsgId) {
                try {
                    await editMessageText(chatId, thinkingMsgId, responseText, { parseMode: 'MarkdownV2' });
                } catch {
                    // If edit fails (e.g., message too old), send new message
                    await sendMessage(chatId, responseText, { parseMode: 'MarkdownV2' });
                }
            } else {
                await sendMessage(chatId, responseText, { parseMode: 'MarkdownV2' });
            }
        }

        // Save to chat history
        chatHistory.push({ role: 'user', text: text || '(image)', timestamp: Date.now() });
        chatHistory.push({ role: 'assistant', text: responseText?.slice(0, 200) || '(image sent)', timestamp: Date.now() });
        await saveChatHistory(supabase, chatId, chatHistory);

    } catch (e) {
        console.error('[Telegram] Processing failed:', e.message);
        const errorMsg = formatError('Something went wrong. Please try again.');
        if (thinkingMsgId) {
            try { await editMessageText(chatId, thinkingMsgId, errorMsg, { parseMode: 'MarkdownV2' }); } catch { /* ignore */ }
        } else {
            await sendMessage(chatId, errorMsg, { parseMode: 'MarkdownV2' });
        }
    }
};

// ━━━ Briefing Command ━━━

const handleBriefingCommand = async (supabase, chatId, editMsgId) => {
    const linked = await getLinkedBrand(supabase, chatId);
    if (!linked) {
        await sendMessage(chatId, formatChatResponse('Not linked to a brand. Use /link CODE first.'), { parseMode: 'MarkdownV2' });
        return;
    }

    const report = await getLatestBriefing(linked.brandId, supabase);
    if (!report) {
        const msg = formatChatResponse('No briefing available yet. The AI generates briefings daily at 6:00 AM.');
        if (editMsgId) {
            try { await editMessageText(chatId, editMsgId, msg, { parseMode: 'MarkdownV2' }); } catch { /* ignore */ }
        } else {
            await sendMessage(chatId, msg, { parseMode: 'MarkdownV2' });
        }
        return;
    }

    const formatted = formatDailyBriefing(report, linked.brandName);
    if (editMsgId) {
        try { await editMessageText(chatId, editMsgId, formatted, { parseMode: 'MarkdownV2' }); } catch { /* ignore */ }
    } else {
        await sendMessage(chatId, formatted, { parseMode: 'MarkdownV2' });
    }
};

export { handleTelegramWebhook };
