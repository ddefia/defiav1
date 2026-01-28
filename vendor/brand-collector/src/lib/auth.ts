import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from './db'

export async function getAuthenticatedUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

export async function getOrCreateUser(): Promise<string> {
  const user = await currentUser()
  if (!user || !user.emailAddresses[0]?.emailAddress) {
    throw new Error('Unauthorized')
  }

  const email = user.emailAddresses[0].emailAddress
  const clerkId = user.id

  // Find or create user in database
  let dbUser = await prisma.user.findUnique({
    where: { email },
  })

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: { email },
    })
  }

  return dbUser.id
}

export async function requireAuth(): Promise<string> {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    throw new Error('Unauthorized')
  }
  return await getOrCreateUser()
}
