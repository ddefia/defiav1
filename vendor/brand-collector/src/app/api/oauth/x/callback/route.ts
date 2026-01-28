import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-simple'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

const X_CLIENT_ID = process.env.X_CLIENT_ID
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET
const X_REDIRECT_URI = process.env.X_REDIRECT_URI

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code || !state) {
      const baseUrl = request.nextUrl.origin
      return NextResponse.redirect(`${baseUrl}/dashboard/setup?error=oauth_failed`)
    }

    // Decode state to get handle
    let stateData: { userId: string; handle: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'))
    } catch {
      const baseUrl = request.nextUrl.origin
      return NextResponse.redirect(`${baseUrl}/dashboard/setup?error=invalid_state`)
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: X_REDIRECT_URI!,
        code_verifier: 'challenge', // Should match start
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text())
      const baseUrl = request.nextUrl.origin
      return NextResponse.redirect(`${baseUrl}/dashboard/setup?error=token_exchange_failed`)
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
          type: 'x',
          handleOrUrl: stateData.handle,
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
        type: 'x',
        handleOrUrl: stateData.handle,
        oauthAccessToken: encrypt(tokens.access_token),
        oauthRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        tokenExpiry: expiresAt,
        status: 'connected',
      },
    })

    const baseUrl = request.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/dashboard/setup?success=x_connected`)
  } catch (error) {
    console.error('Error in X OAuth callback:', error)
    const baseUrl = request.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/dashboard/setup?error=oauth_failed`)
  }
}
