import crypto from 'crypto';

const percentEncode = (value = '') => encodeURIComponent(value)
    .replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const buildSignatureBaseString = (method, url, params) => {
    const sorted = Object.keys(params)
        .sort()
        .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
        .join('&');
    return [
        method.toUpperCase(),
        percentEncode(url),
        percentEncode(sorted)
    ].join('&');
};

const buildOAuthHeader = (params) => {
    const headerParams = Object.keys(params)
        .sort()
        .map((key) => `${percentEncode(key)}="${percentEncode(params[key])}"`)
        .join(', ');
    return `OAuth ${headerParams}`;
};

const getXConfig = () => ({
    apiKey: process.env.X_API_KEY || process.env.TWITTER_API_KEY,
    apiSecret: process.env.X_API_SECRET || process.env.TWITTER_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN || process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET || process.env.TWITTER_ACCESS_SECRET
});

export const isXConfigured = (override) => {
    const { apiKey, apiSecret, accessToken, accessSecret } = override || getXConfig();
    return Boolean(apiKey && apiSecret && accessToken && accessSecret);
};

const buildOAuthParams = ({ apiKey, accessToken }) => ({
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0'
});

const signRequest = (method, url, params, apiSecret, accessSecret) => {
    const baseString = buildSignatureBaseString(method, url, params);
    const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessSecret)}`;
    return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
};

const oauthRequest = async (method, url, { bodyParams, jsonBody, credentials } = {}) => {
    const config = credentials || getXConfig();
    if (!config.apiKey || !config.apiSecret || !config.accessToken || !config.accessSecret) {
        throw new Error('Missing X API credentials (X_API_KEY/X_API_SECRET/X_ACCESS_TOKEN/X_ACCESS_SECRET).');
    }

    const oauthParams = buildOAuthParams(config);
    const signatureParams = {
        ...oauthParams,
        ...(bodyParams || {})
    };
    const signature = signRequest(method, url, signatureParams, config.apiSecret, config.accessSecret);
    const authHeader = buildOAuthHeader({ ...oauthParams, oauth_signature: signature });

    const headers = {
        Authorization: authHeader
    };

    let body;
    if (jsonBody) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(jsonBody);
    } else if (bodyParams) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = new URLSearchParams(bodyParams).toString();
    }

    const response = await fetch(url, { method, headers, body });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = json?.detail || json?.error || json?.title || response.statusText;
        throw new Error(`X API error (${response.status}): ${message}`);
    }

    return json;
};

const stripDataUrl = (input = '') => {
    const trimmed = String(input || '').trim();
    if (!trimmed) return '';
    if (trimmed.includes('base64,')) {
        return trimmed.split('base64,')[1];
    }
    return trimmed;
};

const downloadAsBase64 = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download media (${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
};

export const uploadMedia = async (mediaInput, credentials) => {
    if (!mediaInput) return null;
    const base64 = mediaInput.startsWith('http')
        ? await downloadAsBase64(mediaInput)
        : stripDataUrl(mediaInput);

    if (!base64) return null;

    const url = 'https://upload.twitter.com/1.1/media/upload.json';
    const payload = { media_data: base64 };
    const response = await oauthRequest('POST', url, { bodyParams: payload, credentials });
    return response?.media_id_string || response?.media_id || null;
};

export const postTweet = async ({ text, mediaIds = [] }, credentials) => {
    const url = 'https://api.twitter.com/2/tweets';
    const body = { text };
    if (mediaIds.length > 0) {
        body.media = { media_ids: mediaIds };
    }
    const response = await oauthRequest('POST', url, { jsonBody: body, credentials });
    return response?.data || response;
};
