/**
 * TELEGRAM WEBHOOK HANDLER
 * Main entry point for incoming Telegram messages.
 * Validates → routes → classifies → generates → responds.
 */

import { sendMessage, editMessageText, deleteMessage, sendPhoto, getFile, getMe, answerCallbackQuery } from './telegramClient.js';
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
    extractImageTitle,
    extractTweetUrl,
    fetchTweetContent,
    generateQuoteRetweet,
} from './contentGenerator.js';
import {
    formatDailyBriefing,
    formatAgentDecision,
    formatTweetDraft,
    formatQuoteRetweet,
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

// ━━━ Bot Identity Cache ━━━

let _botInfo = null;
const getBotInfo = async () => {
    if (!_botInfo) {
        try { _botInfo = await getMe(); } catch { _botInfo = { username: 'defiaxyzbot' }; }
    }
    return _botInfo;
};

// Check if a message in a group chat is directed at the bot
const isDirectedAtBot = async (message, text) => {
    const chatType = message.chat?.type || 'private';

    // Private chats: always respond
    if (chatType === 'private') return true;

    // Slash commands are handled separately and always processed
    if (text.startsWith('/')) return true;

    const botInfo = await getBotInfo();
    const botUsername = (botInfo.username || 'defiaxyzbot').toLowerCase();

    // Message mentions @bot
    if (text.toLowerCase().includes(`@${botUsername}`)) return true;

    // Message is a reply to one of the bot's messages
    if (message.reply_to_message?.from?.is_bot) {
        const replyFromUsername = (message.reply_to_message.from.username || '').toLowerCase();
        if (replyFromUsername === botUsername) return true;
    }

    return false;
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

// ━━━ Callback Query Handler (Template Selection) ━━━

const handleCallbackQuery = async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat?.id;
    const data = callbackQuery.data || '';
    const callbackId = callbackQuery.id;

    if (!chatId) return;

    // Acknowledge the button press immediately
    try { await answerCallbackQuery(callbackId, '🎨 Generating...'); } catch { /* ignore */ }

    const pending = pendingImageRequests.get(String(chatId));
    if (!pending) {
        await safeSend(chatId, formatChatResponse('That selection expired. Send your image request again.'));
        return;
    }

    // Clean up pending request
    pendingImageRequests.delete(String(chatId));

    const supabase = getSupabaseClient();
    const { imageTitle, imageAnalysis: savedAnalysis, brandId } = pending;

    // Load brand profile
    let brandProfile = {};
    if (supabase) {
        brandProfile = await fetchBrandProfile(supabase, brandId) || {};
    }

    // Send "generating..." message
    let genMsg;
    try { genMsg = await safeSend(chatId, formatChatResponse('generating...')); } catch { /* ignore */ }

    // Determine which template/reference was selected
    let selectedTemplateId = null;
    let selectedRefImageId = null;

    if (data === 'img_auto') {
        // Auto mode — let generateImage pick randomly (existing behavior)
        console.log(`[Telegram] Template selection: AUTO for "${imageTitle}"`);
    } else if (data.startsWith('img_tmpl:')) {
        selectedTemplateId = data.replace('img_tmpl:', '');
        console.log(`[Telegram] Template selection: ${selectedTemplateId} for "${imageTitle}"`);

        // Find the template and select one of its linked reference images
        const templates = brandProfile.graphicTemplates || [];
        const tmpl = templates.find(t => t.id === selectedTemplateId || t.label === selectedTemplateId);
        if (tmpl?.referenceImageIds?.length > 0) {
            // Pick a random linked reference image from this template
            selectedRefImageId = tmpl.referenceImageIds[Math.floor(Math.random() * tmpl.referenceImageIds.length)];
        }
    } else if (data.startsWith('img_ref:')) {
        selectedRefImageId = data.replace('img_ref:', '');
        console.log(`[Telegram] Reference image selection: ${selectedRefImageId} for "${imageTitle}"`);
    }

    // If a specific reference image was selected, override the brand profile
    // to only include that one image (forces generateImage to use it)
    if (selectedRefImageId && brandProfile.referenceImages) {
        const selectedImg = brandProfile.referenceImages.find(r => r.id === selectedRefImageId);
        if (selectedImg) {
            // Pin ONLY this image so pickReferenceImage() selects it
            brandProfile = {
                ...brandProfile,
                referenceImages: brandProfile.referenceImages.map(r => ({
                    ...r,
                    pinned: r.id === selectedRefImageId,
                })),
            };
        }
    }

    const imagePrompt = savedAnalysis
        ? `${imageTitle}\n\nReference image analysis: ${savedAnalysis}`
        : imageTitle;

    try {
        const responseImage = await generateImage(imagePrompt, brandProfile);
        if (responseImage) {
            // Delete "generating..." message
            if (genMsg?.message_id) {
                try { await deleteMessage(chatId, genMsg.message_id); } catch { /* ignore */ }
            }
            const caption = `🎨 "${imageTitle}"`;
            try {
                await sendPhoto(chatId, responseImage, caption);
            } catch (photoErr) {
                console.warn('[Telegram] Failed to send image:', photoErr.message);
                await safeSend(chatId, formatError('Generated the image but failed to send it. File may be too large.'));
            }
        } else {
            if (genMsg?.message_id) {
                try { await safeEdit(chatId, genMsg.message_id, formatError('Image gen failed. Try a simpler prompt.')); } catch { /* ignore */ }
            }
        }
    } catch (e) {
        console.error('[Telegram] Callback image gen error:', e.message);
        if (genMsg?.message_id) {
            try { await safeEdit(chatId, genMsg.message_id, formatError(`Error: ${e.message?.slice(0, 80)}`)); } catch { /* ignore */ }
        }
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

    // Process message BEFORE responding — on Vercel Hobby, the function may be
    // killed immediately after sending the response, so async processing is unreliable.
    try {
        await processMessage(req.body);
    } catch (e) {
        console.error('[Telegram] Webhook processing error:', e.message);
        // Last-resort: try to send error to the chat
        try {
            const chatId = req.body?.message?.chat?.id;
            if (chatId) {
                await sendMessage(chatId, `⚠️ Error: ${e.message?.slice(0, 100) || 'Unknown error'}`);
            }
        } catch { /* truly nothing we can do */ }
    }

    // Respond 200 after processing is complete
    res.status(200).json({ ok: true });
};

// ━━━ Pending Image Requests (in-memory, keyed by chatId) ━━━
// Stores the extracted title while waiting for template selection.
// Cleared after use or after 5 min timeout.
const pendingImageRequests = new Map();

const processMessage = async (update) => {
    // Handle template selection callbacks
    if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
        return;
    }

    const message = update?.message;
    if (!message) return;

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
                        await safeSend(chatId, formatWelcome() + `\n\n${formatChatResponse(`Linked to ${result.brandName}. We're good to go.`)}`);
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
                    await safeSend(chatId, formatChatResponse(`Linked to ${result.brandName}. I'll drop briefings and recs here. /help if you need it.`));
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
                    await safeSend(chatId, formatChatResponse('Unlinked. Peace.'));
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
                    await safeSend(chatId, formatChatResponse(`Linked to ${linked.brandName}. Notifications ${linked.notificationsEnabled ? 'on' : 'off'}.`));
                } else {
                    await safeSend(chatId, formatChatResponse('Not linked to anything. /link CODE to set up.'));
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

    // In group chats, only respond when explicitly addressed (@bot or reply to bot)
    const directed = await isDirectedAtBot(message, text);
    if (!directed) return; // Silently ignore unaddressed group messages

    // Strip @botname mention from text so AI processes clean input
    const botInfo = await getBotInfo();
    const cleanText = text.replace(new RegExp(`@${botInfo.username}`, 'gi'), '').trim();

    // Wrap ALL processing in try/catch so errors always produce a user-visible message
    let thinkingMsgId = null;

    try {
    // Resolve brand
    if (!supabase) {
        await safeSend(chatId, formatError('Service temporarily unavailable'));
        return;
    }

    const linked = await getLinkedBrand(supabase, chatId);
    if (!linked) {
        await safeSend(chatId, formatChatResponse('Not linked yet. Send /link CODE to connect me to your brand.'));
        return;
    }

    const brandProfile = await fetchBrandProfile(supabase, linked.brandId);
    if (!brandProfile) {
        await safeSend(chatId, formatError('Brand profile not found. Try relinking.'));
        return;
    }

    // Ensure brand name is always set
    // Priority: profile.name > linked.brandName > brandId (brandId is always set, e.g. "Metis")
    if (!brandProfile.name) {
        brandProfile.name = linked.brandName || linked.brandId;
    }

    // Send "thinking" indicator
    const thinkingMsg = await safeSend(chatId, formatChatResponse('...'));
    thinkingMsgId = thinkingMsg?.message_id;

        // ━━━ Tweet URL Auto-Detection (Quote Retweet) ━━━
        const tweetUrlMatch = extractTweetUrl(cleanText);
        if (tweetUrlMatch) {
            console.log(`[Telegram] Tweet URL detected: ${tweetUrlMatch.url} (ID: ${tweetUrlMatch.tweetId})`);

            try {
                // Update thinking message
                if (thinkingMsgId) {
                    try { await safeEdit(chatId, thinkingMsgId, formatChatResponse('fetching tweet...')); } catch { /* ignore */ }
                }

                // Fetch original tweet content
                const originalTweet = await fetchTweetContent(tweetUrlMatch.tweetId);

                if (!originalTweet || !originalTweet.text) {
                    // Couldn't fetch the tweet — tell user
                    const errMsg = formatChatResponse("Couldn't fetch that tweet. The account might be private, or X is blocking the request. Try pasting the tweet text directly and I'll write a QRT for it.");
                    if (thinkingMsgId) {
                        try { await safeEdit(chatId, thinkingMsgId, errMsg); } catch { await safeSend(chatId, errMsg); }
                    } else {
                        await safeSend(chatId, errMsg);
                    }
                    // Save to history
                    const failHistory = await loadChatHistory(supabase, chatId);
                    failHistory.push({ role: 'user', text: cleanText, timestamp: Date.now() });
                    failHistory.push({ role: 'assistant', text: '(failed to fetch tweet for QRT)', timestamp: Date.now() });
                    await saveChatHistory(supabase, chatId, failHistory);
                    return;
                }

                console.log(`[Telegram] Fetched tweet by @${originalTweet.authorHandle}: "${originalTweet.text.slice(0, 80)}..."`);

                // Update thinking message
                if (thinkingMsgId) {
                    try { await safeEdit(chatId, thinkingMsgId, formatChatResponse('writing quote retweet...')); } catch { /* ignore */ }
                }

                // Generate the QRT
                const qrtText = await generateQuoteRetweet(originalTweet, brandProfile);
                const responseText = formatQuoteRetweet(qrtText, originalTweet, tweetUrlMatch.url);

                // Send the QRT
                if (thinkingMsgId) {
                    try { await safeEdit(chatId, thinkingMsgId, responseText); } catch {
                        await safeSend(chatId, responseText);
                    }
                } else {
                    await safeSend(chatId, responseText);
                }

                // Save to chat history
                const chatHistoryLoaded = await loadChatHistory(supabase, chatId);
                chatHistoryLoaded.push({ role: 'user', text: `[Shared tweet by @${originalTweet.authorHandle}]: "${originalTweet.text.slice(0, 200)}"`, timestamp: Date.now() });
                chatHistoryLoaded.push({ role: 'assistant', text: `[Generated QRT]: ${qrtText}`, timestamp: Date.now() });
                await saveChatHistory(supabase, chatId, chatHistoryLoaded);
                return;
            } catch (e) {
                console.error('[Telegram] QRT generation failed:', e.message);
                const errMsg = formatError(`QRT failed: ${e.message?.slice(0, 60) || 'Unknown error'}`);
                if (thinkingMsgId) {
                    try { await safeEdit(chatId, thinkingMsgId, errMsg); } catch { /* ignore */ }
                } else {
                    try { await safeSend(chatId, errMsg); } catch { /* ignore */ }
                }
                return;
            }
        }

        // Handle image input
        let imageBase64 = null;
        let imageAnalysis = '';
        if (hasPhoto) {
            try {
                const photos = message.photo;
                const largestPhoto = photos[photos.length - 1]; // Telegram sends multiple sizes
                const fileBuffer = await getFile(largestPhoto.file_id);
                imageBase64 = fileBuffer.toString('base64');
                imageAnalysis = await analyzeImage(imageBase64, cleanText);
            } catch (e) {
                console.warn('[Telegram] Image processing failed:', e.message);
            }
        }

        // Load chat history for context
        const chatHistory = await loadChatHistory(supabase, chatId);

        // Classify intent
        const { intent, params } = await classifyMessage(
            cleanText || imageAnalysis,
            hasPhoto,
            chatHistory,
            brandProfile
        );

        let responseText = '';
        let responseImage = null;
        let historyNote = ''; // Extra context to save in chat history

        // ━━━ Execute by Intent ━━━

        switch (intent) {
            case INTENTS.DRAFT_CONTENT: {
                const topic = params.topic || cleanText;
                // Generate the tweet
                const tweet = await generateTweet(topic, brandProfile);
                responseText = formatTweetDraft(tweet);
                historyNote = `[Generated tweet about "${topic}"]: ${tweet}`;

                // Also generate a companion image in parallel (best-effort)
                try {
                    const imgTitle = await extractImageTitle(topic, brandProfile.name || linked.brandId);
                    responseImage = await generateImage(imgTitle, brandProfile);
                } catch { /* non-critical — tweet is the primary output */ }

                break;
            }

            case INTENTS.GENERATE_IMAGE: {
                // Check conversation history for context (e.g., "create graphic for that tweet")
                const lastAssistantMsg = [...chatHistory].reverse().find(m => m.role === 'assistant');
                const hasContextRef = /that|this|it|the tweet|the post|above|previous/i.test(cleanText);
                let rawPrompt = params.imagePrompt || cleanText;

                if (hasContextRef && lastAssistantMsg?.text) {
                    rawPrompt = `${cleanText}\n\nContext from previous message: ${lastAssistantMsg.text.slice(0, 500)}`;
                }

                // Extract a short visual title from the raw text
                const imgBrandName = brandProfile.name || linked.brandId;
                const imageTitle = await extractImageTitle(rawPrompt, imgBrandName);
                console.log(`[Telegram] Image title extracted: "${imageTitle}" (from ${rawPrompt.length} chars)`);

                // Check if brand has templates/reference images to choose from
                const templates = brandProfile.graphicTemplates || [];
                const refImages = brandProfile.referenceImages || [];
                const pinnedImages = refImages.filter(r => r.pinned);

                if (templates.length > 0 || pinnedImages.length > 0) {
                    // Store pending request and show template picker
                    pendingImageRequests.set(String(chatId), {
                        imageTitle,
                        imageAnalysis: imageAnalysis || null,
                        brandId: linked.brandId,
                        timestamp: Date.now(),
                    });

                    // Auto-expire after 5 min
                    setTimeout(() => pendingImageRequests.delete(String(chatId)), 5 * 60 * 1000);

                    // Build inline keyboard with template options
                    const buttons = [];

                    // Add template buttons (max 5)
                    templates.slice(0, 5).forEach(t => {
                        buttons.push([{ text: t.label, callback_data: `img_tmpl:${t.id || t.label}` }]);
                    });

                    // Add pinned images that aren't already covered by templates
                    const templateLinkedIds = new Set();
                    templates.forEach(t => (t.referenceImageIds || []).forEach(id => templateLinkedIds.add(id)));
                    const unlinkedPinned = pinnedImages.filter(p => !templateLinkedIds.has(p.id));
                    unlinkedPinned.slice(0, 3).forEach(p => {
                        const label = p.name || p.id?.slice(0, 15) || 'Pinned Style';
                        buttons.push([{ text: `📌 ${label}`, callback_data: `img_ref:${p.id}` }]);
                    });

                    // Always add Auto option
                    buttons.push([{ text: '🎲 Auto (random style)', callback_data: 'img_auto' }]);

                    // Delete thinking message and show picker
                    if (thinkingMsgId) {
                        try { await deleteMessage(chatId, thinkingMsgId); thinkingMsgId = null; } catch { /* ignore */ }
                    }

                    const pickerMsg = `🎨 *"${imageTitle.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1')}"*\n\nPick a style:`;
                    await safeSend(chatId, pickerMsg, {
                        replyMarkup: { inline_keyboard: buttons },
                    });

                    // Don't generate yet — wait for callback
                    responseText = null;
                    responseImage = null;
                    break;
                }

                // No templates — generate directly with auto style
                const imagePrompt = imageAnalysis
                    ? `${imageTitle}\n\nReference image analysis: ${imageAnalysis}`
                    : imageTitle;

                if (thinkingMsgId) {
                    try { await safeEdit(chatId, thinkingMsgId, formatChatResponse('generating...')); } catch { /* ignore */ }
                }

                try {
                    responseImage = await generateImage(imagePrompt, brandProfile);
                } catch (e) {
                    console.warn('[Telegram] Image generation error:', e.message);
                    responseImage = null;
                }
                if (responseImage) {
                    responseText = null;
                } else {
                    responseText = formatError('Image gen failed. Try a simpler prompt.');
                }
                break;
            }

            case INTENTS.ANALYZE_TRENDS: {
                const { summary, trends } = await summarizeTrends(linked.brandId, supabase);
                if (trends.length > 0) {
                    // Show trend headlines as context, then the AI's brand-specific take
                    responseText = formatTrendSummary(trends) + '\n\n' + formatChatResponse(summary);
                } else {
                    responseText = formatChatResponse(summary || 'Nothing major moving right now. I\'ll flag anything relevant.');
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

                // Also try generating a companion image
                try {
                    const recTitle = await extractImageTitle(topic, brandProfile.name || linked.brandId);
                    responseImage = await generateImage(recTitle, brandProfile);
                } catch { /* non-critical */ }

                break;
            }

            case INTENTS.GET_BRIEFING: {
                await handleBriefingCommand(supabase, chatId, thinkingMsgId);
                // Save to history
                chatHistory.push({ role: 'user', text: cleanText, timestamp: Date.now() });
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
                    cleanText || 'The user sent an image.',
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

        if (responseImage && responseText) {
            // Both text AND image (e.g., tweet + companion graphic)
            // Send the text first by editing the thinking message
            if (thinkingMsgId) {
                try { await safeEdit(chatId, thinkingMsgId, responseText); } catch {
                    await safeSend(chatId, responseText);
                }
            } else {
                await safeSend(chatId, responseText);
            }
            // Then send the image as a follow-up
            const caption = cleanText ? `\u{1F3A8} Companion graphic for: "${cleanText.slice(0, 80)}"` : 'Generated graphic';
            try {
                await sendPhoto(chatId, responseImage, caption);
            } catch (photoErr) {
                console.warn('[Telegram] Failed to send companion image:', photoErr.message);
                // Non-critical: the tweet was already sent
            }
        } else if (responseImage) {
            // Image-only response (explicit "create an image" request)
            // Delete the thinking message — the photo IS the response
            if (thinkingMsgId) {
                try { await deleteMessage(chatId, thinkingMsgId); } catch { /* ignore */ }
            }
            const caption = cleanText ? `Generated from: "${cleanText.slice(0, 100)}"` : 'Generated image';
            try {
                await sendPhoto(chatId, responseImage, caption);
            } catch (photoErr) {
                console.warn('[Telegram] Failed to send image:', photoErr.message);
                const errMsg = formatError('Generated the image but failed to send it. The file may be too large. Try a simpler prompt.');
                await safeSend(chatId, errMsg);
            }
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

        // Save to chat history — preserve enough context for follow-up messages
        chatHistory.push({ role: 'user', text: cleanText || '(image)', timestamp: Date.now() });
        const assistantHistoryText = historyNote
            || responseText?.slice(0, 600)
            || (responseImage ? '(generated an image)' : '(no response)');
        chatHistory.push({ role: 'assistant', text: assistantHistoryText, timestamp: Date.now() });
        await saveChatHistory(supabase, chatId, chatHistory);

    } catch (e) {
        console.error('[Telegram] Processing failed:', e.message);
        const isQuota = e.message?.includes('429') || e.message?.includes('quota') || e.message?.includes('RESOURCE_EXHAUSTED');
        const isTimeout = e.message?.includes('timed out');
        const userMsg = isQuota
            ? 'AI quota hit — try again in a minute.'
            : isTimeout
            ? 'AI took too long — try again.'
            : 'Something went wrong. Try again.';
        const errorMsg = formatError(userMsg);
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
