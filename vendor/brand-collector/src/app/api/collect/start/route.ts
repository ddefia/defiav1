import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-simple'
import { prisma } from '@/lib/db'
import { collectionQueue } from '@/lib/queue'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()

    // Rate limiting
    if (!rateLimit(`collect:${userId}`)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Check if user has at least one connected source
    const sources = await prisma.brandSource.findMany({
      where: {
        userId,
        status: 'connected',
      },
    })

    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'No connected sources found. Please connect at least one source.' },
        { status: 400 }
      )
    }

    // Create job
    const job = await prisma.brandJob.create({
      data: {
        userId,
        status: 'queued',
        progress: 0,
      },
    })

    // Enqueue background job
    await collectionQueue.add('collect-brand-profile', {
      jobId: job.id,
      userId,
    })

    return NextResponse.json({ jobId: job.id })
  } catch (error) {
    console.error('Error starting collection:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
