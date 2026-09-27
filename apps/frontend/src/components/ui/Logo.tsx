// FILE: src/components/ui/Logo.tsx
// PURPOSE: SVG logo used everywhere — no external image needed

interface LogoProps {
  className?: string
}

export default function Logo({ className = 'h-9 w-auto' }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 36"
      fill="none"
      className={className}
    >
      <rect x="2" y="4" width="28" height="28" rx="6" fill="#0D0D0D" stroke="#22C55E" strokeWidth="1.5" />
      <path
        d="M16 9L9 12.5V18.5C9 23.5 16 27 16 27C16 27 23 23.5 23 18.5V12.5L16 9Z"
        stroke="#22C55E"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#22C55E"
        fillOpacity="0.15"
      />
      <path
        d="M13.5 18L15.5 20L19 16"
        stroke="#22C55E"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="38"
        y="24"
        fill="#FFFFFF"
        fontFamily="Inter, sans-serif"
        fontWeight="800"
        fontSize="18"
        letterSpacing="-0.5px"
      >
        SafeApply<tspan fill="#22C55E">.AI</tspan>
      </text>
    </svg>
  )
}
