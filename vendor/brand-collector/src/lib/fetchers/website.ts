import { prisma } from '../db'
import * as cheerio from 'cheerio'

interface PageData {
  url: string
  text: string
  title?: string
}

async function fetchPage(url: string): Promise<PageData> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BrandCollector/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  // Remove script, style, nav, footer, header elements
  $('script, style, nav, footer, header, .nav, .footer, .header, .navigation, .sidebar').remove()

  // Extract title
  const title = $('title').text() || $('h1').first().text()

  // Extract main content
  const mainContent = $('main, article, .content, .post, .entry, body').first()
  const text = mainContent.text().replace(/\s+/g, ' ').trim()

  return {
    url,
    text: text || $('body').text().replace(/\s+/g, ' ').trim(),
    title,
  }
}

async function getSitemapUrls(sitemapUrl: string): Promise<string[]> {
  try {
    const response = await fetch(sitemapUrl)
    if (!response.ok) return []

    const xml = await response.text()
    const $ = cheerio.load(xml, { xmlMode: true })
    const urls: string[] = []

    $('url loc').each((_, el) => {
      const url = $(el).text().trim()
      if (url) urls.push(url)
    })

    return urls.slice(0, 10) // Cap at 10 for MVP
  } catch {
    return []
  }
}

async function crawlWebsite(startUrl: string, maxDepth: number = 2): Promise<string[]> {
  const visited = new Set<string>()
  const toVisit: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }]
  const found: string[] = []

  const baseUrl = new URL(startUrl).origin

  while (toVisit.length > 0 && found.length < 10) {
    const { url, depth } = toVisit.shift()!

    if (visited.has(url) || depth > maxDepth) continue
    visited.add(url)

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BrandCollector/1.0)',
        },
      })

      if (!response.ok) continue

      const html = await response.text()
      const $ = cheerio.load(html)

      found.push(url)

      if (depth < maxDepth) {
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href')
          if (!href) return

          try {
            const absoluteUrl = new URL(href, baseUrl).href
            if (absoluteUrl.startsWith(baseUrl) && !visited.has(absoluteUrl)) {
              toVisit.push({ url: absoluteUrl, depth: depth + 1 })
            }
          } catch {
            // Invalid URL, skip
          }
        })
      }
    } catch {
      // Failed to fetch, skip
    }
  }

  return found.slice(0, 10) // Cap at 10
}

export async function fetchWebsiteContent(userId: string): Promise<number> {
  const source = await prisma.brandSource.findFirst({
    where: {
      userId,
      type: 'website',
      status: 'connected',
    },
  })

  if (!source) {
    throw new Error('Website source not found')
  }

  const baseUrl = source.handleOrUrl
  let urls: string[] = []

  // Try sitemap first
  try {
    const sitemapUrl = new URL('/sitemap.xml', baseUrl).href
    urls = await getSitemapUrls(sitemapUrl)
  } catch {
    // Sitemap not found or invalid
  }

  // Fallback to crawling
  if (urls.length === 0) {
    urls = await crawlWebsite(baseUrl, 2)
  }

  // Ensure we have at least the homepage
  if (urls.length === 0) {
    urls = [baseUrl]
  }

  // Fetch and normalize pages
  const contentItems = []

  for (const url of urls.slice(0, 10)) {
    try {
      const pageData = await fetchPage(url)

      contentItems.push({
        userId,
        sourceType: 'website' as const,
        contentType: 'page' as const,
        url: pageData.url,
        text: `${pageData.title ? `${pageData.title}\n\n` : ''}${pageData.text}`,
        timestamp: new Date(),
        rawJson: { title: pageData.title, url: pageData.url },
      })

      // Rate limiting: small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error)
      // Continue with other pages
    }
  }

  await prisma.contentItem.createMany({
    data: contentItems,
    skipDuplicates: true,
  })

  return contentItems.length
}
