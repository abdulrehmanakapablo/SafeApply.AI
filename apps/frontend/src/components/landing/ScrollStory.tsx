// FILE: src/components/landing/ScrollStory.tsx
// PURPOSE: Scroll-driven opening of the landing page. The scene is pinned
//          (CSS sticky) while you scroll through a tall section. Scroll
//          position, not time, drives the story:
//
//            0.00–0.13  confused, question marks
//            0.13–0.28  idea, bulb blinks
//            0.28–0.42  walks to the desk, opens the laptop
//            0.42–0.64  types "safeapply.ai" (letters follow the scroll)
//            0.64–0.74  clicks
//            0.74–1.00  camera pushes into the laptop screen, which shows
//                       the landing page; the real hero follows underneath
//
// Scroll is read straight from the browser (scroll listener + rAF) and
// written to the DOM via refs, so it works with any framer-motion version
// and does not re-render React on every frame. Scrolling up reverses it.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { StoryScene, type StoryPhase } from './Character'

const URL_LEN = 'safeapply.ai'.length

function phaseAt(p: number): StoryPhase {
  if (p < 0.13) return 'confused'
  if (p < 0.28) return 'idea'
  if (p < 0.42) return 'laptop'
  if (p < 0.64) return 'typing'
  if (p < 0.74) return 'click'
  return 'zoom'
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a))

const CAPTION: Partial<Record<StoryPhase, string>> = {
  confused: 'Another job post. Is this company even real?',
  idea: 'Wait. Check them first.',
  laptop: 'Opens the laptop.',
  typing: 'Goes to safeapply.ai',
  click: 'Pastes the post. Checks the company.',
}

export default function ScrollStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<StoryPhase>('confused')
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

      // Discrete story state → React (changes a handful of times per scroll).
      const next = phaseAt(p)
      setPhase((cur) => (cur === next ? cur : next))
      const t = Math.round(range(p, 0.44, 0.62) * URL_LEN)
      setTyped((cur) => (cur === t ? cur : t))

      // Continuous values → DOM directly.
      const zoom = range(p, 0.74, 0.97)
      const scale = 1 + zoom * zoom * 6.5
      if (sceneRef.current) {
        sceneRef.current.style.transform = `scale(${scale})`
        sceneRef.current.style.opacity = String(1 - range(p, 0.9, 1))
      }
      if (barRef.current) barRef.current.style.transform = `scaleX(${range(p, 0, 0.74)})`
      if (hintRef.current) hintRef.current.style.opacity = String(1 - range(p, 0, 0.04))
      if (glowRef.current) {
        const g = p < 0.13 ? 0 : p < 0.28 ? range(p, 0.13, 0.2) * 0.14 : 0.14 - range(p, 0.28, 0.42) * 0.09
        glowRef.current.style.opacity = String(g)
      }
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
    <section ref={sectionRef} aria-label="Story: a job seeker checks a company on SafeApply before applying" className="relative h-[520vh] -mt-16">
      <style>{'@keyframes sa-wheel{0%,100%{transform:translateY(0);opacity:1}50%{transform:translateY(10px);opacity:.2}}'}</style>
      <div className="sticky top-0 h-[100dvh] overflow-hidden flex flex-col items-center justify-center bg-ink pt-16">
        {/* Background: faint grid + a green glow that wakes with the idea */}
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
        <div
          ref={glowRef}
          aria-hidden
          className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none"
          style={{ opacity: 0, background: 'radial-gradient(closest-side, var(--c-accent), transparent)' }}
        />

        {/* The scene. transform-origin = centre of the laptop screen. */}
        <div
          ref={sceneRef}
          className="relative w-[min(1040px,135vw,110dvh)] aspect-[8/5] shrink-0 will-change-transform"
          style={{ transformOrigin: '68.75% 64.8%' }}
        >
          <StoryScene phase={phase} typed={typed} className="w-full h-full" />
        </div>

        {/* Caption */}
        <div className="relative h-16 mt-2 w-full flex justify-center px-6 pointer-events-none" aria-live="polite">
          <AnimatePresence mode="wait">
            {CAPTION[phase] && (
              <motion.p
                key={phase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="text-center text-lg sm:text-2xl font-semibold tracking-tight text-fg max-w-[28ch]"
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

        {/* Story progress */}
        <div aria-hidden className="absolute left-1/2 -translate-x-1/2 bottom-[5vh] w-32 h-[2px] rounded-full bg-line overflow-hidden">
          <div ref={barRef} className="h-full w-full bg-accent origin-left" style={{ transform: 'scaleX(0)' }} />
        </div>

        {/* Scroll hint */}
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
