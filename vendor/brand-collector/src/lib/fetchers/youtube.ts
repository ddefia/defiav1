import { prisma } from '../db'
import { decrypt } from '../encryption'
import { scrubTokens } from '../token-scrub'

interface YouTubeVideo {
  id: string
  snippet: {
    title: string
    description: string
    publishedAt: string
    tags?: string[]
    thumbnails?: {
      default?: { url: string }
      medium?: { url: string }
      high?: { url: string }
    }
  }
  statistics?: {
    viewCount?: string
    likeCount?: string
    commentCount?: string
  }
}

interface YouTubeResponse {
  items: YouTubeVideo[]
}

export async function fetchYouTubeContent(userId: string): Promise<number> {
  const source = await prisma.brandSource.findFirst({
    where: {
      userId,
      type: 'youtube',
      status: 'connected',
    },
  })

  if (!source || !source.oauthAccessToken) {
    throw new Error('YouTube source not connected or missing token')
  }

  const accessToken = decrypt(source.oauthAccessToken)
  const channelUrl = source.handleOrUrl

  // Extract channel ID from URL
  let channelId: string | null = null

  // Try to get channel ID from URL patterns
  const channelIdMatch = channelUrl.match(/channel\/([^/?]+)/)
  if (channelIdMatch) {
    channelId = channelIdMatch[1]
  } else {
    // Try to get from custom URL
    const customMatch = channelUrl.match(/c\/([^/?]+)/)
    if (customMatch) {
      // For custom URLs, we need to resolve to channel ID
      // This is a simplified version - in production, use YouTube Data API
      const username = customMatch[1]
      const resolveResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${username}&key=${process.env.YOUTUBE_API_KEY || ''}`,
      )
      if (resolveResponse.ok) {
        const resolveData = await resolveResponse.json()
        channelId = resolveData.items?.[0]?.id
      }
    }
  }

  if (!channelId) {
    // Fallback: try to get channel ID from OAuth token
    const meResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (meResponse.ok) {
      const meData = await meResponse.json()
      channelId = meData.items?.[0]?.id
    }
  }

  if (!channelId) {
    throw new Error('Could not determine YouTube channel ID')
  }

  // Fetch videos (max 20 for MVP)
  const videosResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=20`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!videosResponse.ok) {
    const errorText = await videosResponse.text()
    throw new Error(`Failed to fetch YouTube videos: ${videosResponse.statusText} - ${errorText}`)
  }

  const searchData = await videosResponse.json()
  const videoIds = searchData.items?.map((item: any) => item.id.videoId).join(',')

  if (!videoIds) {
    return 0
  }

  // Get detailed video information
  const detailsResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!detailsResponse.ok) {
    throw new Error(`Failed to fetch YouTube video details: ${detailsResponse.statusText}`)
  }

  const videosData: YouTubeResponse = await detailsResponse.json()
  const videos = videosData.items || []

  // Normalize and store videos
  const contentItems = videos.map((video) => {
    const text = `${video.snippet.title}\n\n${video.snippet.description}`.trim()
    const media = video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url

    // Scrub tokens
    const rawJson = scrubTokens(video)

    return {
      userId,
      sourceType: 'youtube' as const,
      contentType: 'video' as const,
      externalId: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      text,
      timestamp: new Date(video.snippet.publishedAt),
      metricsJson: video.statistics || {},
      mediaJson: media ? [{ type: 'thumbnail', url: media }] : undefined,
      rawJson: rawJson,
    }
  })

  await prisma.contentItem.createMany({
    data: contentItems,
    skipDuplicates: true,
  })

  return videos.length
}
