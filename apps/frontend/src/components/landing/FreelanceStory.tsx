// FILE: src/components/landing/FreelanceStory.tsx
// PURPOSE: Scroll-driven opening of /freelance (same engine as ScrollStory:
//          sticky scene, native scroll + rAF, continuous values via refs).
//
//            0.00–0.10  apart: client and freelancer on two cliffs, doubtful
//            0.10–0.62  six trust planks build the bridge, rope draws
//            0.62–0.76  both walk to the middle
//            0.76–0.84  handshake, check badge pops
//            0.84–1.00  camera pushes into the badge; the hero follows
//
// Scrolling up reverses everything.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BADGE, BridgeScene, PLANKS, WALK, type BridgePhase } from './BridgeScene'

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a))
const smooth = (t: number) => t * t * (3 - 2 * t)

function phaseAt(p: number): BridgePhase {
  if (p < 0.1) return 'apart'
  if (p < 0.62) return 'build'
  if (p < 0.76) return 'walk'
  if (p < 0.84) return 'shake'
  return 'zoom'
}

const BY = BADGE.y / 500
const CAM: [number, number, number, number][] = [
  [0, 0.5, 0.5, 1],
  [0.62, 0.5, 0.5, 1],
  [0.76, 0.5, 0.46, 1.35],
  [0.84, 0.5, BY, 1.7],
  [0.98, 0.5, BY, 11],
  [1, 0.5, BY, 11],
]
function cameraAt(p: number) {
  let i = 0
  while (i < CAM.length - 2 && p > CAM[i + 1][0]) i++
  const [p0, x0, y0, z0] = CAM[i]
  const [p1, x1, y1, z1] = CAM[i + 1]
  const t = smooth(range(p, p0, p1))
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, z: z0 * Math.pow(z1 / z0, t) }
}

const PLANK_CAPTION = ['Verified profiles on both sides.', 'A clear scope before work starts.', 'Milestones agreed up front.', 'An agreed price, on record.', 'Work handed in, one milestone at a time.', 'Approved step by step.']

function caption(phase: BridgePhase, planks: number): string | null {
  if (phase === 'apart') return 'A client needs work done. A freelancer needs a client worth trusting.'
  if (phase === 'build') return planks ? PLANK_CAPTION[planks - 1] : 'Plank by plank, the gap closes.'
  if (phase === 'walk') return 'Now they can meet in the middle.'
  if (phase === 'shake') return 'Deal.'
  return null
}

export default function FreelanceStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const clientRef = useRef<SVGGElement>(null)
  const freelancerRef = useRef<SVGGElement>(null)
  const ropeRef = useRef<SVGPathElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<BridgePhase>('apart')
  const [planks, setPlanks] = useState(0)

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
      const k = Math.min(PLANKS.length, Math.floor(range(p, 0.12, 0.6) * PLANKS.length + 1e-6))
      setPlanks((cur) => (cur === k ? cur : k))

      const w = smooth(range(p, 0.63, 0.75))
      const bob = w > 0 && w < 1 ? Math.abs(Math.sin(w * Math.PI * 8)) * 4 : 0
      if (clientRef.current) clientRef.current.style.transform = `translate(${w * WALK}px, ${-bob}px)`
      if (freelancerRef.current) freelancerRef.current.style.transform = `translate(${-w * WALK}px, ${-bob}px)`
      if (ropeRef.current) ropeRef.current.style.strokeDashoffset = String(1 - range(p, 0.1, 0.22))

      const cam = cameraAt(p)
      if (sceneRef.current) {
        sceneRef.current.style.transform = `translate(${(0.5 - cam.x) * cam.z * 100}%, ${(0.5 - cam.y) * cam.z * 100}%) scale(${cam.z})`
        sceneRef.current.style.opacity = String(1 - range(p, 0.9, 1))
      }
      if (barRef.current) barRef.current.style.transform = `scaleX(${range(p, 0, 0.84)})`
      if (hintRef.current) hintRef.current.style.opacity = String(1 - range(p, 0, 0.04))
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

  const text = caption(phase, planks)
  return (
    <section ref={sectionRef} aria-label="Story: a client and a freelancer build trust and make a deal" className="relative h-[560vh] -mt-16">
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
        <div className="relative w-[min(1040px,135vw,110dvh)] aspect-[8/5] shrink-0">
          <div ref={sceneRef} className="absolute inset-0 will-change-transform" style={{ transformOrigin: '50% 50%' }}>
            <BridgeScene phase={phase} planks={planks} clientRef={clientRef} freelancerRef={freelancerRef} ropeRef={ropeRef} className="w-full h-full" />
          </div>
        </div>

        <div className="relative h-16 mt-2 w-full flex justify-center px-6 pointer-events-none" aria-live="polite">
          <AnimatePresence mode="wait">
            {text && (
              <motion.p
                key={`${phase}-${phase === 'build' ? planks : ''}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="text-center text-lg sm:text-2xl font-semibold tracking-tight text-fg max-w-[34ch]"
              >
                {phase === 'build' && planks > 0 && <span className="text-accent tabular mr-2">{planks}/6</span>}
                {text}
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
