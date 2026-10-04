// FILE: src/components/ui/ThemeToggle.tsx
import { Icon, cn } from './index'
import { useTheme } from '../../lib/theme'

export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, toggle] = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn('w-9 h-9 inline-flex items-center justify-center rounded-[8px] text-muted hover:text-fg hover:bg-line transition-colors active:scale-95', className)}
    >
      <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-[20px]" />
    </button>
  )
}
