// FILE: src/components/landing/RecruiterStory.tsx
// PURPOSE: Scroll-driven opening of /recruiters. Same engine as ScrollStory
//          (sticky scene, native scroll + rAF, styles written via refs):
//
//            0.00–0.08  tired, leaning back in the chair
//            0.08–0.27  camera pans to the desk: CV piles, coffee going cold
//            0.27–0.37  camera pulls back, he leans back again
//            0.37–0.46  idea, bulb blinks
//            0.46–0.55  sits up, opens the laptop
//            0.55–0.70  types "safeapply.ai"
//            0.70–0.78  clicks "For recruiters"
//            0.78–1.00  camera pushes into the screen; the hero follows
//
// Scrolling up reverses everything.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RecruiterScene, SCREEN_CENTER, type RecruiterPhase } from './RecruiterScene'

const URL_LEN = 'safeapply.ai'.length
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a))
const smooth = (t: number) => t * t * (3 - 2 * t)

function phaseAt(p: number): RecruiterPhase {
  if (p < 0.08) return 'tired'
  if (p < 0.27) return 'desk'
  if (p < 0.37) return 'leanback'
  if (p < 0.46) return 'idea'
  if (p < 0.55) return 'laptop'
  if (p < 0.7) return 'typing'
  if (p < 0.78) return 'click'
  return 'zoom'
}

// Camera keyframes: [progress, centre x (0-1), centre y (0-1), zoom].
const { cx: SX, cy: SY } = SCREEN_CENTER
const CAM: [number, number, number, number][] = [
  [0, 0.5, 0.52, 1],
  [0.08, 0.5, 0.52, 1],
  [0.16, 0.72, 0.64, 2.1],
  [0.26, 0.72, 0.64, 2.1],
  [0.33, 0.5, 0.52, 1],
  [0.46, 0.5, 0.52, 1],
  [0.55, 0.47, 0.58, 1.5],
  [0.62, SX, SY, 2.4],
  [0.78, SX, SY, 2.4],
  [0.97, SX, SY, 9],
  [1, SX, SY, 9],
]

function cameraAt(p: number) {
  let i = 0
  while (i < CAM.length - 2 && p > CAM[i + 1][0]) i++
  const [p0, x0, y0, z0] = CAM[i]
  const [p1, x1, y1, z1] = CAM[i + 1]
  const t = smooth(range(p, p0, p1))
  // Zoom interpolates geometrically so the push-in feels constant.
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, z: z0 * Math.pow(z1 / z0, t) }
}

const CAPTION: Partial<Record<RecruiterPhase, string>> = {
  tired: 'Late again. Still no hire.',
  desk: 'A pile of CVs. The coffee has gone cold.',
  leanback: 'There has to be a better way to do this.',
  idea: 'Wait. SafeApply.',
  laptop: 'Opens the laptop.',
  click: 'For recruiters.',
}

export default function RecruiterStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const steamRef = useRef<SVGGElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<RecruiterPhase>('tired')
  const [typed, setTyped] = useState(0)

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const el = sectionRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      const p = total > 0 ? clamp(-rect.top / total) : 0

      const next = phaseAt(p)
      setPhase((cur) => (cur === next ? cur : next))
      const t = Math.round(range(p, 0.56, 0.68) * URL_LEN)
      setTyped((cur) => (cur === t ? cur : t))

      const cam = cameraAt(p)
      if (sceneRef.current) {
        sceneRef.current.style.transform = `translate(${(0.5 - cam.x) * cam.z * 100}%, ${(0.5 - cam.y) * cam.z * 100}%) scale(${cam.z})`
        sceneRef.current.style.opacity = String(1 - range(p, 0.9, 1))
      }
      if (steamRef.current) steamRef.current.style.opacity = String(1 - range(p, 0.1, 0.25))
      if (barRef.current) barRef.current.style.transform = `scaleX(${range(p, 0, 0.78)})`
      if (hintRef.current) hintRef.current.style.opacity = String(1 - range(p, 0, 0.04))
      if (glowRef.current) glowRef.current.style.opacity = String(p < 0.37 ? 0 : p < 0.46 ? range(p, 0.37, 0.42) * 0.14 : 0.14 - range(p, 0.46, 0.6) * 0.08)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section ref={sectionRef} aria-label="Story: a tired recruiter finds SafeApply" className="relative h-[560vh] -mt-16">
      <style>{'@keyframes sa-wheel{0%,100%{transform:translateY(0);opacity:1}50%{transform:translateY(10px);opacity:.2}}'}</style>
      <div className="sticky top-0 h-[100dvh] overflow-hidden flex flex-col items-center justify-center bg-ink pt-16">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(var(--c-line) 1px, transparent 1px), linear-gradient(90deg, var(--c-line) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />
        <div ref={glowRef} aria-hidden className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none" style={{ opacity: 0, background: 'radial-gradient(closest-side, var(--c-accent), transparent)' }} />

        <div className="relative w-[min(1040px,135vw,110dvh)] aspect-[8/5] shrink-0">
          <div ref={sceneRef} className="absolute inset-0 will-change-transform" style={{ transformOrigin: '50% 50%' }}>
            <RecruiterScene phase={phase} typed={typed} steamRef={steamRef} className="w-full h-full" />
          </div>
        </div>

        <div className="relative h-16 mt-2 w-full flex justify-center px-6 pointer-events-none" aria-live="polite">
          <AnimatePresence mode="wait">
            {(CAPTION[phase] || phase === 'typing') && (
              <motion.p
                key={phase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="text-center text-lg sm:text-2xl font-semibold tracking-tight text-fg max-w-[30ch]"
              >
                {phase === 'typing' ? (
                  <>
                    Goes to <span className="text-accent">safeapply.ai</span>
                  </>
                ) : (
                  CAPTION[phase]
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div aria-hidden className="absolute left-1/2 -translate-x-1/2 bottom-[5vh] w-32 h-[2px] rounded-full bg-line overflow-hidden">
          <div ref={barRef} className="h-full w-full bg-accent origin-left" style={{ transform: 'scaleX(0)' }} />
        </div>

        <div ref={hintRef} aria-hidden className="absolute top-[13vh] left-0 right-0 flex flex-col items-center gap-2 text-muted pointer-events-none">
          <span className="w-6 h-10 rounded-full border-2 border-muted/60 flex justify-center pt-2">
            <span className="w-1 h-2 rounded-full bg-fg animate-[sa-wheel_1.6s_ease-in-out_infinite]" />
          </span>
          <span className="text-xs">Scroll</span>
        </div>
      </div>
    </section>
  )
}
