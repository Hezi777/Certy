import { useEffect, useId, useRef, useState } from 'react'
import { BotEngine, type BotFrame } from './engine/engine'
import { EXPRESSION_BY_ID } from './engine/expressions'
import { DEMI_VIEWBOX as VB, RAYON as R } from './engine/repere'
import { SHAPE_BY_ID } from './engine/skins'
import { STATE_BY_ID, type StateId } from './engine/states'
import { NOTIF_BLUE } from './engine/decor'

/** Mood colors crossfade instead of snapping. */
const FILL_TRANSITION = 'fill 360ms ease'

export type MascotBody = 'sceau' | 'cadenas' | 'bouclier' | 'coffre'

export interface MascotProps {
  body?: MascotBody
  state?: StateId
  /** Resting expression id from the engine catalogue (e.g. 'heureux', 'mefiant'). */
  expression?: string
  size?: number
  /** Body color (any CSS color). */
  color?: string
  /** Background behind the mascot; shows through the eye holes. */
  paper?: string
  /** Eyes follow the pointer while on a resting state. */
  follow?: boolean
  /** Morph into a rounded warning triangle with a "!" cut through it. */
  alert?: boolean
  /** Render a single frame at this time (seconds), no animation loop. */
  frozenAt?: number
  className?: string
  title?: string
}

/**
 * React port of bloub's `BloubBot.vue`: an rAF loop sampling the clock-free engine.
 * Montage/timeline features are dropped; the app drives `state` directly.
 */
export function Mascot({
  body = 'sceau',
  state = 'idle',
  expression,
  size = 120,
  color = 'var(--mascot)',
  paper = 'var(--background)',
  follow = false,
  alert = false,
  frozenAt,
  className,
  title = 'Certy',
}: MascotProps) {
  const uid = useId().replace(/:/g, '')
  const maskId = `mascot-mask-${uid}`
  const svgRef = useRef<SVGSVGElement>(null)
  const clock = useRef(0)
  const engineRef = useRef<BotEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new BotEngine(
      R,
      state,
      SHAPE_BY_ID.get(alert ? 'alerte' : body)?.radii ?? null,
      (expression && EXPRESSION_BY_ID.get(expression)) || null,
    )
  }
  const engine = engineRef.current
  const [frame, setFrame] = useState<BotFrame>(() => engine.sample(frozenAt ?? 0))

  useEffect(() => {
    engine.setState(state, clock.current)
    if (frozenAt !== undefined) setFrame(engine.sample(frozenAt))
  }, [engine, state, frozenAt])

  useEffect(() => {
    engine.setShape(SHAPE_BY_ID.get(alert ? 'alerte' : body)?.radii ?? null, clock.current)
  }, [engine, body, alert])

  useEffect(() => {
    engine.setExpression((expression && EXPRESSION_BY_ID.get(expression)) || null, clock.current)
  }, [engine, expression])

  useEffect(() => {
    if (frozenAt !== undefined) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let pointer: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') pointer = { x: e.clientX, y: e.clientY }
    }
    if (follow) window.addEventListener('pointermove', onMove)

    let raf = 0
    let last = 0
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick)
      // bounded delta: a hidden window resumes without jumping ahead
      const dt = last ? Math.min((ms - last) / 1000, 0.064) : 0
      last = ms
      clock.current += reduce ? dt * 0.5 : dt
      const box = svgRef.current?.getBoundingClientRect()
      if (follow && pointer && box && box.width > 0 && STATE_BY_ID.get(engine.state)?.baseFace) {
        const nx = Math.max(-1, Math.min(1, (pointer.x - (box.left + box.width / 2)) / (window.innerWidth / 2)))
        const ny = Math.max(-1, Math.min(1, (pointer.y - (box.top + box.height / 2)) / (window.innerHeight / 2)))
        engine.setLook({ yaw: nx * 16, pitch: 10 - ny * 13, mix: 1, spin: 0, wander: 0 }, clock.current)
      }
      setFrame(engine.sample(clock.current))
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      engine.setLook(null, clock.current)
    }
  }, [engine, follow, frozenAt])

  // Decorations only make sense on the resting silhouette; animated states replace the body.
  const decoVisible = !alert && (STATE_BY_ID.get(state)?.baseBody ?? false)
  const swap = { transition: 'opacity 200ms cubic-bezier(0.23, 1, 0.32, 1)' }
  const thinking = state === 'thinking'

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`}
      role="img"
      aria-label={title}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* eyes are holes cut in the body, so they clip against the silhouette */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-VB} y={-VB} width={VB * 2} height={VB * 2}>
          <path d={frame.bodyPath} fill="#fff" />
          <g style={{ ...swap, opacity: alert ? 0 : 1 }}>
            {frame.eyes.map((eye, i) => (
              <path key={i} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />
            ))}
          </g>
          {/* the "!" replaces the face while alerting */}
          <g style={{ ...swap, opacity: alert ? 1 : 0 }} fill="#000">
            <rect x={-0.09 * R} y={-0.36 * R} width={0.18 * R} height={0.5 * R} rx={0.09 * R} />
            <circle cx={0} cy={0.34 * R} r={0.1 * R} />
          </g>
          {frame.notch && <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" />}
        </mask>
        {frame.arcs.map((arc) => (
          <linearGradient
            key={arc.id}
            id={`${uid}-${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.grad.x1}
            y1={arc.grad.y1}
            x2={arc.grad.x2}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((c, i) => (
              <stop key={i} offset={i / (arc.grad.stops.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
        ))}
      </defs>

      <Decoration body={body} visible={decoVisible} thinking={thinking} color={color} layer="back" />

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`b${arc.id}`}
            d={arc.back}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>

      {frame.dotsBehind && <Dots frame={frame} color={color} />}

      <g opacity={frame.bodyAlpha}>
        {/* opaque backing so rings drawn behind don't reappear inside the eyes */}
        <path d={frame.bodyPath} style={{ fill: paper }} />
        <g mask={`url(#${maskId})`}>
          <rect x={-VB} y={-VB} width={VB * 2} height={VB * 2} style={{ fill: color, transition: FILL_TRANSITION }} />
        </g>
      </g>

      <Decoration body={body} visible={decoVisible} thinking={thinking} color={color} layer="front" />

      {!frame.dotsBehind && <Dots frame={frame} color={color} />}

      {frame.notif && <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill={NOTIF_BLUE} />}

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`f${arc.id}`}
            d={arc.front}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>
    </svg>
  )
}

function Dots({ frame, color }: { frame: BotFrame; color: string }) {
  return (
    <g>
      {frame.dots.map((dot, i) => {
        // particles fade with depth instead of mixing toward the paper color
        const opacity = dot.opacity * (dot.depth ?? 1)
        const fill = dot.color ?? color
        return dot.d ? (
          <path
            key={i}
            d={dot.d}
            transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})`}
            style={{ fill }}
            opacity={opacity}
          />
        ) : (
          <circle key={i} cx={dot.x} cy={dot.y} r={dot.r} style={{ fill }} opacity={opacity} />
        )
      })}
    </g>
  )
}

/** Body-specific props: the padlock shackle and the vault dial. */
function Decoration({
  body,
  visible,
  thinking,
  color,
  layer,
}: {
  body: MascotBody
  visible: boolean
  thinking: boolean
  color: string
  layer: 'back' | 'front'
}) {
  const style = {
    opacity: visible ? 1 : 0,
    transition: 'opacity 220ms cubic-bezier(0.23, 1, 0.32, 1)',
  }
  if (body === 'cadenas' && layer === 'back') {
    const w = 0.48 * R
    const top = -0.92 * R
    return (
      <path
        d={`M ${-w} ${-0.3 * R} V ${top} A ${w} ${w} 0 0 1 ${w} ${top} V ${-0.3 * R}`}
        fill="none"
        strokeWidth={0.2 * R}
        strokeLinecap="round"
        style={{ ...style, stroke: color }}
      />
    )
  }
  if (body === 'coffre' && layer === 'front') {
    const bolts = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2)
    return (
      <g style={style}>
        <circle r={1.2 * R} fill="none" strokeWidth={0.06 * R} style={{ stroke: color }} />
        <g
          style={{
            transformOrigin: '0 0',
            animation: `mascot-spin ${thinking ? 1.2 : 14}s linear infinite`,
          }}
        >
          {bolts.map((a, i) => (
            <circle
              key={i}
              cx={Math.cos(a) * 1.2 * R}
              cy={Math.sin(a) * 1.2 * R}
              r={0.075 * R}
              style={{ fill: color }}
            />
          ))}
        </g>
      </g>
    )
  }
  return null
}
