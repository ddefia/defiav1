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
    lines.push(bold(`Daily Briefing — ${brandName || 'Your Brand'}`));
    lines.push('');

    // Key metrics bar (if available from data-driven generator)
    const km = report.keyMetrics;
    if (km) {
        const metricParts = [];
        if (km.followers && km.followers !== 'N/A') metricParts.push(`Followers: ${km.followers}`);
        if (km.engagementRate && km.engagementRate !== 'N/A') metricParts.push(`ER: ${km.engagementRate}`);
        if (km.galaxyScore && km.galaxyScore !== 'N/A') metricParts.push(`Galaxy: ${km.galaxyScore}/100`);
        if (km.avgInteractions && km.avgInteractions !== 'N/A') metricParts.push(`Avg Int: ${km.avgInteractions}`);
        if (km.topPostInteractions && km.topPostInteractions !== 'N/A') metricParts.push(`Top Post: ${km.topPostInteractions}`);
        if (metricParts.length > 0) {
            lines.push(bold('Key Metrics'));
            lines.push(escapeMarkdownV2(metricParts.join('  |  ')));
            lines.push('');
        }
    }

    if (report.executiveSummary) {
        lines.push(bold('Executive Summary'));
        lines.push(escapeMarkdownV2(report.executiveSummary));
        lines.push('');
    }

    if (report.tacticalPlan) {
        lines.push(bold('Tactical Plan'));
        lines.push(escapeMarkdownV2(report.tacticalPlan));
        lines.push('');
    }

    if (report.strategicPlan && Array.isArray(report.strategicPlan)) {
        lines.push(bold('Strategic Actions'));
        for (const item of report.strategicPlan.slice(0, 3)) {
            const tag = item.action === 'DOUBLE_DOWN' ? 'DOUBLE DOWN'
                : item.action === 'KILL' ? 'KILL'
                : item.action === 'OPTIMIZE' ? 'OPTIMIZE'
                : item.action || 'ACTION';
            lines.push(`${escapeMarkdownV2('[')}${bold(tag)}${escapeMarkdownV2(']')} ${escapeMarkdownV2(item.subject || '')}`);
            if (item.reasoning) {
                lines.push(`  ${italic(item.reasoning)}`);
            }
        }
        lines.push('');
    }

    // Data sources footer
    const ds = report.dataSourcesUsed;
    if (ds) {
        const sourceParts = [];
        if (ds.lunarCrush) sourceParts.push('LunarCrush');
        if (ds.mentions > 0) sourceParts.push(`${ds.mentions} mentions`);
        if (ds.recentDecisions > 0) sourceParts.push(`${ds.recentDecisions} AI actions`);
        if (sourceParts.length > 0) {
            lines.push(escapeMarkdownV2(`Sources: ${sourceParts.join(', ')}`));
        }
    }

    const timestamp = report.lastUpdated
        ? new Date(report.lastUpdated).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Just now';
    lines.push(escapeMarkdownV2(timestamp));

    return lines.join('\n');
};

// ━━━ Agent Decision ━━━

const formatAgentDecision = (decision) => {
    if (!decision) return '';

    const icon = decision.action === 'REPLY' ? '\u21A9\uFE0F'
        : decision.action === 'TREND_JACK' ? '\u26A1'
        : decision.action === 'CAMPAIGN' ? '\u{1F4E2}'
        : decision.action === 'GAP_FILL' ? '\u{1F3AF}'
        : decision.action === 'Tweet' ? '\u{1F426}'
        : '\u{1F4AC}';

    const lines = [];
    lines.push(`${icon} ${bold(`New AI Recommendation: ${decision.action}`)}`);
    lines.push('');

    if (decision.reason) {
        lines.push(bold('Why'));
        lines.push(escapeMarkdownV2(decision.reason));
        lines.push('');
    }

    if (decision.draft) {
        lines.push(bold('Draft'));
        lines.push(codeBlock(decision.draft));
        lines.push('');
    }

    if (decision.targetId) {
        lines.push(`${escapeMarkdownV2('Target:')} ${code(decision.targetId)}`);
    }

    return lines.join('\n');
};

// ━━━ Tweet Draft ━━━

const formatTweetDraft = (text, reasoning) => {
    const lines = [];
    lines.push(codeBlock(text));
    if (reasoning) {
        lines.push('');
        lines.push(`${italic(reasoning)}`);
    }
    return lines.join('\n');
};

// ━━━ Trend Summary ━━━

const formatTrendSummary = (trends) => {
    if (!trends || trends.length === 0) {
        return escapeMarkdownV2('No trending topics found right now.');
    }

    const lines = [];
    lines.push(`\u{1F525} ${bold('Trending Topics')}`);
    lines.push('');

    for (const trend of trends.slice(0, 8)) {
        const score = trend.relevanceScore ? ` \\(${escapeMarkdownV2(String(trend.relevanceScore))}%\\)` : '';
        lines.push(`\u2022 ${bold(trend.headline || trend.topic || 'Unknown')}${score}`);
        if (trend.summary) {
            lines.push(`  ${escapeMarkdownV2(trend.summary.slice(0, 120))}`);
        }
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
    lines.push(escapeMarkdownV2('I can write tweets, make graphics, analyze trends, pull briefings. I remember the conversation so you can say "now make a graphic for that" after I draft a tweet.'));
    return lines.join('\n');
};

// ━━━ Chat Response ━━━

const formatChatResponse = (text) => {
    // For general chat responses, escape the whole thing
    return escapeMarkdownV2(text);
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
    formatTrendSummary,
    formatWelcome,
    formatHelp,
    formatChatResponse,
    formatError,
};
