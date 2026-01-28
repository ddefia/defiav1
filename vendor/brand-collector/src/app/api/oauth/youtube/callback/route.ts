import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-simple'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET
const YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code || !state) {
      return NextResponse.redirect('/onboarding?error=oauth_failed')
    }

    let stateData: { userId: string; channelUrl: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'))
    } catch {
      return NextResponse.redirect('/onboarding?error=invalid_state')
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: YOUTUBE_CLIENT_ID!,
        client_secret: YOUTUBE_CLIENT_SECRET!,
        redirect_uri: YOUTUBE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text())
      return NextResponse.redirect('/onboarding?error=token_exchange_failed')
    }

    const tokens = await tokenResponse.json()
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null

    // Store encrypted tokens
    await prisma.brandSource.upsert({
      where: {
        userId_type_handleOrUrl: {
          userId,
          type: 'youtube',
          handleOrUrl: stateData.channelUrl,
        },
      },
      update: {
        oauthAccessToken: encrypt(tokens.access_token),
        oauthRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        tokenExpiry: expiresAt,
        status: 'connected',
        updatedAt: new Date(),
      },
      create: {
        userId,
        type: 'youtube',
        handleOrUrl: stateData.channelUrl,
        oauthAccessToken: encrypt(tokens.access_token),
        oauthRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        tokenExpiry: expiresAt,
        status: 'connected',
      },
    })

    return NextResponse.redirect('/onboarding?success=youtube_connected')
  } catch (error) {
    console.error('Error in YouTube OAuth callback:', error)
    return NextResponse.redirect('/onboarding?error=oauth_failed')
  }
}
