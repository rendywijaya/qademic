import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LayoutDashboard, Users, Cpu, Shield } from 'lucide-react'

export const metadata = { title: 'Admin — Qademic' }

const adminNav = [
  { href: '/admin',            label: 'Overview',    icon: LayoutDashboard, exact: true },
  { href: '/admin/users',      label: 'Users',       icon: Users },
  { href: '/admin/ai-usage',   label: 'AI Usage',    icon: Cpu },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check is_admin — if column doesn't exist, catch and redirect
  let isAdmin = false
  try {
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = (data as { is_admin?: boolean } | null)?.is_admin ?? false
  } catch {
    isAdmin = false
  }

  if (!isAdmin) redirect('/dashboard')

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Admin sidebar */}
      <aside
        className="w-56 h-screen fixed left-0 top-0 flex flex-col border-r z-30"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Logo area */}
        <div
          className="flex items-center gap-2.5 px-4 h-14 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--amber-dim)', border: '1px solid var(--amber-border)' }}
          >
            <Shield className="w-3.5 h-3.5" style={{ color: 'var(--amber)' }} />
          </div>
          <span
            className="text-sm font-bold"
            style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
          >
            Admin
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div
            className="px-2 mb-3 text-[10px] uppercase tracking-[0.14em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
          >
            ADMIN PANEL
          </div>
          {adminNav.map(item => (
            <AdminNavLink key={item.href} {...item} />
          ))}
        </nav>

        {/* Back to app */}
        <div className="px-3 py-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--text-dim)' }}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" style={{ color: 'var(--text-ghost)' }} />
            <span>Back to App</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 min-h-screen p-6 lg:p-8" style={{ backgroundColor: 'var(--bg)' }}>
        {children}
      </main>
    </div>
  )
}

// Client nav link handles active state via data attribute — kept server-renderable
function AdminNavLink({ href, label, icon: Icon, exact }: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  exact?: boolean
}) {
  // We use a simple Link; active styling handled client-side is fine here since
  // server-rendering will have no active state. For simplicity we'll leave it static.
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
      style={{ color: 'var(--text-dim)' }}
    >
      <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--text-ghost)' }} />
      <span>{label}</span>
    </Link>
  )
}
