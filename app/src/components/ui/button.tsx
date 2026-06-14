'use client'

import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/40 focus:ring-offset-1 focus:ring-offset-transparent cursor-pointer select-none'

    const variants = {
      primary:
        'bg-[#F59E0B] hover:bg-[#FBBF24] text-[#050810] shadow-sm shadow-[#F59E0B]/20 active:scale-[0.98]',
      secondary:
        'border border-[var(--border)] hover:border-[rgba(245,158,11,0.3)] hover:bg-[var(--surface-2)] text-[var(--text)] bg-transparent',
      ghost:
        'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]',
      danger:
        'bg-[#F87171] hover:bg-red-400 text-[#050810] shadow-sm shadow-red-500/20 active:scale-[0.98]',
      outline:
        'border border-[rgba(245,158,11,0.3)] text-[#F59E0B] hover:bg-[rgba(245,158,11,0.08)]',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm h-8',
      md: 'px-4 py-2 text-sm h-10',
      lg: 'px-6 py-3 text-base h-12',
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
