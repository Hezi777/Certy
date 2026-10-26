import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, Copy, Download, Eye, EyeOff, Loader2, Pencil, RefreshCw, Replace, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { jwtExpiry } from '@/lib/jwt'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Ring } from '@/components/Ring'
import { ServiceIcon } from '@/components/ServiceIcon'
import { countdown, daysLeft, STATUS_COLOR, statusOf } from '@/lib/expiry'
import { actions, serviceById, useStore } from '@/lib/store'
import type { ExpirySource } from '@/lib/types'
import { formatDate, StatusBadge } from './ItemCard'

const SOURCE_LABEL: Record<ExpirySource, string> = {
  manual: 'Set by hand',
  jwt: 'Read from the token',
  'cert-file': 'Read from the certificate',
  tls: 'Read from the live certificate',
  api: 'Reported by the service',
}

export function ItemSheet({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const item = useStore((s) => s.items.find((i) => i.id === itemId))
  const service = useStore((s) => (item ? serviceById(s.services, item.serviceId) : undefined))
  const checking = useStore((s) => (itemId ? s.checking.has(itemId) : false))
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [replacing, setReplacing] = useState(false)

  useEffect(() => {
    setSecret(null)
    setConfirmDelete(false)
    setEditing(false)
    setReplacing(false)
  }, [itemId])

  if (!item || !service) return <Sheet open={false} />

  const d = daysLeft(item.expiresAt)
  const status = statusOf(item)

  async function copy() {
    const value = secret ?? (await actions.revealSecret(item!.id))
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <Sheet open={!!itemId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <div className="flex items-center gap-3 border-b p-6">
          <ServiceIcon icon={service.icon} color={service.color} size={44} />
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate">{item.name}</SheetTitle>
            <SheetDescription>
              {service.name} · {item.kind === 'certificate' ? 'Certificate' : 'API token'}
            </SheetDescription>
          </div>
          <IconButton label={editing ? 'Done editing' : 'Edit'} onClick={() => setEditing((e) => !e)}>
            {editing ? <Check className="size-4" /> : <Pencil className="size-4" />}
          </IconButton>
          {/* room for the sheet's own close button */}
          <span className="w-6" />
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <div className="flex items-center gap-5">
            <Ring value={d === null ? 0 : Math.max(0, 1 - d / 90)} size={88} stroke={6} color={STATUS_COLOR[status]}>
              <span className="text-center">
                <span className="block text-2xl font-semibold tabular-nums">{d === null ? '?' : Math.max(d, 0)}</span>
                <span className="block text-[11px] text-muted-foreground">days</span>
              </span>
            </Ring>
            <div className="grid gap-1">
              <StatusBadge item={item} className="w-fit" />
              <p className="text-lg font-semibold">{countdown(item.expiresAt)}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(item.expiresAt)} · {SOURCE_LABEL[item.source]}
              </p>
            </div>
          </div>

          {editing && <EditForm itemId={item.id} onDone={() => setEditing(false)} />}

          <div className="grid grid-cols-3 gap-2">
            <ActionButton onClick={() => actions.check(item.id)} disabled={checking || service.check.type === 'none'}>
              {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Check now
            </ActionButton>
            <Popover>
              <PopoverTrigger asChild>
                <ActionButton>
                  <CalendarDays className="size-4" /> Set date
                </ActionButton>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={item.expiresAt ? new Date(item.expiresAt) : undefined}
                  onSelect={(date) => date && actions.saveItem({ ...item, expiresAt: date.toISOString(), source: 'manual' })}
                  captionLayout="dropdown"
                  endMonth={new Date(2040, 0)}
                />
              </PopoverContent>
            </Popover>
            <ActionButton onClick={() => setReplacing((r) => !r)} className={cn(replacing && 'bg-accent')}>
              <Replace className="size-4" /> Renew
            </ActionButton>
          </div>

          {replacing && <ReplaceSecret itemId={item.id} onDone={() => setReplacing(false)} />}

          {item.notes && !editing && (
            <Section title="Notes">
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.notes}</p>
            </Section>
          )}

          {item.lastCheck && (
            <Section title="Last check">
              <p className="flex items-center gap-2 text-sm">
                <span className="size-1.5 rounded-full" style={{ background: item.lastCheck.ok ? 'var(--ok)' : 'var(--danger)' }} />
                {item.lastCheck.message}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(item.lastCheck.at).toLocaleString()}</p>
            </Section>
          )}

          {item.kind === 'token' && item.hasSecret && (
            <Section title="Token">
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs">
                  {secret ?? '••••••••••••••••••••••••'}
                </code>
                <IconButton
                  label={secret ? 'Hide' : 'Reveal'}
                  onClick={async () => setSecret(secret ? null : await actions.revealSecret(item.id))}
                >
                  {secret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </IconButton>
                <IconButton label="Copy" onClick={copy}>
                  {copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}
                </IconButton>
              </div>
            </Section>
          )}

          {item.kind === 'certificate' && (
            <Section title="Certificate">
              {item.subject && <Detail label="Subject" value={item.subject} />}
              {item.issuer && <Detail label="Issuer" value={item.issuer} />}
              {item.hasSecret && (
                <ActionButton
                  className="mt-3 w-full"
                  onClick={async () => {
                    await actions.exportFile(item.id)
                    toast.success('Certificate exported')
                  }}
                >
                  <Download className="size-4" /> Export {item.fileName ?? 'file'}
                </ActionButton>
              )}
            </Section>
          )}
        </div>

        <div className="border-t p-6">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm">Delete this secret for good?</p>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-sm text-muted-foreground">
                Keep
              </button>
              <button
                onClick={async () => {
                  await actions.deleteItem(item.id)
                  onClose()
                }}
                className="rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-white"
              >
                Delete
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-danger"
            >
              <Trash2 className="size-4" /> Delete secret
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1 text-sm">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
    </div>
  )
}

function ActionButton({ className, children, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-accent active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${className ?? ''}`}
    >
      {children}
    </button>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground transition-[color,transform] duration-150 hover:text-foreground active:scale-95"
    >
      {children}
    </button>
  )
}

const REMINDER_CHOICES = [60, 30, 14, 7, 3, 1, 0]

/** Name, notes and reminders specific to this one secret. */
function EditForm({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  const item = useStore((s) => s.items.find((i) => i.id === itemId))!
  const defaults = useStore((s) => s.settings.reminders)
  const [name, setName] = useState(item.name)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [reminders, setReminders] = useState<number[] | undefined>(item.reminders)
  const active = reminders ?? defaults

  return (
    <div className="grid gap-4 rounded-2xl bg-muted/50 p-4">
      <div className="grid gap-1.5">
        <p className="text-xs text-muted-foreground">Name</p>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <p className="text-xs text-muted-foreground">Notes</p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Where it's used, who owns it, how to renew…"
          className="min-h-20 text-sm"
        />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Reminders {reminders ? '(custom)' : '(default)'}</p>
          {reminders && (
            <button onClick={() => setReminders(undefined)} className="text-xs text-primary">
              Use defaults
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_CHOICES.map((d) => {
            const on = active.includes(d)
            return (
              <button
                key={d}
                onClick={() =>
                  setReminders(on ? active.filter((r) => r !== d) : [...active, d].sort((a, b) => b - a))
                }
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-[background-color,color] duration-150',
                  on ? 'bg-primary text-primary-foreground ring-primary' : 'text-muted-foreground ring-border',
                )}
              >
                {d === 0 ? 'Day of' : `${d}d`}
              </button>
            )
          })}
        </div>
      </div>
      <button
        onClick={async () => {
          await actions.saveItem({ ...item, name: name.trim() || item.name, notes: notes.trim() || undefined, reminders })
          onDone()
        }}
        className="rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground transition-transform duration-150 active:scale-[0.97]"
      >
        Save changes
      </button>
    </div>
  )
}

/** Swap in a renewed token or certificate; the expiry is re-read from it when possible. */
function ReplaceSecret({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  const item = useStore((s) => s.items.find((i) => i.id === itemId))!
  const service = useStore((s) => serviceById(s.services, item.serviceId))
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function finish(next: typeof item, secret: Parameters<typeof actions.saveItem>[1]) {
    await actions.saveItem({ ...next, hasSecret: true, lastCheck: undefined }, secret)
    toast.success('Secret renewed', {
      description: next.expiresAt ? `Now expires ${formatDate(next.expiresAt)}` : 'Set the new expiry date if it changed',
    })
    if (service && service.check.type !== 'none') actions.check(item.id)
    onDone()
  }

  if (item.kind === 'certificate') {
    return (
      <div className="grid gap-2 rounded-2xl bg-muted/50 p-4">
        <p className="text-sm">Drop in the renewed certificate file.</p>
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          className="rounded-xl bg-card py-2.5 text-sm font-medium ring-1 ring-border"
        >
          {busy ? 'Reading…' : 'Choose file'}
        </button>
        <input
          ref={input}
          type="file"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            setBusy(true)
            const bytes = Array.from(new Uint8Array(await f.arrayBuffer()))
            const info = await actions.parseCert(bytes).catch(() => null)
            await finish(
              {
                ...item,
                fileName: f.name,
                ...(info
                  ? { expiresAt: info.notAfter, source: 'cert-file' as const, subject: info.subject, issuer: info.issuer }
                  : {}),
              },
              { file: { name: f.name, bytes } },
            )
            setBusy(false)
          }}
        />
      </div>
    )
  }

  const jwt = jwtExpiry(token)
  return (
    <div className="grid gap-2 rounded-2xl bg-muted/50 p-4">
      <Textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Paste the new token"
        className="min-h-20 font-mono text-xs break-all"
        spellCheck={false}
      />
      {jwt && <p className="text-xs text-muted-foreground">Expiry read from the token: {formatDate(jwt)}</p>}
      <button
        onClick={() =>
          finish({ ...item, ...(jwt ? { expiresAt: jwt, source: 'jwt' as const } : {}) }, { token: token.trim() })
        }
        disabled={!token.trim()}
        className="rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
      >
        Save new token
      </button>
    </div>
  )
}
