import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth-simple'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireUserId()
    const { id } = params

    const profile = await prisma.brandProfile.findFirst({
      where: {
        id,
        userId,
      },
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Brand profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: profile.id,
      brandHandle: profile.brandHandle,
      isExternal: profile.isExternal,
      createdAt: profile.createdAt,
      version: profile.version,
      profile: profile.profileJson,
    })
  } catch (error) {
    console.error('Error fetching brand profile:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch brand profile' },
      { status: 500 }
    )
  }
}
