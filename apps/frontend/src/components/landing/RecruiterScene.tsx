// FILE: src/components/landing/RecruiterScene.tsx
// PURPOSE: The tired recruiter, same line-art language as Character.tsx.
//          Late-night office: window, wall clock, desk piled with CVs, a
//          coffee going cold, a closed laptop. Pose changes are CSS
//          transitions on SVG transforms (cheap, no per-frame React work).
//          The steam is driven from outside through `steamRef` so the
//          coffee cools continuously with scroll.

import { motion } from 'framer-motion'

export type RecruiterPhase = 'tired' | 'desk' | 'leanback' | 'idea' | 'laptop' | 'typing' | 'click' | 'zoom'

const INK = 'var(--c-ink)'
const SURFACE = 'var(--c-surface)'
const LINE = 'var(--c-line)'
const ACCENT = 'var(--c-accent)'
const FG = 'var(--c-fg)'
const MUTED = 'var(--c-muted)'

const URL = 'safeapply.ai'
const S = { stroke: FG, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
const T = 'transform .7s cubic-bezier(.16,1,.3,1)'
const SPRING = { type: 'spring' as const, stiffness: 140, damping: 18 }
const FONT = 'Inter, sans-serif'

// Screen geometry (laptop). RecruiterStory zooms into its centre.
export const SCREEN = { x: 340, y: 250, w: 120, h: 96 }
export const SCREEN_CENTER = { cx: (SCREEN.x + SCREEN.w / 2) / 800, cy: (SCREEN.y + SCREEN.h / 2) / 500 }

// Upper body leans around the hip. Negative = back into the chair.
const LEAN: Record<RecruiterPhase, number> = { tired: -13, desk: -8, leanback: -20, idea: -7, laptop: 3, typing: 5, click: 5, zoom: 5 }

// Arm paths share one command structure so `d` transitions between them.
const ARM: Record<RecruiterPhase, string> = {
  tired: 'M212 234 Q168 204 192 160',
  desk: 'M212 234 Q252 226 238 180',
  leanback: 'M212 234 Q166 200 190 158',
  idea: 'M212 234 Q240 204 244 150',
  laptop: 'M212 234 Q270 300 371 329',
  typing: 'M212 234 Q270 300 371 329',
  click: 'M212 234 Q272 300 381 326',
  zoom: 'M212 234 Q272 300 381 326',
}
const ARM_BACK: Record<RecruiterPhase, string> = {
  tired: 'M204 236 Q164 214 180 166',
  desk: 'M204 236 Q196 280 214 306',
  leanback: 'M204 236 Q160 210 178 164',
  idea: 'M204 236 Q198 282 216 306',
  laptop: 'M204 236 Q252 306 357 332',
  typing: 'M204 236 Q252 306 357 332',
  click: 'M204 236 Q252 306 357 332',
  zoom: 'M204 236 Q252 306 357 332',
}

// Papers in the pile: [x, y, rotation]. Deterministic, no randomness at render.
const PILE_A: [number, number, number][] = [
  [520, 352, -2], [522, 346, 3], [518, 340, -4], [524, 334, 2], [520, 328, -1], [523, 322, 4], [519, 316, -3], [522, 310, 1],
]
const PILE_B: [number, number, number][] = [
  [640, 352, 3], [636, 346, -3], [641, 340, 2], [637, 334, -5], [640, 328, 1],
]

export function RecruiterScene({ phase, typed = 0, steamRef, className }: { phase: RecruiterPhase; typed?: number; steamRef?: { current: SVGGElement | null }; className?: string }) {
  const lid = phase === 'laptop' || phase === 'typing' || phase === 'click' || phase === 'zoom'
  const urlShown = phase === 'typing' || phase === 'click' || phase === 'zoom'
  const page = phase === 'click' || phase === 'zoom' || (phase === 'typing' && typed >= URL.length)
  const awake = phase === 'idea' || lid
  const lean = LEAN[phase]
  const sx = SCREEN.x
  const sy = SCREEN.y

  return (
    <svg viewBox="0 0 800 500" className={className} role="img" aria-label="A tired recruiter at a desk full of CVs finds SafeApply">
      <defs>
        <radialGradient id="rs-bulb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.55" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rs-screen" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.18" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
        <clipPath id="rs-screen-clip">
          <rect x={sx} y={sy} width={SCREEN.w} height={SCREEN.h} rx="6" />
        </clipPath>
      </defs>

      {/* Room: wall line, floor, night window, clock */}
      <path d="M60 440 H790" stroke={LINE} strokeWidth="2" />
      <g>
        <rect x="560" y="60" width="150" height="120" rx="6" fill={SURFACE} stroke={MUTED} strokeWidth="2" />
        <path d="M635 60 V180 M560 120 H710" stroke={LINE} strokeWidth="2" />
        <path d="M676 82 a14 14 0 1 0 12 22 a11 11 0 1 1 -12 -22 z" fill={FG} fillOpacity="0.85" />
        {[
          [584, 84],
          [612, 100],
          [596, 146],
          [662, 150],
          [690, 136],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill={MUTED} />
        ))}
      </g>
      <g>
        <circle cx="440" cy="110" r="24" fill={SURFACE} stroke={MUTED} strokeWidth="2" />
        <path d="M440 110 L437 96 M440 110 L428 116" stroke={FG} strokeWidth="2" strokeLinecap="round" />
        <circle cx="440" cy="110" r="2" fill={FG} />
      </g>

      {/* Desk */}
      <path d="M300 360 H780" stroke={FG} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M318 360 V440 M762 360 V440" stroke={MUTED} strokeWidth="2.4" strokeLinecap="round" />

      {/* CV piles */}
      {[...PILE_B, ...PILE_A].map(([x, y, r], i) => (
        <rect key={i} x={x} y={y - 6} width="96" height="8" rx="1.5" fill={SURFACE} stroke={i % 3 ? MUTED : FG} strokeWidth="1.4" transform={`rotate(${r} ${x + 48} ${y})`} />
      ))}
      <g transform="rotate(-6 570 290)">
        <rect x="532" y="262" width="74" height="40" rx="2" fill={SURFACE} stroke={FG} strokeWidth="1.6" />
        <text x="540" y="276" fontSize="8" fontWeight="700" fontFamily={FONT} fill={FG}>
          CV
        </text>
        <path d="M540 284 H592 M540 291 H584 M540 297 H588" stroke={MUTED} strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <g transform="rotate(8 680 304)">
        <rect x="648" y="290" width="64" height="28" rx="2" fill={SURFACE} stroke={MUTED} strokeWidth="1.4" />
        <path d="M655 300 H700 M655 307 H690" stroke={MUTED} strokeWidth="1.2" strokeLinecap="round" />
      </g>

      {/* Coffee: steam fades as it goes cold */}
      <g>
        <path d="M484 330 h26 v24 a6 6 0 0 1 -6 6 h-14 a6 6 0 0 1 -6 -6 z" fill={SURFACE} stroke={FG} strokeWidth="2" />
        <path d="M510 336 q10 0 10 8 t-10 8" stroke={FG} strokeWidth="2" fill="none" />
        <path d="M487 338 h20" stroke={MUTED} strokeWidth="1.4" />
        <g ref={steamRef}>
          <motion.path
            d="M492 322 q4 -7 0 -14 M502 322 q4 -7 0 -14"
            stroke={MUTED}
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            animate={{ opacity: [0.3, 0.9, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </g>
      </g>

      {/* Laptop */}
      <path d="M330 346 H470 L480 356 H320 Z" fill={SURFACE} stroke={FG} strokeWidth="2.2" strokeLinejoin="round" />
      <g style={{ transformBox: 'fill-box', transformOrigin: '50% 100%', transform: `scaleY(${lid ? 1 : 0.06})`, transition: 'transform .7s cubic-bezier(.34,1.4,.64,1)' }}>
        <rect x={sx} y={sy} width={SCREEN.w} height={SCREEN.h} rx="6" fill={page ? INK : SURFACE} stroke={FG} strokeWidth="2" />
        <g clipPath="url(#rs-screen-clip)">
          <rect x={sx} y={sy} width={SCREEN.w} height={SCREEN.h} fill="url(#rs-screen)" />
          <rect x={sx + 5} y={sy + 5} width={SCREEN.w - 10} height="11" rx="3" fill={LINE} />
          <circle cx={sx + 11} cy={sy + 10.5} r="1.6" fill={MUTED} />
          <text x={sx + 16} y={sy + 13} fontSize="6" fontFamily={FONT} fill={FG}>
            {urlShown ? URL.slice(0, typed) : ''}
          </text>
          {phase === 'typing' && typed < URL.length && (
            <motion.rect x={sx + 16 + typed * 3.3} y={sy + 7} width="0.8" height="7" fill={ACCENT} animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
          )}

          {page && phase !== 'zoom' && (
            <g fontFamily={FONT}>
              <g transform={`translate(${sx + 53} ${sy + 22}) scale(0.42)`}>
                <path d="M16 3L5 8V16C5 23 16 28 16 28C16 28 27 23 27 16V8L16 3Z" stroke={ACCENT} strokeWidth="2" fill={ACCENT} fillOpacity="0.15" strokeLinejoin="round" />
              </g>
              <text x={sx + 60} y={sy + 44} fontSize="6" fontWeight="700" textAnchor="middle" fill={FG}>
                Who are you hiring as?
              </text>
              <rect x={sx + 14} y={sy + 54} width="42" height="14" rx="3" fill="none" stroke={MUTED} strokeWidth="1" />
              <text x={sx + 35} y={sy + 63} fontSize="4.6" textAnchor="middle" fill={MUTED}>
                Job seekers
              </text>
              <rect x={sx + 64} y={sy + 54} width="42" height="14" rx="3" fill={ACCENT} />
              <text x={sx + 85} y={sy + 63} fontSize="4.6" fontWeight="700" textAnchor="middle" fill={INK}>
                For recruiters
              </text>
            </g>
          )}
          {phase === 'zoom' && (
            <g fontFamily={FONT}>
              <text x={sx + 10} y={sy + 34} fontSize="7.5" fontWeight="700" fill={FG}>
                Hire from people
              </text>
              <text x={sx + 10} y={sy + 44} fontSize="7.5" fontWeight="700" fill={FG}>
                who can <tspan fill={ACCENT}>trust you.</tspan>
              </text>
              <rect x={sx + 10} y={sy + 52} width="70" height="3" rx="1.5" fill={LINE} />
              <rect x={sx + 10} y={sy + 58} width="54" height="3" rx="1.5" fill={LINE} />
              <rect x={sx + 10} y={sy + 68} width="38" height="11" rx="3" fill={ACCENT} />
              <text x={sx + 29} y={sy + 75.5} fontSize="4.6" fontWeight="700" textAnchor="middle" fill={INK}>
                Start hiring
              </text>
            </g>
          )}

          {(phase === 'click' || phase === 'zoom') && (
            <motion.g initial={{ x: 22, y: 24, opacity: 0 }} animate={{ x: 0, y: 0, opacity: phase === 'zoom' ? 0 : 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
              <path d={`M${sx + 88} ${sy + 61} l0 9 l2.4 -2 l1.8 3.8 l1.5 -.7 l-1.8 -3.8 l3.2 -.3 z`} fill={FG} stroke={INK} strokeWidth=".7" />
            </motion.g>
          )}
          {phase === 'click' && (
            <motion.circle
              cx={sx + 88}
              cy={sy + 62}
              r="3"
              fill="none"
              stroke={ACCENT}
              strokeWidth="1.4"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 4, opacity: [0, 1, 0] }}
              transition={{ duration: 0.7, delay: 0.45, ease: 'easeOut' }}
              style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
            />
          )}
        </g>
      </g>

      {/* Chair base (doesn't lean) */}
      <path d="M214 340 V412 M174 428 L214 412 L254 428 M214 412 V430" stroke={MUTED} strokeWidth="3" strokeLinecap="round" fill="none" />
      {[174, 214, 254].map((x) => (
        <circle key={x} cx={x} cy="432" r="5" fill={SURFACE} stroke={MUTED} strokeWidth="2" />
      ))}
      <rect x="168" y="322" width="96" height="16" rx="6" fill={SURFACE} stroke={FG} strokeWidth="2.2" />

      {/* Legs */}
      <path d="M200 322 L276 324 L282 424" {...S} />
      <path d="M282 424 H306" {...S} />
      <path d="M210 330 L268 332 L272 426 H292" {...S} stroke={MUTED} />

      {/* Upper body + chair back lean around the hip */}
      <g style={{ transformBox: 'view-box', transformOrigin: '200px 324px', transform: `rotate(${lean}deg)`, transition: T }}>
        <rect x="156" y="196" width="20" height="132" rx="8" fill={SURFACE} stroke={FG} strokeWidth="2.2" />
        <motion.path initial={false} animate={{ d: ARM_BACK[phase], opacity: phase === 'zoom' ? 0 : 1 }} transition={SPRING} {...S} stroke={MUTED} />
        <path d="M184 324 L188 232 Q206 218 226 232 L232 324 Z" fill={SURFACE} stroke={FG} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M200 226 L210 244 L218 228" {...S} strokeWidth={1.8} />
        <path d="M208 214 V204" {...S} />
        <circle cx="210" cy="180" r="30" fill={SURFACE} stroke={FG} strokeWidth="2.4" />
        <path d="M181 176 Q182 146 210 146 Q238 146 240 168 Q226 158 210 162 Q192 160 181 176 Z" fill={FG} />
        {awake ? (
          <motion.circle cx="226" cy="182" r="2.6" fill={FG} animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.92, 0.95, 1] }} />
        ) : (
          <path d="M221 183 Q226 186 231 183" {...S} strokeWidth={2} />
        )}
        <motion.path initial={false} animate={{ d: awake ? 'M219 172 L232 170' : 'M219 170 L232 174' }} transition={SPRING} {...S} strokeWidth={2} />
        <motion.path initial={false} animate={{ d: phase === 'idea' ? 'M226 196 Q231 202 236 196' : awake ? 'M225 196 Q231 200 237 196' : 'M225 199 Q231 195 237 199' }} transition={SPRING} {...S} strokeWidth={2} />
        {(phase === 'tired' || phase === 'leanback') && (
          <motion.text x="250" y="150" fontSize="15" fontWeight="700" fontFamily={FONT} fill={MUTED} animate={{ opacity: [0, 1, 0], y: [0, -10, -18] }} transition={{ duration: 2.4, repeat: Infinity }}>
            sigh
          </motion.text>
        )}
        <motion.path initial={false} animate={{ d: ARM[phase], opacity: phase === 'zoom' ? 0 : 1 }} transition={SPRING} {...S} />
      </g>

      {/* Idea bulb */}
      <g style={{ opacity: phase === 'idea' ? 1 : 0, transform: `translateY(${phase === 'idea' ? 0 : 10}px) scale(${phase === 'idea' ? 1 : 0.5})`, transformBox: 'fill-box', transformOrigin: '50% 100%', transition: 'opacity .25s, transform .45s cubic-bezier(.34,1.56,.64,1)' }}>
        <motion.g animate={phase === 'idea' ? { opacity: [1, 0.25, 1, 0.45, 1, 1] } : { opacity: 1 }} transition={phase === 'idea' ? { duration: 1.3, repeat: Infinity, times: [0, 0.1, 0.2, 0.3, 0.4, 1] } : { duration: 0.2 }}>
          <circle cx="200" cy="96" r="44" fill="url(#rs-bulb)" />
          <path d="M200 74 a18 18 0 0 1 10 33 v8 h-20 v-8 a18 18 0 0 1 10 -33 z" fill={ACCENT} fillOpacity="0.22" stroke={ACCENT} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M192 120 h16 M194 126 h12" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (-150 + i * 30) * (Math.PI / 180)
            return <path key={i} d={`M${200 + Math.cos(a) * 30} ${92 + Math.sin(a) * 30} L${200 + Math.cos(a) * 40} ${92 + Math.sin(a) * 40}`} stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" />
          })}
        </motion.g>
      </g>
    </svg>
  )
}
