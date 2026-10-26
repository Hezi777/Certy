import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ColorField, IconPicker, SWATCHES } from '@/components/IconPicker'
import { suggestService } from '@/lib/ai'
import { actions, useStore } from '@/lib/store'
import type { CheckConfig, IconRef, Service } from '@/lib/types'

const CHECK_LABEL: Record<CheckConfig['type'], string> = {
  none: 'No live check (date set by hand)',
  ping: 'Ping: the call succeeds while the token is valid',
  api: 'API: read the expiry date from a JSON response',
  tls: 'TLS: read the certificate served by the host',
}

const blank = (): Service => ({
  id: crypto.randomUUID(),
  name: '',
  icon: { kind: 'lucide', name: 'key-round' },
  color: SWATCHES[0]!,
  baseUrl: '',
  check: { type: 'none' },
  builtin: false,
  enabled: true,
})

/** Create or edit a service: identity (icon, color, name) and how Certy checks it. */
export function ServiceEditor({
  open,
  onOpenChange,
  service,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: Service
}) {
  const ai = useStore((s) => s.settings.ai)
  const items = useStore((s) => s.items)
  const inUse = service ? items.filter((i) => i.serviceId === service.id).length : 0
  const [draft, setDraft] = useState<Service>(blank)
  const [describe, setDescribe] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(service ?? blank())
      setDescribe('')
    }
  }, [open, service])

  const patch = (p: Partial<Service>) => setDraft((d) => ({ ...d, ...p }))
  const patchCheck = (p: Partial<Extract<CheckConfig, { type: 'ping' | 'api' }>>) =>
    setDraft((d) => ({ ...d, check: { ...d.check, ...p } as CheckConfig }))

  function setCheckType(type: CheckConfig['type']) {
    const headers = { Authorization: 'Bearer {{token}}' }
    const check: CheckConfig =
      type === 'ping'
        ? { type, method: 'GET', path: '/', headers, okStatus: [200] }
        : type === 'api'
          ? { type, method: 'GET', path: '/', headers, pointer: '/expires_at' }
          : { type }
    patch({ check })
  }

  async function aiFill() {
    setBusy(true)
    try {
      const s = await suggestService(describe)
      const icon: IconRef | undefined = s.brandSlug ? await brandIcon(s.brandSlug) : undefined
      setDraft((d) => ({
        ...d,
        name: s.name || d.name,
        baseUrl: s.baseUrl || d.baseUrl,
        check: s.check ?? d.check,
        hint: s.hint,
        ...(icon ? { icon } : {}),
        ...(s.color ? { color: s.color } : {}),
      }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI request failed')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    await actions.saveService({ ...draft, name: draft.name.trim() })
    toast.success(`${draft.name} saved`)
    onOpenChange(false)
  }

  const c = draft.check
  const headerText = c.type === 'ping' || c.type === 'api' ? Object.entries(c.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b px-6 py-4">
          <DialogTitle className="text-base">{service ? `Edit ${service.name}` : 'New service'}</DialogTitle>
          <DialogDescription className="text-sm">Any system you hold a token or certificate for.</DialogDescription>
        </div>

        <div className="grid max-h-[70vh] gap-6 overflow-y-auto p-6">
          {ai.enabled && ai.model && !service?.builtin && (
            <div className="grid gap-2 rounded-2xl bg-primary/6 p-4 ring-1 ring-primary/20">
              <Label className="flex items-center gap-1.5 text-xs text-primary">
                <Sparkles className="size-3.5" /> Describe it and let {ai.model} fill the form
              </Label>
              <div className="flex gap-2">
                <Input
                  value={describe}
                  onChange={(e) => setDescribe(e.target.value)}
                  placeholder="e.g. Jenkins at jenkins.corp.local, API token"
                  onKeyDown={(e) => e.key === 'Enter' && describe.trim() && aiFill()}
                />
                <button
                  onClick={aiFill}
                  disabled={!describe.trim() || busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Fill
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <IconPicker
              value={draft.icon}
              color={draft.color}
              onChange={(icon, suggested) => patch({ icon, ...(suggested ? { color: suggested } : {}) })}
            />
            <div className="grid flex-1 gap-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Jenkins" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">Color</Label>
            <ColorField value={draft.color} onChange={(color) => patch({ color })} />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Base URL</Label>
            <Input value={draft.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value })} placeholder="https://jenkins.corp.local" />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Live check</Label>
            <Select value={c.type} onValueChange={(v) => setCheckType(v as CheckConfig['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CHECK_LABEL) as CheckConfig['type'][]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {CHECK_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(c.type === 'ping' || c.type === 'api') && (
            <div className="grid gap-4 rounded-2xl bg-muted/50 p-4">
              <div className="grid grid-cols-[96px_1fr] gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Method</Label>
                  <Select value={c.method} onValueChange={(m) => patchCheck({ method: m as 'GET' | 'POST' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Path</Label>
                  <Input value={c.path} onChange={(e) => patchCheck({ path: e.target.value })} className="font-mono text-xs" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Headers · {'{{token}}'} is replaced with the secret</Label>
                <textarea
                  value={headerText}
                  onChange={(e) =>
                    patchCheck({
                      headers: Object.fromEntries(
                        e.target.value
                          .split('\n')
                          .map((l) => l.split(/:(.*)/s).map((x) => x.trim()))
                          .filter(([k]) => k),
                      ),
                    })
                  }
                  rows={2}
                  className="rounded-md bg-card px-3 py-2 font-mono text-xs ring-1 ring-border outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>
              {c.type === 'api' ? (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Expiry field (JSON pointer)</Label>
                  <Input value={c.pointer} onChange={(e) => patchCheck({ pointer: e.target.value })} className="font-mono text-xs" placeholder="/expires_at" />
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Valid when status is</Label>
                  <Input
                    value={c.okStatus.join(', ')}
                    onChange={(e) =>
                      patchCheck({ okStatus: e.target.value.split(',').map((x) => Number(x.trim())).filter(Boolean) })
                    }
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          {service && !service.builtin && (
            <button
              disabled={inUse > 0}
              title={inUse ? `${inUse} secret${inUse === 1 ? '' : 's'} still use this service` : undefined}
              onClick={async () => {
                await actions.deleteService(service.id)
                toast.success(`${service.name} deleted`)
                onOpenChange(false)
              }}
              className="mr-auto text-sm text-muted-foreground transition-colors hover:text-danger disabled:opacity-40 disabled:hover:text-muted-foreground"
            >
              Delete service
            </button>
          )}
          <button onClick={() => onOpenChange(false)} className="px-3 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!draft.name.trim()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
          >
            Save service
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Resolves a Simple Icons slug suggested by the model, if it exists. */
async function brandIcon(slug: string): Promise<IconRef | undefined> {
  const mod = (await import('simple-icons')) as unknown as Record<string, { slug?: string; title: string; path: string; hex: string }>
  const hit = Object.values(mod).find((v) => typeof v === 'object' && v?.slug === slug)
  return hit ? { kind: 'brand', slug, title: hit.title, path: hit.path, hex: hit.hex } : undefined
}
