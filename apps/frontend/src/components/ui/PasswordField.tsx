// FILE: src/components/ui/PasswordField.tsx
// PURPOSE: Password input with show/hide toggle and an optional live
//          requirements checklist (signup / reset / change password).

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Field, Icon, cn } from './index'

export const PASSWORD_RULES = [
  { label: '8+ characters', test: (pw: string) => pw.length >= 8 },
  { label: 'Uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
  { label: 'Number or symbol', test: (pw: string) => /[^A-Za-z]/.test(pw) },
]

export function passwordOk(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw))
}

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  hint?: string
  showRules?: boolean
  labelAction?: ReactNode
}

export const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(
  { showRules, value, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false)
  const pw = typeof value === 'string' ? value : ''
  return (
    <div className="flex flex-col gap-2">
      <Field
        ref={ref}
        type={visible ? 'text' : 'password'}
        value={value}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-muted hover:text-fg transition-colors"
          >
            <Icon name={visible ? 'visibility_off' : 'visibility'} className="text-[18px]" />
          </button>
        }
        {...rest}
      />
      {showRules && pw.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5" aria-label="Password requirements">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(pw)
            return (
              <li key={r.label} className={cn('flex items-center gap-1.5 text-xs transition-colors', ok ? 'text-accent' : 'text-muted')}>
                <Icon name={ok ? 'check_circle' : 'radio_button_unchecked'} fill={ok} className="text-[14px]" />
                {r.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})
