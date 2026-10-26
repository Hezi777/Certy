import { useEffect, useMemo, useState } from 'react'
import { EmojiPicker } from 'frimousse'
import { HexColorPicker } from 'react-colorful'
import { Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconGlyph, LOGO_URL, LUCIDE, ServiceIcon } from '@/components/ServiceIcon'
import type { IconRef } from '@/lib/types'
import { cn } from '@/lib/utils'

type Brand = { title: string; slug: string; path: string; hex: string }

let brandCache: Promise<Brand[]> | null = null
/** Simple Icons is ~3,400 brands; load it only when the Brands tab opens. */
function loadBrands() {
  brandCache ??= import('simple-icons').then((mod) =>
    (Object.values(mod) as unknown[])
      .filter((v): v is Brand => typeof v === 'object' && v !== null && 'path' in v)
      .map(({ title, slug, path, hex }) => ({ title, slug, path, hex }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  )
  return brandCache
}

const LOGO_NAMES: Record<string, string> = {
  airflow: 'Airflow',
  trino: 'Trino',
  gitlab: 'GitLab',
  dagshub: 'DagsHub',
  azuredevops: 'Azure DevOps',
}

/** Icon picker: official logos, any brand, emoji, or a generic glyph. */
export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: IconRef
  color: string
  onChange: (icon: IconRef, suggestedColor?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const pick = (icon: IconRef, suggestedColor?: string) => {
    onChange(icon, suggestedColor)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-[28%] transition-transform duration-150 ease-out active:scale-95"
          aria-label="Choose icon"
        >
          <ServiceIcon icon={value} color={color} size={56} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0">
        <Tabs defaultValue="brands" className="gap-0">
          <TabsList className="m-2 w-[calc(100%-1rem)]">
            <TabsTrigger value="brands">Brands</TabsTrigger>
            <TabsTrigger value="emoji">Emoji</TabsTrigger>
            <TabsTrigger value="generic">Generic</TabsTrigger>
          </TabsList>
          <TabsContent value="brands">
            <BrandGrid onPick={pick} />
          </TabsContent>
          <TabsContent value="emoji">
            <EmojiGrid onPick={(e) => pick({ kind: 'emoji', value: e })} />
          </TabsContent>
          <TabsContent value="generic">
            <div className="grid max-h-72 grid-cols-7 gap-1 overflow-y-auto p-2">
              {Object.keys(LUCIDE).map((name) => (
                <Cell key={name} title={name} onClick={() => pick({ kind: 'lucide', name })}>
                  <IconGlyph icon={{ kind: 'lucide', name }} size={20} color="currentColor" />
                </Cell>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

function Cell({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid aspect-square place-items-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  )
}

function BrandGrid({ onPick }: { onPick: (icon: IconRef, color?: string) => void }) {
  const [brands, setBrands] = useState<Brand[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    loadBrands().then(setBrands)
  }, [])
  const logos = Object.keys(LOGO_URL).filter((id) => LOGO_NAMES[id]?.toLowerCase().includes(q.toLowerCase()))
  const matches = useMemo(() => {
    if (!brands) return []
    const needle = q.trim().toLowerCase()
    return (needle ? brands.filter((b) => b.title.toLowerCase().includes(needle)) : brands).slice(0, 140)
  }, [brands, q])

  return (
    <div>
      <SearchField value={q} onChange={setQ} placeholder="Search 3,400+ brands" />
      <div className="grid max-h-72 grid-cols-7 gap-1 overflow-y-auto p-2">
        {logos.map((id) => (
          <Cell key={id} title={`${LOGO_NAMES[id]} (official)`} onClick={() => onPick({ kind: 'logo', id })}>
            <IconGlyph icon={{ kind: 'logo', id }} size={22} />
          </Cell>
        ))}
        {matches.map((b) => (
          <Cell key={b.slug} title={b.title} onClick={() => onPick({ kind: 'brand', ...b }, `#${b.hex}`)}>
            <IconGlyph icon={{ kind: 'brand', ...b }} size={20} />
          </Cell>
        ))}
        {!brands && <p className="col-span-7 py-6 text-center text-sm text-muted-foreground">Loading brands…</p>}
        {brands && !matches.length && !logos.length && (
          <p className="col-span-7 py-6 text-center text-sm text-muted-foreground">No brand found. Try Emoji or Generic.</p>
        )}
      </div>
    </div>
  )
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="mx-2 flex h-9 items-center gap-2 rounded-lg bg-muted px-3 text-muted-foreground">
      <Search className="size-4" />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  )
}

function EmojiGrid({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <EmojiPicker.Root
      emojibaseUrl="/emojibase"
      columns={8}
      onEmojiSelect={({ emoji }) => onPick(emoji)}
      className="flex h-80 flex-col"
    >
      <EmojiPicker.Search
        placeholder="Search emoji"
        className="mx-2 h-9 rounded-lg bg-muted px-3 text-sm outline-none placeholder:text-muted-foreground"
      />
      <EmojiPicker.Viewport className="relative flex-1 outline-none">
        <EmojiPicker.Loading className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          Loading…
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          No emoji found.
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="pb-2 select-none"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div className="bg-popover px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground" {...props}>
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className="scroll-my-1 px-2" {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                className="grid size-10 place-items-center rounded-lg text-2xl data-[active]:bg-accent"
                {...props}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  )
}

export const SWATCHES = [
  '#22D3EE', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#F59E0B', '#84CC16', '#10B981', '#64748B', '#A8A29E',
]

/** 12 presets plus any hex. */
export function ColorField({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [hex, setHex] = useState(value)
  useEffect(() => setHex(value), [value])
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={cn(
            'size-7 rounded-full ring-offset-2 ring-offset-background transition-transform duration-150 ease-out active:scale-90',
            value.toLowerCase() === c.toLowerCase() && 'ring-2 ring-ring',
          )}
          style={{ background: c }}
        />
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-7 rounded-full px-3 text-xs font-medium text-muted-foreground ring-1 ring-border hover:text-foreground"
          >
            Custom
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3">
          <HexColorPicker color={value} onChange={onChange} />
          <input
            value={hex}
            onChange={(e) => {
              setHex(e.target.value)
              if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value)
            }}
            className="mt-3 h-9 w-full rounded-lg bg-muted px-3 font-mono text-sm outline-none"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
