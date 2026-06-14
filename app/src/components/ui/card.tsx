import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  glow?: boolean
}

export function Card({ className, hover, glow, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-transparent border border-[var(--border)] rounded-lg',
        hover && 'card-hover cursor-pointer transition-all duration-200',
        glow && 'shadow-lg shadow-[#F59E0B]/5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 pb-0', className)} {...props}>
      {children}
    </div>
  )
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 pb-5 pt-0', className)} {...props}>
      {children}
    </div>
  )
}
