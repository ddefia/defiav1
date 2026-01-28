import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserId } from '@/lib/auth-simple'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const statusSchema = z.object({
  jobId: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId parameter required' },
        { status: 400 }
      )
    }

    const job = await prisma.brandJob.findFirst({
      where: {
        id: jobId,
        userId,
      },
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      status: job.status,
      progress: job.progress,
      error: job.errorMessage,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    })
  } catch (error) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
