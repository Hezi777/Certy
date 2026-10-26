import { useEffect, useRef, useState } from 'react'
import { ArrowUp, RotateCcw } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { ServiceIcon } from '@/components/ServiceIcon'
import { Mascot } from '@/mascot/Mascot'
import { askAssistant } from '@/lib/ai'
import type { ChatMessage } from '@/lib/backend'
import { serviceById, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const SUGGESTIONS = ['What expires this month?', 'Which secrets need attention first?', 'How do I renew a GitLab token?']

/** Slide-over chat about the user's secrets. Answers only; it never sees secret values. */
export function AssistantPanel({
  open,
  onOpenChange,
  onOpenItem,
  onSetup,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenItem: (id: string) => void
  onSetup: () => void
}) {
  const ai = useStore((s) => s.settings.ai)
  const items = useStore((s) => s.items)
  const services = useStore((s) => s.services)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const ready = ai.enabled && !!ai.model

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const history: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(history)
    setDraft('')
    setError(null)
    setBusy(true)
    try {
      const reply = await askAssistant(history, items, services)
      setMessages([...history, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <div className="flex items-center gap-3 border-b p-6">
          <Mascot size={44} state={busy ? 'thinking' : 'idle'} paper="var(--popover)" />
          <div className="min-w-0 flex-1">
            <SheetTitle>Assistant</SheetTitle>
            <SheetDescription className="truncate">{ready ? ai.model : 'Not set up'}</SheetDescription>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([])
                setError(null)
              }}
              aria-label="New chat"
              title="New chat"
              className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="size-4" />
            </button>
          )}
          {/* room for the sheet's own close button */}
          <span className="w-6" />
        </div>

        {!ready ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <Mascot size={88} expression="curieux" paper="var(--popover)" />
            <p className="mt-5 font-medium">Connect a model to chat</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              The assistant runs on your own model endpoint. It sees names and dates only, never token values.
            </p>
            <button
              onClick={onSetup}
              className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              Set up AI in Settings
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
              {messages.length === 0 && (
                <div className="flex flex-1 flex-col justify-end gap-2">
                  <p className="mb-1 text-sm text-muted-foreground">Ask about what's expiring and how to renew it.</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-fit rounded-xl bg-card px-3.5 py-2 text-left text-sm ring-1 ring-border transition-colors duration-150 hover:bg-muted dark:ring-0"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <p key={i} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground">
                    {m.content}
                  </p>
                ) : (
                  <Reply key={i} text={m.content} onOpenItem={onOpenItem} />
                ),
              )}
              {busy && <p className="text-sm text-muted-foreground">Thinking…</p>}
              {error && <p className="text-sm text-danger">{error}</p>}
              <div ref={end} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(draft)
              }}
              className="flex items-end gap-2 border-t p-4"
            >
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(draft)
                  }
                }}
                placeholder="Ask about your secrets"
                rows={1}
                className="max-h-32 min-h-10 resize-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                aria-label="Send"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-[transform,opacity] duration-150 ease-out active:scale-[0.95] disabled:opacity-50"
              >
                <ArrowUp className="size-4" />
              </button>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Assistant text with `[[itemId]]` references turned into chips that open the item. */
function Reply({ text, onOpenItem }: { text: string; onOpenItem: (id: string) => void }) {
  const items = useStore((s) => s.items)
  const services = useStore((s) => s.services)
  return (
    <div className="max-w-[92%] leading-relaxed whitespace-pre-wrap">
      {text.split(/(\[\[[^\]]+\]\])/).map((part, i) => {
        const id = part.match(/^\[\[([^\]]+)\]\]$/)?.[1]
        const item = id ? items.find((x) => x.id === id) : undefined
        if (!item) return id ? null : <span key={i}>{part}</span>
        const service = serviceById(services, item.serviceId)
        return (
          <button
            key={i}
            onClick={() => onOpenItem(item.id)}
            className={cn(
              'mx-0.5 inline-flex translate-y-[3px] items-center gap-1.5 rounded-lg bg-card py-0.5 pr-2 pl-1 text-sm font-medium ring-1 ring-border',
              'transition-colors duration-150 hover:bg-muted dark:ring-0',
            )}
          >
            {service && <ServiceIcon icon={service.icon} color={service.color} size={18} />}
            {item.name}
          </button>
        )
      })}
    </div>
  )
}
