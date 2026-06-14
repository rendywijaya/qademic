import { redirect } from 'next/navigation'

// Absorbed into Markets (QADEMIC.md §8). Kept as a redirect for existing links.
export default function SectorsPage() {
  redirect('/dashboard/markets')
}
