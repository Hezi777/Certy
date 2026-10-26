import { useEffect, useState } from 'react'
import { Mascot, type MascotBody } from '@/mascot/Mascot'
import type { StateId } from '@/mascot/engine/states'
import { setThemePref } from '@/lib/theme'
import { cn } from '@/lib/utils'

const BODIES: { id: MascotBody; name: string; blurb: string }[] = [
  { id: 'sceau', name: 'Seal', blurb: 'Scalloped certificate seal' },
  { id: 'cadenas', name: 'Padlock', blurb: 'Lock body with a shackle' },
  { id: 'bouclier', name: 'Shield', blurb: 'Protection, pointed base' },
  { id: 'coffre', name: 'Vault', blurb: 'Round door with a spinning dial' },
]

/** App situations and the engine state/expression each one maps to. */
const MOODS: { id: string; label: string; state: StateId; expression?: string; alert?: boolean }[] = [
  { id: 'healthy', label: 'All healthy', state: 'idle', expression: 'heureux' },
  { id: 'wink', label: 'Empty state', state: 'wink' },
  { id: 'checking', label: 'Checking API', state: 'thinking' },
  { id: 'soon', label: 'Expiring soon', state: 'notify', expression: 'mefiant' },
  { id: 'expired', label: 'Expired', state: 'idle', alert: true },
  { id: 'alert', label: 'Alert', state: 'alert' },
  { id: 'added', label: 'Item added', state: 'burst' },
  { id: 'sleep', label: 'Nothing to do', state: 'sleep' },
]

const COLORS = [
  { name: 'Violet', value: 'var(--mascot)' },
  { name: 'Blue', value: '#3b93f0' },
  { name: 'Orange', value: '#f08a24' },
  { name: 'Mint', value: '#2fbfa0' },
  { name: 'Ink', value: 'var(--foreground)' },
]

export function MascotLab() {
  const initial = MOODS.findIndex((m) => m.id === new URLSearchParams(location.search).get('mood'))
  const [mood, setMood] = useState(Math.max(0, initial))
  const [auto, setAuto] = useState(initial < 0)
  const [color, setColor] = useState(COLORS[0]!.value)
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')

  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => setMood((m) => (m + 1) % MOODS.length), 2600)
    return () => clearInterval(id)
  }, [auto])

  useEffect(() => setThemePref(theme), [theme])

  const current = MOODS[mood]!

  return (
    <div className="min-h-dvh bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-primary">Checkpoint 1</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Pick Certy's mascot</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Same engine, four bodies. Resting states use the custom body; alert-type states morph into
              their own animated shapes. Move your pointer — they watch it.
            </p>
          </div>
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </header>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {MOODS.map((m, i) => (
            <button
              key={m.id}
              onClick={() => {
                setAuto(false)
                setMood(i)
              }}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]',
                i === mood
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          ))}
          <button
            onClick={() => setAuto((a) => !a)}
            className="ml-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {auto ? 'Pause cycle' : 'Auto-cycle'}
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.name}
                title={c.name}
                onClick={() => setColor(c.value)}
                className={cn(
                  'size-6 rounded-full ring-offset-2 ring-offset-background transition-transform duration-150 ease-out active:scale-90',
                  color === c.value && 'ring-2 ring-ring',
                )}
                style={{ background: c.value }}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BODIES.map((b) => (
            <section key={b.id} className="overflow-hidden rounded-3xl border bg-card">
              <div className="grid place-items-center pt-10 pb-6">
                <Mascot
                  body={b.id}
                  state={current.state}
                  expression={current.expression}
                  alert={current.alert}
                  color={color}
                  paper="var(--card)"
                  size={180}
                  follow
                />
              </div>
              <div className="px-5 pb-4">
                <h2 className="text-lg font-semibold">{b.name}</h2>
                <p className="text-sm text-muted-foreground">{b.blurb}</p>
              </div>
              {/* size ladder: sidebar logo, list avatar, tray icon */}
              <div className="flex items-end gap-4 border-t px-5 py-4">
                {[56, 32, 20].map((s) => (
                  <Mascot key={s} body={b.id} color={color} paper="var(--card)" size={s} frozenAt={0.5} />
                ))}
                <div className="ml-auto flex gap-2">
                  <div className="grid size-10 place-items-center rounded-xl bg-[oklch(0.16_0.012_275)]">
                    <Mascot body={b.id} color="oklch(0.7 0.19 285)" paper="oklch(0.16 0.012 275)" size={30} frozenAt={0.5} />
                  </div>
                  <div className="grid size-10 place-items-center rounded-xl border bg-white">
                    <Mascot body={b.id} color="oklch(0.56 0.22 285)" paper="#fff" size={30} frozenAt={0.5} />
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Showing: <span className="text-foreground">{current.label}</span> · engine state{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{current.state}</code>
        </p>
      </div>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-full border bg-card p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full px-3.5 py-1 text-sm transition-colors duration-150',
            value === o.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
