import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, CalendarDays, FileUp, KeyRound, Loader2, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { ServiceIcon } from '@/components/ServiceIcon'
import { Mascot } from '@/mascot/Mascot'
import { extractExpiry } from '@/lib/ai'
import type { CertInfo, Secret } from '@/lib/backend'
import { jwtExpiry } from '@/lib/jwt'
import { actions, useStore } from '@/lib/store'
import type { ExpirySource, Item, ItemKind } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatDate } from './ItemCard'

type Step = 'service' | 'secret'

/** Pick a service, then paste a token or drop a certificate; expiry is detected where possible. */
export function AddSecretDialog({
  open,
  onOpenChange,
  presetServiceId,
  onNewService,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  presetServiceId?: string
  onNewService: () => void
}) {
  const allServices = useStore((s) => s.services)
  const services = useMemo(() => allServices.filter((x) => x.enabled), [allServices])
  const ai = useStore((s) => s.settings.ai)
  const [step, setStep] = useState<Step>('service')
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [kind, setKind] = useState<ItemKind>('token')
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [file, setFile] = useState<{ name: string; bytes: number[] } | null>(null)
  const [password, setPassword] = useState('')
  const [cert, setCert] = useState<CertInfo | null>(null)
  const [certError, setCertError] = useState<string | null>(null)
  const [manualDate, setManualDate] = useState<Date | undefined>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(presetServiceId ? 'secret' : 'service')
    setServiceId(presetServiceId ?? null)
    setKind('token')
    setName('')
    setToken('')
    setFile(null)
    setPassword('')
    setCert(null)
    setCertError(null)
    setManualDate(undefined)
  }, [open, presetServiceId])

  const service = services.find((s) => s.id === serviceId)
  const jwtDate = useMemo(() => (kind === 'token' ? jwtExpiry(token) : null), [kind, token])
  const apiReadsExpiry = kind === 'token' && service?.check.type === 'api'

  // the detected date wins unless the user picked one
  const detected: { at: string; source: ExpirySource } | null =
    kind === 'token' && jwtDate
      ? { at: jwtDate, source: 'jwt' }
      : kind === 'certificate' && cert
        ? { at: cert.notAfter, source: 'cert-file' }
        : null
  const expiresAt = manualDate?.toISOString() ?? detected?.at ?? null

  async function readFile(f: File, pw?: string) {
    const bytes = Array.from(new Uint8Array(await f.arrayBuffer()))
    setFile({ name: f.name, bytes })
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
    await parse(bytes, pw)
  }

  async function parse(bytes: number[], pw?: string) {
    setCert(null)
    setCertError(null)
    try {
      setCert(await actions.parseCert(bytes, pw))
    } catch (e) {
      setCertError(e instanceof Error ? e.message : 'Unreadable file')
    }
  }

  async function save() {
    if (!service) return
    setSaving(true)
    try {
      const secret: Secret | undefined =
        kind === 'token' ? (token ? { token: token.trim() } : undefined) : file ? { file } : undefined
      const item: Item = {
        id: crypto.randomUUID(),
        serviceId: service.id,
        name: name.trim() || (kind === 'token' ? `${service.name} token` : `${service.name} certificate`),
        kind,
        expiresAt,
        source: manualDate ? 'manual' : (detected?.source ?? (apiReadsExpiry ? 'api' : 'manual')),
        hasSecret: !!secret,
        fileName: file?.name,
        subject: cert?.subject,
        issuer: cert?.issuer,
        createdAt: new Date().toISOString(),
      }
      await actions.saveItem(item, secret)
      onOpenChange(false)
      toast.success(`${item.name} added`, {
        description: expiresAt ? `Expires ${formatDate(expiresAt)}` : 'Checking the service for the expiry date…',
        icon: <Mascot state="burst" size={28} paper="var(--popover)" />,
      })
      // services that can, refresh validity/expiry right away
      if (service.check.type !== 'none' && secret) actions.check(item.id)
    } finally {
      setSaving(false)
    }
  }

  const canSave = !!service && (kind === 'token' ? token.trim().length > 0 : !!file) && (!!expiresAt || apiReadsExpiry)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          {step === 'secret' && !presetServiceId && (
            <button
              onClick={() => setStep('service')}
              className="-ml-2 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          {service && step === 'secret' && <ServiceIcon icon={service.icon} color={service.color} size={32} />}
          <div>
            <DialogTitle className="text-base">{step === 'service' ? 'Add a secret' : `New ${service?.name} secret`}</DialogTitle>
            <DialogDescription className="text-sm">
              {step === 'service' ? 'Which service is it for?' : service?.hint}
            </DialogDescription>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, transform: 'translateX(16px)' }}
            animate={{ opacity: 1, transform: 'translateX(0px)' }}
            exit={{ opacity: 0, transform: 'translateX(-16px)' }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="max-h-[70vh] overflow-y-auto p-6"
          >
            {step === 'service' ? (
              <div className="grid grid-cols-3 gap-3">
                {services.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setServiceId(s.id)
                      setStep('secret')
                    }}
                    className="flex flex-col items-center gap-2 rounded-2xl p-4 text-sm font-medium ring-1 ring-border transition-[background-color,transform] duration-150 ease-out hover:bg-muted/60 active:scale-[0.97]"
                  >
                    <ServiceIcon icon={s.icon} color={s.color} size={44} />
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
                <button
                  onClick={onNewService}
                  className="flex flex-col items-center gap-2 rounded-2xl p-4 text-sm font-medium text-muted-foreground ring-1 ring-border ring-dashed transition-[background-color,transform] duration-150 ease-out hover:bg-muted/60 active:scale-[0.97]"
                >
                  <span className="grid size-11 place-items-center rounded-[28%] bg-muted">
                    <Plus className="size-5" />
                  </span>
                  New service
                </button>
              </div>
            ) : (
              <div className="grid gap-5">
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                  {(['token', 'certificate'] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-[background-color,color] duration-150',
                        kind === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                      )}
                    >
                      {k === 'token' ? <KeyRound className="size-4" /> : <ShieldCheck className="size-4" />}
                      {k === 'token' ? 'API token' : 'Certificate'}
                    </button>
                  ))}
                </div>

                <Field label="Name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CI deploy token" />
                </Field>

                {kind === 'token' ? (
                  <Field label="Token">
                    <Textarea
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Paste the token. It is encrypted and stays on this computer."
                      className="min-h-24 font-mono text-xs break-all"
                      spellCheck={false}
                    />
                  </Field>
                ) : (
                  <CertDrop
                    file={file}
                    error={certError}
                    onFile={(f) => readFile(f)}
                    password={password}
                    onPassword={setPassword}
                    onRetry={() => file && parse(file.bytes, password)}
                  />
                )}

                <ExpiryField
                  detected={detected}
                  cert={cert}
                  apiReadsExpiry={apiReadsExpiry}
                  serviceName={service?.name ?? ''}
                  manualDate={manualDate}
                  onManualDate={setManualDate}
                  aiEnabled={ai.enabled && !!ai.model}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {step === 'secret' && (
          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <button onClick={() => onOpenChange(false)} className="px-3 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!canSave || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save secret
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CertDrop({
  file,
  error,
  onFile,
  password,
  onPassword,
  onRetry,
}: {
  file: { name: string } | null
  error: string | null
  onFile: (f: File) => void
  password: string
  onPassword: (v: string) => void
  onRetry: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const isPfx = !!file && /\.(pfx|p12)$/i.test(file.name)
  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files[0]
          if (f) onFile(f)
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-150',
          over ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
        )}
      >
        <FileUp className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">{file ? file.name : 'Drop a certificate or click to browse'}</p>
        <p className="text-xs text-muted-foreground">PEM, CRT, CER, DER, PFX, P12 · any other file is stored as-is</p>
      </button>
      <input ref={input} type="file" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {isPfx && (
        <div className="flex gap-2">
          <Input type="password" value={password} onChange={(e) => onPassword(e.target.value)} placeholder="PFX password" />
          <button onClick={onRetry} className="rounded-lg bg-muted px-3 text-sm font-medium">
            Unlock
          </button>
        </div>
      )}
      {error && file && isPfx && !password && (
        <p className="text-sm text-muted-foreground">Enter the file's password to read its expiry date.</p>
      )}
      {error && file && !(isPfx && !password) && (
        <p className="text-sm text-muted-foreground">
          Couldn't read a date from this file. It will still be stored encrypted and you can export it any time. Set the
          date below.
        </p>
      )}
    </div>
  )
}

function ExpiryField({
  detected,
  cert,
  apiReadsExpiry,
  serviceName,
  manualDate,
  onManualDate,
  aiEnabled,
}: {
  detected: { at: string; source: ExpirySource } | null
  cert: CertInfo | null
  apiReadsExpiry: boolean
  serviceName: string
  manualDate?: Date
  onManualDate: (d: Date | undefined) => void
  aiEnabled: boolean
}) {
  const [aiText, setAiText] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [showAi, setShowAi] = useState(false)

  const found = manualDate
    ? `Set by you: ${formatDate(manualDate.toISOString())}`
    : detected
      ? `${detected.source === 'jwt' ? 'Read from the token' : 'Read from the certificate'}: ${formatDate(detected.at)}`
      : apiReadsExpiry
        ? `${serviceName} reports the expiry when Certy checks the token.`
        : 'No date found. Pick one.'

  async function findWithAi() {
    setAiBusy(true)
    try {
      const at = await extractExpiry(aiText)
      if (at) onManualDate(new Date(at))
      else toast('No date found in that text')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI request failed')
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">Expiry</Label>
      <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
        <p className="flex-1 text-sm">
          {found}
          {cert && !manualDate && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{cert.subject}</span>}
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-sm font-medium ring-1 ring-border">
              <CalendarDays className="size-4" />
              {manualDate || detected ? 'Change' : 'Pick date'}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar mode="single" selected={manualDate} onSelect={onManualDate} captionLayout="dropdown" endMonth={new Date(2040, 0)} />
          </PopoverContent>
        </Popover>
      </div>
      {aiEnabled && !detected && (
        <div>
          {!showAi ? (
            <button onClick={() => setShowAi(true)} className="inline-flex items-center gap-1.5 text-sm text-primary">
              <Sparkles className="size-3.5" /> Find the date in an email or page
            </button>
          ) : (
            <div className="grid gap-2">
              <Textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="Paste the text that mentions the expiry (don't paste the token itself)"
                className="min-h-20 text-sm"
              />
              <button
                onClick={findWithAi}
                disabled={!aiText.trim() || aiBusy}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                Find date
              </button>
            </div>
          )}
        </div>
      )}
    </div>
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
