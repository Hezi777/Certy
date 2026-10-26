import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ExpandableSearchBarProps = {
  value: string
  onChange: (query: string) => void
  expandDirection?: 'left' | 'right'
  placeholder?: string
  width?: number
  /** Ctrl/Cmd + K opens and focuses the bar. */
  hotkey?: boolean
  className?: string
}

const COLLAPSED = 44

/**
 * Round icon button that springs open into a search field. Adapted from the
 * expandable-search-bar snippet: controlled (filters as you type), stays open while
 * it holds a query, and Escape clears then closes.
 */
export default function ExpandableSearchBar({
  value,
  onChange,
  expandDirection = 'left',
  placeholder = 'Search…',
  width = 320,
  hotkey = true,
  className,
}: ExpandableSearchBarProps) {
  const [open, setOpen] = useState(value !== '')
  const container = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const reduce = useReducedMotion()
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 320, damping: 30 }

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  // click outside closes, but only when empty: a live filter shouldn't vanish under the user
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (open && !value && !container.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, value])

  useEffect(() => {
    if (!hotkey) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkey])

  return (
    <div ref={container} className={cn('relative shrink-0', className)} style={{ width: COLLAPSED, height: COLLAPSED }}>
      <AnimatePresence initial={false}>
        {open && (
          <motion.label
            key="field"
            className={cn(
              'absolute top-0 z-10 flex h-11 items-center overflow-hidden rounded-full bg-card text-foreground ring-1 ring-border focus-within:ring-2 focus-within:ring-ring/50 dark:ring-0 dark:focus-within:ring-2',
              expandDirection === 'left' ? 'right-0' : 'left-0',
            )}
            initial={{ width: COLLAPSED, opacity: 0.9 }}
            animate={{ width, opacity: 1 }}
            exit={{ width: COLLAPSED, opacity: 0, transition: reduce ? { duration: 0 } : { duration: 0.16, ease: [0.23, 1, 0.32, 1] } }}
            transition={spring}
          >
            <Search className="absolute left-[13px] size-[18px] text-muted-foreground" />
            <input
              ref={input}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return
                if (value) onChange('')
                else setOpen(false)
              }}
              placeholder={placeholder}
              className="h-full w-full min-w-0 bg-transparent pr-11 pl-11 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
              className="absolute right-1.5 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </motion.label>
        )}
      </AnimatePresence>
      <button
        type="button"
        aria-label="Search (Ctrl K)"
        title="Search (Ctrl K)"
        onClick={() => setOpen(true)}
        className={cn(
          'grid size-11 place-items-center rounded-full bg-card text-muted-foreground ring-1 ring-border transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-95 dark:ring-0',
          open && 'invisible',
        )}
      >
        <Search className="size-[18px]" />
      </button>
    </div>
  )
}
