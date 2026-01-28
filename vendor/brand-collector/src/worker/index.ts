// Load environment variables first
import 'dotenv/config'

import { createWorker } from '@/lib/queue'
import { prisma } from '@/lib/db'
import { fetchXContent } from '@/lib/fetchers/x'
import { generateBrandProfile } from '@/lib/brand-profile'

async function processCollectionJob(job: any) {
  const { jobId, userId } = job.data

  try {
    // Update job status
    await prisma.brandJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        progress: 0,
        startedAt: new Date(),
      },
    })

    // Stage A: Fetch X content (0-40%)
    let xCount = 0

    try {
      await prisma.brandJob.update({
        where: { id: jobId },
        data: { progress: 10 },
      })

      // Fetch X content
      try {
        xCount = await fetchXContent(userId)
        await prisma.brandJob.update({
          where: { id: jobId },
          data: { progress: 40 },
        })
      } catch (error) {
        console.error('Error fetching X content:', error)
        throw error // Fail the job if X content fetch fails
      }
    } catch (error) {
      throw new Error(`Failed to fetch content: ${error}`)
    }

    // Stage B: Normalization (40-50%)
    await prisma.brandJob.update({
      where: { id: jobId },
      data: { progress: 50 },
    })

    // Stage C: Generate brand profile (50-90%)
    await prisma.brandJob.update({
      where: { id: jobId },
      data: { progress: 60 },
    })

    const profile = await generateBrandProfile(userId)

    await prisma.brandJob.update({
      where: { id: jobId },
      data: { progress: 90 },
    })

    // Stage D: Finalize (90-100%)
    await prisma.brandJob.update({
      where: { id: jobId },
      data: {
        status: 'complete',
        progress: 100,
        finishedAt: new Date(),
      },
    })

    console.log(`Job ${jobId} completed successfully`)
  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error)

    await prisma.brandJob.update({
      where: { id: jobId },
      data: {
        status: 'error',
        errorMessage: error.message || 'Unknown error',
        finishedAt: new Date(),
      },
    })
  }
}

// Create and start worker
const worker = createWorker(processCollectionJob)

console.log('Brand collection worker started')

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down worker...')
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down worker...')
  await worker.close()
  process.exit(0)
})
