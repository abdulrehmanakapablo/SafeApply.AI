// FILE: src/components/ui/Logo.tsx
// PURPOSE: Brand wordmark as inline SVG. `mark` renders the shield only.

interface LogoProps {
  className?: string
  mark?: boolean
}

export default function Logo({ className = 'h-8 w-auto', mark = false }: LogoProps) {
  if (mark) {
    return (
      <svg viewBox="0 0 32 32" fill="none" className={className} role="img" aria-label="SafeApply.AI">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--c-surface)" stroke="var(--c-accent)" strokeWidth="1.5" />
        <path
          d="M16 7L9 10.5V16.5C9 21.5 16 25 16 25C16 25 23 21.5 23 16.5V10.5L16 7Z"
          stroke="var(--c-accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="var(--c-accent)"
          fillOpacity="0.15"
        />
        <path d="M13.5 16L15.5 18L19 14" stroke="var(--c-accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 160 36" fill="none" className={className} role="img" aria-label="SafeApply.AI">
      <rect x="2" y="4" width="28" height="28" rx="7" fill="var(--c-surface)" stroke="var(--c-accent)" strokeWidth="1.5" />
      <path
        d="M16 9L9 12.5V18.5C9 23.5 16 27 16 27C16 27 23 23.5 23 18.5V12.5L16 9Z"
        stroke="var(--c-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="var(--c-accent)"
        fillOpacity="0.15"
      />
      <path d="M13.5 18L15.5 20L19 16" stroke="var(--c-accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <text x="38" y="24" fill="var(--c-fg)" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="18" letterSpacing="-0.5px">
        SafeApply<tspan fill="var(--c-accent)">.AI</tspan>
      </text>
    </svg>
  )
}
