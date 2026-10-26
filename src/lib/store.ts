import { useSyncExternalStore } from 'react'
import { browserBackend, DEFAULT_SETTINGS, type Backend, type ChatMessage, type Secret, type Snapshot } from './backend'
import type { Item, Service, Settings } from './types'

/**
 * App state: one snapshot mirrored from the backend. Writes go to the backend first,
 * then update the snapshot, so the UI never shows state that failed to save.
 */
let backend: Backend = browserBackend
let state: Snapshot & { ready: boolean; checking: Set<string> } = {
  services: [],
  items: [],
  settings: DEFAULT_SETTINGS,
  ready: false,
  checking: new Set(),
}
const listeners = new Set<() => void>()

function set(patch: Partial<typeof state>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useStore<T>(select: (s: typeof state) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => select(state),
  )
}

export async function init(b: Backend) {
  backend = b
  const snap = await backend.load()
  set({ ...snap, ready: true })
}

export const actions = {
  /** Re-reads everything, e.g. after the background scheduler updated items. */
  async reload() {
    const snap = await backend.load()
    set({ ...snap })
  },
  async saveItem(item: Item, secret?: Secret) {
    await backend.saveItem(item, secret)
    set({ items: [...state.items.filter((i) => i.id !== item.id), item] })
  },
  async deleteItem(id: string) {
    await backend.deleteItem(id)
    set({ items: state.items.filter((i) => i.id !== id) })
  },
  async saveService(service: Service) {
    await backend.saveService(service)
    set({ services: [...state.services.filter((s) => s.id !== service.id), service] })
  },
  async deleteService(id: string) {
    await backend.deleteService(id)
    set({ services: state.services.filter((s) => s.id !== id) })
  },
  async saveSettings(settings: Settings) {
    await backend.saveSettings(settings)
    set({ settings })
  },
  async check(id: string) {
    set({ checking: new Set(state.checking).add(id) })
    try {
      const res = await backend.checkItem(id)
      const item = state.items.find((i) => i.id === id)
      if (item) {
        const next: Item = {
          ...item,
          lastCheck: { at: res.at, ok: res.ok, message: res.message },
          ...(res.expiresAt ? { expiresAt: res.expiresAt } : {}),
        }
        set({ items: state.items.map((i) => (i.id === id ? next : i)) })
      }
      return res
    } finally {
      const checking = new Set(state.checking)
      checking.delete(id)
      set({ checking })
    }
  },
  parseCert: (bytes: number[], password?: string) => backend.parseCert(bytes, password),
  revealSecret: (id: string) => backend.revealSecret(id),
  exportFile: (id: string) => backend.exportFile(id),
  saveAiKey: (key: string) => backend.saveAiKey(key),
  aiModels: (baseUrl: string, key?: string) => backend.aiModels(baseUrl, key),
  aiChat: (messages: ChatMessage[]) => backend.aiChat(messages),
  testNotification: () => backend.testNotification(),
  authMethod: () => backend.authMethod(),
}

export const serviceById = (services: Service[], id: string) => services.find((s) => s.id === id)
