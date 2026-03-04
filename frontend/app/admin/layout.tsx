import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin – SwapSmith',
  description: 'SwapSmith Platform Administration',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
