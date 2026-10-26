import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

/**
 * The opening reveal plays once per app launch (or reload), not on every return to the
 * Overview: a view you visit dozens of times a day must not make you wait.
 */
let played = false

export function useIntro(): boolean {
  const reduce = useReducedMotion()
  const [intro] = useState(() => !played && !reduce)
  useEffect(() => {
    played = true
  }, [])
  return intro
}

/** Counts from 0 to `target` with an ease-out quart; returns `target` immediately when disabled. */
export function useCountUp(target: number, enabled: boolean, duration = 1100, delay = 0): number {
  const [value, setValue] = useState(enabled ? 0 : target)
  useEffect(() => {
    if (!enabled) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - start) / duration))
      setValue(target * (1 - Math.pow(1 - p, 4)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled, duration, delay])
  return value
}

/** Inline style for one item of a staggered rise. */
export const rise = (intro: boolean, index: number, base = 0): React.CSSProperties | undefined =>
  intro ? { animation: `rise 520ms var(--ease-out) ${base + index * 60}ms both` } : undefined
