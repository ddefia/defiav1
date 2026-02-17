/**
 * TELEGRAM BOT API CLIENT
 * Low-level wrapper for the Telegram Bot API.
 * Pattern follows server/publishing/xClient.js.
 */

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = () => `https://api.telegram.org/bot${BOT_TOKEN()}`;

const isConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

// ━━━ Core Request Helper ━━━

const telegramRequest = async (method, body = {}) => {
    const token = BOT_TOKEN();
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured');

    const url = `${BASE_URL()}/${method}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const json = await response.json();
    if (!json.ok) {
        const desc = json.description || 'Unknown Telegram API error';
        throw new Error(`Telegram API error (${json.error_code}): ${desc}`);
    }
    return json.result;
};

// ━━━ Messages ━━━

const sendMessage = async (chatId, text, options = {}) => {
    return telegramRequest('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: options.parseMode || undefined,
        reply_markup: options.replyMarkup || undefined,
        disable_web_page_preview: options.disablePreview ?? true,
    });
};

const editMessageText = async (chatId, messageId, text, options = {}) => {
    return telegramRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: options.parseMode || undefined,
        disable_web_page_preview: options.disablePreview ?? true,
    });
};

// ━━━ Photos ━━━

const sendPhoto = async (chatId, photoInput, caption = '', options = {}) => {
    const token = BOT_TOKEN();
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured');

    // If photoInput is a URL, use JSON API
    if (typeof photoInput === 'string' && photoInput.startsWith('http')) {
        return telegramRequest('sendPhoto', {
            chat_id: chatId,
            photo: photoInput,
            caption: caption || undefined,
            parse_mode: options.parseMode || undefined,
        });
    }

    // For base64/buffer, use multipart form upload
    const url = `${BASE_URL()}/sendPhoto`;
    const formData = new FormData();
    formData.append('chat_id', String(chatId));

    // Handle base64 string or Buffer
    let buffer;
    if (typeof photoInput === 'string') {
        // Strip data URL prefix if present
        const raw = photoInput.includes('base64,')
            ? photoInput.split('base64,')[1]
            : photoInput;
        buffer = Buffer.from(raw, 'base64');
    } else {
        buffer = photoInput;
    }

    const blob = new Blob([buffer], { type: 'image/png' });
    formData.append('photo', blob, 'image.png');
    if (caption) formData.append('caption', caption);
    if (options.parseMode) formData.append('parse_mode', options.parseMode);

    const response = await fetch(url, { method: 'POST', body: formData });
    const json = await response.json();
    if (!json.ok) {
        throw new Error(`Telegram sendPhoto error (${json.error_code}): ${json.description}`);
    }
    return json.result;
};

// ━━━ Files (for downloading user-sent images) ━━━

const getFile = async (fileId) => {
    const fileInfo = await telegramRequest('getFile', { file_id: fileId });
    const filePath = fileInfo.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN()}/${filePath}`;

    const response = await fetch(downloadUrl);
    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
};

// ━━━ Webhook Management ━━━

const setWebhook = async (url) => {
    return telegramRequest('setWebhook', {
        url,
        allowed_updates: ['message', 'callback_query'],
        max_connections: 40,
    });
};

const deleteWebhook = async () => {
    return telegramRequest('deleteWebhook', { drop_pending_updates: true });
};

// ━━━ Bot Info ━━━

const getMe = async () => {
    return telegramRequest('getMe');
};

export {
    isConfigured,
    sendMessage,
    editMessageText,
    sendPhoto,
    getFile,
    setWebhook,
    deleteWebhook,
    getMe,
};
