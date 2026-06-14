import { redirect } from 'next/navigation'

// Absorbed into Portfolio & Risk (QADEMIC.md §8). Old route kept as a redirect
// so existing links and bookmarks still land somewhere useful.
export default function RiskMonitorPage() {
  redirect('/dashboard/portfolio')
}
