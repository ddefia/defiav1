import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-simple'

export const dynamic = 'force-dynamic'

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID
const YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId()
    
    if (!YOUTUBE_CLIENT_ID || !YOUTUBE_REDIRECT_URI) {
      return NextResponse.json(
        { error: 'YouTube OAuth not configured' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const channelUrl = searchParams.get('channelUrl')

    if (!channelUrl) {
      return NextResponse.json(
        { error: 'channelUrl parameter required' },
        { status: 400 }
      )
    }

    const state = Buffer.from(JSON.stringify({ userId, channelUrl })).toString('base64')

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', YOUTUBE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', YOUTUBE_REDIRECT_URI)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.readonly')
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('state', state)

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('Error starting YouTube OAuth:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
