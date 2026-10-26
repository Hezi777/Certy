import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, Bell, Check, Plus } from 'lucide-react'
import { Mascot } from '@/mascot/Mascot'
import type { StateId } from '@/mascot/engine/states'
import { ServiceIcon } from '@/components/ServiceIcon'
import { Switch } from '@/components/ui/switch'
import { AiSettingsForm } from '@/features/settings/AiSettingsForm'
import { actions, useStore } from '@/lib/store'
import type { Settings } from '@/lib/types'
import { cn } from '@/lib/utils'

const STEPS = ['welcome', 'services', 'reminders', 'ai', 'done'] as const
type Step = (typeof STEPS)[number]

const REMINDER_CHOICES = [60, 30, 14, 7, 3, 1, 0]
const CHECK_CHOICES = [
  { hours: 1, label: 'Hourly' },
  { hours: 6, label: 'Every 6 hours' },
  { hours: 24, label: 'Daily' },
]

/** Mascot pose per step: it greets, watches, perks up, thinks, celebrates. */
const STEP_MASCOT: Record<Step, { state: StateId; expression?: string }> = {
  welcome: { state: 'wink' },
  services: { state: 'idle', expression: 'curieux' },
  reminders: { state: 'notify', expression: 'attentif' },
  ai: { state: 'idle', expression: 'fier' },
  done: { state: 'burst' },
}

export function Onboarding({ onFinish }: { onFinish: (addFirst: boolean) => void }) {
  const services = useStore((s) => s.services)
  const saved = useStore((s) => s.settings)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(services.filter((s) => s.builtin).map((s) => s.id)))
  const [settings, setSettings] = useState<Settings>(saved)
  const [aiKey, setAiKey] = useState('')
  const reduce = useReducedMotion()

  const current = STEPS[step]!
  const go = (delta: number) => {
    setDir(delta)
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)))
  }

  async function finish(addFirst: boolean) {
    await Promise.all(
      services
        .filter((s) => s.builtin)
        .map((s) => actions.saveService({ ...s, enabled: picked.has(s.id) })),
    )
    if (settings.ai.enabled && aiKey) await actions.saveAiKey(aiKey)
    await actions.saveSettings({ ...settings, ai: { ...settings.ai, hasKey: settings.ai.hasKey || !!aiKey }, onboarded: true })
    onFinish(addFirst)
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-6 py-10 text-foreground">
      {/* soft cyan glow behind the card, nothing else competing */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(50% 40% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent)' }}
      />
      <div className="relative flex w-full max-w-2xl flex-col items-center">
        <Mascot
          state={STEP_MASCOT[current].state}
          expression={STEP_MASCOT[current].expression}
          size={current === 'welcome' || current === 'done' ? 150 : 96}
          paper="var(--background)"
          follow
        />

        <div className="mt-6 flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                'h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out',
                i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-muted',
              )}
            />
          ))}
        </div>

        <div className="relative mt-8 w-full">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={current}
              custom={dir}
              initial={{ opacity: 0, transform: reduce ? 'none' : `translateX(${dir * 24}px)` }}
              animate={{ opacity: 1, transform: 'translateX(0px)' }}
              exit={{ opacity: 0, transform: reduce ? 'none' : `translateX(${dir * -24}px)` }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              {current === 'welcome' && (
                <StepText title="Meet Certy" body="Certy watches your API tokens and certificates and taps you on the shoulder before any of them expire. Everything stays on this computer, encrypted." />
              )}

              {current === 'services' && (
                <>
                  <StepText title="What do you use?" body="Pick the services you have tokens or certificates for. You can add your own later, with any logo or emoji." />
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {services
                      .filter((s) => s.builtin)
                      .map((s) => {
                        const on = picked.has(s.id)
                        return (
                          <button
                            key={s.id}
                            onClick={() =>
                              setPicked((p) => {
                                const n = new Set(p)
                                if (on) n.delete(s.id)
                                else n.add(s.id)
                                return n
                              })
                            }
                            className={cn(
                              'relative flex items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 transition-[box-shadow,transform] duration-150 ease-out active:scale-[0.98]',
                              on ? 'ring-2 ring-primary' : 'ring-border',
                            )}
                          >
                            <ServiceIcon icon={s.icon} color={s.color} size={36} />
                            <span className="text-sm font-medium">{s.name}</span>
                            {on && (
                              <span className="absolute top-2 right-2 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
                                <Check className="size-3" strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        )
                      })}
                    <div className="flex items-center gap-3 rounded-2xl p-3 text-sm text-muted-foreground ring-1 ring-border ring-dashed">
                      <span className="grid size-9 place-items-center rounded-[28%] bg-muted">
                        <Plus className="size-4" />
                      </span>
                      Custom later
                    </div>
                  </div>
                </>
              )}

              {current === 'reminders' && (
                <>
                  <StepText title="When should I remind you?" body="You'll get a Windows notification at each of these points before something expires." />
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {REMINDER_CHOICES.map((d) => {
                      const on = settings.reminders.includes(d)
                      return (
                        <button
                          key={d}
                          onClick={() =>
                            setSettings((s) => ({
                              ...s,
                              reminders: on ? s.reminders.filter((r) => r !== d) : [...s.reminders, d].sort((a, b) => b - a),
                            }))
                          }
                          className={cn(
                            'rounded-full px-4 py-2 text-sm font-medium ring-1 transition-[background-color,color] duration-150',
                            on ? 'bg-primary text-primary-foreground ring-primary' : 'bg-card text-muted-foreground ring-border',
                          )}
                        >
                          {d === 0 ? 'On the day' : `${d} day${d === 1 ? '' : 's'}`}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-6 divide-y rounded-2xl bg-card ring-1 ring-border">
                    <Row label="Check services" hint="Live API and certificate checks">
                      <select
                        value={settings.checkEveryHours}
                        onChange={(e) => setSettings((s) => ({ ...s, checkEveryHours: Number(e.target.value) }))}
                        className="rounded-lg bg-muted px-2 py-1.5 text-sm outline-none"
                      >
                        {CHECK_CHOICES.map((c) => (
                          <option key={c.hours} value={c.hours}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </Row>
                    <Row label="Start with Windows" hint="Runs quietly in the tray">
                      <Switch
                        checked={settings.autostart}
                        onCheckedChange={(v) => setSettings((s) => ({ ...s, autostart: v }))}
                      />
                    </Row>
                    <Row label="Test notification" hint="See what a reminder looks like">
                      <button
                        onClick={() => actions.testNotification()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium transition-transform duration-150 active:scale-[0.97]"
                      >
                        <Bell className="size-3.5" /> Send
                      </button>
                    </Row>
                  </div>
                </>
              )}

              {current === 'ai' && <AiStep settings={settings} setSettings={setSettings} aiKey={aiKey} setAiKey={setAiKey} />}

              {current === 'done' && (
                <StepText title="You're all set" body="Add your first token or certificate. Paste it, drop a file, and Certy figures out the expiry date." />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-10 flex w-full items-center justify-between">
          {step > 0 && current !== 'done' ? (
            <button
              onClick={() => go(-1)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
          ) : (
            <span />
          )}
          {current === 'done' ? (
            <div className="flex w-full justify-center gap-3">
              <button onClick={() => finish(false)} className="rounded-xl px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                Go to dashboard
              </button>
              <PrimaryButton onClick={() => finish(true)}>
                <Plus className="size-4" /> Add first secret
              </PrimaryButton>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {current === 'ai' && !settings.ai.enabled && (
                <button onClick={() => go(1)} className="text-sm text-muted-foreground hover:text-foreground">
                  Skip
                </button>
              )}
              <PrimaryButton onClick={() => go(1)} disabled={current === 'services' && picked.size === 0}>
                {current === 'welcome' ? 'Get started' : 'Continue'} <ArrowRight className="size-4" />
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AiStep({
  settings,
  setSettings,
  aiKey,
  setAiKey,
}: {
  settings: Settings
  setSettings: React.Dispatch<React.SetStateAction<Settings>>
  aiKey: string
  setAiKey: (k: string) => void
}) {
  return (
    <>
      <StepText
        title="AI assist (optional)"
        body="Point Certy at your model endpoint and it can set up custom services from a one-line description. You can change the endpoint later in Settings."
      />
      <div className="mt-6">
        <AiSettingsForm
          value={settings.ai}
          onChange={(ai) => setSettings((s) => ({ ...s, ai }))}
          aiKey={aiKey}
          onKeyChange={setAiKey}
          persist={(ai) => actions.saveSettings({ ...settings, ai })}
        />
      </div>
    </>
  )
}

function StepText({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-muted-foreground">{body}</p>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  )
}

function PrimaryButton({ children, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
    >
      {children}
    </button>
  )
}
