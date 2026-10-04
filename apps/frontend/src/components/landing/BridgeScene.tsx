// FILE: src/components/landing/BridgeScene.tsx
// PURPOSE: "Two cliffs, one bridge". A client (left, holding a brief) and a
//          freelancer (right, holding a laptop) are split by a gap. Six
//          trust planks build the bridge; they walk out and shake hands.
//          Same line-art language as Character.tsx; all colours are theme
//          variables so it works in light and dark.
//
//          Continuous values (walk distance, rope draw) are written by
//          FreelanceStory through the refs; `walk`/`rope` props only set
//          the starting values (and drive static renders).

import { motion } from 'framer-motion'

export type BridgePhase = 'apart' | 'build' | 'walk' | 'shake' | 'zoom'

const SURFACE = 'var(--c-surface)'
const LINE = 'var(--c-line)'
const ACCENT = 'var(--c-accent)'
const FG = 'var(--c-fg)'
const MUTED = 'var(--c-muted)'
const INK = 'var(--c-ink)'
const FONT = 'Inter, sans-serif'
const S = { stroke: FG, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
const SPRING = { type: 'spring' as const, stiffness: 160, damping: 18 }

export const PLANKS = ['Verified', 'Clear scope', 'Milestones', 'Agreed price', 'Handed in', 'Approved']
export const WALK = 200 // px each person walks toward the middle
export const BADGE = { x: 400, y: 186 } // handshake badge; the camera zooms here

const ROPE = 'M246 286 Q400 334 554 286'
const ropeY = (x: number) => {
  const t = (x - 246) / 308
  return 286 + 2 * t * (1 - t) * 48
}

/** One person, origin at the feet. Mirror with `flip` (faces left). */
function Person({ phase, flip, kind }: { phase: BridgePhase; flip?: boolean; kind: 'client' | 'freelancer' }) {
  const worried = phase === 'apart'
  const shaking = phase === 'shake' || phase === 'zoom'
  const front = shaking ? 'M12 -100 Q26 -96 30 -88' : 'M12 -100 Q22 -84 14 -72'
  return (
    <g transform={flip ? 'scale(-1 1)' : undefined}>
      <ellipse cx="0" cy="2" rx="26" ry="4" fill={LINE} />
      <path d="M-7 -50 L-9 0 M7 -50 L9 0" {...S} />
      <path d="M-9 0 H1 M9 0 H19" {...S} />
      <path d="M-12 -100 Q-22 -80 -16 -62" {...S} stroke={MUTED} />
      <path d="M-18 -106 Q0 -114 18 -106 L21 -50 L-21 -50 Z" fill={SURFACE} stroke={FG} strokeWidth="2.4" strokeLinejoin="round" />
      {kind === 'client' ? <path d="M0 -106 L-3 -90 L0 -80 L3 -90 Z" fill={ACCENT} /> : <path d="M-6 -106 L0 -98 L6 -106" {...S} strokeWidth={1.8} />}
      <path d="M0 -114 V-120" {...S} />
      <circle cx="0" cy="-136" r="17" fill={SURFACE} stroke={FG} strokeWidth="2.4" />
      <path d="M-17 -139 Q-15 -156 1 -156 Q17 -155 17 -141 Q9 -148 0 -146 Q-10 -146 -17 -139 Z" fill={FG} />
      {kind === 'freelancer' && <path d="M-19 -134 Q-19 -160 0 -160 Q19 -160 19 -134" stroke={ACCENT} strokeWidth="2.6" fill="none" strokeLinecap="round" />}
      <circle cx="7" cy="-136" r="1.8" fill={FG} />
      <motion.path initial={false} animate={{ d: worried ? 'M3 -126 Q7 -128 11 -126' : 'M3 -127 Q7 -122 11 -127' }} transition={SPRING} {...S} strokeWidth={1.8} />
      {/* Held item: brief (client) or laptop (freelancer); put away for the handshake */}
      <g style={{ opacity: shaking ? 0 : 1, transition: 'opacity .3s' }}>
        {kind === 'client' ? (
          <g>
            <rect x="12" y="-92" width="18" height="24" rx="2" fill={SURFACE} stroke={FG} strokeWidth="1.8" />
            <path d="M16 -85 H26 M16 -80 H24 M16 -75 H26" stroke={MUTED} strokeWidth="1.2" />
          </g>
        ) : (
          <g>
            <path d="M10 -70 H34 L37 -66 H7 Z" fill={SURFACE} stroke={FG} strokeWidth="1.8" strokeLinejoin="round" />
            <rect x="12" y="-88" width="20" height="18" rx="2" fill={SURFACE} stroke={FG} strokeWidth="1.8" transform="rotate(-12 12 -70)" />
          </g>
        )}
      </g>
      <motion.path
        initial={false}
        animate={shaking ? { d: front, y: [0, -3, 0, -3, 0] } : { d: front, y: 0 }}
        transition={shaking ? { d: SPRING, y: { duration: 0.9, delay: 0.35 } } : SPRING}
        {...S}
      />
    </g>
  )
}

export function BridgeScene({
  phase,
  planks,
  walk = 0,
  rope = 0,
  clientRef,
  freelancerRef,
  ropeRef,
  className,
}: {
  phase: BridgePhase
  planks: number
  walk?: number
  rope?: number
  clientRef?: { current: SVGGElement | null }
  freelancerRef?: { current: SVGGElement | null }
  ropeRef?: { current: SVGPathElement | null }
  className?: string
}) {
  const met = phase === 'shake' || phase === 'zoom'
  return (
    <svg viewBox="0 0 800 500" className={className} role="img" aria-label="A client and a freelancer build a bridge of trust and shake hands">
      <defs>
        <linearGradient id="br-gap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={LINE} stopOpacity="0.9" />
          <stop offset="1" stopColor={INK} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="br-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.45" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky details */}
      <path d="M120 96 q10 -16 28 -8 q12 -14 28 0 q16 -2 14 14 H118 q-10 -2 2 -6 z" fill="none" stroke={LINE} strokeWidth="2" />
      <path d="M600 70 q8 -12 22 -6 q10 -11 22 0 q12 -1 11 11 H598 q-8 -2 2 -5 z" fill="none" stroke={LINE} strokeWidth="2" />

      {/* The gap */}
      <rect x="250" y="330" width="300" height="170" fill="url(#br-gap)" />
      {[290, 345, 405, 470, 515].map((x, i) => (
        <path key={x} d={`M${x} ${352 + (i % 2) * 20} v${40 + (i % 3) * 18}`} stroke={LINE} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 8" />
      ))}

      {/* Cliffs */}
      <path d="M0 330 H252 L240 372 L254 418 L236 470 L246 500 H0 Z" fill={SURFACE} stroke={FG} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M800 330 H548 L561 368 L546 420 L566 466 L556 500 H800 Z" fill={SURFACE} stroke={FG} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M40 360 l22 6 M120 392 l30 -4 M70 440 l26 8 M690 372 l-24 8 M740 420 l-28 -2 M650 456 l-22 6" stroke={LINE} strokeWidth="2" strokeLinecap="round" />

      {/* Bridge posts + rope (rope draws with scroll) */}
      <g style={{ opacity: phase === 'apart' ? 0 : 1, transition: 'opacity .4s' }}>
        <path d="M246 330 V280 M554 330 V280" stroke={FG} strokeWidth="3" strokeLinecap="round" />
        <circle cx="246" cy="279" r="3.5" fill={ACCENT} />
        <circle cx="554" cy="279" r="3.5" fill={ACCENT} />
      </g>
      <path ref={ropeRef} d={ROPE} pathLength={1} stroke={MUTED} strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="1 1" style={{ strokeDashoffset: 1 - rope }} />

      {/* Planks */}
      {PLANKS.map((label, i) => {
        const x = 252 + i * 50
        const on = i < planks
        return (
          <g key={label} style={{ opacity: on ? 1 : 0, transform: on ? 'translateY(0)' : 'translateY(-36px)', transition: 'opacity .3s, transform .55s cubic-bezier(.34,1.56,.64,1)' }}>
            <path d={`M${x + 23} ${ropeY(x + 23)} V326`} stroke={MUTED} strokeWidth="1.4" />
            <rect x={x} y="326" width="46" height="9" rx="2" fill={SURFACE} stroke={on ? ACCENT : FG} strokeWidth="2" style={{ transition: 'stroke .4s' }} />
            <text x={x + 23} y="350" fontSize="7.5" fontWeight="600" textAnchor="middle" fontFamily={FONT} fill={ACCENT}>
              {label}
            </text>
          </g>
        )
      })}

      {/* People (walk via refs) */}
      <g ref={clientRef} style={{ transform: `translateX(${walk * WALK}px)` }}>
        <g transform="translate(161 330) scale(1.3)">
          <Person phase={phase} kind="client" />
        </g>
      </g>
      <g ref={freelancerRef} style={{ transform: `translateX(${-walk * WALK}px)` }}>
        <g transform="translate(639 330) scale(1.3)">
          <Person phase={phase} kind="freelancer" flip />
        </g>
      </g>

      {/* Doubt */}
      {['?', '?'].map((q, i) => (
        <motion.text
          key={i}
          x={i ? 660 : 140}
          y="104"
          fontSize="26"
          fontWeight="700"
          fontFamily={FONT}
          fill={MUTED}
          textAnchor="middle"
          initial={false}
          animate={phase === 'apart' ? { opacity: [0.2, 1, 0.2], y: [0, -6, 0] } : { opacity: 0, y: -12 }}
          transition={phase === 'apart' ? { duration: 1.8, repeat: Infinity, delay: i * 0.3 } : { duration: 0.25 }}
        >
          {q}
        </motion.text>
      ))}

      {/* Handshake badge */}
      <g style={{ opacity: met ? 1 : 0, transform: met ? 'scale(1)' : 'scale(0.3)', transformBox: 'fill-box', transformOrigin: '50% 50%', transition: 'opacity .3s .5s, transform .5s cubic-bezier(.34,1.56,.64,1) .5s' }}>
        <circle cx={BADGE.x} cy={BADGE.y} r="40" fill="url(#br-glow)" />
        <circle cx={BADGE.x} cy={BADGE.y} r="13" fill={ACCENT} />
        <path d={`M${BADGE.x - 5.5} ${BADGE.y} l4 4 l7.5 -7.5`} stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
