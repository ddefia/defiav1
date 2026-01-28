import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserId } from '@/lib/auth-simple'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId()

    // Get all brand profiles, grouped by brandHandle
    const profiles = await prisma.brandProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    // Group by brandHandle and get latest version for each
    const brandMap = new Map<string, typeof profiles[0]>()
    
    for (const profile of profiles) {
      const key = profile.brandHandle || 'unknown'
      if (!brandMap.has(key) || profile.createdAt > brandMap.get(key)!.createdAt) {
        brandMap.set(key, profile)
      }
    }

    // Convert to array and format
    const brands = Array.from(brandMap.values()).map((profile) => {
      const profileJson = profile.profileJson as any
      return {
        id: profile.id,
        brandHandle: profile.brandHandle,
        isExternal: profile.isExternal,
        createdAt: profile.createdAt,
        version: profile.version,
        tweetsAnalyzed: profileJson?.meta?.sources?.x?.itemsUsed || 0,
        generatedAt: profileJson?.meta?.generatedAt,
      }
    })

    // Sort by most recent first
    brands.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ brands })
  } catch (error) {
    console.error('Error fetching brands:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch brands' },
      { status: 500 }
    )
  }
}
