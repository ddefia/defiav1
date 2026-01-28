import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-simple'
import { prisma } from '@/lib/db'
import { validateApiKey } from '@/lib/api-key'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Support both user auth and API key auth
    const authHeader = request.headers.get('authorization')
    const apiKeyValid = validateApiKey(authHeader)
    
    let userId: string
    
    if (apiKeyValid) {
      // API key auth - get userId from query param
      const searchParams = request.nextUrl.searchParams
      const requestedUserId = searchParams.get('userId')
      
      if (!requestedUserId) {
        return NextResponse.json(
          { error: 'userId parameter required for API key auth' },
          { status: 400 }
        )
      }
      
      userId = requestedUserId
    } else {
      // User auth
      userId = await requireUserId()
    }

    const profile = await prisma.brandProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'No brand profile found' },
        { status: 404 }
      )
    }

    return NextResponse.json(profile.profileJson)
  } catch (error) {
    console.error('Error fetching brand profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
