import {
  Activity, AppWindow, Bot, Boxes, Cloud, Code, Cpu, Database, FileKey, Fingerprint, Globe, HardDrive, Key,
  KeyRound, Landmark, Layers, Lock, Mail, Network, Package, Rocket, Server, Shield, ShieldCheck, Terminal,
  Webhook, Workflow, Wrench, type LucideIcon,
} from 'lucide-react'
import type { IconRef } from '@/lib/types'
import { cn } from '@/lib/utils'

const logos = import.meta.glob('../assets/logos/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>

export const LOGO_URL: Record<string, string> = Object.fromEntries(
  Object.entries(logos).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url]),
)

/** Curated generic glyphs for the icon picker. */
export const LUCIDE: Record<string, LucideIcon> = {
  key: Key, 'key-round': KeyRound, lock: Lock, shield: Shield, 'shield-check': ShieldCheck,
  fingerprint: Fingerprint, 'file-key': FileKey, server: Server, database: Database, cloud: Cloud,
  globe: Globe, network: Network, cpu: Cpu, 'hard-drive': HardDrive, terminal: Terminal, code: Code,
  webhook: Webhook, workflow: Workflow, boxes: Boxes, package: Package, layers: Layers, bot: Bot,
  rocket: Rocket, activity: Activity, mail: Mail, landmark: Landmark, wrench: Wrench, app: AppWindow,
}

function isDark(hex: string) {
  const n = parseInt(hex, 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 48
}

/** Just the glyph, sized by `size` (px). */
export function IconGlyph({ icon, size = 20, color }: { icon: IconRef; size?: number; color?: string }) {
  switch (icon.kind) {
    case 'logo':
      return <img src={LOGO_URL[icon.id]} alt="" width={size} height={size} className="object-contain" draggable={false} />
    case 'brand':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
          {/* near-black brand colors (GitHub, Vercel…) would vanish on the dark theme */}
          <path d={icon.path} fill={isDark(icon.hex) ? 'currentColor' : `#${icon.hex}`} />
        </svg>
      )
    case 'emoji':
      return <span style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden>{icon.value}</span>
    case 'lucide': {
      const Glyph = LUCIDE[icon.name] ?? Key
      return <Glyph size={size} style={{ color }} strokeWidth={2} />
    }
  }
}

/**
 * Icon on a tile tinted with the service color: the tint and ring are what make
 * services tell apart at a glance, whatever the glyph.
 */
export function ServiceIcon({
  icon,
  color,
  size = 40,
  className,
}: {
  icon: IconRef
  color: string
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn('relative grid shrink-0 place-items-center rounded-[28%]', className)}
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${color} 14%, var(--card))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 28%, transparent)`,
      }}
    >
      <IconGlyph icon={icon} size={Math.round(size * 0.56)} color={color} />
    </span>
  )
}
