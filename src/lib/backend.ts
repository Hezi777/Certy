import type { CheckResult, Item, Service, Settings } from './types'
import { PRESETS } from './presets'

export interface Snapshot {
  services: Service[]
  items: Item[]
  settings: Settings
}

/** A secret handed to the backend with an item; it is encrypted before it touches disk. */
export type Secret = { token: string } | { file: { name: string; bytes: number[] } }

export interface CertInfo {
  notAfter: string
  notBefore: string
  subject: string
  issuer: string
}

export interface CheckOutcome extends CheckResult {
  expiresAt?: string
}

/** Everything the UI needs from the machine. Implemented by Tauri commands, or a browser mock in dev. */
export interface Backend {
  load(): Promise<Snapshot>
  saveItem(item: Item, secret?: Secret): Promise<void>
  deleteItem(id: string): Promise<void>
  saveService(service: Service): Promise<void>
  deleteService(id: string): Promise<void>
  saveSettings(settings: Settings): Promise<void>
  checkItem(id: string): Promise<CheckOutcome>
  /** Parse a certificate (PEM, DER, PFX/P12). Throws when the format can't be read. */
  parseCert(bytes: number[], password?: string): Promise<CertInfo>
  revealSecret(id: string): Promise<string>
  exportFile(id: string): Promise<void>
  /** Stores the AI API key encrypted; empty string clears it. */
  saveAiKey(key: string): Promise<void>
  /** Models served by an endpoint; `key` overrides the stored one (used before saving). */
  aiModels(baseUrl: string, key?: string): Promise<string[]>
  /** One chat completion on the configured endpoint and model. Never sent secrets. */
  aiChat(messages: ChatMessage[]): Promise<string>
  /** Fires a test desktop notification. */
  testNotification(): Promise<void>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const DEFAULT_SETTINGS: Settings = {
  reminders: [30, 14, 7, 3, 1, 0],
  checkEveryHours: 6,
  autostart: true,
  theme: 'system',
  onboarded: false,
  ai: { enabled: false, baseUrl: '', model: '', hasKey: false },
}

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/* ---------------------------------------------------------------- browser mock */

const KEY = 'certy-dev-snapshot'
const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

function demo(): Snapshot {
  const at = new Date().toISOString()
  const item = (p: Partial<Item> & Pick<Item, 'id' | 'serviceId' | 'name'>): Item => ({
    kind: 'token',
    expiresAt: null,
    source: 'manual',
    hasSecret: true,
    createdAt: at,
    ...p,
  })
  return {
    services: [
      ...PRESETS,
      {
        id: 'vault-internal',
        name: 'Internal CA',
        icon: { kind: 'emoji', value: '🏛️' },
        color: '#8B5CF6',
        baseUrl: 'https://ca.corp.local',
        check: { type: 'tls' },
        builtin: false,
        enabled: true,
      },
    ],
    items: [
      item({ id: 'i1', serviceId: 'gitlab', name: 'CI deploy token', expiresAt: iso(4), source: 'api',
        lastCheck: { at, ok: true, message: 'Token active' } }),
      item({ id: 'i2', serviceId: 'azuredevops', name: 'Release pipeline PAT', expiresAt: iso(-2) }),
      item({ id: 'i3', serviceId: 'airflow', name: 'Scheduler API (prod)', expiresAt: iso(12), source: 'jwt' }),
      item({ id: 'i4', serviceId: 'trino', name: 'coordinator.prod TLS', kind: 'certificate', expiresAt: iso(23),
        source: 'cert-file', fileName: 'trino-prod.pem', subject: 'CN=trino.prod.internal', issuer: 'CN=Internal CA' }),
      item({ id: 'i5', serviceId: 'dagshub', name: 'Experiments token', expiresAt: iso(58) }),
      item({ id: 'i6', serviceId: 'gitlab', name: 'Renovate bot', expiresAt: iso(140), source: 'api' }),
      item({ id: 'i7', serviceId: 'vault-internal', name: 'Wildcard *.corp.local', kind: 'certificate',
        expiresAt: iso(211), source: 'tls', subject: 'CN=*.corp.local', issuer: 'CN=Internal CA' }),
      item({ id: 'i8', serviceId: 'trino', name: 'BI service account', expiresAt: iso(36), source: 'jwt' }),
      item({ id: 'i9', serviceId: 'azuredevops', name: 'Artifacts feed PAT', expiresAt: iso(9) }),
    ],
    settings: { ...DEFAULT_SETTINGS, onboarded: true },
  }
}

function read(): Snapshot {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Snapshot
  } catch {
    /* storage unavailable: fall through to demo data */
  }
  return demo()
}

function write(s: Snapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* dev only */
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const browserBackend: Backend = {
  async load() {
    // `?fresh` starts from an empty, not-yet-onboarded state to preview the wizard
    if (new URLSearchParams(location.search).has('fresh')) {
      return { services: PRESETS, items: [], settings: DEFAULT_SETTINGS }
    }
    return read()
  },
  async saveItem(item) {
    const s = read()
    s.items = [...s.items.filter((i) => i.id !== item.id), item]
    write(s)
  },
  async deleteItem(id) {
    const s = read()
    s.items = s.items.filter((i) => i.id !== id)
    write(s)
  },
  async saveService(service) {
    const s = read()
    s.services = [...s.services.filter((x) => x.id !== service.id), service]
    write(s)
  },
  async deleteService(id) {
    const s = read()
    s.services = s.services.filter((x) => x.id !== id)
    write(s)
  },
  async saveSettings(settings) {
    const s = read()
    s.settings = settings
    write(s)
  },
  async checkItem() {
    await wait(1400)
    return { at: new Date().toISOString(), ok: true, message: 'Token active (mock)' }
  },
  async parseCert() {
    await wait(300)
    return {
      notAfter: iso(90),
      notBefore: iso(-275),
      subject: 'CN=example.com (mock)',
      issuer: 'CN=Mock CA',
    }
  },
  async revealSecret() {
    return 'glpat-mock-xxxxxxxxxxxxxxxx'
  },
  async exportFile() {},
  async saveAiKey(key) {
    mockAiKey = key
  },
  async aiModels(baseUrl, key) {
    return listModels(baseUrl, key ?? mockAiKey)
  },
  async aiChat(messages) {
    // dev only: call the endpoint straight from the page (the Tauri build goes through Rust)
    const { ai } = read().settings
    const res = await fetch(`${ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(mockAiKey) },
      body: JSON.stringify({ model: ai.model, messages, temperature: 0 }),
    })
    if (!res.ok) throw new Error(`Model endpoint answered ${res.status}`)
    const json = await res.json()
    return json.choices?.[0]?.message?.content ?? ''
  },
  async testNotification() {
    if ('Notification' in window && (await Notification.requestPermission()) === 'granted') {
      new Notification('Certy', { body: 'Notifications work. You will hear from me before anything expires.' })
    }
  },
}

let mockAiKey = ''

const auth = (key: string): Record<string, string> => (key ? { Authorization: `Bearer ${key}` } : {})

/**
 * `GET {base}/models` is what vLLM, LM Studio, llama.cpp, TGI and Ollama's /v1 all serve.
 * Ollama's native `/api/tags` is the fallback when the user pasted the bare host.
 * Mirrored in Rust for the desktop build.
 */
async function listModels(baseUrl: string, key: string): Promise<string[]> {
  const base = baseUrl.replace(/\/$/, '')
  const res = await fetch(`${base}/models`, { headers: auth(key) }).catch(() => null)
  if (res?.ok) {
    const json = await res.json()
    const ids: string[] = (json.data ?? json.models ?? []).map((m: { id?: string; name?: string }) => m.id ?? m.name)
    if (ids.length) return ids.filter(Boolean).sort()
  }
  const tags = await fetch(`${new URL(base).origin}/api/tags`, { headers: auth(key) }).catch(() => null)
  if (tags?.ok) {
    const json = await tags.json()
    return (json.models ?? []).map((m: { name: string }) => m.name).sort()
  }
  throw new Error(res ? `Endpoint answered ${res.status}` : 'Could not reach the endpoint')
}
