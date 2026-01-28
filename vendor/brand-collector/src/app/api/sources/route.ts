import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserId } from '@/lib/auth-simple'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const sourceSchema = z.object({
  type: z.enum(['x', 'youtube', 'website']),
  value: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    
    // Rate limiting
    if (!rateLimit(`sources:${userId}`)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }
    
    const body = await request.json()
    const { type, value } = sourceSchema.parse(body)

    // Normalize value based on type
    let handleOrUrl = value.trim()
    
    if (type === 'youtube' && !handleOrUrl.includes('youtube.com') && !handleOrUrl.includes('youtu.be')) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      )
    }

    if (type === 'website' && !handleOrUrl.startsWith('http://') && !handleOrUrl.startsWith('https://')) {
      handleOrUrl = `https://${handleOrUrl}`
    }

    // Create or update source
    const source = await prisma.brandSource.upsert({
      where: {
        userId_type_handleOrUrl: {
          userId,
          type,
          handleOrUrl,
        },
      },
      update: {
        handleOrUrl,
        status: type === 'website' ? 'connected' : 'pending',
        updatedAt: new Date(),
      },
      create: {
        userId,
        type,
        handleOrUrl,
        status: type === 'website' ? 'connected' : 'pending',
      },
    })

    return NextResponse.json({ source })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error creating source:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId()
    
    const sources = await prisma.brandSource.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ sources })
  } catch (error) {
    console.error('Error fetching sources:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const searchParams = request.nextUrl.searchParams
    const sourceId = searchParams.get('id')

    if (!sourceId) {
      return NextResponse.json(
        { error: 'Source ID is required' },
        { status: 400 }
      )
    }

    // Verify the source belongs to the user
    const source = await prisma.brandSource.findFirst({
      where: {
        id: sourceId,
        userId,
      },
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }

    // Delete the source
    await prisma.brandSource.delete({
      where: { id: sourceId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting source:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
