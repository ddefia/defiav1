// Utility to scrub sensitive tokens from objects before logging/storing

export function scrubTokens(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(scrubTokens)
  }

  const scrubbed: any = {}

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()

    // Remove token-related fields
    if (
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('authorization') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('apikey')
    ) {
      scrubbed[key] = '[REDACTED]'
    } else if (typeof value === 'object') {
      scrubbed[key] = scrubTokens(value)
    } else {
      scrubbed[key] = value
    }
  }

  return scrubbed
}
