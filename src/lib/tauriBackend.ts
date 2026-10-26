import { invoke } from '@tauri-apps/api/core'
import type { Backend, Snapshot } from './backend'
import { DEFAULT_SETTINGS } from './backend'
import { PRESETS } from './presets'
import type { Item, Service, Settings } from './types'

/** Desktop backend: every call is a Rust command (src-tauri/src/commands.rs). */
export const tauriBackend: Backend = {
  async load() {
    const snap = await invoke<{ services: Service[]; items: Item[]; settings: Settings | null }>('load')
    // first launch: seed the built-in services; Rust stays agnostic of the preset list
    if (!snap.services.length) {
      await Promise.all(PRESETS.map((s) => invoke('save_service', { service: s })))
      snap.services = PRESETS
    }
    const settings: Settings = { ...DEFAULT_SETTINGS, ...snap.settings, ai: { ...DEFAULT_SETTINGS.ai, ...snap.settings?.ai } }
    return { services: snap.services, items: snap.items, settings } satisfies Snapshot
  },
  saveItem: (item, secret) => invoke('save_item', { item, secret: secret ?? null }),
  deleteItem: (id) => invoke('delete_item', { id }),
  saveService: (service) => invoke('save_service', { service }),
  deleteService: (id) => invoke('delete_service', { id }),
  saveSettings: (settings) => invoke('save_settings', { settings }),
  checkItem: (id) => invoke('check_item', { id }),
  parseCert: (bytes, password) => invoke('parse_cert', { bytes, password: password ?? null }),
  revealSecret: (id) => invoke('reveal_secret', { id }),
  exportFile: (id) => invoke('export_file', { id }),
  saveAiKey: (key) => invoke('save_ai_key', { key }),
  aiModels: (baseUrl, key) => invoke('ai_models', { baseUrl, key: key ?? null }),
  aiChat: (messages) => invoke('ai_chat', { messages }),
  testNotification: () => invoke('test_notification'),
  authMethod: () => invoke('auth_method'),
}
