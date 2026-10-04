// FILE: src/components/landing/Character.tsx
// PURPOSE: The SafeApply job seeker, drawn as line art in brand colours.
//          <StoryScene phase>  — full desk scene used by the intro + hero.
//          <Climber>           — small figure that climbs the ladder rail.
//
// All motion is transform/opacity or SVG path morphs between paths with
// identical command structure, so framer-motion interpolates them cleanly.

import { motion, useTransform, type MotionValue } from 'framer-motion'

export type StoryPhase = 'confused' | 'idea' | 'laptop' | 'typing' | 'click' | 'zoom' | 'calm'

const INK = 'var(--c-ink)'
const SURFACE = 'var(--c-surface)'
const LINE = 'var(--c-line)'
const ACCENT = 'var(--c-accent)'
const FG = 'var(--c-fg)'
const MUTED = 'var(--c-muted)'

const STROKE = { stroke: FG, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
const SPRING = { type: 'spring' as const, stiffness: 140, damping: 18 }
const EASE = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }

const URL = 'safeapply.ai'

function at(phase: StoryPhase, ...phases: StoryPhase[]) {
  return phases.includes(phase)
}

// Arm / mouth paths share command structure per element so they morph.
const ARM_R = {
  down: 'M282 226 Q296 264 292 306',
  scratch: 'M282 226 Q322 192 278 150',
  type: 'M282 226 Q318 300 392 388',
  wave: 'M282 226 Q318 200 320 156',
}
const ARM_L = {
  down: 'M218 226 Q204 264 208 306',
  chin: 'M218 226 Q214 262 244 210',
  type: 'M270 236 Q306 330 372 392',
}
const MOUTH = {
  unsure: 'M240 189 Q246 186 252 190 Q256 192 260 188',
  smile: 'M240 187 Q246 195 252 195 Q256 195 260 187',
  open: 'M242 188 Q246 196 252 196 Q258 196 260 188',
}
const BROW_L = { worried: 'M233 165 L246 169', up: 'M232 163 L246 161' }
const BROW_R = { worried: 'M256 169 L269 164', up: 'M256 161 L270 163' }

export function StoryScene({
  phase,
  typed = URL.length,
  className,
  title = 'A job seeker checks a company on SafeApply before applying',
  viewBox = '0 0 800 500',
  person = true,
}: {
  phase: StoryPhase
  typed?: number
  className?: string
  title?: string
  viewBox?: string
  /** Hide the man (hero uses the desk alone; he's on the ladder by then). */
  person?: boolean
}) {
  const confused = at(phase, 'confused')
  const atDesk = at(phase, 'laptop', 'typing', 'click', 'zoom', 'calm')
  const lidOpen = at(phase, 'laptop', 'typing', 'click', 'zoom', 'calm')
  const typing = at(phase, 'typing', 'click')
  const clicked = at(phase, 'click', 'zoom')
  const calm = phase === 'calm'

  const armR = confused ? ARM_R.scratch : phase === 'idea' ? ARM_R.wave : atDesk && !calm ? ARM_R.type : ARM_R.down
  const armL = confused ? ARM_L.chin : atDesk && !calm ? ARM_L.type : ARM_L.down
  const mouth = confused ? MOUTH.unsure : phase === 'idea' ? MOUTH.open : MOUTH.smile
  const browL = confused ? BROW_L.worried : BROW_L.up
  const browR = confused ? BROW_R.worried : BROW_R.up

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={title}>
      <defs>
        <radialGradient id="sa-bulb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.55" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sa-screen" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.16" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
        <clipPath id="sa-screen-clip">
          <rect x="452" y="256" width="196" height="136" rx="8" />
        </clipPath>
      </defs>

      {/* Floor + desk */}
      <path d="M90 470 H790" stroke={LINE} strokeWidth="2" />
      <path d="M404 404 H776" stroke={FG} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M424 404 V470 M756 404 V470" stroke={MUTED} strokeWidth="2.4" strokeLinecap="round" />

      {/* Mug — small human detail */}
      <g opacity="0.9">
        <path d="M700 378 h26 v22 a6 6 0 0 1 -6 6 h-14 a6 6 0 0 1 -6 -6 z" fill={SURFACE} stroke={FG} strokeWidth="2" />
        <path d="M726 384 q10 0 10 8 t-10 8" stroke={FG} strokeWidth="2" fill="none" />
        <motion.path
          d="M708 370 q4 -6 0 -12 M718 370 q4 -6 0 -12"
          stroke={MUTED}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          animate={{ opacity: [0.2, 0.7, 0.2], y: [0, -3, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </g>

      {/* Laptop */}
      <g>
        <path d="M436 396 H664 L678 406 H422 Z" fill={SURFACE} stroke={FG} strokeWidth="2.2" strokeLinejoin="round" />
        <motion.g
          style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
          initial={false}
          animate={{ scaleY: lidOpen ? 1 : 0.06 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16, delay: lidOpen ? 0.15 : 0 }}
        >
          <rect x="452" y="256" width="196" height="136" rx="8" fill={clicked || phase === 'zoom' ? INK : SURFACE} stroke={FG} strokeWidth="2.2" />
          <g clipPath="url(#sa-screen-clip)">
            <rect x="452" y="256" width="196" height="136" fill="url(#sa-screen)" />
            {/* Browser bar */}
            <rect x="460" y="264" width="180" height="17" rx="5" fill={LINE} />
            <circle cx="469" cy="272.5" r="2.2" fill={MUTED} />
            <text x="478" y="276.5" fontSize="9" fontFamily="Inter, sans-serif" fill={FG} letterSpacing="0.2">
              {URL.slice(0, typing || clicked || calm ? typed : 0)}
            </text>
            {typing && typed < URL.length && (
              <motion.rect
                x={478 + typed * 5.1}
                y="268"
                width="1.2"
                height="10"
                fill={ACCENT}
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}

            {/* Page content */}
            <motion.g initial={false} animate={{ opacity: typing || clicked || calm ? 1 : 0 }} transition={{ duration: 0.3 }}>
              <g transform="translate(538 290) scale(0.75)">
                <path d="M16 3L5 8V16C5 23 16 28 16 28C16 28 27 23 27 16V8L16 3Z" stroke={ACCENT} strokeWidth="1.8" fill={ACCENT} fillOpacity="0.15" strokeLinejoin="round" />
                <path d="M11.5 15.5L14.5 18.5L20.5 12.5" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>
              {phase === 'zoom' && (
                <g fontFamily="Inter, sans-serif">
                  <text x="550" y="330" fontSize="9.5" fontWeight="700" textAnchor="middle" fill={FG}>
                    Check the company before
                  </text>
                  <text x="550" y="342" fontSize="9.5" fontWeight="700" textAnchor="middle" fill={FG}>
                    you send the <tspan fill={ACCENT}>CV.</tspan>
                  </text>
                  <rect x="522" y="354" width="56" height="14" rx="4" fill={ACCENT} />
                  <text x="550" y="363.5" fontSize="6.5" fontWeight="600" textAnchor="middle" fill={INK}>
                    Start free
                  </text>
                </g>
              )}
              {!calm && phase !== 'zoom' && (
                <>
                  <rect x="492" y="332" width="116" height="10" rx="3" fill={LINE} />
                  <rect x="516" y="352" width="68" height="18" rx="5" fill={ACCENT} />
                  <text x="550" y="364.5" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="Inter, sans-serif" fill={INK}>
                    Check company
                  </text>
                </>
              )}
              {calm && (
                <g fontFamily="Inter, sans-serif" fontSize="8.5" fill={FG}>
                  {['News', 'Engineering activity', 'Repeat postings'].map((label, i) => (
                    <motion.g
                      key={label}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.12, ...EASE }}
                    >
                      <circle cx="484" cy={334 + i * 16} r="5" fill={ACCENT} fillOpacity="0.18" />
                      <path d={`M481.5 ${334 + i * 16} l2 2 l3.5 -3.5`} stroke={ACCENT} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                      <text x="495" y={337 + i * 16}>{label}</text>
                    </motion.g>
                  ))}
                </g>
              )}
            </motion.g>

            {/* Cursor + click */}
            {(typing || phase === 'click') && (
              <motion.g
                initial={{ x: 70, y: 40, opacity: 0 }}
                animate={{ x: clicked ? 0 : 30, y: clicked ? 0 : 18, opacity: 1 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <path d="M556 360 l0 13 l3.5 -3 l2.6 5.4 l2.2 -1 l-2.6 -5.4 l4.6 -0.4 z" fill={FG} stroke={INK} strokeWidth="1" />
              </motion.g>
            )}
            {phase === 'click' && (
              <motion.circle
                cx="556"
                cy="361"
                r="4"
                fill="none"
                stroke={ACCENT}
                strokeWidth="2"
                initial={{ scale: 0.4, opacity: 1 }}
                animate={{ scale: 4, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
              />
            )}
          </g>
        </motion.g>
      </g>

      {/* Person — walks to the desk after the idea */}
      {person && (
      <motion.g initial={false} animate={{ x: atDesk ? 92 : 0 }} transition={{ type: 'spring', stiffness: 70, damping: 16 }}>
        <ellipse cx="250" cy="472" rx="58" ry="6" fill={LINE} />

        {/* Legs */}
        <path d="M234 320 L226 466 M266 320 L274 466" {...STROKE} />
        <path d="M216 466 H234 M266 466 H286" {...STROKE} />

        {/* Torso */}
        <path d="M214 218 Q250 202 286 218 L294 324 L206 324 Z" fill={SURFACE} {...{ stroke: FG, strokeWidth: 2.4, strokeLinejoin: 'round' as const }} />
        <path d="M240 210 L250 228 L260 210" {...STROKE} strokeWidth={2} />

        {/* Arms */}
        <motion.path d={armL} initial={false} animate={{ d: armL }} transition={SPRING} {...STROKE} />
        <motion.path d={armR} initial={false} animate={{ d: armR }} transition={SPRING} {...STROKE} />

        {/* Head */}
        <motion.g
          initial={false}
          animate={{ rotate: confused ? -9 : phase === 'idea' ? 4 : 0, y: phase === 'idea' ? -4 : 0 }}
          transition={SPRING}
          style={{ transformBox: 'fill-box', transformOrigin: '50% 90%' }}
        >
          <path d="M250 206 V196" {...STROKE} />
          <circle cx="250" cy="174" r="32" fill={SURFACE} stroke={FG} strokeWidth="2.4" />
          <path d="M219 168 Q222 136 252 138 Q282 138 282 166 Q270 152 252 156 Q232 152 219 168 Z" fill={FG} />
          <motion.circle cx="240" cy="176" r="2.6" fill={FG} initial={false} animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.92, 0.95, 1] }} />
          <motion.circle cx="261" cy="176" r="2.6" fill={FG} initial={false} animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.92, 0.95, 1] }} />
          <motion.path d={browL} initial={false} animate={{ d: browL }} transition={SPRING} {...STROKE} strokeWidth={2} />
          <motion.path d={browR} initial={false} animate={{ d: browR }} transition={SPRING} {...STROKE} strokeWidth={2} />
          <motion.path d={mouth} initial={false} animate={{ d: mouth }} transition={SPRING} {...STROKE} strokeWidth={2} />
        </motion.g>

        {/* Question marks */}
        {['?', '?', '?'].map((q, i) => (
          <motion.text
            key={i}
            x={198 + i * 46}
            y={118 - (i % 2) * 18}
            fontSize={i === 1 ? 34 : 24}
            fontWeight="700"
            fontFamily="Inter, sans-serif"
            fill={i === 1 ? FG : MUTED}
            textAnchor="middle"
            initial={false}
            animate={
              confused
                ? { opacity: [0, 1, 1], y: [8, 0, -4], rotate: [0, i === 1 ? 0 : i ? 10 : -10, 0] }
                : { opacity: 0, y: -16 }
            }
            transition={confused ? { duration: 1.6, delay: i * 0.18, repeat: Infinity, repeatType: 'reverse' } : { duration: 0.3 }}
          >
            {q}
          </motion.text>
        ))}

        {/* Lightbulb */}
        <motion.g
          initial={false}
          animate={phase === 'idea' ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.4, y: 10 }}
          transition={phase === 'idea' ? { type: 'spring', stiffness: 320, damping: 14 } : { duration: 0.25 }}
          style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
        >
          <motion.g
            initial={false}
            animate={phase === 'idea' ? { opacity: [1, 0.25, 1, 0.45, 1, 1] } : { opacity: 1 }}
            transition={phase === 'idea' ? { duration: 1.3, repeat: Infinity, times: [0, 0.1, 0.2, 0.3, 0.4, 1] } : { duration: 0.2 }}
          >
          <circle cx="250" cy="92" r="44" fill="url(#sa-bulb)" />
          <path d="M250 70 a18 18 0 0 1 10 33 v8 h-20 v-8 a18 18 0 0 1 10 -33 z" fill={ACCENT} fillOpacity="0.22" stroke={ACCENT} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M242 116 h16 M244 122 h12" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M246 96 l4 6 l4 -6" stroke={ACCENT} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (-150 + i * 30) * (Math.PI / 180)
            const r1 = 30
            const r2 = 40
            return (
              <path
                key={i}
                d={`M${250 + Math.cos(a) * r1} ${88 + Math.sin(a) * r1} L${250 + Math.cos(a) * r2} ${88 + Math.sin(a) * r2}`}
                stroke={ACCENT}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            )
          })}
          </motion.g>
        </motion.g>
      </motion.g>
      )}
    </svg>
  )
}

// ─── Climber (ladder rail) ───────────────────────────────
// `cycle` is a motion value (sin of scroll) in [-1, 1]. Hands and feet
// alternate with it so the figure reads as climbing while you scroll.
export function Climber({ cycle, className }: { cycle: MotionValue<number>; className?: string }) {
  const handL = useTransform(cycle, (s) => `M22 34 Q16 26 14 ${14 + s * 6}`)
  const handR = useTransform(cycle, (s) => `M38 34 Q44 26 46 ${14 - s * 6}`)
  const footL = useTransform(cycle, (s) => `M25 66 Q20 76 14 ${86 - s * 6}`)
  const footR = useTransform(cycle, (s) => `M35 66 Q40 76 46 ${86 + s * 6}`)
  const bob = useTransform(cycle, (s) => Math.abs(s) * 1.5)

  return (
    <motion.svg viewBox="0 0 60 96" className={className} style={{ y: bob }} aria-hidden>
      {/* Back view: hair cap, torso, limbs on the rails */}
      <motion.path d={handL} {...STROKE} strokeWidth={2.6} />
      <motion.path d={handR} {...STROKE} strokeWidth={2.6} />
      <motion.path d={footL} {...STROKE} strokeWidth={2.6} />
      <motion.path d={footR} {...STROKE} strokeWidth={2.6} />
      <path d="M20 32 Q30 26 40 32 L42 66 L18 66 Z" fill={SURFACE} stroke={FG} strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="30" cy="18" r="10" fill={FG} stroke={FG} strokeWidth="2" />
      <path d="M24 48 h12" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" />
    </motion.svg>
  )
}

// Standing figure for the final CTA — waving, done.
export function Arrived({ className }: { className?: string }) {
  return (
    <svg viewBox="150 60 220 430" className={className} aria-hidden>
      <ellipse cx="250" cy="472" rx="58" ry="6" fill={LINE} />
      <path d="M234 320 L226 466 M266 320 L274 466" {...STROKE} />
      <path d="M216 466 H234 M266 466 H286" {...STROKE} />
      <path d="M214 218 Q250 202 286 218 L294 324 L206 324 Z" fill={SURFACE} stroke={FG} strokeWidth="2.4" strokeLinejoin="round" />
      <path d={ARM_L.down} {...STROKE} />
      <motion.path
        d={ARM_R.wave}
        {...STROKE}
        animate={{ d: [ARM_R.wave, 'M282 226 Q312 196 330 160', ARM_R.wave] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <path d="M250 206 V196" {...STROKE} />
      <circle cx="250" cy="174" r="32" fill={SURFACE} stroke={FG} strokeWidth="2.4" />
      <path d="M219 168 Q222 136 252 138 Q282 138 282 166 Q270 152 252 156 Q232 152 219 168 Z" fill={FG} />
      <circle cx="240" cy="176" r="2.6" fill={FG} />
      <circle cx="261" cy="176" r="2.6" fill={FG} />
      <path d={BROW_L.up} {...STROKE} strokeWidth={2} />
      <path d={BROW_R.up} {...STROKE} strokeWidth={2} />
      <path d={MOUTH.smile} {...STROKE} strokeWidth={2} />
      <g transform="translate(296 86)">
        <rect x="0" y="0" width="64" height="40" rx="12" fill={ACCENT} />
        <path d="M24 20 l6 6 l12 -12" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 40 l-6 10 l14 -10" fill={ACCENT} />
      </g>
    </svg>
  )
}
