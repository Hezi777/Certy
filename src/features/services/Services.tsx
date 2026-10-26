import { Plus } from 'lucide-react'
import { ServiceIcon } from '@/components/ServiceIcon'
import { Switch } from '@/components/ui/switch'
import { actions, useStore } from '@/lib/store'
import type { Service } from '@/lib/types'

const CHECK_SHORT: Record<Service['check']['type'], string> = {
  none: 'Manual dates',
  ping: 'Validity ping',
  api: 'Reads expiry from API',
  tls: 'Reads TLS certificate',
}

/** Built-in and custom services; toggling hides a service from the sidebar and add flow. */
export function Services({ onEdit, onNew }: { onEdit: (s: Service) => void; onNew: () => void }) {
  const services = useStore((s) => s.services)
  const items = useStore((s) => s.items)
  const sorted = [...services].sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.name.localeCompare(b.name))

  return (
    <div>
      <div className="mb-6 flex items-end justify-end">
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-accent active:scale-[0.97]"
        >
          <Plus className="size-4" /> New service
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((s) => {
          const count = items.filter((i) => i.serviceId === s.id).length
          return (
            <div
              key={s.id}
              className="flex flex-col rounded-2xl bg-card p-5 ring-1 ring-border transition-opacity duration-150 dark:ring-0"
              style={{ opacity: s.enabled ? 1 : 0.55 }}
            >
              <div className="flex items-start justify-between">
                <ServiceIcon icon={s.icon} color={s.color} size={48} />
                <Switch
                  checked={s.enabled}
                  onCheckedChange={(enabled) => actions.saveService({ ...s, enabled })}
                  aria-label={`Show ${s.name}`}
                />
              </div>
              <p className="mt-4 font-semibold">{s.name}</p>
              <p className="text-sm text-muted-foreground">
                {CHECK_SHORT[s.check.type]} · {count} secret{count === 1 ? '' : 's'}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground/80">{s.baseUrl || 'No URL'}</p>
              <button
                onClick={() => onEdit(s)}
                className="mt-4 w-fit text-sm font-medium text-primary transition-opacity hover:opacity-80"
              >
                Configure
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
