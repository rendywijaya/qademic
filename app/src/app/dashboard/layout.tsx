import Sidebar from '@/components/layout/sidebar'
import Topbar, { DashboardTopbar } from '@/components/layout/topbar'
import BottomNav from '@/components/layout/bottom-nav'
import MarketBar from '@/components/dashboard/market-bar'
import { DISCLAIMER } from '@/lib/grades'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen th-bg dot-grid" style={{ backgroundSize: '24px 24px' }}>
      {/* Sidebar (desktop) */}
      <Sidebar />

      {/* Mobile topbar */}
      <Topbar />

      {/* Desktop topbar */}
      <DashboardTopbar />

      {/* Market ticker bar */}
      <div className="fixed top-14 left-0 lg:left-64 right-0 z-20">
        <MarketBar />
      </div>

      {/* Main content */}
      <main className="lg:pl-64 pt-14 pb-16 lg:pb-0">
        {/* Market bar spacer */}
        <div className="h-9" />
        <div className="min-h-[calc(100vh-5.75rem)] p-4 md:p-6 lg:p-8">
          {children}
        </div>
        <p className="px-4 md:px-6 lg:px-8 pb-6 text-[10px] leading-relaxed max-w-3xl" style={{ color: '#4B5563' }}>
          {DISCLAIMER}
        </p>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
