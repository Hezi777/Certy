import { useMemo, useState } from 'react'
import { ServiceIcon } from '@/components/ServiceIcon'
import { Mascot } from '@/mascot/Mascot'
import { STATUS_COLOR, STATUS_LABEL, sortByExpiry, statusOf, type Status } from '@/lib/expiry'
import { serviceById, useStore } from '@/lib/store'
import type { ItemKind } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatDate, KIND_LABEL, shortLeft, StatusBadge } from './ItemCard'

const STATUSES: Status[] = ['expired', 'critical', 'soon', 'ok', 'unknown']

/** All secrets, filterable by service, kind and status. */
export function Vault({
  query,
  serviceFilter,
  onServiceFilter,
  status,
  onStatus,
  onOpenItem,
  onAdd,
}: {
  query: string
  serviceFilter: string | null
  onServiceFilter: (id: string | null) => void
  /** Lifted to the shell so a KPI tile on the Overview can open this list pre-filtered. */
  status: Status | null
  onStatus: (s: Status | null) => void
  onOpenItem: (id: string) => void
  onAdd: () => void
}) {
  const items = useStore((s) => s.items)
  const services = useStore((s) => s.services)
  const checking = useStore((s) => s.checking)
  const [kind, setKind] = useState<ItemKind | null>(null)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sortByExpiry(items).filter((i) => {
      const s = serviceById(services, i.serviceId)
      if (serviceFilter && i.serviceId !== serviceFilter) return false
      if (kind && i.kind !== kind) return false
      if (status && statusOf(i) !== status) return false
      if (q && !`${i.name} ${s?.name} ${i.subject ?? ''} ${i.username ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, services, query, serviceFilter, kind, status])

  const used = services.filter((s) => items.some((i) => i.serviceId === s.id))

  return (
    <div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted-foreground tabular-nums">
          {shown.length} of {items.length}
        </span>
        <Chip active={!serviceFilter} onClick={() => onServiceFilter(null)}>
          All services
        </Chip>
        {used.map((s) => (
          <Chip key={s.id} active={serviceFilter === s.id} onClick={() => onServiceFilter(serviceFilter === s.id ? null : s.id)}>
            <ServiceIcon icon={s.icon} color={s.color} size={18} />
            {s.name}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <Chip active={kind === 'token'} onClick={() => setKind(kind === 'token' ? null : 'token')}>
          Tokens
        </Chip>
        <Chip active={kind === 'certificate'} onClick={() => setKind(kind === 'certificate' ? null : 'certificate')}>
          Certificates
        </Chip>
        <Chip active={kind === 'login'} onClick={() => setKind(kind === 'login' ? null : 'login')}>
          Logins
        </Chip>
        <span className="mx-1 h-5 w-px bg-border" />
        {STATUSES.map((st) => (
          <Chip key={st} active={status === st} onClick={() => onStatus(status === st ? null : st)}>
            <span className="size-1.5 rounded-full" style={{ background: STATUS_COLOR[st] }} />
            {STATUS_LABEL[st]}
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Mascot state="wink" size={96} paper="var(--background)" />
          <p className="mt-5 font-medium">{items.length ? 'Nothing matches these filters' : 'No secrets yet'}</p>
          {items.length > 0 && (
            <button
              onClick={() => {
                onServiceFilter(null)
                onStatus(null)
                setKind(null)
              }}
              className="mt-3 text-sm text-primary"
            >
              Clear filters
            </button>
          )}
          {!items.length && (
            <button onClick={onAdd} className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              Add your first secret
            </button>
          )}
        </div>
      ) : (
        <div className="-mx-3 flex flex-col">
          {shown.map((i) => {
            const s = serviceById(services, i.serviceId)
            if (!s) return null
            return (
              <button
                key={i.id}
                onClick={() => onOpenItem(i.id)}
                className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors duration-150 hover:bg-card"
              >
                <ServiceIcon icon={s.icon} color={s.color} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {s.name} · {KIND_LABEL[i.kind]}
                    {checking.has(i.id) && ' · checking…'}
                    {!checking.has(i.id) && i.lastCheck && !i.lastCheck.ok && (
                      <span className="text-danger"> · rejected by {s.name}</span>
                    )}
                  </p>
                </div>
                <StatusBadge item={i} className="hidden md:inline-flex" />
                <p className="hidden w-28 text-right text-sm text-muted-foreground sm:block">{formatDate(i.expiresAt)}</p>
                <span className="w-12 text-right text-sm font-medium text-muted-foreground tabular-nums">{shortLeft(i.expiresAt)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-[background-color,color] duration-150',
        active ? 'bg-foreground text-background' : 'bg-card text-muted-foreground ring-1 ring-border hover:text-foreground dark:ring-0',
      )}
    >
      {children}
    </button>
  )
}
