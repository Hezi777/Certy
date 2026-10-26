import { useEffect, useState } from 'react'
import { MessageCircle, Plus } from 'lucide-react'
import { AttentionBell } from '@/features/shell/AttentionBell'
import { MascotLab } from '@/dev/MascotLab'
import { IconRender } from '@/dev/IconRender'
import { InstallerArt } from '@/dev/InstallerArt'
import { Sidebar, type View } from '@/features/shell/Sidebar'
import { Overview } from '@/features/overview/Overview'
import { Vault } from '@/features/items/Vault'
import { ItemSheet } from '@/features/items/ItemSheet'
import { AddSecretDialog } from '@/features/items/AddSecretDialog'
import { AssistantPanel } from '@/features/assistant/AssistantPanel'
import { Services } from '@/features/services/Services'
import { ServiceEditor } from '@/features/services/ServiceEditor'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { Onboarding } from '@/features/onboarding/Onboarding'
import type { Status } from '@/lib/expiry'
import { browserBackend, isTauri } from '@/lib/backend'
import { actions, init, useStore } from '@/lib/store'
import { setThemePref } from '@/lib/theme'
import type { Service } from '@/lib/types'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import ExpandableSearchBar from '@/components/ui/expandable-search-bar'

export default function App() {
  if (location.hash === '#mascots') return <MascotLab />
  if (location.hash === '#icon') return <IconRender />
  if (location.hash === '#installer-art') return <InstallerArt />
  return (
    <TooltipProvider delayDuration={350}>
      <Shell />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

function Shell() {
  const ready = useStore((s) => s.ready)
  const onboarded = useStore((s) => s.settings.onboarded)
  const theme = useStore((s) => s.settings.theme)
  const [view, setView] = useState<View>('overview')
  const [query, setQuery] = useState('')
  const [serviceFilter, setServiceFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<Status | null>(null)
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addFor, setAddFor] = useState<string | undefined>()
  const [editing, setEditing] = useState<{ service?: Service } | null>(null)
  const [chatting, setChatting] = useState(false)

  useEffect(() => {
    // the desktop backend is loaded lazily so the browser preview never touches Tauri APIs
    if (!isTauri) {
      init(browserBackend)
      return
    }
    let unlisten: (() => void) | undefined
    Promise.all([import('@/lib/tauriBackend'), import('@tauri-apps/api/event')]).then(async ([b, ev]) => {
      await init(b.tauriBackend)
      unlisten = await ev.listen('items-changed', () => actions.reload())
    })
    return () => unlisten?.()
  }, [])

  useEffect(() => setThemePref(theme), [theme])

  // Ctrl/Cmd + N: add a secret from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setAdding(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!ready) return null
  if (!onboarded)
    return (
      <Onboarding
        onFinish={(addFirst) => {
          if (addFirst) setAdding(true)
        }}
      />
    )

  return (
    <div className="relative isolate flex h-dvh bg-background text-foreground">
      {/* soft cyan flare: one glow behind the header, a fainter one low on the left */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        style={{
          background: [
            'radial-gradient(45% 40% at 78% -6%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 70%)',
            'radial-gradient(35% 35% at 4% 104%, color-mix(in oklab, var(--primary) 9%, transparent), transparent 70%)',
          ].join(', '),
        }}
      />
      <Sidebar
        view={view}
        onNavigate={(v) => {
          setView(v)
          if (v !== 'vault') {
            setServiceFilter(null)
            setStatusFilter(null)
          }
        }}
        onPickService={(id) => {
          setServiceFilter(id)
          setView('vault')
        }}
        onAddFor={(id) => {
          setAddFor(id)
          setAdding(true)
        }}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <Header
          view={view}
          query={query}
          onQuery={(q) => {
            setQuery(q)
            if (q && view !== 'vault') setView('vault')
          }}
          onAdd={() => setAdding(true)}
          onOpenItem={setOpenItem}
          onSeeAll={() => setView('vault')}
          onChat={() => setChatting(true)}
        />
        <div className="flex-1 overflow-y-auto px-8 pb-12">
          {view === 'overview' && (
            <Overview
              onOpenItem={setOpenItem}
              onViewAll={() => setView('vault')}
              onAdd={() => setAdding(true)}
              onStatus={(st) => {
                setStatusFilter(st)
                setView('vault')
              }}
            />
          )}
          {view === 'vault' && (
            <Vault
              query={query}
              serviceFilter={serviceFilter}
              onServiceFilter={setServiceFilter}
              status={statusFilter}
              onStatus={setStatusFilter}
              onOpenItem={setOpenItem}
              onAdd={() => setAdding(true)}
            />
          )}
          {view === 'services' && <Services onEdit={(service) => setEditing({ service })} onNew={() => setEditing({})} />}
          {view === 'settings' && <SettingsPage />}
        </div>
      </main>

      <ItemSheet itemId={openItem} onClose={() => setOpenItem(null)} />
      <AssistantPanel
        open={chatting}
        onOpenChange={setChatting}
        onOpenItem={(id) => {
          setChatting(false)
          setOpenItem(id)
        }}
        onSetup={() => {
          setChatting(false)
          setView('settings')
        }}
      />
      <AddSecretDialog
        open={adding}
        onOpenChange={(o) => {
          setAdding(o)
          if (!o) setAddFor(undefined)
        }}
        presetServiceId={addFor ?? (view === 'vault' ? (serviceFilter ?? undefined) : undefined)}
        onNewService={() => {
          setAdding(false)
          setEditing({})
        }}
      />
      <ServiceEditor open={!!editing} onOpenChange={(o) => !o && setEditing(null)} service={editing?.service} />
    </div>
  )
}

const TITLES: Record<View, string> = {
  overview: '',
  vault: 'Secrets',
  services: 'Services',
  settings: 'Settings',
}

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function Header({
  view,
  query,
  onQuery,
  onAdd,
  onOpenItem,
  onSeeAll,
  onChat,
}: {
  view: View
  query: string
  onQuery: (q: string) => void
  onAdd: () => void
  onOpenItem: (id: string) => void
  onSeeAll: () => void
  onChat: () => void
}) {
  return (
    <header className="flex items-center gap-3 px-8 pt-7 pb-6">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{TITLES[view] || greeting()}</h1>
        {view === 'overview' && (
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        )}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <ExpandableSearchBar value={query} onChange={onQuery} placeholder="Search tokens, certificates, services" />
        <button
          onClick={onChat}
          aria-label="Assistant"
          title="Assistant"
          className="grid size-11 place-items-center rounded-full bg-card text-muted-foreground ring-1 ring-border transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-95 dark:ring-0"
        >
          <MessageCircle className="size-[18px]" />
        </button>
        <AttentionBell onOpenItem={onOpenItem} onSeeAll={onSeeAll} />
        <button
          onClick={onAdd}
          title="Add secret (Ctrl N)"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          <Plus className="size-4" /> Add secret
        </button>
      </div>
    </header>
  )
}
