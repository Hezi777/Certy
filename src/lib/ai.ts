import { actions } from './store'
import type { CheckConfig } from './types'

/**
 * Optional AI helpers. Only service names, descriptions and pasted text the user
 * chose to share are sent; token values and cert files never leave the machine.
 */

export interface ServiceSuggestion {
  name: string
  baseUrl: string
  check: CheckConfig
  /** Simple Icons slug, if the model knows one. */
  brandSlug?: string
  color?: string
  hint?: string
}

const SERVICE_PROMPT = `You configure an expiry tracker for API tokens and certificates.
Given a service description, answer with ONE JSON object and nothing else:
{"name": string, "baseUrl": string, "brandSlug": string|null (Simple Icons slug), "color": "#RRGGBB"|null,
 "hint": string (one sentence for the user),
 "check": one of
   {"type":"api","method":"GET","path":string,"headers":{...},"pointer":string}  // endpoint returning the token's own expiry; pointer is an RFC 6901 JSON pointer
   {"type":"ping","method":"GET","path":string,"headers":{...},"okStatus":[200]} // endpoint that only succeeds while the token is valid
   {"type":"tls"}   // for certificates served by the host
   {"type":"none"}}
Use the literal placeholder {{token}} where the token goes in headers. Prefer "api" only when you are sure the endpoint returns the expiry.`

/** Extracts the first JSON object from a model reply (models like to wrap it in prose or fences). */
export function parseJsonObject<T>(reply: string): T {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('The model did not return JSON')
  return JSON.parse(reply.slice(start, end + 1)) as T
}

export async function suggestService(description: string): Promise<ServiceSuggestion> {
  const reply = await actions.aiChat([
    { role: 'system', content: SERVICE_PROMPT },
    { role: 'user', content: description },
  ])
  return parseJsonObject<ServiceSuggestion>(reply)
}

/** Finds an expiry date in pasted text (an email, a settings page). Returns ISO or null. */
export async function extractExpiry(text: string): Promise<string | null> {
  const reply = await actions.aiChat([
    {
      role: 'system',
      content: `Today is ${new Date().toISOString().slice(0, 10)}. Find when the token or certificate described in the text expires. Answer with JSON only: {"expiresAt": "YYYY-MM-DD" | null}`,
    },
    { role: 'user', content: text },
  ])
  const { expiresAt } = parseJsonObject<{ expiresAt: string | null }>(reply)
  return expiresAt && !Number.isNaN(Date.parse(expiresAt)) ? new Date(expiresAt).toISOString() : null
}

export async function testConnection(): Promise<string> {
  const reply = await actions.aiChat([{ role: 'user', content: 'Reply with the single word: ready' }])
  return reply.trim()
}
