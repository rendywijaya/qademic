import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('shimmer rounded-lg bg-[#131929]', className)} />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-[#131929] border border-[#1E2D4A] rounded-xl p-5 space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}
