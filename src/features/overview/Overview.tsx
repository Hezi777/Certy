import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Mascot } from '@/mascot/Mascot'
import type { StateId } from '@/mascot/engine/states'
import { Ring } from '@/components/Ring'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ServiceIcon } from '@/components/ServiceIcon'
import { daysLeft, sortByExpiry, STATUS_COLOR, statusOf, type Status } from '@/lib/expiry'
import { serviceById, useStore } from '@/lib/store'
import type { Item } from '@/lib/types'
import { rise, useCountUp, useIntro } from '@/lib/intro'
import { formatDate, ItemCard, KIND_LABEL, shortLeft, StatusBadge } from '@/features/items/ItemCard'

export function Overview({
  onOpenItem,
  onViewAll,
  onStatus,
  onAdd,
}: {
  onOpenItem: (id: string) => void
  onViewAll: () => void
  /** Opens the Secrets list filtered to one status (KPI tile click). */
  onStatus: (status: Status) => void
  onAdd: () => void
}) {
  const items = useStore((s) => s.items)
  const services = useStore((s) => s.services)
  const checking = useStore((s) => s.checking)

  const sorted = useMemo(() => sortByExpiry(items), [items])
  const counts = useMemo(() => {
    const c: Record<Status, number> = { expired: 0, critical: 0, soon: 0, ok: 0, unknown: 0 }
    items.forEach((i) => c[statusOf(i)]++)
    return c
  }, [items])
  const attention = counts.expired + counts.critical
  const next = sorted.find((i) => (daysLeft(i.expiresAt) ?? -1) >= 0)
  const upcoming = sorted.filter((i) => statusOf(i) !== 'unknown').slice(0, 3)
  const intro = useIntro()

  return (
    <div className="flex flex-col gap-12">
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div style={rise(intro, 0)} className="flex">
          <Hero
            attention={attention}
            expired={counts.expired}
            next={next}
            busy={checking.size > 0}
            intro={intro}
            onReview={onViewAll}
          />
        </div>
        {next && (
          <div style={rise(intro, 1)} className="flex">
            <NextUp item={next} intro={intro} onOpen={() => onOpenItem(next.id)} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(['expired', 'critical', 'soon', 'ok'] as const).map((s, i) => (
          <div key={s} style={rise(intro, i, 160)}>
            <StatTile
              status={s}
              value={counts[s]}
              total={items.length}
              intro={intro}
              delay={260 + i * 60}
              onClick={() => onStatus(s)}
            />
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <section className="flex flex-col items-center rounded-3xl py-14 text-center ring-1 ring-border ring-dashed">
          <Mascot state="wink" size={88} paper="var(--background)" />
          <p className="mt-5 text-lg font-semibold">Nothing tracked yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Paste a token or drop a certificate. Certy finds the expiry date and reminds you before it runs out.
          </p>
          <button
            onClick={onAdd}
            className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Add your first secret
          </button>
        </section>
      )}

      {upcoming.length > 0 && (
      <section>
        <SectionHeader title="Coming up" action="View all" onAction={onViewAll} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((i, idx) => {
            const s = serviceById(services, i.serviceId)
            return (
              s && (
                <div key={i.id} style={rise(intro, idx, 380)}>
                  <ItemCard item={i} service={s} onOpen={() => onOpenItem(i.id)} />
                </div>
              )
            )
          })}
        </div>
      </section>

      )}

      {sorted.length > 0 && (
        <section>
          <SectionHeader title="Timeline" />
          <Timeline items={sorted.slice(0, 8)} intro={intro} onOpen={onOpenItem} />
        </section>
      )}
    </div>
  )
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          {action}
        </button>
      )}
    </div>
  )
}

/** Mascot mood: a warning triangle while anything has expired, wary with the notification dot when something is close. */
function heroMood(attention: number, expired: number, busy: boolean): { state: StateId; expression?: string; alert?: boolean } {
  if (busy) return { state: 'thinking' }
  if (expired > 0) return { state: 'idle', alert: true }
  if (attention > 0) return { state: 'notify', expression: 'mefiant' }
  return { state: 'idle', expression: 'heureux' }
}

function Hero({
  attention,
  expired,
  next,
  busy,
  intro,
  onReview,
}: {
  attention: number
  expired: number
  next?: Item
  busy: boolean
  intro: boolean
  onReview: () => void
}) {
  // on launch the mascot arrives with bloub's swirl, then settles into the real mood
  const [arriving, setArriving] = useState(intro)
  useEffect(() => {
    if (!arriving) return
    const t = setTimeout(() => setArriving(false), 1300)
    return () => clearTimeout(t)
  }, [arriving])
  const mood = arriving ? { state: 'swirl' as StateId } : heroMood(attention, expired, busy)
  const title = busy
    ? 'Checking your services…'
    : attention > 0
      ? `${attention} ${attention === 1 ? 'secret needs' : 'secrets need'} attention`
      : 'Everything is fresh'
  const sub =
    expired > 0
      ? `${expired} already expired. Renew ${expired === 1 ? 'it' : 'them'} before something breaks.`
      : next
        ? `Next expiry in ${daysLeft(next.expiresAt)} days.`
        : 'Add your first token or certificate to start tracking.'

  return (
    <section
      className="relative flex min-h-60 flex-1 overflow-hidden rounded-3xl p-9 text-white"
      style={{
        // one calm palette whatever the status: the copy and the mascot carry the urgency
        background:
          'radial-gradient(70% 110% at 82% 40%, oklch(0.62 0.11 215 / 0.9), transparent 70%), linear-gradient(115deg, oklch(0.24 0.04 250), oklch(0.33 0.07 240))',
      }}
    >
      <div className="relative z-10 flex max-w-md flex-col">
        <h1 className="text-[34px] leading-tight font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-white/70">{sub}</p>
        <button
          onClick={onReview}
          className="mt-auto inline-flex w-fit items-center gap-2 rounded-xl bg-white/12 px-5 py-2.5 text-sm font-medium backdrop-blur-md transition-[background-color,transform] duration-150 ease-out hover:bg-white/18 active:scale-[0.97]"
        >
          Review secrets <ArrowRight className="size-4" />
        </button>
      </div>
      <div className="pointer-events-none absolute top-1/2 right-10 -translate-y-1/2 sm:right-16">
        <Mascot
          state={mood.state}
          expression={mood.expression}
          alert={mood.alert}
          size={190}
          color="#fff"
          paper="transparent"
          follow
        />
      </div>
    </section>
  )
}

function NextUp({ item, intro, onOpen }: { item: Item; intro: boolean; onOpen: () => void }) {
  const service = useStore((s) => serviceById(s.services, item.serviceId))
  const d = daysLeft(item.expiresAt) ?? 0
  const shown = Math.round(useCountUp(d, intro, 1100, 200))
  if (!service) return null
  return (
    <section className="flex flex-1 flex-col rounded-3xl bg-card p-6 ring-1 ring-border dark:ring-0">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Next to expire</p>
        <StatusBadge item={item} />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <ServiceIcon icon={service.icon} color={service.color} size={44} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{item.name}</p>
          <p className="truncate text-sm text-muted-foreground">{service.name}</p>
        </div>
      </div>
      <p className="mt-6 text-5xl font-semibold tracking-tight tabular-nums">
        {shown}
        <span className="ml-1.5 text-lg font-medium text-muted-foreground">{d === 1 ? 'day' : 'days'}</span>
      </p>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{formatDate(item.expiresAt)}</p>
      <button
        onClick={onOpen}
        className="mt-auto inline-flex items-center justify-center rounded-xl bg-secondary py-2.5 text-sm font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-accent active:scale-[0.97]"
      >
        Open details
      </button>
    </section>
  )
}

const TILE: Record<'expired' | 'critical' | 'soon' | 'ok', { label: string; explain: string }> = {
  expired: { label: 'Expired', explain: 'Past their expiry date. Anything still using them is probably failing right now.' },
  critical: { label: 'This week', explain: 'Expire within the next 7 days. Renew these first.' },
  soon: { label: 'This month', explain: 'Expire in 8 to 30 days. Plan the renewal.' },
  ok: { label: 'Healthy', explain: 'More than 30 days left. Nothing to do.' },
}

function StatTile({
  status,
  value,
  total,
  intro,
  delay,
  onClick,
}: {
  status: keyof typeof TILE
  value: number
  total: number
  intro: boolean
  delay: number
  onClick: () => void
}) {
  const shown = Math.round(useCountUp(value, intro, 900, delay))
  const share = total ? Math.round((value / total) * 100) : 0
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="group flex w-full items-center justify-between rounded-2xl bg-card px-5 py-4 text-left ring-1 ring-border transition-[box-shadow,transform] duration-150 ease-out hover:ring-foreground/15 active:scale-[0.98] dark:ring-0 dark:hover:ring-1"
        >
          <div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />
              {TILE[status].label}
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{shown}</p>
          </div>
          <Ring value={total ? value / total : 0} size={44} stroke={4} color={STATUS_COLOR[status]} intro={intro} delay={delay} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64 text-left">
        <div>
          <p>{TILE[status].explain}</p>
          <p className="mt-1 opacity-70">
            {value} of {total} secrets ({share}%). Click to see them.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function Timeline({ items, intro, onOpen }: { items: Item[]; intro: boolean; onOpen: (id: string) => void }) {
  const services = useStore((s) => s.services)
  return (
    <div className="-mx-3 flex flex-col">
      {items.map((i, idx) => {
        const s = serviceById(services, i.serviceId)
        if (!s) return null
        const status = statusOf(i)
        const urgent = status === 'expired' || status === 'critical'
        return (
          <button
            key={i.id}
            onClick={() => onOpen(i.id)}
            style={rise(intro, idx, 520)}
            className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors duration-150 hover:bg-card"
          >
            <ServiceIcon icon={s.icon} color={s.color} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {s.name} · {KIND_LABEL[i.kind]}
              </p>
            </div>
            <p className="hidden text-sm text-muted-foreground sm:block">{formatDate(i.expiresAt)}</p>
            <span
              className="w-14 text-right text-sm font-medium tabular-nums"
              style={{ color: urgent ? STATUS_COLOR[status] : 'var(--muted-foreground)' }}
            >
              {shortLeft(i.expiresAt)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
