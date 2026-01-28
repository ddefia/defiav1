import { prisma } from '../db'
import { decrypt } from '../encryption'
import { scrubTokens } from '../token-scrub'

interface XTweet {
  id: string
  text: string
  created_at: string
  public_metrics?: {
    like_count?: number
    retweet_count?: number
    reply_count?: number
    quote_count?: number
  }
  attachments?: {
    media_keys?: string[]
  }
}

interface XMedia {
  media_key: string
  type: string
  url?: string
  preview_image_url?: string
}

interface XResponse {
  data?: XTweet[]
  includes?: {
    media?: XMedia[]
  }
  meta?: {
    result_count?: number
  }
}

/**
 * Get an access token for X API calls
 * Uses a connected account's token, or throws if none available
 */
async function getAccessToken(): Promise<string> {
  // Try to get a connected X account token
  const source = await prisma.brandSource.findFirst({
    where: {
      type: 'x',
      status: 'connected',
      oauthAccessToken: { not: null },
    },
  })

  if (!source || !source.oauthAccessToken) {
    throw new Error('No X API access token available. Please connect an X account first in Setup.')
  }

  // Check if token is expired
  if (source.tokenExpiry && source.tokenExpiry < new Date()) {
    throw new Error('X API access token expired. Please reconnect your X account in Setup.')
  }

  return decrypt(source.oauthAccessToken)
}

/**
 * Fetch tweets from an external X account (public, no OAuth required for the target account)
 * @param handle - X handle (with or without @)
 * @param maxTweets - Maximum number of tweets to fetch (default: 200)
 * @returns Array of normalized tweet data
 */
export async function fetchExternalXAccount(
  handle: string,
  maxTweets: number = 200
): Promise<Array<{
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
}>> {
  const accessToken = await getAccessToken()
  const cleanHandle = handle.replace('@', '')

  // Get user ID from handle
  const userResponse = await fetch(
    `https://api.twitter.com/2/users/by/username/${cleanHandle}?user.fields=id,username`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!userResponse.ok) {
    const errorText = await userResponse.text()
    console.error(`X API user lookup failed:`, {
      status: userResponse.status,
      statusText: userResponse.statusText,
      error: errorText,
      handle: cleanHandle,
    })
    
    if (userResponse.status === 404) {
      throw new Error(`X account @${cleanHandle} not found`)
    } else if (userResponse.status === 402) {
      throw new Error(`X API Payment Required: This endpoint requires a paid X API plan.`)
    }
    
    throw new Error(`Failed to fetch X user (${userResponse.status}): ${userResponse.statusText}`)
  }

  const userData = await userResponse.json()
  const xUserId = userData.data?.id

  if (!xUserId) {
    throw new Error(`X account @${cleanHandle} not found`)
  }

  // Fetch tweets (max 100 per request - X API limit)
  // We'll paginate to get up to maxTweets
  const allTweets: XTweet[] = []
  const allMedia = new Map<string, XMedia>()
  let nextToken: string | undefined = undefined
  const maxRequests = Math.ceil(maxTweets / 100)

  for (let i = 0; i < maxRequests && allTweets.length < maxTweets; i++) {
    const url = new URL(`https://api.twitter.com/2/users/${xUserId}/tweets`)
    url.searchParams.set('max_results', '100')
    url.searchParams.set('exclude', 'retweets')
    url.searchParams.set('tweet.fields', 'created_at,public_metrics,attachments')
    url.searchParams.set('expansions', 'attachments.media_keys')
    url.searchParams.set('media.fields', 'type,url,preview_image_url')
    if (nextToken) {
      url.searchParams.set('pagination_token', nextToken)
    }

    const tweetsResponse = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!tweetsResponse.ok) {
      const errorText = await tweetsResponse.text()
      console.error(`X API tweets fetch failed:`, {
        status: tweetsResponse.status,
        statusText: tweetsResponse.statusText,
        error: errorText,
        handle: cleanHandle,
      })
      
      if (tweetsResponse.status === 402) {
        throw new Error(`X API Payment Required: This endpoint requires a paid X API plan.`)
      } else if (tweetsResponse.status === 401) {
        throw new Error(`X API Unauthorized: Access token may be expired. Please reconnect your X account.`)
      } else if (tweetsResponse.status === 403) {
        throw new Error(`X API Forbidden: Your API plan may not have access to this endpoint.`)
      }
      
      throw new Error(`Failed to fetch X tweets (${tweetsResponse.status}): ${tweetsResponse.statusText}`)
    }

    const tweetsData: XResponse = await tweetsResponse.json()
    const tweets = tweetsData.data || []
    allTweets.push(...tweets)

    // Collect media from this batch
    if (tweetsData.includes?.media) {
      tweetsData.includes.media.forEach((m) => {
        allMedia.set(m.media_key, m)
      })
    }

    // Check for pagination token
    const meta = tweetsData.meta as any
    nextToken = meta?.next_token
    if (!nextToken || tweets.length === 0) {
      break
    }
  }

  // Limit to maxTweets
  const limitedTweets = allTweets.slice(0, maxTweets)

  // Normalize tweets
  return limitedTweets.map((tweet) => {
    const media: Array<{ type: string; url?: string }> = []
    
    if (tweet.attachments?.media_keys) {
      tweet.attachments.media_keys.forEach((key) => {
        const mediaItem = allMedia.get(key)
        if (mediaItem) {
          media.push({
            type: mediaItem.type,
            url: mediaItem.url || mediaItem.preview_image_url,
          })
        }
      })
    }

    return {
      id: tweet.id,
      text: tweet.text,
      created_at: new Date(tweet.created_at),
      url: `https://twitter.com/${cleanHandle}/status/${tweet.id}`,
      metrics: {
        like_count: tweet.public_metrics?.like_count || 0,
        retweet_count: tweet.public_metrics?.retweet_count || 0,
        reply_count: tweet.public_metrics?.reply_count || 0,
        quote_count: tweet.public_metrics?.quote_count || 0,
      },
      ...(media.length > 0 && { media }),
    }
  })
}
