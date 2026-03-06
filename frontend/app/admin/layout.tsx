import type { Metadata } from 'next'
import AdminFooter from '@/components/AdminFooter'

export const metadata: Metadata = {
  title: 'Admin – SwapSmith',
  description: 'SwapSmith Platform Administration',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#09090b' }}>
      <div style={{ flex: 1 }}>{children}</div>
      <AdminFooter />
    </div>
  )
}
