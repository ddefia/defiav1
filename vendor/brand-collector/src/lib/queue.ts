import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const isUpstash = redisUrl.includes('upstash.io')

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  ...(isUpstash && {
    tls: {
      rejectUnauthorized: false,
    },
  }),
})

export const collectionQueue = new Queue('brand-collection', { connection })

export function createWorker(processor: (job: any) => Promise<void>) {
  return new Worker('brand-collection', processor, { connection })
}
