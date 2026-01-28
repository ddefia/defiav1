import OpenAI from 'openai'
import { BrandProfile } from './brand-profile'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface TweetData {
  id: string
  text: string
  created_at: Date
  url: string
  metrics: {
    like_count: number
    retweet_count: number
    reply_count: number
    quote_count: number
  }
  media?: Array<{
    type: string
    url?: string
  }>
}

/**
 * Generate brand profile from external tweets (doesn't save to DB)
 */
export async function generateBrandProfileFromTweets(
  handle: string,
  tweets: TweetData[]
): Promise<BrandProfile> {
  if (tweets.length === 0) {
    throw new Error('No tweets provided')
  }

  // Convert tweets to format similar to xItems
  const tweetsWithMetrics = tweets.map((tweet) => ({
    text: tweet.text || '',
    timestamp: tweet.created_at,
    likes: tweet.metrics.like_count || 0,
    retweets: tweet.metrics.retweet_count || 0,
    replies: tweet.metrics.reply_count || 0,
    quotes: tweet.metrics.quote_count || 0,
    hasMedia: !!tweet.media && tweet.media.length > 0,
    url: tweet.url,
  }))

  // Extract hashtags
  const hashtagRegex = /#\w+/g
  const allHashtags: { [key: string]: number } = {}
  tweets.forEach((tweet) => {
    if (tweet.text) {
      const matches = tweet.text.match(hashtagRegex)
      if (matches) {
        matches.forEach((tag) => {
          const normalized = tag.toLowerCase()
          allHashtags[normalized] = (allHashtags[normalized] || 0) + 1
        })
      }
    }
  })

  // Analyze posting times
  const postingTimes: { [key: string]: number } = {}
  const postingDays: { [key: string]: number } = {}
  tweets.forEach((tweet) => {
    if (tweet.created_at) {
      const date = new Date(tweet.created_at)
      const hour = date.getUTCHours()
      const day = date.toLocaleDateString('en-US', { weekday: 'long' })
      postingTimes[hour.toString()] = (postingTimes[hour.toString()] || 0) + 1
      postingDays[day] = (postingDays[day] || 0) + 1
    }
  })

  // Calculate engagement
  const totalEngagement = tweetsWithMetrics.reduce(
    (sum, item) => sum + item.likes + item.retweets + item.replies,
    0
  )
  const avgEngagement = tweets.length > 0 ? totalEngagement / tweets.length : 0

  // === Lexical Analysis ===
  const allText = tweets.map((tweet) => tweet.text || '').join(' ').toLowerCase()
  const words = allText.match(/\b\w+\b/g) || []

  // Unigrams
  const unigramCounts: { [key: string]: number } = {}
  words.forEach((word) => {
    if (word.length > 2) {
      unigramCounts[word] = (unigramCounts[word] || 0) + 1
    }
  })
  const topUnigrams = Object.entries(unigramCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, freq]) => ({ word, frequency: freq }))

  // Bigrams
  const bigramCounts: { [key: string]: number } = {}
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`
    bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1
  }
  const topBigrams = Object.entries(bigramCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([phrase, freq]) => ({ phrase, frequency: freq }))

  // Jargon
  const cryptoJargon = [
    'defi',
    'liquidity',
    'pool',
    'yield',
    'staking',
    'apy',
    'apr',
    'dao',
    'nft',
    'token',
    'protocol',
    'on-chain',
    'off-chain',
    'l2',
    'l1',
    'bridge',
    'swap',
    'dex',
    'cex',
    'gas',
    'blockchain',
    'crypto',
    'bitcoin',
    'ethereum',
    'solana',
    'arbitrum',
    'optimism',
    'polygon',
    'avalanche',
    'validator',
    'node',
    'consensus',
    'fork',
    'whale',
    'hodl',
    'fomo',
    'fud',
    'moon',
    'pump',
    'dump',
    'bull',
    'bear',
    'altcoin',
    'stablecoin',
    'weth',
    'usdc',
    'usdt',
    'dai',
    'governance',
    'proposal',
    'voting',
    'treasury',
    'tvl',
    'volume',
    'slippage',
    'impermanent',
    'loss',
    'arbitrage',
    'mev',
    'flashloan',
    'collateral',
    'leverage',
    'margin',
    'liquidation',
    'oracle',
    'amm',
    'uniswap',
    'aave',
    'compound',
    'rollup',
    'zk',
    'zero',
    'knowledge',
    'proof',
  ]
  const jargonWords = cryptoJargon.filter((j) => allText.includes(j))
  const jargonFrequency = Math.min(jargonWords.length / 50, 1)

  // Emoji frequency
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
  const postsWithEmojis = tweets.filter((tweet) => {
    const text = tweet.text || ''
    return emojiRegex.test(text)
  }).length
  const emojiFrequency = tweets.length > 0 ? postsWithEmojis / tweets.length : 0

  // Profanity
  const profanityWords = ['fuck', 'shit', 'damn', 'ass', 'bitch', 'bastard', 'crap', 'piss', 'hell']
  const profanityCount = profanityWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    return count + (allText.match(regex) || []).length
  }, 0)
  let profanityLevel: 'none' | 'low' | 'medium' | 'high' = 'none'
  if (profanityCount > 10) profanityLevel = 'high'
  else if (profanityCount > 5) profanityLevel = 'medium'
  else if (profanityCount > 0) profanityLevel = 'low'

  // Hedging language
  const hedgingWords = [
    'maybe',
    'could',
    'likely',
    'perhaps',
    'might',
    'possibly',
    'probably',
    'seems',
    'appears',
    'suggests',
  ]
  const hedgingCount = hedgingWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    return count + (allText.match(regex) || []).length
  }, 0)
  const hedgingLanguageRate = words.length > 0 ? hedgingCount / words.length : 0

  // Conviction language
  const convictionWords = [
    'will',
    'is',
    'must',
    'definitely',
    'certainly',
    'always',
    'never',
    'guaranteed',
    'sure',
    'absolutely',
  ]
  const convictionCount = convictionWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    return count + (allText.match(regex) || []).length
  }, 0)
  const convictionLanguageRate = words.length > 0 ? convictionCount / words.length : 0

  // === Network Analysis ===
  const mentionRegex = /@(\w+)/g
  const mentions: { [key: string]: number } = {}
  tweets.forEach((tweet) => {
    const text = tweet.text || ''
    const matches = text.match(mentionRegex)
    if (matches) {
      matches.forEach((match) => {
        const handle = match.toLowerCase()
        mentions[handle] = (mentions[handle] || 0) + 1
      })
    }
  })
  const topMentions = Object.entries(mentions)
    .filter(([_, freq]) => freq >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([handle, freq]) => ({ handle, frequency: freq }))

  const replyTargets: { [key: string]: number } = {}
  const mostInteractedAccounts: { [key: string]: number } = {}

  Object.entries(mentions).forEach(([handle, count]) => {
    mostInteractedAccounts[handle] = (mostInteractedAccounts[handle] || 0) + count
    replyTargets[handle] = (replyTargets[handle] || 0) + count
  })

  const mostInteractedAccountsList = Object.entries(mostInteractedAccounts)
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([handle, count]) => ({ handle, interactionCount: count }))

  const replyTargetsList = Object.entries(replyTargets)
    .filter(([_, freq]) => freq >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([handle, freq]) => ({ handle, frequency: freq }))

  const frequentlyQuoted: Array<{ handle: string; frequency: number }> = []

  const ecosystemClusters: string[] = []
  const ethereumMentions = topMentions.filter(
    (m) => m.handle.includes('ethereum') || m.handle.includes('eth') || m.handle.includes('vitalik')
  ).length
  const solanaMentions = topMentions.filter(
    (m) => m.handle.includes('solana') || m.handle.includes('sol')
  ).length
  if (ethereumMentions > 2) ecosystemClusters.push('Ethereum Ecosystem')
  if (solanaMentions > 2) ecosystemClusters.push('Solana Ecosystem')

  // === Epistemic Style ===
  const urlRegex = /https?:\/\/[^\s]+/g
  const postsWithLinks = tweets.filter((tweet) => {
    const text = tweet.text || ''
    return urlRegex.test(text)
  }).length
  const dataBackedRate = tweets.length > 0 ? postsWithLinks / tweets.length : 0

  const speculativeWords = ['might', 'could', 'maybe', 'perhaps', 'if', 'when', 'potential', 'possibly']
  const speculativeCount = speculativeWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    return count + (allText.match(regex) || []).length
  }, 0)
  const speculativeRate = words.length > 0 ? speculativeCount / words.length : 0

  const opinionWords = ['think', 'believe', 'opinion', 'view', 'perspective', 'take', 'feel']
  const opinionCount = opinionWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    return count + (allText.match(regex) || []).length
  }, 0)
  const opinionatedRate = words.length > 0 ? opinionCount / words.length : 0

  const narrativeWords = ['story', 'narrative', 'journey', 'tale', 'history', 'evolution', 'future', 'vision']
  const narrativeCount = narrativeWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    return count + (allText.match(regex) || []).length
  }, 0)
  const narrativeDrivenRate = words.length > 0 ? narrativeCount / words.length : 0

  // === Sentiment Analysis ===
  const positiveWords = [
    'good',
    'great',
    'excellent',
    'amazing',
    'awesome',
    'love',
    'best',
    'perfect',
    'win',
    'success',
    'happy',
    'excited',
  ]
  const negativeWords = [
    'bad',
    'terrible',
    'awful',
    'hate',
    'worst',
    'fail',
    'failure',
    'sad',
    'disappointed',
    'angry',
    'frustrated',
  ]

  const positiveCount = positiveWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    return count + (allText.match(regex) || []).length
  }, 0)
  const negativeCount = negativeWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    return count + (allText.match(regex) || []).length
  }, 0)

  const totalSentimentWords = positiveCount + negativeCount
  const avgSentimentScore =
    totalSentimentWords > 0 ? (positiveCount - negativeCount) / totalSentimentWords : 0

  const volatility = Math.abs(avgSentimentScore) * 0.3
  const negativityRate = words.length > 0 ? negativeCount / words.length : 0
  const controversyRate = (profanityCount + negativeCount) / Math.max(words.length, 1)
  const sarcasmDetectionScore = 0.0

  // Build prompt
  let prompt = `CRITICAL: Analyze ONLY the actual tweets provided below from @${handle}. 

DO NOT invent, infer, or add generic content. EVERY field must be derived directly from the actual tweets shown below. If something doesn't appear in the tweets, use empty arrays or null values - do NOT make up examples.

=== X (Twitter) Posts with Engagement Metrics ===
${tweetsWithMetrics
    .map((item) => {
      const dateStr = item.timestamp ? new Date(item.timestamp).toISOString() : 'Unknown date'
      return `[${dateStr}] Likes: ${item.likes}, Retweets: ${item.retweets}, Replies: ${item.replies}${item.hasMedia ? ' [Has Media]' : ''}\n${item.text}`
    })
    .join('\n\n')}

=== Posting Patterns Analysis ===
${Object.keys(postingDays).length > 0
    ? `Most active days: ${Object.entries(postingDays)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([day, count]) => `${day} (${count} posts)`)
        .join(', ')}`
    : 'No timestamp data available'}

=== Hashtag Usage ===
${Object.keys(allHashtags).length > 0
    ? `Most used hashtags: ${Object.entries(allHashtags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => `${tag} (${count}x)`)
        .join(', ')}`
    : 'No hashtags found'}

=== Average Engagement ===
${avgEngagement > 0
    ? `Average engagement per post: ${avgEngagement.toFixed(1)} (likes + retweets + replies)`
    : 'No engagement data available'}

=== Lexical Analysis ===
Top Unigrams: ${topUnigrams
    .slice(0, 10)
    .map((u) => `${u.word} (${u.frequency}x)`)
    .join(', ')}
Top Bigrams: ${topBigrams
    .slice(0, 10)
    .map((b) => `"${b.phrase}" (${b.frequency}x)`)
    .join(', ')}
Jargon Frequency: ${(jargonFrequency * 100).toFixed(1)}%
Emoji Frequency: ${(emojiFrequency * 100).toFixed(1)}% of posts
Profanity Level: ${profanityLevel}
Hedging Language Rate: ${(hedgingLanguageRate * 100).toFixed(2)}%
Conviction Language Rate: ${(convictionLanguageRate * 100).toFixed(2)}%

=== Network Analysis ===
Top Mentions: ${topMentions
    .slice(0, 10)
    .map((m) => `@${m.handle} (${m.frequency}x)`)
    .join(', ')}
Most Interacted Accounts: ${mostInteractedAccountsList
    .slice(0, 10)
    .map((a) => `@${a.handle} (${a.interactionCount}x)`)
    .join(', ')}
Ecosystem Clusters: ${ecosystemClusters.length > 0 ? ecosystemClusters.join(', ') : 'None detected'}

=== Epistemic Style ===
Data-Backed Rate: ${(dataBackedRate * 100).toFixed(1)}% (posts with links/stats)
Speculative Rate: ${(speculativeRate * 100).toFixed(2)}%
Opinionated Rate: ${(opinionatedRate * 100).toFixed(2)}%
Narrative-Driven Rate: ${(narrativeDrivenRate * 100).toFixed(2)}%

=== Sentiment Analysis ===
Average Sentiment Score: ${avgSentimentScore.toFixed(2)} (range: -1 to 1)
Volatility: ${volatility.toFixed(2)}
Negativity Rate: ${(negativityRate * 100).toFixed(2)}%
Controversy Rate: ${(controversyRate * 100).toFixed(2)}%

CRITICAL INSTRUCTIONS:
1. Extract ALL information ONLY from the actual tweets provided above
2. For "voice.dos", "voice.donts", "voice.traits", "voice.tone" - derive these ONLY from patterns in the actual tweets
3. For "voice.signaturePhrases" - use ONLY phrases that actually appear multiple times in the tweets
4. For "templates.postTemplates" and "templates.replyTemplates" - use ONLY actual examples from the tweets, not generic templates
5. For "positioning.topics" - extract ONLY topics that actually appear in the tweets
6. For "positioning.contentPillars" - base these ONLY on actual content patterns in the tweets
7. For "brandSafety" topics - derive ONLY from what topics are actually present/absent in the tweets
8. For "topicDistribution" - calculate percentages based ONLY on actual post counts and engagement from the tweets
9. DO NOT add generic examples, best practices, or inferred content
10. If a field cannot be derived from the actual tweets, use empty arrays or appropriate null/empty values

Generate a brand profile following this exact JSON schema. Extract EVERY piece of information directly from the tweets provided above.

{
  "meta": {
    "userId": "external",
    "generatedAt": "${new Date().toISOString()}",
    "sources": {
      "x": { "handle": "@${handle}", "itemsUsed": ${tweets.length} }
    }
  },
  "voice": {
    "dos": ["ONLY patterns observed in actual tweets - what the account actually does"],
    "tone": ["ONLY tone descriptors derived from actual tweet language"],
    "donts": ["ONLY things the account avoids based on actual tweet content"],
    "traits": ["ONLY traits observable from actual tweets"],
    "readingLevel": "simple|mixed|advanced (based on actual tweet complexity)",
    "formatPatterns": ["ONLY format patterns that actually appear in tweets"],
    "signaturePhrases": ["ONLY phrases that actually appear multiple times in tweets"]
  },
  "positioning": {
    "topics": ["ONLY topics that actually appear in the tweets"],
    "oneLiner": "one sentence brand positioning derived ONLY from actual tweet content",
    "audiences": [
      {
        "segment": "ONLY audience segments mentioned or implied in actual tweets",
        "painPoints": ["ONLY pain points mentioned in actual tweets"],
        "desiredOutcomes": ["ONLY outcomes mentioned in actual tweets"]
      }
    ],
    "contentPillars": [
      {
        "name": "ONLY pillars based on actual content patterns in tweets",
        "description": "derived from actual tweet content",
        "exampleAngles": ["ONLY angles that actually appear in tweets"]
      }
    ]
  },
  "styleGuidelines": {
    "ctaStyle": ["array of CTA styles"],
    "emojiPolicy": "none|light|heavy",
    "hashtagPolicy": "none|light|heavy",
    "punctuationNotes": "punctuation style notes",
    "lengthPreferences": {
      "short": boolean,
      "threads": boolean,
      "longForm": boolean
    }
  },
  "templates": {
    "postTemplates": [
      {
        "name": "ONLY templates based on actual tweet patterns",
        "example": "ONLY actual example from tweets",
        "structure": "structure derived from actual tweets"
      }
    ],
    "replyTemplates": [
      {
        "name": "ONLY templates based on actual reply patterns",
        "example": "ONLY actual reply example from tweets"
      }
    ]
  },
  "brandSafety": {
    "redTopics": ["ONLY topics the account actually avoids based on tweet content"],
    "greenTopics": ["ONLY topics the account actually covers in tweets"],
    "yellowTopics": ["ONLY topics that appear occasionally or cautiously in tweets"],
    "complianceNotes": ["ONLY compliance patterns observed in actual tweets"]
  },
  "contentPerformance": {
    "optimalLengthRange": {
      "min": number,
      "max": number,
      "recommended": number
    },
    "topPerformingTypes": [
      {
        "type": "content type name",
        "description": "what this type is",
        "avgEngagement": number
      }
    ],
    "bestPerformingTopics": [
      {
        "topic": "topic name",
        "description": "what this topic is",
        "performance": "high|medium|low"
      }
    ]
  },
  "postingPatterns": {
    "bestDays": ["array of best days"],
    "bestTimes": ["array of best times"],
    "frequencyRecommendation": "posting frequency recommendation",
    "contentCalendarSuggestions": [
      {
        "day": "day name",
        "time": "specific time",
        "rationale": "why this timing",
        "contentType": "type of content"
      }
    ]
  },
  "hashtagAnalysis": {
    "mostUsed": [
      {
        "hashtag": "hashtag text",
        "frequency": number,
        "context": "when/where it's used"
      }
    ],
    "recommendations": [
      {
        "hashtag": "recommended hashtag",
        "reason": "why to use it",
        "useCase": "when to use"
      }
    ],
    "performanceInsights": [
      {
        "insight": "key insight",
        "recommendation": "actionable recommendation"
      }
    ]
  },
  "engagementStrategies": {
    "communityTactics": [
      {
        "tactic": "tactic name",
        "description": "what this tactic is",
        "effectiveness": "high|medium|low"
      }
    ],
    "effectiveReplyTypes": [
      {
        "type": "reply type name",
        "example": "full example",
        "description": "what this type is"
      }
    ],
    "responseTimePatterns": {
      "average": "average response time",
      "bestPractice": "recommended response time",
      "notes": "additional notes"
    }
  },
  "contentMix": {
    "communityRatio": number,
    "educationalRatio": number,
    "mediaPreferences": {
      "images": number,
      "videos": number,
      "textOnly": number
    },
    "promotionalRatio": number,
    "linkSharingPatterns": [
      {
        "type": "link type",
        "frequency": "how often",
        "description": "what this link type is"
      }
    ]
  },
  "competitivePositioning": {
    "differentiators": [
      {
        "point": "ONLY differentiators observable from actual tweet content",
        "description": "derived from actual tweets"
      }
    ],
    "uniqueValueProps": [
      {
        "prop": "ONLY value props evident in actual tweets",
        "evidence": "ONLY evidence from actual tweet content"
      }
    ],
    "marketPositioning": {
      "position": "ONLY position derived from actual tweet content",
      "reasoning": "based on actual tweets"
    }
  },
  "crisisCommunication": {
    "damageControl": {
      "methods": ["ONLY methods observed in actual tweet responses"],
      "bestPractices": ["ONLY practices evident in actual tweet handling"]
    },
    "controversyResponse": {
      "patterns": ["ONLY response patterns from actual tweets"],
      "strategy": "ONLY strategy observable from actual tweet responses"
    },
    "negativeFeedbackHandling": {
      "tone": "ONLY tone observed in actual responses to negative feedback",
      "approach": "ONLY approach evident in actual tweets",
      "examples": ["ONLY actual examples from tweets"]
    }
  },
  "visualStyle": {
    "imagePreferences": {
      "style": "ONLY style observable from actual media in tweets",
      "themes": ["ONLY themes from actual tweet media"],
      "colorSchemes": ["ONLY color schemes from actual tweet media"]
    },
    "videoPreferences": {
      "style": "ONLY style from actual videos in tweets",
      "format": "ONLY format from actual videos in tweets",
      "length": "ONLY length patterns from actual videos in tweets"
    },
    "visualContentThemes": [
      {
        "theme": "ONLY themes from actual tweet media",
        "frequency": "based on actual tweet media frequency",
        "description": "derived from actual tweet media"
      }
    ]
  },
  "lexicalProfile": {
    "topUnigrams": [
      {
        "word": "word",
        "frequency": number
      }
    ],
    "topBigrams": [
      {
        "phrase": "two word phrase",
        "frequency": number
      }
    ],
    "jargonFrequency": number,
    "emojiFrequency": number,
    "profanityLevel": "none|low|medium|high",
    "hedgingLanguageRate": number,
    "convictionLanguageRate": number
  },
  "topicDistribution": [
    {
      "topic": "topic name",
      "percentageOfPosts": number,
      "engagementShare": number,
      "trendDirection": "rising|flat|falling"
    }
  ],
  "sentimentProfile": {
    "avgSentimentScore": number,
    "volatility": number,
    "negativityRate": number,
    "controversyRate": number,
    "sarcasmDetectionScore": number
  },
  "epistemicStyle": {
    "dataBackedRate": number,
    "speculativeRate": number,
    "opinionatedRate": number,
    "narrativeDrivenRate": number
  },
  "networkProfile": {
    "topMentions": [
      {
        "handle": "@username",
        "frequency": number
      }
    ],
    "mostInteractedAccounts": [
      {
        "handle": "@username",
        "interactionCount": number
      }
    ],
    "frequentlyQuoted": [
      {
        "handle": "@username",
        "frequency": number
      }
    ],
    "replyTargets": [
      {
        "handle": "@username",
        "frequency": number
      }
    ],
    "ecosystemClusters": ["array of ecosystem cluster names"]
  }
}

Return ONLY valid JSON, no markdown, no code blocks, no explanations.`

  // Call OpenAI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert brand analyst creating brand profiles. CRITICAL: Extract ALL information ONLY from the actual tweets provided. Do NOT invent, infer, or add generic content. Every field must be derived directly from the actual tweet content. If something does not appear in the tweets, use empty arrays or null values. Always return valid JSON only - no markdown, no code blocks.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })

  const responseText = completion.choices[0]?.message?.content
  if (!responseText) {
    throw new Error('No response from OpenAI')
  }

  // Parse JSON
  let profileJson: BrandProfile
  try {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    profileJson = JSON.parse(cleaned)
  } catch (error) {
    console.error('Failed to parse OpenAI response:', responseText)
    throw new Error('Invalid JSON response from OpenAI')
  }

  // Set meta
  profileJson.meta = {
    userId: 'external',
    generatedAt: new Date().toISOString(),
    sources: {
      x: { handle: `@${handle}`, itemsUsed: tweets.length },
    },
  }

  // Merge analyzed data
  profileJson.lexicalProfile = {
    topUnigrams: topUnigrams.slice(0, 20),
    topBigrams: topBigrams.slice(0, 20),
    jargonFrequency,
    emojiFrequency,
    profanityLevel,
    hedgingLanguageRate,
    convictionLanguageRate,
  }

  profileJson.sentimentProfile = {
    avgSentimentScore,
    volatility,
    negativityRate,
    controversyRate,
    sarcasmDetectionScore,
  }

  profileJson.epistemicStyle = {
    dataBackedRate,
    speculativeRate,
    opinionatedRate,
    narrativeDrivenRate,
  }

  profileJson.networkProfile = {
    topMentions: topMentions.slice(0, 20),
    mostInteractedAccounts: mostInteractedAccountsList.slice(0, 20),
    frequentlyQuoted: frequentlyQuoted.slice(0, 20),
    replyTargets: replyTargetsList.slice(0, 20),
    ecosystemClusters,
  }

  if (!profileJson.topicDistribution) {
    profileJson.topicDistribution = []
  }

  return profileJson
}
