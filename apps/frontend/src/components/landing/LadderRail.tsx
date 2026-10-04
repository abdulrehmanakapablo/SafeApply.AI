// FILE: src/components/landing/LadderRail.tsx
// PURPOSE: After the opening story, the same man climbs down a ladder on the
//          right edge of the page while you scroll, from the top of the
//          landing content to the bottom, saying something about each
//          section (data-bubble="…") on the way. All screen sizes.
//
// Scroll is read from the browser directly (scroll listener + rAF) and the
// figure is moved / posed by writing to refs: no React re-render per frame,
// no dependency on framer-motion's scroll hooks.

import { useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))

function useActiveBubble(): string {
  const [text, setText] = useState('')
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-bubble]'))
    if (nodes.length === 0) return
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (hit) setText((hit.target as HTMLElement).dataset.bubble || '')
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])
  return text
}

// Limb paths for the climber (back view). s ∈ [-1, 1] swaps hands/feet.
const limb = {
  handL: (s: number) => `M22 34 Q16 26 14 ${14 + s * 6}`,
  handR: (s: number) => `M38 34 Q44 26 46 ${14 - s * 6}`,
  footL: (s: number) => `M25 66 Q20 76 14 ${86 - s * 6}`,
  footR: (s: number) => `M35 66 Q40 76 46 ${86 + s * 6}`,
}

export default function LadderRail({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
  const bubble = useActiveBubble()
  const railRef = useRef<HTMLDivElement>(null)
  const rungsRef = useRef<HTMLDivElement>(null)
  const manRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const hl = useRef<SVGPathElement>(null)
  const hr = useRef<SVGPathElement>(null)
  const fl = useRef<SVGPathElement>(null)
  const fr = useRef<SVGPathElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    let raf = 0
    let current = 0 // smoothed progress
    let target = 0

    const read = () => {
      const el = targetRef.current
      if (!el) return 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const start = vh * 0.85 // begins as the content comes into view
      const total = r.height - vh + start
      return total > 0 ? clamp((start - r.top) / total) : 0
    }

    const frame = () => {
      raf = 0
      target = read()
      current += (target - current) * 0.18
      if (Math.abs(target - current) < 0.0005) current = target

      const railH = railRef.current?.clientHeight ?? 600
      const manH = manRef.current?.offsetHeight ?? 90
      const y = current * Math.max(0, railH - manH - 8)
      if (manRef.current) manRef.current.style.transform = `translateY(${y}px)`

      const sy = window.scrollY
      const s = Math.sin(sy / 30)
      hl.current?.setAttribute('d', limb.handL(s))
      hr.current?.setAttribute('d', limb.handR(s))
      fl.current?.setAttribute('d', limb.footL(s))
      fr.current?.setAttribute('d', limb.footR(s))
      if (svgRef.current) svgRef.current.style.transform = `translateY(${Math.abs(s) * 1.5}px)`
      if (rungsRef.current) rungsRef.current.style.backgroundPosition = `0px ${-((sy * 0.6) % 28)}px`

      const visible = target > 0.005 && target < 0.995
      if (railRef.current) railRef.current.style.opacity = visible ? '1' : '0'
      setShown((v) => (v === visible ? v : visible))

      if (current !== target) raf = requestAnimationFrame(frame)
    }

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }
    kick()
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    return () => {
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [targetRef])

  return (
    <div
      ref={railRef}
      aria-hidden
      style={{ opacity: 0 }}
      className="fixed top-16 bottom-2 right-1 sm:right-3 xl:right-6 2xl:right-10 w-9 sm:w-14 z-20 pointer-events-none transition-opacity duration-300"
    >
      {/* Ladder: two rails + rungs that slide as you scroll */}
      <div className="absolute inset-y-0 left-1.5 sm:left-2.5 w-[2px] bg-muted/40 rounded-full" />
      <div className="absolute inset-y-0 right-1.5 sm:right-2.5 w-[2px] bg-muted/40 rounded-full" />
      <div
        ref={rungsRef}
        className="absolute inset-y-0 left-1.5 right-1.5 sm:left-2.5 sm:right-2.5"
        style={{ backgroundImage: 'linear-gradient(to bottom, rgba(115,115,115,0.4) 0 2px, transparent 2px 28px)', backgroundSize: '100% 28px' }}
      />

      <div ref={manRef} className="absolute left-0 right-0 top-0 will-change-transform">
        <AnimatePresence mode="wait">
          {shown && bubble && (
            <motion.div
              key={bubble}
              className="hidden md:block absolute right-[calc(100%+10px)] top-1 w-max max-w-[200px] rounded-[12px] rounded-tr-[4px] bg-surface border border-line px-3 py-2 text-[13px] text-fg shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
              initial={{ opacity: 0, x: 8, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 4, scale: 0.98, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              {bubble}
            </motion.div>
          )}
        </AnimatePresence>

        {/* The man, seen from behind, hands and feet on the rungs */}
        <svg ref={svgRef} viewBox="0 0 60 96" className="w-9 h-[58px] sm:w-14 sm:h-[90px]">
          {[hl, hr, fl, fr].map((r, i) => (
            <path
              key={i}
              ref={r}
              d={[limb.handL, limb.handR, limb.footL, limb.footR][i](0)}
              stroke="var(--c-fg)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          <path d="M20 32 Q30 26 40 32 L42 66 L18 66 Z" fill="var(--c-surface)" stroke="var(--c-fg)" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="30" cy="18" r="10" fill="var(--c-fg)" />
          <path d="M24 48 h12" stroke="var(--c-accent)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
