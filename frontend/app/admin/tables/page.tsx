'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { csrfFetch } from '@/hooks/useCsrfToken'
import { signOut } from 'firebase/auth'
import { AlertTriangle } from 'lucide-react'
import AdminNavbar from '@/components/AdminNavbar'
import AdminTableList from '@/components/AdminTableList'

interface AdminInfo { name: string; email: string; role: string }

export default function AdminTablesPage() {
  const router = useRouter()
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // ── Auth check (same pattern as dashboard/stats) ──────────────────────
  const checkAuth = useCallback(async () => {
    const user = auth?.currentUser
    if (!user) {
      router.replace('/admin/login')
      return
    }
    try {
      const token = await user.getIdToken()
      const res = await csrfFetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      })
      const data = await res.json()
      if (!data.isAdmin) {
        router.replace('/admin/login')
        return
      }
      setAdminInfo(data.admin)
    } catch {
      setAuthError('Authentication failed. Please log in again.')
    } finally {
      setAuthChecked(true)
    }
  }, [router])

  useEffect(() => {
    if (!auth) { router.replace('/admin/login'); return }
    const unsub = auth.onAuthStateChanged(user => {
      if (!user) { router.replace('/admin/login'); return }
      checkAuth()
    })
    return unsub
  }, [checkAuth, router])

  const handleLogout = async () => {
    if (auth) await signOut(auth)
    router.replace('/admin/login')
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#52525b', fontSize: 14 }}>Authenticating...</div>
      </div>
    )
  }

  if (authError) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f87171' }}>
          <AlertTriangle size={18} />{authError}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e4e7' }}>
      <AdminNavbar
        activePage="tables"
        adminInfo={adminInfo}
        onLogout={handleLogout}
      />
      <main className="admin-content" style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 32px' }}>
        <AdminTableList />
      </main>
    </div>
  )
}
