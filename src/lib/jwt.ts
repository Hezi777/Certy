/** Reads `exp` from a JWT without verifying it: we only need the date, not trust. */
export function jwtExpiry(token: string): string | null {
  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.')
  if (parts.length !== 3) return null
  try {
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')))
    return typeof payload.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : null
  } catch {
    return null
  }
}
