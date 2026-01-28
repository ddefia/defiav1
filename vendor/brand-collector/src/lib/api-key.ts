const COACH_API_KEY = process.env.COACH_API_KEY

export function validateApiKey(authHeader: string | null): boolean {
  if (!COACH_API_KEY) {
    return false
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const providedKey = authHeader.replace('Bearer ', '')
  return providedKey === COACH_API_KEY
}
