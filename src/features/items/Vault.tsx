import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { ServiceIcon } from '@/components/ServiceIcon'
import { Mascot } from '@/mascot/Mascot'
import { countdown, STATUS_COLOR, STATUS_LABEL, sortByExpiry, statusOf, type Status } from '@/lib/expiry'
import { serviceById, useStore } from '@/lib/store'
import type { Item, ItemKind } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatDate, KIND_LABEL } from './ItemCard'

/** The list is split by urgency, so a row never has to repeat its status. */
const GROUPS: { title: string; color: string; statuses: Status[] }[] = [
  { title: 'Needs attention', color: STATUS_COLOR.expired, statuses: ['expired', 'critical'] },
  { title: 'This month', color: STATUS_COLOR.soon, statuses: ['soon'] },
  { title: 'Later', color: STATUS_COLOR.ok, statuses: ['ok'] },
  { title: 'No date', color: STATUS_COLOR.unknown, statuses: ['unknown'] },
]

const KINDS: { id: ItemKind | null; label: string }[] = [
  { id: null, label: 'All' },
  { id: 'token', label: 'Tokens' },
  { id: 'certificate', label: 'Certificates' },
  { id: 'login', label: 'Logins' },
]

/** All secrets, grouped by urgency. Service and status filters arrive from the sidebar and Overview. */
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

  const filteredService = serviceFilter ? serviceById(services, serviceFilter) : undefined

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {KINDS.map((k) => (
            <button
              key={k.label}
              onClick={() => setKind(k.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-[background-color,color] duration-150',
                kind === k.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        {filteredService && (
          <FilterPill onClear={() => onServiceFilter(null)}>
            <ServiceIcon icon={filteredService.icon} color={filteredService.color} size={18} />
            {filteredService.name}
          </FilterPill>
        )}
        {status && (
          <FilterPill onClear={() => onStatus(null)}>
            <span className="size-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />
            {STATUS_LABEL[status]}
          </FilterPill>
        )}
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {shown.length === items.length ? `${items.length} secrets` : `${shown.length} of ${items.length}`}
        </span>
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
        <div className="flex flex-col gap-8">
          {GROUPS.map((g) => {
            const rows = shown.filter((i) => g.statuses.includes(statusOf(i)))
            if (!rows.length) return null
            return (
              <section key={g.title}>
                <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <span className="size-1.5 rounded-full" style={{ background: g.color }} />
                  {g.title}
                  <span className="font-normal tabular-nums">{rows.length}</span>
                </h2>
                <div className="-mx-3 flex flex-col">
                  {rows.map((i) => (
                    <Row key={i.id} item={i} onOpen={() => onOpenItem(i.id)} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Row({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const service = useStore((s) => serviceById(s.services, item.serviceId))
  const checking = useStore((s) => s.checking.has(item.id))
  if (!service) return null
  const status = statusOf(item)
  const urgent = status === 'expired' || status === 'critical'
  return (
    <button
      onClick={onOpen}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors duration-150 hover:bg-card"
    >
      <ServiceIcon icon={service.icon} color={service.color} size={40} />
      <div className="min-w-0">
        <p className="truncate font-medium">{item.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {service.name} · {KIND_LABEL[item.kind]}
          {checking && ' · checking…'}
          {!checking && item.lastCheck && !item.lastCheck.ok && (
            <span className="text-danger"> · rejected by {service.name}</span>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums" style={urgent ? { color: STATUS_COLOR[status] } : undefined}>
          {countdown(item.expiresAt)}
        </p>
        {item.expiresAt && <p className="text-xs text-muted-foreground">{formatDate(item.expiresAt)}</p>}
      </div>
    </button>
  )
}

function FilterPill({ onClear, children }: { onClear: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClear}
      aria-label="Clear filter"
      className="inline-flex items-center gap-1.5 rounded-full bg-foreground py-1.5 pr-2.5 pl-3 text-sm text-background transition-opacity duration-150 hover:opacity-85"
    >
      {children}
      <X className="size-3.5 opacity-70" />
    </button>
  )
}
