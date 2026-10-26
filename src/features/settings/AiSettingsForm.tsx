import { useState } from 'react'
import { Check, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { testConnection } from '@/lib/ai'
import { actions } from '@/lib/store'
import type { AiSettings } from '@/lib/types'
import { cn } from '@/lib/utils'

type Status = { state: 'idle' | 'busy' | 'ok' | 'error'; message?: string }

/**
 * Endpoint + key + model picked from the endpoint's own list. Used by onboarding and Settings.
 * `aiKey` is the not-yet-saved key typed by the user; an empty string keeps the stored one.
 */
export function AiSettingsForm({
  value,
  onChange,
  aiKey,
  onKeyChange,
  persist,
}: {
  value: AiSettings
  onChange: (next: AiSettings) => void
  aiKey: string
  onKeyChange: (key: string) => void
  /** Saves the endpoint so the test call uses it. */
  persist: (next: AiSettings) => Promise<void>
}) {
  const [models, setModels] = useState<string[]>(value.model ? [value.model] : [])
  const [load, setLoad] = useState<Status>({ state: 'idle' })
  const [test, setTest] = useState<Status>({ state: 'idle' })
  const patch = (p: Partial<AiSettings>) => onChange({ ...value, ...p })

  async function loadModels() {
    setLoad({ state: 'busy' })
    try {
      const list = await actions.aiModels(value.baseUrl, aiKey || undefined)
      setModels(list)
      setLoad({ state: 'ok', message: `${list.length} model${list.length === 1 ? '' : 's'} available` })
      // keep the current pick if the endpoint still serves it, else take the first
      if (!list.includes(value.model) && list[0]) patch({ model: list[0] })
    } catch (e) {
      setLoad({ state: 'error', message: e instanceof Error ? e.message : 'Could not load models' })
    }
  }

  async function runTest() {
    setTest({ state: 'busy' })
    try {
      await persist(value)
      if (aiKey) await actions.saveAiKey(aiKey)
      const reply = await testConnection()
      setTest({ state: 'ok', message: `${value.model} answered “${reply.slice(0, 32)}”` })
    } catch (e) {
      setTest({ state: 'error', message: e instanceof Error ? e.message : 'The model did not answer' })
    }
  }

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Sparkles className="size-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">Use AI assist</p>
          <p className="text-sm text-muted-foreground">Your own model endpoint (Qwen, Llama, Mistral…)</p>
        </div>
        <Switch checked={value.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
      </div>

      {value.enabled && (
        <div className="grid gap-4 border-t p-4">
          <div className="grid grid-cols-[1fr_200px] gap-3">
            <Field label="Endpoint URL">
              <Input
                value={value.baseUrl}
                onChange={(e) => patch({ baseUrl: e.target.value })}
                placeholder="https://llm.your-company.com/v1"
              />
            </Field>
            <Field label={value.hasKey && !aiKey ? 'API key (saved)' : 'API key'}>
              <Input
                type="password"
                value={aiKey}
                onChange={(e) => onKeyChange(e.target.value)}
                placeholder={value.hasKey ? '••••••••' : 'Optional'}
              />
            </Field>
          </div>

          <Field label="Model">
            <div className="flex gap-2">
              <Select value={value.model} onValueChange={(model) => patch({ model })} disabled={!models.length}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={models.length ? 'Choose a model' : 'Load models first'} />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={loadModels}
                disabled={!value.baseUrl || load.state === 'busy'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 text-sm font-medium transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
              >
                {load.state === 'busy' ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Load models
              </button>
            </div>
            <StatusLine status={load} />
          </Field>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runTest}
              disabled={!value.model || test.state === 'busy'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
            >
              {test.state === 'busy' && <Loader2 className="size-3.5 animate-spin" />}
              {test.state === 'ok' && <Check className="size-3.5 text-ok" />}
              Test model
            </button>
            <StatusLine status={test} />
          </div>
          <p className="text-xs text-muted-foreground">
            Only service names and descriptions are sent to the model. Token values and certificate files never leave this computer.
          </p>
        </div>
      )}
    </div>
  )
}

function StatusLine({ status }: { status: Status }) {
  if (!status.message) return null
  return (
    <span className={cn('mt-1 block truncate text-xs', status.state === 'error' ? 'text-danger' : 'text-muted-foreground')}>
      {status.message}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
