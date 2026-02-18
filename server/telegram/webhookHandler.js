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

// ━━━ Safe Send Helper (MarkdownV2 fallback to plaintext) ━━━

const safeSend = async (chatId, text, options = {}) => {
    try {
        return await sendMessage(chatId, text, { parseMode: 'MarkdownV2', ...options });
    } catch (e) {
        // If MarkdownV2 fails (bad escaping), retry as plain text
        if (e.message?.includes('parse') || e.message?.includes('entities') || e.message?.includes('can\'t')) {
            const plain = text.replace(/\\([_*[\]()~`>#+=|{}.!\-])/g, '$1');
            return await sendMessage(chatId, plain);
        }
        throw e;
    }
};

const safeEdit = async (chatId, msgId, text, options = {}) => {
    try {
        return await editMessageText(chatId, msgId, text, { parseMode: 'MarkdownV2', ...options });
    } catch (e) {
        if (e.message?.includes('parse') || e.message?.includes('entities') || e.message?.includes('can\'t')) {
            const plain = text.replace(/\\([_*[\]()~`>#+=|{}.!\-])/g, '$1');
            return await editMessageText(chatId, msgId, plain);
        }
        throw e;
    }
};

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
                        await safeSend(chatId, formatWelcome() + `\n\n\u2705 ${formatChatResponse(`Linked to ${result.brandName}! You're all set.`)}`);
                        return;
                    }
                }
                await safeSend(chatId, formatWelcome());
                return;
            }

            case '/link': {
                const code = args[0];
                if (!code) {
                    await safeSend(chatId, formatError('Usage: /link YOUR_CODE'));
                    return;
                }
                if (!supabase) {
                    await safeSend(chatId, formatError('Service temporarily unavailable'));
                    return;
                }
                const result = await validateAndLink(supabase, code, chatId, chatTitle, chatType, username);
                if (result.success) {
                    await safeSend(chatId, formatChatResponse(`\u2705 Linked to ${result.brandName}! I'll send daily briefings and AI recommendations here. Type /help to see what I can do.`));
                } else {
                    await safeSend(chatId, formatError(result.error || 'Invalid or expired link code'));
                }
                return;
            }

            case '/unlink': {
                if (!supabase) {
                    await safeSend(chatId, formatError('Service temporarily unavailable'));
                    return;
                }
                const result = await unlinkChat(supabase, chatId);
                if (result.success) {
                    await safeSend(chatId, formatChatResponse('\u{1F44B} Unlinked. I won\'t send any more updates to this chat.'));
                } else {
                    await safeSend(chatId, formatError('Failed to unlink'));
                }
                return;
            }

            case '/status': {
                if (!supabase) {
                    await safeSend(chatId, formatError('Service temporarily unavailable'));
                    return;
                }
                const linked = await getLinkedBrand(supabase, chatId);
                if (linked) {
                    await safeSend(chatId, formatChatResponse(`\u{1F517} Linked to: ${linked.brandName}\nNotifications: ${linked.notificationsEnabled ? 'On' : 'Off'}`));
                } else {
                    await safeSend(chatId, formatChatResponse('Not linked to any brand. Use /link CODE to connect.'));
                }
                return;
            }

            case '/brief': {
                await handleBriefingCommand(supabase, chatId);
                return;
            }

            case '/recommendations':
            case '/recs': {
                await handleRecommendationsCommand(supabase, chatId);
                return;
            }

            case '/help': {
                await safeSend(chatId, formatHelp());
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
        await safeSend(chatId, formatError('Service temporarily unavailable'));
        return;
    }

    const linked = await getLinkedBrand(supabase, chatId);
    if (!linked) {
        await safeSend(chatId, formatChatResponse('This chat isn\'t linked to a brand yet. Use /link CODE to connect.'));
        return;
    }

    const brandProfile = await fetchBrandProfile(supabase, linked.brandId);
    if (!brandProfile) {
        await safeSend(chatId, formatError('Brand profile not found. Try relinking.'));
        return;
    }

    // Send "thinking" indicator
    const thinkingMsg = await safeSend(chatId, formatChatResponse('\u{1F914} Thinking...'));
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
                try {
                    responseImage = await generateImage(enrichedPrompt, brandProfile);
                } catch (e) {
                    console.warn('[Telegram] Image generation error:', e.message);
                    responseImage = null;
                }
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

                // Enrich chat with recent recommendations + briefing (AI CMO mode)
                const enrichment = {};
                try {
                    const [recs, briefing] = await Promise.all([
                        getRecentRecommendations(linked.brandId, supabase, 3),
                        getLatestBriefing(linked.brandId, supabase),
                    ]);
                    if (recs.length > 0) enrichment.recentRecommendations = recs;
                    if (briefing?.executiveSummary) enrichment.briefingSummary = briefing.executiveSummary;
                } catch { /* non-critical */ }

                const response = await generateChatResponse(
                    text || 'The user sent an image.',
                    chatHistory,
                    brandProfile,
                    contextParts.join('\n'),
                    enrichment
                );
                responseText = formatChatResponse(response);
                break;
            }
        }

        // ━━━ Send Response ━━━

        if (responseImage) {
            // Delete thinking message first
            if (thinkingMsgId) {
                try { await safeEdit(chatId, thinkingMsgId, formatChatResponse('Done!')); } catch { /* ignore */ }
            }
            const caption = text ? `Generated from: "${text.slice(0, 100)}"` : 'Generated image';
            await sendPhoto(chatId, responseImage, caption);
        } else if (responseText) {
            // Edit thinking message with the real response
            if (thinkingMsgId) {
                try {
                    await safeEdit(chatId, thinkingMsgId, responseText);
                } catch {
                    // If edit fails (e.g., message too old), send new message
                    await safeSend(chatId, responseText);
                }
            } else {
                await safeSend(chatId, responseText);
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
            try { await safeEdit(chatId, thinkingMsgId, errorMsg); } catch { /* ignore */ }
        } else {
            try { await safeSend(chatId, errorMsg); } catch { /* ignore */ }
        }
    }
};

// ━━━ Briefing Command ━━━

const handleBriefingCommand = async (supabase, chatId, editMsgId) => {
    const linked = await getLinkedBrand(supabase, chatId);
    if (!linked) {
        await safeSend(chatId, formatChatResponse('Not linked to a brand. Use /link CODE first.'));
        return;
    }

    const report = await getLatestBriefing(linked.brandId, supabase);
    if (!report) {
        const msg = formatChatResponse('No briefing available yet. The AI generates briefings daily at 6:00 AM.');
        if (editMsgId) {
            try { await safeEdit(chatId, editMsgId, msg); } catch { /* ignore */ }
        } else {
            await safeSend(chatId, msg);
        }
        return;
    }

    const formatted = formatDailyBriefing(report, linked.brandName);
    if (editMsgId) {
        try { await safeEdit(chatId, editMsgId, formatted); } catch { /* ignore */ }
    } else {
        await safeSend(chatId, formatted);
    }
};

// ━━━ Recommendations Command ━━━

const handleRecommendationsCommand = async (supabase, chatId) => {
    const linked = await getLinkedBrand(supabase, chatId);
    if (!linked) {
        await safeSend(chatId, formatChatResponse('Not linked to a brand. Use /link CODE first.'));
        return;
    }

    const recommendations = await getRecentRecommendations(linked.brandId, supabase, 5);
    if (recommendations.length === 0) {
        await safeSend(chatId, formatChatResponse('No recent recommendations. The AI agent generates these during scheduled analysis cycles (every 6 hours).'));
        return;
    }

    const lines = [`\u{1F4CB} *Recent AI Recommendations*\n`];
    recommendations.forEach((rec, i) => {
        const icon = rec.action === 'REPLY' ? '\u21A9\uFE0F'
            : rec.action === 'TREND_JACK' ? '\u26A1'
            : rec.action === 'CAMPAIGN' ? '\u{1F4E2}'
            : rec.action === 'GAP_FILL' ? '\u{1F3AF}'
            : rec.action === 'Tweet' ? '\u{1F426}'
            : '\u{1F4AC}';
        const escapedAction = rec.action?.replace(/[_*[\]()~`>#+=|{}.!\-]/g, '\\$&') || 'Unknown';
        const escapedReason = (rec.reason || 'No details')
            .slice(0, 120)
            .replace(/[_*[\]()~`>#+=|{}.!\-]/g, '\\$&');
        lines.push(`${icon} *#${i + 1}* \\- *${escapedAction}*`);
        lines.push(`  ${escapedReason}`);
        if (rec.draft) {
            const draftPreview = rec.draft.slice(0, 80).replace(/[_*[\]()~`>#+=|{}.!\-]/g, '\\$&');
            lines.push(`  _"${draftPreview}\\.\\.\\."_`);
        }
        lines.push('');
    });
    lines.push('_Say "use recommendation \\#N" to turn one into a tweet\\._');

    await safeSend(chatId, lines.join('\n'));
};

export { handleTelegramWebhook };
