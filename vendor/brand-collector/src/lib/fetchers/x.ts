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

export async function fetchXContent(userId: string): Promise<number> {
  const sources = await prisma.brandSource.findMany({
    where: {
      userId,
      type: 'x',
      status: 'connected',
    },
  })

  if (sources.length === 0) {
    throw new Error('No X sources connected')
  }

  let totalTweets = 0

  // Process each connected X account
  for (const source of sources) {
    if (!source.oauthAccessToken) {
      console.warn(`Skipping X source ${source.handleOrUrl}: missing token`)
      continue
    }

    try {
      // Check if token is expired
      if (source.tokenExpiry && source.tokenExpiry < new Date()) {
        console.warn(`Token expired for ${source.handleOrUrl}. Please reconnect this account.`)
        // Update status to error so user knows to reconnect
        await prisma.brandSource.update({
          where: { id: source.id },
          data: { status: 'error' },
        })
        throw new Error(`OAuth token expired for ${source.handleOrUrl}. Please reconnect this account.`)
      }

      const accessToken = decrypt(source.oauthAccessToken)
      const handle = source.handleOrUrl.replace('@', '')
      const tweetsCount = await fetchTweetsForSource(userId, handle, accessToken)
      totalTweets += tweetsCount
    } catch (error) {
      console.error(`Error fetching tweets for ${source.handleOrUrl}:`, error)
      // Update source status to error if it's an auth issue
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('expired'))) {
        await prisma.brandSource.update({
          where: { id: source.id },
          data: { status: 'error' },
        })
      }
      // Continue with other sources even if one fails
    }
  }

  return totalTweets
}

async function fetchTweetsForSource(
  userId: string,
  handle: string,
  accessToken: string
): Promise<number> {

  // First, get user ID from handle
  const userResponse = await fetch(
    `https://api.twitter.com/2/users/by/username/${handle}?user.fields=id,username`,
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
    })
    throw new Error(`Failed to fetch X user (${userResponse.status}): ${userResponse.statusText} - ${errorText}`)
  }

  const userData = await userResponse.json()
  const xUserId = userData.data?.id

  if (!xUserId) {
    throw new Error('X user not found')
  }

  // Fetch tweets (max 100 per request - X API limit)
  // Exclude retweets (RTs) but keep quote tweets (QRTs) since they have original commentary
  const tweetsResponse = await fetch(
    `https://api.twitter.com/2/users/${xUserId}/tweets?max_results=100&exclude=retweets&tweet.fields=created_at,public_metrics,attachments&expansions=attachments.media_keys&media.fields=type,url,preview_image_url`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!tweetsResponse.ok) {
    const errorText = await tweetsResponse.text()
    console.error(`X API tweets fetch failed:`, {
      status: tweetsResponse.status,
      statusText: tweetsResponse.statusText,
      error: errorText,
      handle,
    })
    
    // Provide more helpful error messages
    if (tweetsResponse.status === 402) {
      throw new Error(`X API Payment Required: This endpoint requires a paid X API plan. Please upgrade your X API subscription. Error: ${errorText}`)
    } else if (tweetsResponse.status === 401) {
      throw new Error(`X API Unauthorized: OAuth token may be expired or invalid. Please reconnect your X account. Error: ${errorText}`)
    } else if (tweetsResponse.status === 403) {
      throw new Error(`X API Forbidden: Your API plan may not have access to this endpoint. Error: ${errorText}`)
    }
    
    throw new Error(`Failed to fetch X tweets (${tweetsResponse.status}): ${tweetsResponse.statusText} - ${errorText}`)
  }

  const tweetsData: XResponse = await tweetsResponse.json()
  const tweets = tweetsData.data || []
  const mediaMap = new Map<string, XMedia>()
  
  if (tweetsData.includes?.media) {
    tweetsData.includes.media.forEach((m) => {
      mediaMap.set(m.media_key, m)
    })
  }

  // Normalize and store tweets
  const contentItems = tweets.map((tweet) => {
    const media: any[] = []
    
    if (tweet.attachments?.media_keys) {
      tweet.attachments.media_keys.forEach((key) => {
        const mediaItem = mediaMap.get(key)
        if (mediaItem) {
          media.push({
            type: mediaItem.type,
            url: mediaItem.url || mediaItem.preview_image_url,
          })
        }
      })
    }

    // Scrub tokens from raw JSON
    const rawJson = scrubTokens(tweet)

    return {
      userId,
      sourceType: 'x' as const,
      contentType: 'post' as const,
      externalId: tweet.id,
      url: `https://twitter.com/${handle}/status/${tweet.id}`,
      text: tweet.text,
      timestamp: new Date(tweet.created_at),
      metricsJson: tweet.public_metrics || {},
      mediaJson: media.length > 0 ? media : undefined,
      rawJson: rawJson,
    }
  })

  // Batch insert
  if (contentItems.length > 0) {
    await prisma.contentItem.createMany({
      data: contentItems,
      skipDuplicates: true,
    })
  }

  return tweets.length
}
