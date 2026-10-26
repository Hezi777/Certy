import { LifeBuoy } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { isTauri } from '@/lib/backend'

const SHORTCUTS: [string, string][] = [
  ['Ctrl K', 'Search'],
  ['Ctrl N', 'Add a secret'],
  ['Esc', 'Close or clear'],
]

/** Short "how it works" plus shortcuts; replaces a Help button that went nowhere. */
export function HelpPopover({ trigger }: { trigger: (props: { icon: typeof LifeBuoy }) => React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger({ icon: LifeBuoy })}</PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-80">
        <p className="text-sm font-semibold">How Certy works</p>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>Paste a token or drop a certificate; Certy reads the expiry when it can, or you set the date.</li>
          <li>Services with a live check are re-checked in the background, also while Certy sits in the tray.</li>
          <li>You get a Windows notification at each reminder you chose.</li>
        </ul>
        <p className="mt-4 text-sm font-semibold">Shortcuts</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
              </dt>
              <dd className="text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          {isTauri
            ? 'Data is stored encrypted in %APPDATA%\\com.certy.app. The key lives in Windows Credential Manager.'
            : 'Browser preview: data is kept in this browser only.'}
        </p>
      </PopoverContent>
    </Popover>
  )
}
