'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import {
  Users, Search, LogOut, RefreshCw, BarChart2,
  AlertTriangle, CheckCircle2, Ban, Flag, Eye,
  ChevronLeft, ChevronRight, ArrowLeftRight, Clock, X, Menu,
  ShieldAlert, ShieldOff, Unlock, Lock,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────

interface AdminUserRow {
  id: number
  firebaseUid: string | null
  walletAddress: string | null
  email: string | null
  plan: string
  totalPoints: number
  createdAt: string | null
  swapCount: number
  suspended: boolean
  flagged: boolean
  suspendedBy: string | null
  suspendedAt: string | null
  suspendReason: string | null
  flaggedBy: string | null
  flaggedAt: string | null
  flagReason: string | null
}

interface SwapEntry {
  id: number
  userId: string
  walletAddress: string | null
  sideshiftOrderId: string
  fromAsset: string
  fromNetwork: string
  fromAmount: number
  toAsset: string
  toNetwork: string
  settleAmount: string
  status: string
  txHash: string | null
  createdAt: string | null
}

interface AuditEntry {
  ts: string
  admin: string
  action: string
  target: string
  reason?: string
}

interface AdminInfo { name: string; email: string; role: string }

// ── Constants ─────────────────────────────────────────────────────────────

const PLAN_COLOR: Record<string, string> = {
  free:    '#52525b',
  premium: '#d97706',
  pro:     '#7c3aed',
}

const STATUS_COLOR: Record<string, string> = {
  settled:    '#16a34a',
  completed:  '#16a34a',
  pending:    '#d97706',
  processing: '#2563eb',
  failed:     '#dc2626',
}

// ── Small helpers ─────────────────────────────────────────────────────────

function badge(label: string, color: string) {
  return (
    <span style={{
      display: 'inline-block', background: `${color}22`, color,
      border: `1px solid ${color}44`, padding: '2px 10px',
      borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function truncate(s: string | null | undefined, n = 14) {
  if (!s) return '—'
  return s.length > n ? `${s.substring(0, n)}…` : s
}

function fmt(dt: string | null | undefined) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString()
}

// ── Swap history modal ──────────────────────────────────────────────────

function SwapHistoryModal({
  user, token, onClose,
}: { user: AdminUserRow; token: string; onClose: () => void }) {
  const [swaps, setSwaps]     = useState<SwapEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!user.firebaseUid) { setLoading(false); setError('No firebaseUid for this user.'); return }
    fetch(`/api/admin/users/${encodeURIComponent(user.firebaseUid)}/swaps?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setSwaps(d.swaps); else setError(d.error ?? 'Failed'); })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false))
  }, [user.firebaseUid, token])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: '#00000090',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#0f0f1a', border: '1px solid #27272a', borderRadius: 16,
        width: '100%', maxWidth: 860, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #18182a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              <ArrowLeftRight size={16} style={{ display: 'inline', marginRight: 8, color: '#2563eb', verticalAlign: 'middle' }} />
              Swap History
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#52525b' }}>
              User #{user.id} · {user.email ?? user.walletAddress ?? user.firebaseUid ?? 'unknown'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Connected chains summary */}
        {swaps.length > 0 && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #18182a', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#52525b' }}>Connected chains: </span>
            {[...new Set(swaps.flatMap(s => [s.fromNetwork, s.toNetwork]))].map(c => (
              <span key={c} style={{ display: 'inline-block', marginRight: 6, marginTop: 2, background: '#1e293b', color: '#93c5fd', border: '1px solid #2563eb33', borderRadius: 8, padding: '1px 8px', fontSize: 11 }}>
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Table */}
        <div style={{ overflowY: 'auto', padding: '0 24px 24px', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#52525b' }}>Loading…</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#f87171' }}>{error}</div>
          ) : swaps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#52525b' }}>No swaps found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  {['#', 'Order ID', 'From', 'To', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#52525b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {swaps.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: i < swaps.length - 1 ? '1px solid #18182a' : 'none' }}>
                    <td style={{ padding: '9px 10px', color: '#52525b' }}>#{s.id}</td>
                    <td style={{ padding: '9px 10px', color: '#a1a1aa', fontFamily: 'monospace', fontSize: 11 }} title={s.sideshiftOrderId}>
                      {truncate(s.sideshiftOrderId, 16)}
                    </td>
                    <td style={{ padding: '9px 10px', color: '#e4e4e7', fontWeight: 500 }}>
                      {s.fromAsset}<span style={{ color: '#52525b' }}> ({s.fromNetwork})</span>
                    </td>
                    <td style={{ padding: '9px 10px', color: '#e4e4e7', fontWeight: 500 }}>
                      {s.toAsset}<span style={{ color: '#52525b' }}> ({s.toNetwork})</span>
                    </td>
                    <td style={{ padding: '9px 10px', color: '#a1a1aa' }}>{s.fromAmount}</td>
                    <td style={{ padding: '9px 10px' }}>{badge(s.status, STATUS_COLOR[s.status] ?? '#71717a')}</td>
                    <td style={{ padding: '9px 10px', color: '#52525b', whiteSpace: 'nowrap' }}>{fmt(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Action modal (suspend / flag) ──────────────────────────────────────

function ActionModal({
  user, action, onConfirm, onClose,
}: {
  user: AdminUserRow
  action: 'suspend' | 'unsuspend' | 'flag' | 'unflag'
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const needsReason = action === 'suspend' || action === 'flag'

  const icons: Record<string, React.ReactNode> = {
    suspend:   <Lock   size={18} style={{ color: '#f59e0b' }} />,
    unsuspend: <Unlock size={18} style={{ color: '#16a34a' }} />,
    flag:      <Flag   size={18} style={{ color: '#dc2626' }} />,
    unflag:    <ShieldOff size={18} style={{ color: '#16a34a' }} />,
  }

  const labels: Record<string, string> = {
    suspend:   'Suspend User',
    unsuspend: 'Re-activate User',
    flag:      'Flag as High-Risk',
    unflag:    'Remove High-Risk Flag',
  }

  const colors: Record<string, string> = {
    suspend:   '#d97706',
    unsuspend: '#16a34a',
    flag:      '#dc2626',
    unflag:    '#16a34a',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: '#00000099',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#0f0f1a', border: '1px solid #27272a', borderRadius: 14,
        width: '100%', maxWidth: 420, padding: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          {icons[action]}
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{labels[action]}</h3>
        </div>
        <p style={{ color: '#71717a', fontSize: 13, marginBottom: needsReason ? 16 : 24 }}>
          Target: <span style={{ color: '#e4e4e7', fontFamily: 'monospace', fontSize: 12 }}>
            {user.email ?? user.walletAddress ?? user.firebaseUid ?? `#${user.id}`}
          </span>
        </p>
        {needsReason && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 6 }}>
              Reason <span style={{ color: '#52525b' }}>(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={`Reason for ${action}…`}
              rows={3}
              style={{
                width: '100%', background: '#18181b', border: '1px solid #27272a',
                borderRadius: 8, color: '#e4e4e7', fontSize: 13, padding: '10px 12px',
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
            borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13,
          }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(reason)} style={{
            background: `${colors[action]}22`, border: `1px solid ${colors[action]}66`,
            color: colors[action], borderRadius: 8, padding: '8px 18px',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            {labels[action]}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const router = useRouter()

  const [users, setUsers]           = useState<AdminUserRow[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [adminInfo, setAdminInfo]   = useState<AdminInfo | null>(null)
  const [token, setToken]           = useState('')

  // Modals
  const [viewUser, setViewUser]     = useState<AdminUserRow | null>(null)
  const [actionModal, setActionModal] = useState<{
    user: AdminUserRow
    action: 'suspend' | 'unsuspend' | 'flag' | 'unflag'
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg]   = useState('')

  // Audit log (session-local)
  const [auditLog, setAuditLog]     = useState<AuditEntry[]>([])

  const LIMIT = 20

  // ── Fetch users ──────────────────────────────────────────────────────

  const fetchUsers = useCallback(async (pg = page, q = search, tok = token) => {
    if (!tok) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(LIMIT) })
      if (q) params.set('search', q)
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (res.status === 401 || res.status === 403) { router.push('/admin/login'); return }
      const data = await res.json()
      if (data.success) {
        setUsers(data.users)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      } else {
        setError(data.error ?? 'Failed to load users.')
      }
    } catch {
      setError('Network error. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [page, search, token, router])

  // ── Bootstrap ────────────────────────────────────────────────────────

  useEffect(() => {
    const tok = sessionStorage.getItem('admin-token') ?? ''
    if (!tok) { router.push('/admin/login'); return }
    setToken(tok)

    const cached = sessionStorage.getItem('admin-info')
    if (cached) { try { setAdminInfo(JSON.parse(cached)) } catch {} }

    fetchUsers(1, '', tok)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Search submit ────────────────────────────────────────────────────

  const handleSearch = () => {
    const q = searchInput.trim()
    setSearch(q)
    setPage(1)
    fetchUsers(1, q, token)
  }

  // ── Page change ──────────────────────────────────────────────────────

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return
    setPage(p)
    fetchUsers(p, search, token)
  }

  // ── Action: suspend / flag ───────────────────────────────────────────

  const handleActionConfirm = async (reason: string) => {
    if (!actionModal) return
    setActionLoading(true)
    setActionMsg('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firebaseUid: actionModal.user.firebaseUid,
          action: actionModal.action,
          reason,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setActionMsg(`✅ ${data.message}`)
        // Add to audit log
        setAuditLog(prev => [{
          ts:     new Date().toLocaleString(),
          admin:  adminInfo?.email ?? 'admin',
          action: actionModal.action,
          target: actionModal.user.walletAddress ?? actionModal.user.firebaseUid ?? `#${actionModal.user.id}`,
          reason,
        }, ...prev].slice(0, 50))
        // Refresh table
        await fetchUsers(page, search, token)
        setTimeout(() => { setActionModal(null); setActionMsg('') }, 1200)
      } else {
        setActionMsg(`❌ ${data.error ?? 'Failed'}`)
      }
    } catch {
      setActionMsg('❌ Network error')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────

  const handleLogout = async () => {
    sessionStorage.removeItem('admin-token')
    sessionStorage.removeItem('admin-info')
    document.cookie = 'admin-session=; path=/; max-age=0; SameSite=Lax'
    if (auth) await signOut(auth)
    router.push('/admin/login')
  }
  // ── Mobile nav state ────────────────────────────────────────────────────

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // ── Derived stats ────────────────────────────────────────────────────

  const suspendedCount = users.filter(u => u.suspended).length
  const flaggedCount   = users.filter(u => u.flagged).length

  // ── Loading / error screens ──────────────────────────────────────────

  if (loading && users.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#070710', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#71717a' }}>Loading user management…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#070710', color: '#e4e4e7', fontFamily: 'inherit' }}>

      {/* ── Responsive styles ──────────────────────────────────── */}
      <style>{`
        .admin-nav-label    { display: inline; }
        .admin-nav-sep      { display: inline; }
        .admin-nav-hamburger{ display: none !important; }
        @media (max-width: 768px) {
          .admin-nav-label    { display: none !important; }
          .admin-nav-sep      { display: none !important; }
          .admin-nav-right    { display: none !important; }
          .admin-nav-hamburger{ display: flex !important; }
          .admin-nav          { padding: 10px 16px !important; }
          .admin-content      { padding: 16px 10px !important; }
          .admin-user-email   { font-size: 12px !important; }
          .admin-stats-grid   { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
        }
        @media (max-width: 480px) {
          .admin-stats-grid{ grid-template-columns: 1fr 1fr !important; }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* ── Navbar ── */}
      <nav className="admin-nav" style={{
        background: '#0b0b18', borderBottom: '1px solid #18182a',
        padding: '14px 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, gap: 8,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Image src="/swapsmithicon.png" alt="SwapSmith" width={36} height={36} style={{ borderRadius: 8 }} unoptimized />
          <span className="admin-nav-label" style={{ fontSize: 18, fontWeight: 700 }}>SwapSmith Admin</span>
          <span style={{ background: '#1e3a5f', color: '#93c5fd', border: '1px solid #2563eb44', borderRadius: 20, fontSize: 11, padding: '2px 10px', marginLeft: 4, fontWeight: 600 }}>
            {adminInfo?.role?.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {/* Desktop actions */}
        <div className="admin-nav-right" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button onClick={() => router.push('/admin/dashboard')} style={{
            background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer', display: 'flex',
            alignItems: 'center', gap: 6, fontSize: 13,
          }}>
            <BarChart2 size={14} /> Analytics
          </button>
          <button style={{
            background: '#1e1e40', border: '1px solid #2563eb55', color: '#93c5fd',
            borderRadius: 8, padding: '6px 14px', cursor: 'default', display: 'flex',
            alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
          }}>
            <Users size={14} /> Users
          </button>
          <span className="admin-nav-sep" style={{ color: '#27272a' }}>|</span>
          <span className="admin-nav-label" style={{ color: '#52525b', fontSize: 13 }}>{adminInfo?.name}</span>
          <button onClick={() => fetchUsers(page, search, token)} style={{
            background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
            borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex',
            alignItems: 'center', gap: 6, fontSize: 13,
          }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={handleLogout} style={{
            background: '#450a0a22', border: '1px solid #dc262644', color: '#f87171',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer', display: 'flex',
            alignItems: 'center', gap: 6, fontSize: 13,
          }}>
            <LogOut size={14} /> Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="admin-nav-hamburger"
          onClick={() => setMobileNavOpen(true)}
          style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', alignItems: 'center', gap: 6 }}
        >
          <Menu size={20} />
        </button>
      </nav>

      {/* ── Mobile drawer ── */}
      {mobileNavOpen && (
        <>
          <div
            onClick={() => setMobileNavOpen(false)}
            style={{ position: 'fixed', inset: 0, background: '#00000070', backdropFilter: 'blur(2px)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '80%', maxWidth: 300,
            background: '#0b0b18', borderLeft: '1px solid #1e1e2a', zIndex: 201,
            display: 'flex', flexDirection: 'column', padding: 24, gap: 8,
          }}>
            {/* Drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Image src="/swapsmithicon.png" alt="SwapSmith" width={32} height={32} style={{ borderRadius: 8 }} unoptimized />
                <span style={{ fontSize: 16, fontWeight: 700 }}>SwapSmith Admin</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            {/* Admin info */}
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
              <p style={{ color: '#71717a', fontSize: 12, margin: 0 }}>{adminInfo?.name}</p>
              <p style={{ color: '#52525b', fontSize: 11, margin: '2px 0 0' }}>{adminInfo?.email}</p>
            </div>
            {/* Nav buttons */}
            <button onClick={() => { setMobileNavOpen(false); router.push('/admin/dashboard'); }}
              style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <BarChart2 size={16} /> Analytics
            </button>
            <button
              style={{ background: '#1e1e40', border: '1px solid #2563eb55', color: '#93c5fd', borderRadius: 10, padding: '12px 16px', cursor: 'default', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
              <Users size={16} /> Users
            </button>
            <button onClick={() => { setMobileNavOpen(false); fetchUsers(page, search, token); }}
              style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <RefreshCw size={16} /> Refresh
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={() => { setMobileNavOpen(false); handleLogout(); }}
              style={{ background: '#450a0a22', border: '1px solid #dc262644', color: '#f87171', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </>
      )}

      <div className="admin-content" style={{ maxWidth: '100%', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Page title ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            <Users size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: '#2563eb' }} />
            User Management
          </h2>
          <p style={{ color: '#52525b', fontSize: 13, marginTop: 4 }}>
            Monitor, search, suspend, and flag registered users
          </p>
        </div>

        {/* ── Stats cards ─────────────────────────────────────────── */}
        <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 28 }}>
          {[
            { icon: Users,      label: 'Total Users (page)',  value: total,          color: '#2563eb' },
            { icon: CheckCircle2, label: 'Active (this page)', value: users.filter(u => !u.suspended && !u.flagged).length, color: '#16a34a' },
            { icon: Ban,        label: 'Suspended',           value: suspendedCount, color: '#d97706' },
            { icon: ShieldAlert, label: 'Flagged High-Risk',  value: flaggedCount,   color: '#dc2626' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ background: `${color}22`, borderRadius: 8, padding: 6 }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <span style={{ color: '#71717a', fontSize: 12 }}>{label}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#e4e4e7', lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Search bar ──────────────────────────────────────────── */}
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Search size={16} style={{ color: '#52525b', flexShrink: 0 }} />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by email, wallet address or Firebase UID…"
            style={{
              flex: 1, minWidth: 240, background: '#09090b', border: '1px solid #27272a',
              borderRadius: 8, color: '#e4e4e7', fontSize: 13, padding: '8px 12px',
              outline: 'none',
            }}
          />
          <button onClick={handleSearch} style={{
            background: '#2563eb', color: 'white', border: 'none',
            borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            Search
          </button>
          {search && (
            <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1); fetchUsers(1, '', token) }} style={{
              background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
              borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <X size={13} /> Clear
            </button>
          )}
          {search && (
            <span style={{ color: '#52525b', fontSize: 12 }}>
              Showing {total} result{total !== 1 ? 's' : ''} for &quot;{search}&quot;
            </span>
          )}
        </div>

        {/* ── Error ───────────────────────────────────────────────── */}
        {error && (
          <div style={{ background: '#450a0a33', border: '1px solid #dc262655', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#f87171', fontSize: 13 }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />{error}
          </div>
        )}

        {/* ── Users table ─────────────────────────────────────────── */}
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a', background: '#0f0f1a' }}>
                  {['#', 'Email / Wallet', 'Plan', 'Points', 'Swaps', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: '#52525b', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: '32px 14px', textAlign: 'center', color: '#52525b' }}>Loading…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '32px 14px', textAlign: 'center', color: '#52525b' }}>No users found.</td></tr>
                ) : users.map((u, i) => (
                  <tr key={u.id} style={{
                    borderBottom: i < users.length - 1 ? '1px solid #18182a' : 'none',
                    background: u.suspended ? '#290d0d' : u.flagged ? '#1a0d0d' : 'transparent',
                    transition: 'background 0.15s',
                  }}>
                    {/* ID */}
                    <td style={{ padding: '11px 14px', color: '#3f3f46', fontSize: 12 }}>#{u.id}</td>

                    {/* Email / Wallet */}
                    <td style={{ padding: '11px 14px', maxWidth: 220 }}>
                      {/* Gmail */}
                      {u.email && (
                        <div className="admin-user-email" style={{ color: '#e4e4e7', fontSize: 13, fontWeight: 500, marginBottom: u.walletAddress || u.firebaseUid ? 3 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={u.email}>
                          {u.email}
                        </div>
                      )}
                      {/* Wallet */}
                      {u.walletAddress && (
                        <div style={{ color: '#a1a1aa', fontFamily: 'monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={u.walletAddress}>
                          {truncate(u.walletAddress, 18)}
                        </div>
                      )}
                      {/* Firebase UID (only if no email and no wallet) */}
                      {!u.email && !u.walletAddress && u.firebaseUid && (
                        <div style={{ color: '#52525b', fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={u.firebaseUid}>
                          {truncate(u.firebaseUid, 20)}
                        </div>
                      )}
                      {!u.email && !u.walletAddress && !u.firebaseUid && (
                        <span style={{ color: '#52525b' }}>—</span>
                      )}
                    </td>

                    {/* Plan */}
                    <td style={{ padding: '11px 14px' }}>
                      {badge(u.plan, PLAN_COLOR[u.plan] ?? '#52525b')}
                    </td>

                    {/* Points */}
                    <td style={{ padding: '11px 14px', color: '#a1a1aa' }}>{u.totalPoints.toLocaleString()}</td>

                    {/* Swaps */}
                    <td style={{ padding: '11px 14px', color: '#a1a1aa' }}>{u.swapCount}</td>

                    {/* Status badges */}
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {u.suspended && (
                          <div>
                            {badge('Suspended', '#d97706')}
                            {u.suspendReason && (
                              <div style={{ color: '#52525b', fontSize: 10, marginTop: 2 }} title={u.suspendReason}>
                                {truncate(u.suspendReason, 22)}
                              </div>
                            )}
                          </div>
                        )}
                        {u.flagged && (
                          <div>
                            {badge('High-Risk', '#dc2626')}
                            {u.flagReason && (
                              <div style={{ color: '#52525b', fontSize: 10, marginTop: 2 }} title={u.flagReason}>
                                {truncate(u.flagReason, 22)}
                              </div>
                            )}
                          </div>
                        )}
                        {!u.suspended && !u.flagged && badge('Active', '#16a34a')}
                      </div>
                    </td>

                    {/* Joined */}
                    <td style={{ padding: '11px 14px', color: '#52525b', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                        {/* View swaps */}
                        <button
                          onClick={() => setViewUser(u)}
                          title="View swap history"
                          style={{ background: '#1e293b', border: '1px solid #2563eb33', color: '#93c5fd', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          <Eye size={13} /> Swaps
                        </button>

                        {/* Suspend / Unsuspend */}
                        {u.suspended ? (
                          <button
                            onClick={() => setActionModal({ user: u, action: 'unsuspend' })}
                            title="Re-activate user"
                            style={{ background: '#052e1622', border: '1px solid #16a34a44', color: '#4ade80', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <Unlock size={13} /> Lift
                          </button>
                        ) : (
                          <button
                            onClick={() => setActionModal({ user: u, action: 'suspend' })}
                            title="Suspend user"
                            style={{ background: '#2a180022', border: '1px solid #d9780644', color: '#fbbf24', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <Lock size={13} /> Suspend
                          </button>
                        )}

                        {/* Flag / Unflag */}
                        {u.flagged ? (
                          <button
                            onClick={() => setActionModal({ user: u, action: 'unflag' })}
                            title="Remove high-risk flag"
                            style={{ background: '#052e1622', border: '1px solid #16a34a44', color: '#4ade80', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <ShieldOff size={13} /> Unflag
                          </button>
                        ) : (
                          <button
                            onClick={() => setActionModal({ user: u, action: 'flag' })}
                            title="Flag as high-risk"
                            style={{ background: '#2a000022', border: '1px solid #dc262644', color: '#f87171', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <Flag size={13} /> Flag
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ borderTop: '1px solid #18182a', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ color: '#52525b', fontSize: 13 }}>
                Page {page} of {totalPages} &nbsp;·&nbsp; {total} user{total !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => goToPage(page - 1)} disabled={page <= 1} style={{
                  background: '#18181b', border: '1px solid #27272a', color: page <= 1 ? '#3f3f46' : '#a1a1aa',
                  borderRadius: 8, padding: '6px 12px', cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                }}>
                  <ChevronLeft size={14} /> Prev
                </button>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i
                  if (p < 1 || p > totalPages) return null
                  return (
                    <button key={p} onClick={() => goToPage(p)} style={{
                      background: p === page ? '#2563eb' : '#18181b',
                      border: `1px solid ${p === page ? '#2563eb' : '#27272a'}`,
                      color: p === page ? 'white' : '#a1a1aa',
                      borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: p === page ? 600 : 400,
                    }}>{p}</button>
                  )
                })}
                <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} style={{
                  background: '#18181b', border: '1px solid #27272a', color: page >= totalPages ? '#3f3f46' : '#a1a1aa',
                  borderRadius: 8, padding: '6px 12px', cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                }}>
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Audit log ───────────────────────────────────────────── */}
        {auditLog.length > 0 && (
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
              <Clock size={16} style={{ display: 'inline', marginRight: 6, color: '#7c3aed', verticalAlign: 'middle' }} />
              Admin Audit Log <span style={{ fontSize: 12, color: '#52525b', fontWeight: 400 }}>(session)</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {auditLog.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 12, borderBottom: i < auditLog.length - 1 ? '1px solid #18182a' : 'none', paddingBottom: i < auditLog.length - 1 ? 8 : 0 }}>
                  <span style={{ color: '#3f3f46', whiteSpace: 'nowrap', flexShrink: 0 }}>{e.ts}</span>
                  <span style={{ color: '#71717a', flexShrink: 0 }}>{e.admin}</span>
                  <span style={{ color: e.action.includes('suspend') ? '#fbbf24' : e.action.includes('flag') ? '#f87171' : '#4ade80', fontWeight: 600 }}>
                    {e.action}
                  </span>
                  <span style={{ color: '#a1a1aa', fontFamily: 'monospace' }}>{truncate(e.target, 24)}</span>
                  {e.reason && <span style={{ color: '#52525b' }}>— {e.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#27272a', fontSize: 12, marginTop: 12 }}>
          SwapSmith Admin · User Management
        </p>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {viewUser && (
        <SwapHistoryModal user={viewUser} token={token} onClose={() => setViewUser(null)} />
      )}

      {actionModal && (
        <ActionModal
          user={actionModal.user}
          action={actionModal.action}
          onConfirm={handleActionConfirm}
          onClose={() => { setActionModal(null); setActionMsg('') }}
        />
      )}

      {/* Action loading overlay */}
      {actionLoading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#00000060', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '24px 40px', textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: '#71717a', margin: 0 }}>{actionMsg || 'Processing…'}</p>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Action result toast */}
      {!actionLoading && actionMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 400,
          background: actionMsg.startsWith('✅') ? '#052e16' : '#450a0a',
          border: `1px solid ${actionMsg.startsWith('✅') ? '#16a34a55' : '#dc262655'}`,
          color: actionMsg.startsWith('✅') ? '#4ade80' : '#f87171',
          borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 500,
        }}>
          {actionMsg}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
