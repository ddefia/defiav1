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
    lines.push(`\u2600\uFE0F ${bold(`Daily Briefing — ${brandName || 'Your Brand'}`)}`);
    lines.push('');

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
        for (const item of report.strategicPlan.slice(0, 5)) {
            const icon = item.action === 'DOUBLE_DOWN' ? '\u{1F680}'
                : item.action === 'KILL' ? '\u274C'
                : item.action === 'OPTIMIZE' ? '\u{1F527}'
                : '\u{1F4CB}';
            lines.push(`${icon} ${bold(item.action)}: ${escapeMarkdownV2(item.subject)}`);
            if (item.reasoning) {
                lines.push(`   ${italic(item.reasoning)}`);
            }
        }
        lines.push('');
    }

    const timestamp = report.lastUpdated
        ? new Date(report.lastUpdated).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Just now';
    lines.push(escapeMarkdownV2(`Generated: ${timestamp}`));

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
    lines.push(`\u{1F426} ${bold('Generated Tweet')}`);
    lines.push('');
    lines.push(codeBlock(text));
    lines.push('');
    if (reasoning) {
        lines.push(`${italic(reasoning)}`);
        lines.push('');
    }
    lines.push(escapeMarkdownV2('Copy the text above and paste into your Content Studio or schedule directly.'));
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
    lines.push(`\u{1F680} ${bold('Defia Bot')}`);
    lines.push('');
    lines.push(escapeMarkdownV2('Your AI marketing co-pilot, now in Telegram.'));
    lines.push('');
    lines.push(escapeMarkdownV2('To get started, link this chat to your Defia brand:'));
    lines.push(escapeMarkdownV2('1. Go to Settings in Defia → Telegram section'));
    lines.push(escapeMarkdownV2('2. Click "Generate Link Code"'));
    lines.push(escapeMarkdownV2('3. Send /link YOUR_CODE in this chat'));
    lines.push('');
    lines.push(escapeMarkdownV2('Once linked, you can chat naturally or use /help for commands.'));
    return lines.join('\n');
};

const formatHelp = () => {
    const lines = [];
    lines.push(`\u{1F4CB} ${bold('Available Commands')}`);
    lines.push('');
    lines.push(`${code('/link CODE')} ${escapeMarkdownV2('— Link this chat to your Defia brand')}`);
    lines.push(`${code('/unlink')} ${escapeMarkdownV2('— Disconnect this chat')}`);
    lines.push(`${code('/status')} ${escapeMarkdownV2('— Show linked brand info')}`);
    lines.push(`${code('/brief')} ${escapeMarkdownV2('— Get today\'s daily briefing')}`);
    lines.push(`${code('/recs')} ${escapeMarkdownV2('— View recent AI recommendations')}`);
    lines.push(`${code('/help')} ${escapeMarkdownV2('— Show this command list')}`);
    lines.push('');
    lines.push(bold('Natural Language'));
    lines.push(escapeMarkdownV2('Just chat naturally — I\'m your AI CMO:'));
    lines.push(escapeMarkdownV2('• "Write a tweet about our new partnership"'));
    lines.push(escapeMarkdownV2('• "Create an image for our upcoming launch"'));
    lines.push(escapeMarkdownV2('• "What\'s trending in Web3?"'));
    lines.push(escapeMarkdownV2('• "Use recommendation #1 to draft a post"'));
    lines.push(escapeMarkdownV2('• Send an image + "Create a post like this"'));
    lines.push(escapeMarkdownV2('• "What should we post today?"'));
    return lines.join('\n');
};

// ━━━ Chat Response ━━━

const formatChatResponse = (text) => {
    // For general chat responses, escape the whole thing
    return escapeMarkdownV2(text);
};

// ━━━ Error ━━━

const formatError = (message) => {
    return `\u26A0\uFE0F ${escapeMarkdownV2(message || 'Something went wrong. Please try again.')}`;
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
