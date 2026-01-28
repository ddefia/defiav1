import { NextRequest, NextResponse } from 'next/server'
import { fetchExternalXAccount } from '@/lib/fetchers/x-external'
import { generateBrandProfileFromTweets } from '@/lib/brand-profile-external'
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth-simple'

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await request.json()
    const { handle } = body

    if (!handle) {
      return NextResponse.json(
        { error: 'X handle is required' },
        { status: 400 }
      )
    }

    // Clean handle
    const cleanHandle = handle.replace('@', '').trim()
    if (!cleanHandle) {
      return NextResponse.json(
        { error: 'Invalid X handle' },
        { status: 400 }
      )
    }

    const brandHandle = `@${cleanHandle}`

    // Check if profile already exists for this brand
    const existingProfile = await prisma.brandProfile.findFirst({
      where: {
        userId,
        brandHandle,
        isExternal: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch tweets from external account
    console.log(`Fetching tweets for external account: ${brandHandle}`)
    const tweets = await fetchExternalXAccount(cleanHandle, 200)

    if (tweets.length === 0) {
      return NextResponse.json(
        { error: `No tweets found for ${brandHandle}` },
        { status: 404 }
      )
    }

    console.log(`Fetched ${tweets.length} tweets for ${brandHandle}`)

    // Generate brand profile from tweets
    const brandProfile = await generateBrandProfileFromTweets(cleanHandle, tweets)

    // Save to database
    const latestProfile = await prisma.brandProfile.findFirst({
      where: { userId, brandHandle, isExternal: true },
      orderBy: { version: 'desc' },
    })

    const nextVersion = latestProfile ? latestProfile.version + 1 : 1

    await prisma.brandProfile.create({
      data: {
        userId,
        version: nextVersion,
        brandHandle,
        isExternal: true,
        profileJson: brandProfile as any,
      },
    })

    return NextResponse.json({
      success: true,
      handle: brandHandle,
      tweetsAnalyzed: tweets.length,
      profile: brandProfile,
      profileId: (await prisma.brandProfile.findFirst({
        where: { userId, brandHandle, isExternal: true },
        orderBy: { createdAt: 'desc' },
      }))?.id,
    })
  } catch (error) {
    console.error('Error analyzing external brand:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to analyze external brand',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
