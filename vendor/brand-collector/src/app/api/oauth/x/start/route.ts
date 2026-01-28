import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-simple'

export const dynamic = 'force-dynamic'

const X_CLIENT_ID = process.env.X_CLIENT_ID
const X_REDIRECT_URI = process.env.X_REDIRECT_URI

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId()
    
    if (!X_CLIENT_ID || !X_REDIRECT_URI) {
      return NextResponse.json(
        { error: 'X OAuth not configured' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const handle = searchParams.get('handle')

    if (!handle) {
      return NextResponse.json(
        { error: 'Handle parameter required' },
        { status: 400 }
      )
    }

    // Store handle in session/cookie for callback
    // For simplicity, we'll include it in state
    const state = Buffer.from(JSON.stringify({ userId, handle })).toString('base64')

    const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', X_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', X_REDIRECT_URI)
    authUrl.searchParams.set('scope', 'tweet.read users.read offline.access')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', 'challenge') // Simplified - should use PKCE
    authUrl.searchParams.set('code_challenge_method', 'plain')

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('Error starting X OAuth:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
