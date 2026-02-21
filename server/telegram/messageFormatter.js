/**
 * TELEGRAM MESSAGE FORMATTER
 * Formats various content types into Telegram-safe MarkdownV2.
 *
 * Telegram MarkdownV2 requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
 */

// ━━━ Escape Helper ━━━

const ESCAPE_CHARS = /[_*[\]()~`>#+=|{}.!-]/g;

const escapeMarkdownV2 = (text) => {
    if (!text) return '';
    return String(text).replace(ESCAPE_CHARS, '\\$&');
};

// Bold/italic helpers that produce valid MarkdownV2
const bold = (text) => `*${escapeMarkdownV2(text)}*`;
const italic = (text) => `_${escapeMarkdownV2(text)}_`;
const code = (text) => `\`${text}\``;
const codeBlock = (text) => `\`\`\`\n${text}\n\`\`\``;

// ━━━ Daily Briefing ━━━

const formatDailyBriefing = (report, brandName) => {
    if (!report) return escapeMarkdownV2('No briefing data available.');

    const lines = [];
    lines.push(`\u2615 ${bold(`Morning Brief — ${brandName || 'Your Brand'}`)}`);
    lines.push('');

    // Compact metrics bar (only show if we actually have real data — hide entirely otherwise)
    const km = report.keyMetrics;
    if (km) {
        const metricParts = [];
        if (km.followers && km.followers !== 'N/A') metricParts.push(`${km.followers} followers`);
        if (km.engagementRate && km.engagementRate !== 'N/A') metricParts.push(`${km.engagementRate} ER`);
        if (km.galaxyScore && km.galaxyScore !== 'N/A') metricParts.push(`Galaxy ${km.galaxyScore}/100`);
        if (metricParts.length > 0) {
            lines.push(escapeMarkdownV2(metricParts.join(' · ')));
            lines.push('');
        }
    }

    // Executive summary — keep it tight
    if (report.executiveSummary) {
        lines.push(escapeMarkdownV2(report.executiveSummary.slice(0, 300)));
        lines.push('');
    }

    // Top 2 strategic moves (if available)
    if (report.strategicPlan && Array.isArray(report.strategicPlan)) {
        lines.push(bold('Moves'));
        for (const item of report.strategicPlan.slice(0, 2)) {
            const tag = item.action === 'DOUBLE_DOWN' ? '\u{1F525}'
                : item.action === 'KILL' ? '\u274C'
                : item.action === 'OPTIMIZE' ? '\u{1F527}'
                : '\u27A1\uFE0F';
            lines.push(`${tag} ${escapeMarkdownV2(item.subject || '')}${item.reasoning ? ' — ' + italic(item.reasoning.slice(0, 80)) : ''}`);
        }
    }

    return lines.join('\n');
};

// ━━━ Agent Decision ━━━

const formatAgentDecision = (decision) => {
    if (!decision) return '';

    const icon = decision.action === 'REPLY' ? '\u21A9\uFE0F'
        : decision.action === 'TREND_JACK' ? '\u26A1'
        : decision.action === 'CAMPAIGN' ? '\u{1F4C1}'
        : decision.action === 'GAP_FILL' ? '\u{1F3AF}'
        : decision.action === 'Tweet' ? '\u{1F426}'
        : '\u{1F4AC}';

    // Strip any hashtags that leaked through
    const cleanDraft = (decision.draft || '').replace(/#\w+/g, '').replace(/  +/g, ' ').trim();

    const lines = [];
    lines.push(`${icon} ${bold(decision.action)}`);

    if (decision.reason) {
        lines.push(escapeMarkdownV2(decision.reason.slice(0, 200)));
    }

    if (cleanDraft) {
        lines.push('');
        // Render draft as italic quoted text — not a code block
        lines.push(italic(cleanDraft.slice(0, 280)));
    }

    return lines.join('\n');
};

// ━━━ Tweet Draft ━━━

const formatTweetDraft = (text, reasoning) => {
    // Strip hashtags from tweet text
    const clean = (text || '').replace(/#\w+/g, '').replace(/  +/g, ' ').trim();
    const lines = [];
    lines.push(italic(clean));
    if (reasoning) {
        lines.push('');
        lines.push(escapeMarkdownV2(reasoning));
    }
    return lines.join('\n');
};

// ━━━ Trend Summary ━━━

const formatTrendSummary = (trends) => {
    if (!trends || trends.length === 0) {
        return escapeMarkdownV2('No trending topics found right now.');
    }

    const lines = [];
    lines.push(`\u{1F525} ${bold('What\'s Moving')}`);
    lines.push('');

    // Keep it tight — max 4 trends, headline only (no summaries)
    for (const trend of trends.slice(0, 4)) {
        const score = trend.relevanceScore ? ` \\(${escapeMarkdownV2(String(trend.relevanceScore))}%\\)` : '';
        lines.push(`\u2022 ${escapeMarkdownV2(trend.headline || trend.topic || 'Unknown')}${score}`);
    }

    return lines.join('\n');
};

// ━━━ Welcome / Help ━━━

const formatWelcome = () => {
    const lines = [];
    lines.push(bold('Defia'));
    lines.push('');
    lines.push(escapeMarkdownV2("What's up. I'm your marketing brain — tweets, graphics, strategy, all of it."));
    lines.push('');
    lines.push(escapeMarkdownV2('Link me to your brand first:'));
    lines.push(escapeMarkdownV2('1. Defia Settings → Telegram → Generate Link Code'));
    lines.push(escapeMarkdownV2('2. Send /link YOUR_CODE here'));
    lines.push('');
    lines.push(escapeMarkdownV2('After that, just @ me or reply to my messages. /help for commands.'));
    return lines.join('\n');
};

const formatHelp = () => {
    const lines = [];
    lines.push(bold('Commands'));
    lines.push(`${code('/link CODE')} ${escapeMarkdownV2('— connect to your brand')}`);
    lines.push(`${code('/unlink')} ${escapeMarkdownV2('— disconnect')}`);
    lines.push(`${code('/status')} ${escapeMarkdownV2('— check connection')}`);
    lines.push(`${code('/brief')} ${escapeMarkdownV2('— daily marketing briefing')}`);
    lines.push(`${code('/recs')} ${escapeMarkdownV2('— AI recommendations')}`);
    lines.push('');
    lines.push(bold('Talking to me'));
    lines.push(escapeMarkdownV2('In groups: @defiaxyzbot or reply to my messages'));
    lines.push(escapeMarkdownV2('In DMs: just type'));
    lines.push('');
    lines.push(escapeMarkdownV2('I can write tweets, make graphics, analyze trends, pull briefings, and generate quote retweets. Drop a tweet link and I\'ll draft a QRT in your brand voice. I remember the conversation so you can say "now make a graphic for that" after I draft a tweet.'));
    return lines.join('\n');
};

// ━━━ Chat Response ━━━

const formatChatResponse = (text) => {
    // For general chat responses, escape the whole thing
    return escapeMarkdownV2(text);
};

// ━━━ Quote Retweet Draft ━━━

const formatQuoteRetweet = (qrtText, originalTweet, tweetUrl) => {
    const lines = [];
    lines.push(`\u{1F501} ${bold('Quote Retweet Draft')}`);
    lines.push('');

    // Show the original tweet context (truncated)
    if (originalTweet?.authorHandle) {
        lines.push(`${italic(`Re: @${originalTweet.authorHandle}`)}`);
    } else if (originalTweet?.authorName) {
        lines.push(`${italic(`Re: ${originalTweet.authorName}`)}`);
    }
    if (originalTweet?.text) {
        const preview = originalTweet.text.slice(0, 120);
        lines.push(escapeMarkdownV2(`"${preview}${originalTweet.text.length > 120 ? '...' : ''}"`));
    }
    lines.push('');

    // The actual QRT content
    const clean = (qrtText || '').replace(/#\w+/g, '').replace(/  +/g, ' ').trim();
    lines.push(bold('Your QRT:'));
    lines.push(italic(clean));

    // Link to original tweet
    if (tweetUrl) {
        lines.push('');
        const escaped = escapeMarkdownV2(tweetUrl);
        lines.push(escapeMarkdownV2('Copy the text above and quote retweet:'));
        lines.push(escaped);
    }

    return lines.join('\n');
};

// ━━━ Error ━━━

const formatError = (message) => {
    return escapeMarkdownV2(message || 'Something broke. Try again.');
};

export {
    escapeMarkdownV2,
    formatDailyBriefing,
    formatAgentDecision,
    formatTweetDraft,
    formatQuoteRetweet,
    formatTrendSummary,
    formatWelcome,
    formatHelp,
    formatChatResponse,
    formatError,
};
