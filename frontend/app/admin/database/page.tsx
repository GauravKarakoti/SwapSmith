'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Database, Terminal } from 'lucide-react'
import AdminNavbar from '@/components/AdminNavbar'
import AdminTableList from '@/components/AdminTableList'

interface AdminInfo { name: string; email: string; role: string }

export default function AdminDatabasePage() {
  const router = useRouter()
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const token = useRef<string | null>(null)

  // ── Auth check ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = sessionStorage.getItem('admin-token')
    if (!t) {
      router.push('/admin/login')
      return
    }
    token.current = t
    const cached = sessionStorage.getItem('admin-info')
    if (cached) {
      try { setAdminInfo(JSON.parse(cached)) } catch { /* ignore malformed cache */ }
    }
    setAuthChecked(true)
  }, [router])

  const handleLogout = () => {
    sessionStorage.removeItem('admin-token')
    sessionStorage.removeItem('admin-info')
    router.push('/admin/login')
  }

  // ── Guard: don't render until auth is confirmed ───────────────────────
  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh', background: '#09090b',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: '#52525b', fontSize: 14 }}>Verifying access…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e4e7' }}>
      <AdminNavbar
        activePage="database"
        adminInfo={adminInfo}
        onLogout={handleLogout}
      />

      <main
        className="admin-content"
        style={{ padding: '32px 40px', maxWidth: 1600, margin: '0 auto' }}
      >
        {/* ── Page header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          marginBottom: 28, paddingBottom: 24,
          borderBottom: '1px solid #18182a',
        }}>
          <div style={{ background: '#1e3a5f', borderRadius: 10, padding: 10 }}>
            <Database size={22} style={{ color: '#93c5fd' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e4e4e7', margin: 0 }}>
              Database Explorer
            </h1>
            <p style={{ fontSize: 13, color: '#52525b', margin: '4px 0 0' }}>
              Browse Neon Postgres tables, inspect metadata, and export data as CSV
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => router.push('/admin/sql')}
              style={{
                background: '#1a1a2e', border: '1px solid #7c3aed55',
                color: '#c4b5fd', borderRadius: 8, fontSize: 12, fontWeight: 600,
                padding: '6px 14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Terminal size={13} /> SQL Terminal
            </button>
            <span style={{
              background: '#14532d22', border: '1px solid #16a34a44',
              color: '#4ade80', borderRadius: 20, fontSize: 11,
              padding: '3px 12px', fontWeight: 600,
            }}>
              READ-ONLY
            </span>
            <span style={{
              background: '#1e3a5f22', border: '1px solid #2563eb44',
              color: '#93c5fd', borderRadius: 20, fontSize: 11,
              padding: '3px 12px', fontWeight: 600,
            }}>
              ADMIN ONLY
            </span>
          </div>
        </div>

        {/* ── Main table explorer ── */}
        <AdminTableList />
      </main>
    </div>
  )
}
