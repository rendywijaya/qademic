import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.12em] mb-1.5"
            style={{ fontFamily: 'var(--font-mono)' }}>
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg',
              'px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-ghost)]',
              'focus:outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]',
              'transition-all duration-150',
              icon && 'pl-10',
              error && 'border-[#F87171] focus:ring-[#F87171]',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-[#F87171]">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
