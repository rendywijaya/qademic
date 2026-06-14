import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface ProfileRow {
  id: string
  full_name: string | null
  username: string | null
  created_at: string
  is_admin: boolean | null
}

export default async function AdminUsersPage() {
  let users: ProfileRow[] = []
  let configError = false

  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('id, full_name, username, created_at, is_admin')
      .order('created_at', { ascending: false })
      .limit(100)
    users = (data ?? []) as ProfileRow[]
  } catch {
    configError = true
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Page header */}
      <div>
        <h1
          className="text-2xl font-black"
          style={{ fontFamily: 'var(--font-bricolage)', color: 'var(--text)' }}
        >
          Users
        </h1>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
          {configError ? 'SERVICE ROLE KEY REQUIRED' : `${users.length} users · READ-ONLY`}
        </p>
      </div>

      {configError && (
        <div
          className="border rounded-xl px-4 py-3 text-sm"
          style={{
            borderColor: 'rgba(248,113,113,0.25)',
            backgroundColor: 'rgba(248,113,113,0.06)',
            color: 'var(--negative)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          SUPABASE_SERVICE_ROLE_KEY not configured. Set this environment variable to access user data.
        </div>
      )}

      <div
        className="border rounded-xl overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div
          className="grid px-4 py-2.5 border-b"
          style={{
            gridTemplateColumns: '1fr 160px 160px 80px',
            borderColor: 'var(--border)',
            backgroundColor: 'var(--surface)',
          }}
        >
          {(['NAME', 'USERNAME', 'JOINED', 'ROLE'] as const).map(col => (
            <span
              key={col}
              className="text-[10px] uppercase tracking-[0.10em]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-ghost)' }}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Rows */}
        {users.length === 0 ? (
          <div
            className="px-4 py-10 text-center text-sm"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {configError ? 'Configure service role key to view users' : 'No users found'}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {users.map(user => (
              <div
                key={user.id}
                className="grid px-4 py-3 items-center"
                style={{ gridTemplateColumns: '1fr 160px 160px 80px' }}
                onMouseEnter={undefined}
              >
                {/* Name */}
                <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {user.full_name ?? 'Anonymous'}
                </span>

                {/* Username */}
                <span
                  className="text-[11px] tabular-nums truncate"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                >
                  {user.username ? `@${user.username}` : '—'}
                </span>

                {/* Joined */}
                <span
                  className="text-[11px] tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                >
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>

                {/* Role badge */}
                {user.is_admin ? (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded w-fit"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--amber)',
                      backgroundColor: 'var(--amber-dim)',
                      border: '1px solid var(--amber-border)',
                    }}
                  >
                    ADMIN
                  </span>
                ) : (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded w-fit"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-ghost)',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border)',
                    }}
                  >
                    USER
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
