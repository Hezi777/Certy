import { Boxes, KeyRound, LayoutGrid, Plus, RefreshCw, Settings } from 'lucide-react'
import { HelpPopover } from './HelpPopover'
import { Mascot } from '@/mascot/Mascot'
import { ServiceIcon } from '@/components/ServiceIcon'
import { statusOf } from '@/lib/expiry'
import { actions, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export type View = 'overview' | 'vault' | 'services' | 'settings'

const NAV: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'vault', label: 'Secrets', icon: KeyRound },
  { id: 'services', label: 'Services', icon: Boxes },
]

export function Sidebar({
  view,
  onNavigate,
  onPickService,
  onAddFor,
}: {
  view: View
  onNavigate: (v: View) => void
  onPickService: (serviceId: string) => void
  /** A service with no secrets yet opens the add flow for it. */
  onAddFor: (serviceId: string) => void
}) {
  const services = useStore((s) => s.services)
  const items = useStore((s) => s.items)
  const checking = useStore((s) => s.checking)
  // every enabled service shows, so a fresh install already lists what was picked in onboarding;
  // ones with secrets come first
  const shown = services
    .filter((s) => s.enabled)
    .map((s) => ({ service: s, mine: items.filter((i) => i.serviceId === s.id) }))
    .sort((a, b) => Number(b.mine.length > 0) - Number(a.mine.length > 0) || a.service.name.localeCompare(b.service.name))

  return (
    <aside className="flex w-64 shrink-0 flex-col px-5 pt-8 pb-6">
      <div className="flex items-center gap-2.5 px-3">
        <Mascot size={30} paper="var(--background)" />
        <span className="text-lg font-semibold tracking-tight">Certy</span>
      </div>

      <nav className="mt-9 flex flex-col gap-0.5">
        {NAV.map((n) => (
          <NavButton key={n.id} active={view === n.id} onClick={() => onNavigate(n.id)} icon={n.icon}>
            {n.label}
          </NavButton>
        ))}
      </nav>

      {shown.length > 0 && (
        <div className="mt-8 flex min-h-0 flex-col gap-0.5 overflow-y-auto">
          <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Your services</p>
          {shown.map(({ service: s, mine }) => {
            const urgent = mine.some((i) => ['expired', 'critical'].includes(statusOf(i)))
            const empty = mine.length === 0
            return (
              <button
                key={s.id}
                onClick={() => (empty ? onAddFor(s.id) : onPickService(s.id))}
                title={empty ? `Add a ${s.name} secret` : undefined}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 text-left text-[15px] text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-foreground"
              >
                <span className={cn('transition-opacity duration-150', empty && 'opacity-50 group-hover:opacity-100')}>
                  <ServiceIcon icon={s.icon} color={s.color} size={28} />
                </span>
                <span className="flex-1 truncate">{s.name}</span>
                {urgent ? (
                  <span className="size-1.5 rounded-full bg-warn" aria-label="Needs attention" />
                ) : empty ? (
                  <Plus className="size-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                ) : (
                  <span className="text-xs tabular-nums">{mine.length}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-0.5 pt-6">
        <div className="mb-4 rounded-2xl border p-4">
          <p className="text-sm font-medium">Auto-checks on</p>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">Certy checks your services every few hours.</p>
          <button
            onClick={() => items.forEach((i) => actions.check(i.id))}
            disabled={checking.size > 0}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-2 text-sm font-medium text-background transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-70"
          >
            <RefreshCw className={cn('size-3.5', checking.size > 0 && 'animate-spin')} />
            {checking.size > 0 ? 'Checking…' : 'Check now'}
          </button>
        </div>
        <NavButton active={view === 'settings'} onClick={() => onNavigate('settings')} icon={Settings}>
          Settings
        </NavButton>
        <HelpPopover
          trigger={({ icon }) => (
            <NavButton active={false} icon={icon}>
              Help
            </NavButton>
          )}
        />
      </div>
    </aside>
  )
}

function NavButton({
  active,
  icon: Icon,
  children,
  ...rest
}: {
  active: boolean
  icon: typeof LayoutGrid
  children: React.ReactNode
} & React.ComponentProps<'button'>) {
  return (
    <button
      {...rest}
      className={cn(
        'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors duration-150',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {active && <span className="absolute top-1/2 -left-5 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />}
      <Icon className="size-[18px]" strokeWidth={1.75} />
      {children}
    </button>
  )
}
