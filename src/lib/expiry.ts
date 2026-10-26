import type { Item } from './types'

export type Status = 'expired' | 'critical' | 'soon' | 'ok' | 'unknown'

const DAY = 86_400_000

/** Whole days until expiry, rounded up; negative once expired. */
export function daysLeft(expiresAt: string | null, now = Date.now()): number | null {
  if (!expiresAt) return null
  return Math.ceil((Date.parse(expiresAt) - now) / DAY)
}

export function statusOf(item: Pick<Item, 'expiresAt'>, now = Date.now()): Status {
  const d = daysLeft(item.expiresAt, now)
  if (d === null) return 'unknown'
  if (d <= 0) return 'expired'
  if (d <= 7) return 'critical'
  if (d <= 30) return 'soon'
  return 'ok'
}

export const STATUS_LABEL: Record<Status, string> = {
  expired: 'Expired',
  critical: 'This week',
  soon: 'This month',
  ok: 'Healthy',
  unknown: 'No date',
}

/** CSS color var per status. */
export const STATUS_COLOR: Record<Status, string> = {
  expired: 'var(--danger)',
  critical: 'var(--warn)',
  soon: 'var(--primary)',
  ok: 'var(--ok)',
  unknown: 'var(--muted-foreground)',
}

export function countdown(expiresAt: string | null, now = Date.now()): string {
  const d = daysLeft(expiresAt, now)
  if (d === null) return 'No expiry date'
  if (d < 0) return `Expired ${-d} day${d === -1 ? '' : 's'} ago`
  if (d === 0) return 'Expires today'
  if (d === 1) return 'Expires tomorrow'
  if (d < 60) return `${d} days left`
  const months = Math.round(d / 30)
  return `${months} months left`
}

/** The threshold reached today, if any: the smallest reminder >= days left. Used for notifications. */
export function dueThreshold(expiresAt: string | null, reminders: number[], now = Date.now()): number | null {
  const d = daysLeft(expiresAt, now)
  if (d === null) return null
  const hit = [...reminders].sort((a, b) => a - b).find((r) => d <= r)
  return hit ?? null
}

export function sortByExpiry(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    if (!a.expiresAt) return 1
    if (!b.expiresAt) return -1
    return Date.parse(a.expiresAt) - Date.parse(b.expiresAt)
  })
}
