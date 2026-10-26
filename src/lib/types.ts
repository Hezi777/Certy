/** How a service or item is drawn: a bundled official logo, a Simple Icons brand, an emoji or a lucide glyph. */
export type IconRef =
  | { kind: 'logo'; id: string }
  | { kind: 'brand'; slug: string; title: string; path: string; hex: string }
  | { kind: 'emoji'; value: string }
  | { kind: 'lucide'; name: string }

/** How a service can tell whether a secret is still alive, and when it dies. */
export type CheckConfig =
  | { type: 'none' }
  /** HTTP call; success codes mean "still valid". */
  | { type: 'ping'; method: 'GET' | 'POST'; path: string; headers: Record<string, string>; okStatus: number[] }
  /** HTTP call; the expiry date is read from the JSON body at `pointer` (RFC 6901). */
  | { type: 'api'; method: 'GET' | 'POST'; path: string; headers: Record<string, string>; pointer: string }
  /** Connect to the base URL's host and read the TLS certificate. */
  | { type: 'tls' }

export interface Service {
  id: string
  name: string
  icon: IconRef
  /** Accent color, any CSS color. */
  color: string
  /** e.g. https://gitlab.example.com. `{{token}}` in header templates is replaced at call time. */
  baseUrl: string
  check: CheckConfig
  builtin: boolean
  /** Shown in the sidebar and the add flow. Presets the user didn't pick in onboarding are off. */
  enabled: boolean
  /** Hint shown in the add flow. */
  hint?: string
}

export type ItemKind = 'token' | 'certificate'

/** Where an item's expiry date came from. */
export type ExpirySource = 'manual' | 'jwt' | 'cert-file' | 'tls' | 'api'

export interface CheckResult {
  at: string
  ok: boolean
  message: string
}

export interface Item {
  id: string
  serviceId: string
  name: string
  kind: ItemKind
  /** ISO date, null when unknown. */
  expiresAt: string | null
  source: ExpirySource
  /** A token value or cert file is stored (encrypted) for this item. */
  hasSecret: boolean
  fileName?: string
  /** Certificate subject / issuer, when parsed. */
  subject?: string
  issuer?: string
  notes?: string
  /** Days-before thresholds; falls back to settings when absent. */
  reminders?: number[]
  lastCheck?: CheckResult
  createdAt: string
}

/**
 * Optional AI helper on the user's own model endpoint (Qwen and friends, served by vLLM,
 * Ollama, LM Studio...). Models are listed from the endpoint, not hardcoded.
 */
export interface AiSettings {
  enabled: boolean
  /** e.g. https://llm.corp.local/v1 */
  baseUrl: string
  /** Picked from the endpoint's model list. */
  model: string
  /** The key itself lives encrypted in the backend; this only says one is stored. */
  hasKey: boolean
}

export interface Settings {
  reminders: number[]
  checkEveryHours: number
  autostart: boolean
  theme: 'system' | 'light' | 'dark'
  onboarded: boolean
  ai: AiSettings
}
