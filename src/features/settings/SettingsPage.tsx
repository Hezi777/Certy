import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { actions, useStore } from '@/lib/store'
import { setThemePref } from '@/lib/theme'
import type { Settings } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AiSettingsForm } from './AiSettingsForm'

const REMINDER_CHOICES = [60, 30, 14, 7, 3, 1, 0]

export function SettingsPage() {
  const saved = useStore((s) => s.settings)
  const [draft, setDraft] = useState<Settings>(saved)
  const [aiKey, setAiKey] = useState('')
  useEffect(() => setDraft(saved), [saved])

  // everything but AI saves as you go; AI waits for the explicit button since the key is sensitive
  const commit = (next: Settings) => {
    setDraft(next)
    actions.saveSettings({ ...next, ai: saved.ai })
  }

  return (
    <div className="max-w-2xl">

      <Group title="Reminders">
        <div className="flex flex-wrap gap-2 p-4">
          {REMINDER_CHOICES.map((d) => {
            const on = draft.reminders.includes(d)
            return (
              <button
                key={d}
                onClick={() =>
                  commit({
                    ...draft,
                    reminders: on ? draft.reminders.filter((r) => r !== d) : [...draft.reminders, d].sort((a, b) => b - a),
                  })
                }
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-[background-color,color] duration-150',
                  on ? 'bg-primary text-primary-foreground ring-primary' : 'text-muted-foreground ring-border',
                )}
              >
                {d === 0 ? 'On the day' : `${d} days before`}
              </button>
            )
          })}
        </div>
        <Row label="Test notification" hint="Send a sample Windows notification">
          <button
            onClick={() => actions.testNotification()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium"
          >
            <Bell className="size-3.5" /> Send
          </button>
        </Row>
      </Group>

      <Group title="Background">
        <Row label="Check services" hint="Live API and certificate checks">
          <select
            value={draft.checkEveryHours}
            onChange={(e) => commit({ ...draft, checkEveryHours: Number(e.target.value) })}
            className="rounded-lg bg-muted px-2 py-1.5 text-sm outline-none"
          >
            <option value={1}>Hourly</option>
            <option value={6}>Every 6 hours</option>
            <option value={24}>Daily</option>
          </select>
        </Row>
        <Row label="Start with Windows" hint="Runs quietly in the tray">
          <Switch checked={draft.autostart} onCheckedChange={(autostart) => commit({ ...draft, autostart })} />
        </Row>
      </Group>

      <Group title="Appearance">
        <Row label="Theme" hint="System follows Windows">
          <div className="inline-flex rounded-lg bg-muted p-0.5">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setThemePref(t)
                  commit({ ...draft, theme: t })
                }}
                className={cn(
                  'rounded-md px-3 py-1 text-sm capitalize transition-colors duration-150',
                  draft.theme === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </Row>
      </Group>

      <Group title="AI assist" plain>
        <AiSettingsForm
          value={draft.ai}
          onChange={(ai) => setDraft((d) => ({ ...d, ai }))}
          aiKey={aiKey}
          onKeyChange={setAiKey}
          persist={(ai) => actions.saveSettings({ ...saved, ai })}
        />
        <button
          onClick={async () => {
            if (aiKey) await actions.saveAiKey(aiKey)
            await actions.saveSettings({ ...saved, ai: { ...draft.ai, hasKey: draft.ai.hasKey || !!aiKey } })
            setAiKey('')
            toast.success('AI settings saved')
          }}
          className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform duration-150 active:scale-[0.97]"
        >
          Save AI settings
        </button>
      </Group>
    </div>
  )
}

function Group({ title, plain, children }: { title: string; plain?: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <p className="mb-3 text-sm font-medium text-muted-foreground">{title}</p>
      {plain ? children : <div className="divide-y rounded-2xl bg-card ring-1 ring-border dark:ring-0">{children}</div>}
    </section>
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
