import { useEffect, useState } from 'react'

/** Circular progress ring (stat tiles, countdowns). `value` is 0..1. With `intro` it draws in from empty. */
export function Ring({
  value,
  size = 44,
  stroke = 4,
  color = 'var(--primary)',
  track = 'color-mix(in oklab, currentColor 12%, transparent)',
  intro = false,
  delay = 0,
  children,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  intro?: boolean
  delay?: number
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const target = Math.max(0, Math.min(1, value))
  const [shown, setShown] = useState(intro ? 0 : target)
  useEffect(() => {
    // next frame, so the browser paints the empty ring before transitioning
    const raf = requestAnimationFrame(() => setShown(target))
    return () => cancelAnimationFrame(raf)
  }, [target])
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{
            transition: `stroke-dashoffset ${intro ? 1100 : 600}ms var(--ease-out) ${intro ? delay : 0}ms`,
            opacity: shown > 0 ? 1 : 0,
          }}
        />
      </svg>
      {children && <span className="absolute inset-0 grid place-items-center">{children}</span>}
    </span>
  )
}
