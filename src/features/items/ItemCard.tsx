import { IconGlyph } from '@/components/ServiceIcon'
import { countdown, daysLeft, STATUS_COLOR, STATUS_LABEL, statusOf } from '@/lib/expiry'
import type { Item, ItemKind, Service } from '@/lib/types'
import { cn } from '@/lib/utils'

export const KIND_LABEL: Record<ItemKind, string> = {
  token: 'API token',
  certificate: 'Certificate',
  login: 'Login',
}

export function StatusBadge({ item, className }: { item: Item; className?: string }) {
  const status = statusOf(item)
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', className)}
      style={{
        color: STATUS_COLOR[status],
        background: `color-mix(in oklab, ${STATUS_COLOR[status]} 14%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Short countdown chip: "4d", "3mo", "–2d". */
export function shortLeft(expiresAt: string | null) {
  const d = daysLeft(expiresAt)
  if (d === null) return '—'
  if (d <= 0) return d === 0 ? 'today' : `${d}d`
  if (d < 60) return `${d}d`
  return `${Math.round(d / 30)}mo`
}

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'

/** Thumbnail card, after the "Learn Zeno" tiles: a softly tinted panel with the logo and a countdown chip. */
export function ItemCard({ item, service, onOpen }: { item: Item; service: Service; onOpen: () => void }) {
  const status = statusOf(item)
  const urgent = status === 'expired' || status === 'critical'
  return (
    <button onClick={onOpen} className="group flex w-full flex-col gap-3 text-left">
      <div
        className="relative grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-2xl ring-1 ring-border transition-transform duration-200 ease-out group-active:scale-[0.98] dark:ring-0"
        style={{
          background: `radial-gradient(100% 100% at 50% 0%, color-mix(in oklab, ${service.color} 16%, var(--card)), var(--card) 75%)`,
        }}
      >
        <span className="transition-transform duration-300 ease-out group-hover:scale-105">
          <IconGlyph icon={service.icon} size={52} color={service.color} />
        </span>
        <span className="absolute right-3 bottom-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white tabular-nums">
          {shortLeft(item.expiresAt)}
        </span>
      </div>
      <div className="px-0.5">
        <p className="truncate font-medium">{item.name}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {service.name} ·{' '}
          <span style={urgent ? { color: STATUS_COLOR[status] } : undefined}>{countdown(item.expiresAt)}</span>
        </p>
      </div>
    </button>
  )
}
