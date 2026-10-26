import { useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ServiceIcon } from '@/components/ServiceIcon'
import { Mascot } from '@/mascot/Mascot'
import { countdown, sortByExpiry, STATUS_COLOR, statusOf } from '@/lib/expiry'
import { serviceById, useStore } from '@/lib/store'

/** Secrets that need action: expired, expiring this week, or rejected by their service. */
export function useAttention() {
  const items = useStore((s) => s.items)
  return useMemo(
    () =>
      sortByExpiry(items).filter(
        (i) => ['expired', 'critical'].includes(statusOf(i)) || (i.lastCheck && !i.lastCheck.ok),
      ),
    [items],
  )
}

export function AttentionBell({ onOpenItem, onSeeAll }: { onOpenItem: (id: string) => void; onSeeAll: () => void }) {
  const services = useStore((s) => s.services)
  const attention = useAttention()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={attention.length ? `${attention.length} need attention` : 'Notifications'}
          className="relative grid size-11 place-items-center rounded-full bg-card text-muted-foreground ring-1 ring-border transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-95 dark:ring-0"
        >
          <Bell className="size-[18px]" />
          {attention.length > 0 && (
            <span className="absolute top-2 right-2.5 size-2.5 rounded-full border-2 border-card bg-danger" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Needs attention</p>
          <span className="text-xs text-muted-foreground tabular-nums">{attention.length}</span>
        </div>
        {attention.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Mascot size={56} expression="heureux" paper="var(--popover)" />
            <p className="mt-3 text-sm text-muted-foreground">All clear. Nothing expires this week.</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto p-1.5">
            {attention.map((i) => {
              const s = serviceById(services, i.serviceId)
              if (!s) return null
              const rejected = i.lastCheck && !i.lastCheck.ok
              return (
                <button
                  key={i.id}
                  onClick={() => {
                    setOpen(false)
                    onOpenItem(i.id)
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-100 hover:bg-muted"
                >
                  <ServiceIcon icon={s.icon} color={s.color} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.name}</p>
                    <p className="truncate text-xs" style={{ color: rejected ? 'var(--danger)' : STATUS_COLOR[statusOf(i)] }}>
                      {rejected ? `Rejected by ${s.name}` : countdown(i.expiresAt)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
        {attention.length > 0 && (
          <button
            onClick={() => {
              setOpen(false)
              onSeeAll()
            }}
            className="w-full border-t py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            See all secrets
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
