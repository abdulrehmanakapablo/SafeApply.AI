// FILE: src/components/ui/index.tsx
// PURPOSE: Shared UI primitives. Every page builds from these so spacing,
//          radii, focus states and colours stay identical across the app.
//          Tokens live in index.css (@theme): ink, surface, line, accent,
//          accent-hover, fg, muted, danger, warn.

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// ─── Utils ───────────────────────────────────────────────
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function formatDate(iso: string | null | undefined, withYear = true): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

export function relativeDays(iso: string | null | undefined): string {
  if (!iso) return '-'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '-'
  const d = Math.max(0, Math.round((Date.now() - then) / 86_400_000))
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d} days ago`
  if (d < 30) return `${Math.floor(d / 7)} wk ago`
  if (d < 365) return `${Math.floor(d / 30)} mo ago`
  return `${Math.floor(d / 365)} yr ago`
}

export function initialsOf(name: string | null | undefined, fallback = '?'): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return fallback
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

// ─── Icon ────────────────────────────────────────────────
export function Icon({
  name,
  className,
  fill,
  label,
}: {
  name: string
  className?: string
  fill?: boolean
  label?: string
}) {
  return (
    <span
      className={cn('material-symbols-outlined', fill && 'icon-fill', className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {name}
    </span>
  )
}

// ─── Buttons ─────────────────────────────────────────────
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-ink hover:bg-accent-hover disabled:hover:bg-accent',
  secondary: 'bg-surface text-fg border border-line hover:border-muted/60',
  ghost: 'text-muted hover:text-fg hover:bg-line/60',
  danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-sm gap-2',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(
    'inline-flex items-center justify-center rounded-[var(--radius-btn)] font-semibold whitespace-nowrap select-none',
    'transition-[background-color,border-color,color,transform] duration-150 ease-out',
    'active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
    VARIANT[variant],
    SIZE[size],
    extra,
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: string
  iconRight?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const iconSize = size === 'sm' ? 'text-[16px]' : 'text-[18px]'
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading ? (
        <Icon name="progress_activity" className={cn(iconSize, 'animate-spin')} />
      ) : (
        icon && <Icon name={icon} className={iconSize} />
      )}
      {children}
      {!loading && iconRight && <Icon name={iconRight} className={iconSize} />}
    </button>
  )
})

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: string; iconRight?: string }) {
  const iconSize = size === 'sm' ? 'text-[16px]' : 'text-[18px]'
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} className={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} className={iconSize} />}
    </Link>
  )
}

// ─── Form fields ─────────────────────────────────────────
const inputBase =
  'w-full bg-ink text-fg text-sm rounded-[var(--radius-input)] border px-3 placeholder:text-muted/80 ' +
  'transition-colors duration-150 focus:outline-none focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed'

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  optional,
  children,
  className,
  labelAction,
}: {
  id: string
  label?: string
  hint?: string
  error?: string
  required?: boolean
  optional?: boolean
  children: ReactNode
  className?: string
  labelAction?: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-0', className)}>
      {(label || labelAction) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={id} className="text-[13px] font-medium text-fg">
              {label}
              {required && <span className="text-accent ml-0.5" aria-hidden>*</span>}
              {optional && <span className="text-muted font-normal ml-1.5">Optional</span>}
            </label>
          )}
          {labelAction}
        </div>
      )}
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  optional?: boolean
  wrapClassName?: string
  labelAction?: ReactNode
  trailing?: ReactNode
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, optional, required, id, className, wrapClassName, labelAction, trailing, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id || auto
  return (
    <FieldShell
      id={fid}
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      className={wrapClassName}
      labelAction={labelAction}
    >
      <div className="relative">
        <input
          ref={ref}
          id={fid}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
          className={cn(inputBase, 'h-11', trailing ? 'pr-11' : '', error ? 'border-danger' : 'border-line', className)}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{trailing}</div>}
      </div>
    </FieldShell>
  )
})

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  optional?: boolean
  wrapClassName?: string
  labelAction?: ReactNode
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, optional, required, id, className, wrapClassName, labelAction, rows = 4, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id || auto
  return (
    <FieldShell
      id={fid}
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      className={wrapClassName}
      labelAction={labelAction}
    >
      <textarea
        ref={ref}
        id={fid}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        className={cn(inputBase, 'py-2.5 leading-relaxed resize-y', error ? 'border-danger' : 'border-line', className)}
        {...rest}
      />
    </FieldShell>
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  optional?: boolean
  wrapClassName?: string
  options: Array<{ value: string; label: string }>
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, optional, required, id, className, wrapClassName, options, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id || auto
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required} optional={optional} className={wrapClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={fid}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(inputBase, 'h-11 appearance-none pr-9 cursor-pointer', error ? 'border-danger' : 'border-line', className)}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-surface">
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-muted" />
      </div>
    </FieldShell>
  )
})

// ─── Surfaces ────────────────────────────────────────────
export function Card({
  children,
  className,
  as: As = 'section',
  padded = true,
  ...rest
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article' | 'aside'
  padded?: boolean
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  return (
    <As className={cn('bg-surface border border-line rounded-[var(--radius-card)]', padded && 'p-5 sm:p-6', className)} {...rest}>
      {children}
    </As>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-5', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {description && <p className="text-[13px] text-muted mt-1 leading-relaxed">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg transition-colors mb-3"
          >
            <Icon name="arrow_back" className="text-[16px]" />
            {back.label}
          </Link>
        )}
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-fg leading-tight">{title}</h1>
        {description && <p className="text-sm text-muted mt-1.5 max-w-[65ch] leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  )
}

export function PageContainer({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return (
    <div className={cn('w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-20 flex flex-col gap-6', narrow ? 'max-w-3xl' : 'max-w-7xl', className)}>
      {children}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: string
  title: string
  body?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center text-center py-14 px-6', className)}>
      <div className="w-12 h-12 rounded-[12px] bg-line/60 flex items-center justify-center mb-4">
        <Icon name={icon} className="text-[24px] text-muted" />
      </div>
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      {body && <p className="text-sm text-muted mt-1.5 max-w-sm leading-relaxed">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-[6px]', className)} aria-hidden />
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-[8px]" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

type Tone = 'neutral' | 'accent' | 'warn' | 'danger'
const TONE: Record<Tone, string> = {
  neutral: 'bg-line text-muted',
  accent: 'bg-accent/10 text-accent',
  warn: 'bg-warn/10 text-warn',
  danger: 'bg-danger/10 text-danger',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap', TONE[tone], className)}>
      {children}
    </span>
  )
}

export function Alert({
  tone = 'danger',
  title,
  children,
  className,
}: {
  tone?: Exclude<Tone, 'neutral'>
  title?: string
  children: ReactNode
  className?: string
}) {
  const icon = tone === 'danger' ? 'error' : tone === 'warn' ? 'warning' : 'check_circle'
  const color = tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-accent'
  const border = tone === 'danger' ? 'border-danger/30 bg-danger/5' : tone === 'warn' ? 'border-warn/30 bg-warn/5' : 'border-accent/30 bg-accent/5'
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-2.5 rounded-[10px] border p-3', border, className)}>
      <Icon name={icon} className={cn('text-[18px] shrink-0 mt-px', color)} />
      <div className="min-w-0 text-[13px] leading-relaxed">
        {title && <p className="font-semibold text-fg">{title}</p>}
        <div className="text-muted">{children}</div>
      </div>
    </div>
  )
}

// ─── Application status (shared by Dashboard / Tracker / Detail) ───
export const APPLICATION_STATUSES = ['saved', 'applied', 'screening', 'interviewing', 'offered', 'rejected', 'ghosted'] as const
export type AppStatus = (typeof APPLICATION_STATUSES)[number]

export const STATUS_META: Record<AppStatus, { label: string; tone: Tone }> = {
  saved: { label: 'Saved', tone: 'neutral' },
  applied: { label: 'Applied', tone: 'accent' },
  screening: { label: 'Screening', tone: 'warn' },
  interviewing: { label: 'Interviewing', tone: 'warn' },
  offered: { label: 'Offer', tone: 'accent' },
  rejected: { label: 'Rejected', tone: 'danger' },
  ghosted: { label: 'No reply', tone: 'neutral' },
}

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as AppStatus] || STATUS_META.saved
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

// ─── Pagination ──────────────────────────────────────────
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
      <Button variant="secondary" size="sm" icon="chevron_left" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <span className="text-xs text-muted tabular px-2">
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" size="sm" iconRight="chevron_right" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </nav>
  )
}

// ─── Dialog (focus-trapped, Escape closes, motion-aware) ───
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const reduce = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Latest onClose without re-running the focus effect. Parents usually pass
  // an inline arrow, which is a new function every render; if it were an
  // effect dependency, every keystroke would re-focus the first field.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button:not([data-dialog-close]), a[href]',
      )
      ;(first || panelRef.current)?.focus()
    }, 30)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
        )
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [open])

  const width = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.16 }}
        >
          <div className="absolute inset-0 bg-ink/75 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
              'relative w-full bg-surface border border-line sm:rounded-[var(--radius-card)] rounded-t-[var(--radius-card)] flex flex-col max-h-[88dvh] focus:outline-none',
              width,
            )}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="flex items-start justify-between gap-4 p-5 pb-0">
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-semibold text-fg">
                  {title}
                </h2>
                {description && <p className="text-[13px] text-muted mt-1 leading-relaxed">{description}</p>}
              </div>
              <button
                type="button"
                data-dialog-close
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 -mr-1 -mt-1 rounded-[8px] flex items-center justify-center text-muted hover:text-fg hover:bg-line transition-colors"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            {children && <div className="p-5 overflow-y-auto">{children}</div>}
            {footer && <div className="flex flex-wrap justify-end gap-2 p-5 pt-0">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Delete',
  loading,
  tone = 'danger',
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body?: ReactNode
  confirmLabel?: string
  loading?: boolean
  tone?: 'danger' | 'primary'
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={body}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}

// ─── Tabs (segmented) ────────────────────────────────────
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
  label,
}: {
  value: T
  onChange: (v: T) => void
  items: Array<{ value: T; label: string; icon?: string; count?: number; disabled?: boolean }>
  className?: string
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex p-1 gap-1 bg-surface border border-line rounded-[10px] max-w-full overflow-x-auto', className)}>
      {items.map((it) => {
        const active = it.value === value
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={it.disabled}
            onClick={() => onChange(it.value)}
            className={cn(
              'relative h-8 px-3 rounded-[7px] text-[13px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors',
              active ? 'bg-line text-fg' : 'text-muted hover:text-fg',
              it.disabled && 'opacity-40 cursor-not-allowed hover:text-muted',
            )}
          >
            {it.icon && <Icon name={it.icon} className="text-[16px]" />}
            {it.label}
            {typeof it.count === 'number' && <span className="text-[11px] text-muted tabular">{it.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ─── Stat (plain number + label, no decorative tracks) ───
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-0', className)}>
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[28px] font-semibold text-fg tabular leading-none tracking-tight">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  )
}

export function QuotaMeter({ used, limit, label }: { used: number; limit: number | null; label: string }) {
  if (limit === null || !Number.isFinite(limit)) {
    return (
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-muted">{label}</span>
        <span className="text-fg tabular">{used} used</span>
      </div>
    )
  }
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100))
  const tone = pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warn' : 'bg-accent'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-muted">{label}</span>
        <span className="text-fg tabular">
          {used}
          <span className="text-muted"> / {limit}</span>
        </span>
      </div>
      <div
        className="h-1 w-full rounded-full overflow-hidden bg-line"
        role="progressbar"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
      >
        <div
          className={cn('h-full w-full rounded-full origin-left transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]', tone)}
          style={{ transform: `scaleX(${Math.max(pct, used > 0 ? 3 : 0) / 100})` }}
        />
      </div>
    </div>
  )
}
