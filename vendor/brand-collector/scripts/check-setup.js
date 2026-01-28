#!/usr/bin/env node

/**
 * Setup verification script
 * Checks if all required environment variables and services are configured
 */

const requiredEnvVars = [
  'DATABASE_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'REDIS_URL',
  'OPENAI_API_KEY',
  'X_CLIENT_ID',
  'X_CLIENT_SECRET',
  'X_REDIRECT_URI',
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'YOUTUBE_REDIRECT_URI',
  'ENCRYPTION_KEY',
]

const optionalEnvVars = [
  'COACH_API_KEY',
  'YOUTUBE_API_KEY',
]

console.log('🔍 Checking Brand Collector Setup...\n')

// Check environment variables
let missing = []
let present = []

requiredEnvVars.forEach((varName) => {
  if (process.env[varName]) {
    present.push(varName)
    console.log(`✅ ${varName}`)
  } else {
    missing.push(varName)
    console.log(`❌ ${varName} - MISSING`)
  }
})

optionalEnvVars.forEach((varName) => {
  if (process.env[varName]) {
    console.log(`✅ ${varName} (optional)`)
  } else {
    console.log(`⚠️  ${varName} - Not set (optional)`)
  }
})

console.log('\n' + '='.repeat(50))

if (missing.length === 0) {
  console.log('\n✅ All required environment variables are set!')
  console.log('\n📋 Next steps:')
  console.log('1. Ensure PostgreSQL is running')
  console.log('2. Ensure Redis is running')
  console.log('3. Run: npx prisma migrate dev')
  console.log('4. Start dev server: npm run dev')
  console.log('5. Start worker: npm run worker')
} else {
  console.log(`\n❌ Missing ${missing.length} required environment variable(s)`)
  console.log('\nPlease set the following in your .env file:')
  missing.forEach((varName) => {
    console.log(`  - ${varName}`)
  })
  console.log('\nSee SETUP_GUIDE.md for detailed instructions.')
  process.exit(1)
}

// Check database connection (if Prisma is available)
try {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  
  prisma.$connect()
    .then(() => {
      console.log('\n✅ Database connection successful!')
      return prisma.$disconnect()
    })
    .catch((err) => {
      console.log('\n❌ Database connection failed:')
      console.log(`   ${err.message}`)
      console.log('\n   Make sure PostgreSQL is running and DATABASE_URL is correct.')
    })
} catch (err) {
  console.log('\n⚠️  Could not check database connection (Prisma not generated)')
  console.log('   Run: npx prisma generate')
}

// Check Redis connection
try {
  const IORedis = require('ioredis')
  const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    connectTimeout: 2000,
  })
  
  redis.ping()
    .then((result) => {
      if (result === 'PONG') {
        console.log('✅ Redis connection successful!')
      }
      redis.disconnect()
    })
    .catch((err) => {
      console.log('\n❌ Redis connection failed:')
      console.log(`   ${err.message}`)
      console.log('\n   Make sure Redis is running and REDIS_URL is correct.')
    })
} catch (err) {
  console.log('\n⚠️  Could not check Redis connection')
  console.log('   Make sure Redis is installed and running')
}

console.log('\n' + '='.repeat(50))
