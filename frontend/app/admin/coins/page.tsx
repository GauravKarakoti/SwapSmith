'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import {
  Coins, Gift, MinusCircle, RotateCcw, Search, RefreshCw,
  ChevronLeft, ChevronRight, BarChart2, Users,
  ArrowLeftRight, X, History, AlertTriangle, Globe, ArrowUpDown,
} from 'lucide-react'
import AdminNavbar from '@/components/AdminNavbar'

// ── Types ─────────────────────────────────────────────────────────────────

interface CoinUserRow {
  id: number
  firebaseUid: string | null
  walletAddress: string | null
  testnetBalance: number
  totalGifted: number
  lastUpdated: string | null
  swapCount: number
}

interface CoinGiftLog {
  id: number
  adminId: string
  adminEmail: string
  targetUserId: number
  walletAddress: string | null
  action: 'gift' | 'deduct' | 'reset'
  amount: string
  balanceBefore: string
  balanceAfter: string
  note: string | null
  createdAt: string
}

interface CoinStats {
  totalUsers: number
  usersWithCoins: number
  totalDistributed: number
  totalCurrentBalance: number
  recentLogs: CoinGiftLog[]
}

interface AdminInfo { name: string; email: string; role: string }

// ── Helpers ───────────────────────────────────────────────────────────────

const ACTION_COLOR: Record<string, string> = {
  gift:   '#16a34a',
  deduct: '#dc2626',
  reset:  '#d97706',
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  gift:   <Gift   size={13} />,
  deduct: <MinusCircle size={13} />,
  reset:  <RotateCcw   size={13} />,
}

function badge(label: string, color: string) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${color}22`, color,
      border: `1px solid ${color}44`, padding: '2px 10px',
      borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {ACTION_ICON[label]}
      {label.toUpperCase()}
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

function StatCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ background: `${color}22`, borderRadius: 8, padding: 8 }}>
          <Icon size={18} style={{ color }} />
        </div>
        <span style={{ color: '#71717a', fontSize: 13 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#e4e4e7', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div style={{ color: '#52525b', fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ── Adjust modal ──────────────────────────────────────────────────────────

function AdjustModal({
  user,
  onConfirm,
  onClose,
  loading,
  message,
}: {
  user: CoinUserRow
  onConfirm: (action: 'gift' | 'deduct' | 'reset', amount: number, note: string) => void
  onClose: () => void
  loading: boolean
  message: string
}) {
  const [action, setAction] = useState<'gift' | 'deduct' | 'reset'>('gift')
  const [amount, setAmount] = useState('')
  const [note, setNote]     = useState('')

  const handleSubmit = () => {
    const amt = parseFloat(amount)
    if (action !== 'reset' && (!amt || amt <= 0)) return
    onConfirm(action, amt || 0, note)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: '#00000099',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#0f0f1a', border: '1px solid #27272a', borderRadius: 14,
        width: '100%', maxWidth: 460, padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#2563eb22', borderRadius: 8, padding: 8 }}>
              <Coins size={18} style={{ color: '#2563eb' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Adjust Testnet Coins</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* User info */}
        <div style={{
          background: '#18181b', border: '1px solid #27272a', borderRadius: 8,
          padding: '10px 14px', marginBottom: 20, fontSize: 12,
        }}>
          <div style={{ color: '#71717a', marginBottom: 4 }}>User #{user.id}</div>
          <div style={{ color: '#e4e4e7', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.walletAddress ?? user.firebaseUid ?? '—'}
          </div>
          <div style={{ color: '#a1a1aa', marginTop: 6 }}>
            Current balance: <span style={{ color: '#fbbf24', fontWeight: 700 }}>{user.testnetBalance.toLocaleString()} coins</span>
          </div>
        </div>

        {/* Action selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 8 }}>Action</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['gift', 'deduct', 'reset'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAction(a)}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                  fontWeight: 600, textTransform: 'capitalize',
                  background: action === a ? `${ACTION_COLOR[a]}22` : '#18181b',
                  border: action === a ? `1px solid ${ACTION_COLOR[a]}` : '1px solid #27272a',
                  color: action === a ? ACTION_COLOR[a] : '#71717a',
                  transition: 'all 0.15s',
                }}
              >
                {a === 'gift' ? '+ Gift' : a === 'deduct' ? '− Deduct' : '↺ Reset'}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        {action !== 'reset' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 8 }}>
              Amount (coins)
            </label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 100"
              style={{
                width: '100%', background: '#18181b', border: '1px solid #27272a',
                borderRadius: 8, color: '#e4e4e7', fontSize: 14, padding: '10px 12px',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {action === 'reset' && (
          <div style={{
            background: '#d9770622', border: '1px solid #d9770644', borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#fbbf24',
          }}>
            <AlertTriangle size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            This will set the user&apos;s balance to <strong>0</strong>.
          </div>
        )}

        {/* Note */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 8 }}>
            Note <span style={{ color: '#52525b' }}>(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Reason for this adjustment…"
            rows={2}
            style={{
              width: '100%', background: '#18181b', border: '1px solid #27272a',
              borderRadius: 8, color: '#e4e4e7', fontSize: 13, padding: '10px 12px',
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {message && (
          <div style={{
            marginBottom: 16, padding: '8px 12px', borderRadius: 8, fontSize: 13,
            background: message.startsWith('✅') ? '#16a34a22' : '#dc262622',
            color:      message.startsWith('✅') ? '#4ade80'   : '#f87171',
            border: `1px solid ${message.startsWith('✅') ? '#16a34a44' : '#dc262644'}`,
          }}>{message}</div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
            borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13,
          }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (action !== 'reset' && (!amount || parseFloat(amount) <= 0))}
            style={{
              background: `${ACTION_COLOR[action]}22`, border: `1px solid ${ACTION_COLOR[action]}66`,
              color: ACTION_COLOR[action], borderRadius: 8, padding: '8px 20px',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Processing…' : action === 'gift' ? '+ Gift Coins' : action === 'deduct' ? '− Deduct Coins' : '↺ Reset Balance'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Logs modal ────────────────────────────────────────────────────────────

function UserLogsModal({
  user, token, onClose,
}: { user: CoinUserRow; token: string; onClose: () => void }) {
  const [logs, setLogs]     = useState<CoinGiftLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    fetch(`/api/admin/coins/adjust?userId=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setLogs(d.logs); else setError(d.error ?? 'Failed') })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false))
  }, [user.id, token])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: '#00000099',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#0f0f1a', border: '1px solid #27272a', borderRadius: 14,
        width: '100%', maxWidth: 720, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #18182a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              <History size={16} style={{ display: 'inline', marginRight: 8, color: '#7c3aed', verticalAlign: 'middle' }} />
              Coin History – User #{user.id}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#52525b', fontFamily: 'monospace' }}>
              {user.walletAddress ?? user.firebaseUid ?? '—'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 24px 24px', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#52525b' }}>Loading…</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#f87171' }}>{error}</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#52525b' }}>No coin activity found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  {['#', 'Action', 'Amount', 'Before', 'After', 'By', 'Note', 'Date'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#52525b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={l.id} style={{ borderBottom: i < logs.length - 1 ? '1px solid #18182a' : 'none' }}>
                    <td style={{ padding: '9px 10px', color: '#52525b' }}>#{l.id}</td>
                    <td style={{ padding: '9px 10px' }}>{badge(l.action, ACTION_COLOR[l.action])}</td>
                    <td style={{ padding: '9px 10px', color: '#e4e4e7', fontWeight: 700 }}>{parseFloat(l.amount).toLocaleString()}</td>
                    <td style={{ padding: '9px 10px', color: '#a1a1aa' }}>{parseFloat(l.balanceBefore).toLocaleString()}</td>
                    <td style={{ padding: '9px 10px', color: '#fbbf24', fontWeight: 600 }}>{parseFloat(l.balanceAfter).toLocaleString()}</td>
                    <td style={{ padding: '9px 10px', color: '#71717a', fontSize: 11 }} title={l.adminEmail}>{truncate(l.adminEmail, 18)}</td>
                    <td style={{ padding: '9px 10px', color: '#71717a', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.note ?? '—'}</td>
                    <td style={{ padding: '9px 10px', color: '#52525b', whiteSpace: 'nowrap' }}>{fmt(l.createdAt)}</td>
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

// ── Global Gift Modal ─────────────────────────────────────────────────────

function GlobalGiftModal({
  onConfirm,
  onClose,
  loading,
  message,
}: {
  onConfirm: (amount: number, note: string) => void
  onClose: () => void
  loading: boolean
  message: string
}) {
  const [amount, setAmount] = useState('')
  const [note, setNote]     = useState('')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: '#00000099',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#0f0f1a', border: '1px solid #27272a', borderRadius: 14,
        width: '100%', maxWidth: 460, padding: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#7c3aed22', borderRadius: 8, padding: 8 }}>
              <Globe size={18} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Broadcast Gift to All Users</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#71717a' }}>Gifts coins to every registered user at once.</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{
          background: '#d9770615', border: '1px solid #d9770640', borderRadius: 8,
          padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#fbbf24',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>This is a <strong>mass action</strong>. Coins will be gifted to every user in the database. This cannot be undone.</span>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 8 }}>Amount per user (coins)</label>
          <input
            type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 100"
            style={{ width: '100%', background: '#18181b', border: '1px solid #27272a', borderRadius: 8, color: '#e4e4e7', fontSize: 14, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 8 }}>Note <span style={{ color: '#52525b' }}>(optional)</span></label>
          <textarea
            value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for broadcast gift…" rows={2}
            style={{ width: '100%', background: '#18181b', border: '1px solid #27272a', borderRadius: 8, color: '#e4e4e7', fontSize: 13, padding: '10px 12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {message && (
          <div style={{
            marginBottom: 16, padding: '8px 12px', borderRadius: 8, fontSize: 13,
            background: message.startsWith('✅') ? '#16a34a22' : '#dc262622',
            color:      message.startsWith('✅') ? '#4ade80'   : '#f87171',
            border: `1px solid ${message.startsWith('✅') ? '#16a34a44' : '#dc262644'}`,
          }}>{message}</div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}>
            Cancel
          </button>
          <button
            onClick={() => { const amt = parseFloat(amount); if (!amt || amt <= 0) return; onConfirm(amt, note) }}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            style={{ background: '#7c3aed22', border: '1px solid #7c3aed66', color: '#a78bfa', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Globe size={14} />
            {loading ? 'Gifting…' : 'Confirm Broadcast Gift'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminCoinsPage() {
  const router = useRouter()

  const [users, setUsers]           = useState<CoinUserRow[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]         = useState('')
  const [hasSwapped, setHasSwapped] = useState(false)
  const [adminInfo, setAdminInfo]   = useState<AdminInfo | null>(null)
  const [token, setToken]           = useState('')
  const [stats, setStats]           = useState<CoinStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  // Modals
  const [adjustUser, setAdjustUser] = useState<CoinUserRow | null>(null)
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [adjustMsg, setAdjustMsg]   = useState('')
  const [logsUser, setLogsUser]     = useState<CoinUserRow | null>(null)
  const [globalGiftOpen, setGlobalGiftOpen]     = useState(false)
  const [globalGiftLoading, setGlobalGiftLoading] = useState(false)
  const [globalGiftMsg, setGlobalGiftMsg]         = useState('')

  const LIMIT = 20

  // ── Data fetchers ─────────────────────────────────────────────────────

  const fetchUsers = useCallback(async (pg = 1, q = '', tok = '', swapped = false) => {
    if (!tok) return
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(LIMIT) })
      if (q) params.set('search', q)
      if (swapped) params.set('hasSwapped', 'true')
      const res = await fetch(`/api/admin/coins/users?${params}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (res.status === 401 || res.status === 403) { router.push('/admin/login'); return }
      const data = await res.json()
      if (data.success) {
        setUsers(data.rows); setTotal(data.total)
        setTotalPages(Math.max(1, Math.ceil(data.total / LIMIT)))
      } else {
        setError(data.error ?? 'Failed to load users.')
      }
    } catch { setError('Network error. Please refresh.') }
    finally { setLoading(false) }
  }, [router])

  const fetchStats = useCallback(async (tok = '') => {
    if (!tok) return
    setStatsLoading(true)
    try {
      const res = await fetch('/api/admin/coins/stats', {
        headers: { Authorization: `Bearer ${tok}` },
      })
      const data = await res.json()
      if (data.success) setStats(data.stats)
    } catch { /* ignore stats fetch errors */ }
    finally { setStatsLoading(false) }
  }, [])

  // ── Bootstrap ─────────────────────────────────────────────────────────

  useEffect(() => {
    const tok = sessionStorage.getItem('admin-token') ?? ''
    if (!tok) { router.push('/admin/login'); return }
    setToken(tok)
    const cached = sessionStorage.getItem('admin-info')
    if (cached) { try { setAdminInfo(JSON.parse(cached)) } catch {} }
    fetchUsers(1, '', tok, false)
    fetchStats(tok)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Search ────────────────────────────────────────────────────────────

  const handleSearch = () => {
    const q = searchInput.trim()
    setSearch(q); setPage(1)
    fetchUsers(1, q, token, hasSwapped)
  }

  // ── Has-Swapped toggle ────────────────────────────────────────────────

  const toggleHasSwapped = () => {
    const next = !hasSwapped
    setHasSwapped(next); setPage(1)
    fetchUsers(1, search, token, next)
  }

  // ── Pagination ────────────────────────────────────────────────────────

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return
    setPage(p); fetchUsers(p, search, token, hasSwapped)
  }

  // ── Adjust submit ─────────────────────────────────────────────────────

  const handleAdjustConfirm = async (
    action: 'gift' | 'deduct' | 'reset',
    amount: number,
    note: string,
  ) => {
    if (!adjustUser) return
    setAdjustLoading(true); setAdjustMsg('')
    try {
      const res = await fetch('/api/admin/coins/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: adjustUser.id, action, amount, note }),
      })
      const data = await res.json()
      if (data.success) {
        setAdjustMsg(`✅ Done! New balance: ${data.balanceAfter.toLocaleString()} coins`)
        await fetchUsers(page, search, token, hasSwapped)
        await fetchStats(token)
        setTimeout(() => { setAdjustUser(null); setAdjustMsg('') }, 1500)
      } else {
        setAdjustMsg(`❌ ${data.error ?? 'Failed'}`)
      }
    } catch { setAdjustMsg('❌ Network error') }
    finally { setAdjustLoading(false) }
  }

  // ── Global gift submit ────────────────────────────────────────────────

  const handleGlobalGift = async (amount: number, note: string) => {
    setGlobalGiftLoading(true); setGlobalGiftMsg('')
    try {
      const res = await fetch('/api/admin/coins/gift-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, note }),
      })
      const data = await res.json()
      if (data.ok) {
        setGlobalGiftMsg(`✅ Gifted ${amount.toLocaleString()} coins to ${data.usersGifted.toLocaleString()} users (${data.totalCoinsDistributed.toLocaleString()} total)`)
        await fetchUsers(page, search, token, hasSwapped)
        await fetchStats(token)
        setTimeout(() => { setGlobalGiftOpen(false); setGlobalGiftMsg('') }, 2500)
      } else {
        setGlobalGiftMsg(`❌ ${data.error ?? 'Failed'}`)
      }
    } catch { setGlobalGiftMsg('❌ Network error') }
    finally { setGlobalGiftLoading(false) }
  }

  // ── Logout ────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    sessionStorage.removeItem('admin-token')
    sessionStorage.removeItem('admin-info')
    document.cookie = 'admin-session=; path=/; max-age=0; SameSite=Lax'
    if (auth) await signOut(auth)
    router.push('/admin/login')
  }

  // ── Loading screen ────────────────────────────────────────────────────

  if (loading && users.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#070710', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#71717a' }}>Loading coin management…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#070710', color: '#e4e4e7', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .admin-content { padding: 16px 10px !important; }
        @media (max-width: 768px) {
          .admin-content { padding: 16px 10px !important; }
        }
      `}</style>
      <AdminNavbar
        activePage="coins"
        adminInfo={adminInfo}
        onLogout={handleLogout}
      />

      <main style={{ padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ background: '#fbbf2422', borderRadius: 10, padding: 10 }}>
              <Coins size={22} style={{ color: '#fbbf24' }} />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Testnet Coin Management</h1>
          </div>
          <p style={{ margin: 0, color: '#52525b', fontSize: 13 }}>
            Gift, deduct, or reset testnet coin balances. Every action is logged for audit.
          </p>
        </div>

        {/* ── Stats cards ─────────────────────────────────────────────── */}
        {statsLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, height: 100, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <StatCard icon={Users}    label="Total Users"        value={stats.totalUsers}          color="#2563eb" />
            <StatCard icon={Coins}    label="Users with Coins"   value={stats.usersWithCoins}      color="#fbbf24" sub="have non-zero balance" />
            <StatCard icon={Gift}     label="Total Distributed"  value={stats.totalDistributed}    color="#16a34a" sub="coins gifted all-time" />
            <StatCard icon={BarChart2} label="Current in Circulation" value={stats.totalCurrentBalance} color="#7c3aed" sub="sum of all balances" />
          </div>
        ) : null}

        {/* ── User table ──────────────────────────────────────────────── */}
        <div style={{ background: '#0f0f1a', border: '1px solid #27272a', borderRadius: 14, overflow: 'hidden' }}>

          {/* Table header / toolbar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #18182a', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 260px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#52525b' }} />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search wallet or Firebase UID…"
                  style={{
                    width: '100%', background: '#18181b', border: '1px solid #27272a',
                    borderRadius: 8, color: '#e4e4e7', fontSize: 13, padding: '8px 12px 8px 32px',
                    outline: 'none',
                  }}
                />
              </div>
              <button onClick={handleSearch} style={{
                background: '#2563eb22', border: '1px solid #2563eb44', color: '#60a5fa',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                Search
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Has Swapped filter */}
              <button
                onClick={toggleHasSwapped}
                title="Show only users who have performed at least one swap"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: hasSwapped ? '#2563eb22' : '#18181b',
                  border: hasSwapped ? '1px solid #2563eb66' : '1px solid #27272a',
                  color: hasSwapped ? '#60a5fa' : '#71717a',
                  borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                <ArrowUpDown size={13} />
                Has Swapped
              </button>
              {/* Broadcast gift */}
              <button
                onClick={() => { setGlobalGiftMsg(''); setGlobalGiftOpen(true) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#7c3aed22', border: '1px solid #7c3aed55', color: '#a78bfa',
                  borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                <Globe size={13} /> Broadcast Gift
              </button>
              <span style={{ color: '#52525b', fontSize: 12, whiteSpace: 'nowrap' }}>{total.toLocaleString()} users</span>
              <button onClick={() => { fetchUsers(page, search, token, hasSwapped); fetchStats(token) }} style={{
                display: 'flex', alignItems: 'center', gap: 6, background: '#18181b',
                border: '1px solid #27272a', color: '#71717a', borderRadius: 8,
                padding: '7px 12px', cursor: 'pointer', fontSize: 12,
              }}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>

          {/* Table */}
          {error ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#f87171' }}>{error}</div>
          ) : loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#52525b' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              Loading…
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#52525b' }}>No users found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #27272a' }}>
                    {['#', 'Wallet / Firebase UID', 'Balance', 'Total Received', 'Swaps', 'Last Updated', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#52525b', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #18182a' : 'none' }}>
                      <td style={{ padding: '10px 14px', color: '#52525b' }}>#{u.id}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {u.walletAddress ? (
                          <div>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#93c5fd' }}
                              title={u.walletAddress}>{truncate(u.walletAddress, 20)}</span>
                            {u.firebaseUid && (
                              <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}
                                title={u.firebaseUid}>uid: {truncate(u.firebaseUid, 16)}</div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#71717a' }}
                            title={u.firebaseUid ?? ''}>{truncate(u.firebaseUid, 20) }</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          color: u.testnetBalance > 0 ? '#fbbf24' : '#52525b',
                          fontWeight: u.testnetBalance > 0 ? 700 : 400,
                          fontSize: 14,
                        }}>
                          {u.testnetBalance.toLocaleString()}
                        </span>
                        <span style={{ color: '#52525b', fontSize: 11, marginLeft: 4 }}>coins</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#a1a1aa' }}>
                        {u.totalGifted.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {u.swapCount > 0 ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: '#2563eb22', color: '#60a5fa',
                            border: '1px solid #2563eb44', borderRadius: 10,
                            padding: '2px 8px', fontSize: 11, fontWeight: 600,
                          }}>
                            <ArrowLeftRight size={10} />
                            {u.swapCount.toLocaleString()}
                          </span>
                        ) : (
                          <span style={{ color: '#3f3f46', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#52525b', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {fmt(u.lastUpdated)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => { setAdjustUser(u); setAdjustMsg('') }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              background: '#16a34a22', border: '1px solid #16a34a44',
                              color: '#4ade80', borderRadius: 6, padding: '5px 10px',
                              cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            }}
                          >
                            <Coins size={12} /> Adjust
                          </button>
                          <button
                            onClick={() => setLogsUser(u)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              background: '#7c3aed22', border: '1px solid #7c3aed44',
                              color: '#a78bfa', borderRadius: 6, padding: '5px 10px',
                              cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            }}
                          >
                            <History size={12} /> History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #27272a',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: '#52525b', fontSize: 12 }}>
                Page {page} of {totalPages} · {total.toLocaleString()} total
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => goToPage(page - 1)} disabled={page === 1} style={{
                  display: 'flex', alignItems: 'center', gap: 4, background: '#18181b',
                  border: '1px solid #27272a', color: page === 1 ? '#3f3f46' : '#a1a1aa',
                  borderRadius: 6, padding: '6px 10px', cursor: page === 1 ? 'default' : 'pointer', fontSize: 12,
                }}>
                  <ChevronLeft size={14} /> Prev
                </button>
                <button onClick={() => goToPage(page + 1)} disabled={page === totalPages} style={{
                  display: 'flex', alignItems: 'center', gap: 4, background: '#18181b',
                  border: '1px solid #27272a', color: page === totalPages ? '#3f3f46' : '#a1a1aa',
                  borderRadius: 6, padding: '6px 10px', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 12,
                }}>
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Recent global activity ───────────────────────────────────── */}
        {stats && stats.recentLogs.length > 0 && (
          <div style={{ marginTop: 28, background: '#0f0f1a', border: '1px solid #27272a', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #18182a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={15} style={{ color: '#7c3aed' }} />
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Recent Global Activity</h2>
              <span style={{ marginLeft: 'auto', color: '#52525b', fontSize: 11 }}>Last 50 actions</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #27272a' }}>
                    {['Action', 'User #', 'Amount', 'Before → After', 'Admin', 'Note', 'Date'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 14px', color: '#52525b', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentLogs.map((l, i) => (
                    <tr key={l.id} style={{ borderBottom: i < stats.recentLogs.length - 1 ? '1px solid #18182a' : 'none' }}>
                      <td style={{ padding: '8px 14px' }}>{badge(l.action, ACTION_COLOR[l.action])}</td>
                      <td style={{ padding: '8px 14px', color: '#71717a' }}>#{l.targetUserId}</td>
                      <td style={{ padding: '8px 14px', color: '#e4e4e7', fontWeight: 600 }}>{parseFloat(l.amount).toLocaleString()}</td>
                      <td style={{ padding: '8px 14px', color: '#a1a1aa', whiteSpace: 'nowrap' }}>
                        {parseFloat(l.balanceBefore).toLocaleString()}
                        <span style={{ color: '#3f3f46', margin: '0 6px' }}>→</span>
                        <span style={{ color: '#fbbf24', fontWeight: 600 }}>{parseFloat(l.balanceAfter).toLocaleString()}</span>
                      </td>
                      <td style={{ padding: '8px 14px', color: '#71717a' }} title={l.adminEmail}>{truncate(l.adminEmail, 20)}</td>
                      <td style={{ padding: '8px 14px', color: '#52525b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.note ?? '—'}</td>
                      <td style={{ padding: '8px 14px', color: '#52525b', whiteSpace: 'nowrap' }}>{fmt(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {adjustUser && (
        <AdjustModal
          user={adjustUser}
          onConfirm={handleAdjustConfirm}
          onClose={() => { setAdjustUser(null); setAdjustMsg('') }}
          loading={adjustLoading}
          message={adjustMsg}
        />
      )}
      {logsUser && (
        <UserLogsModal
          user={logsUser}
          token={token}
          onClose={() => setLogsUser(null)}
        />
      )}
      {globalGiftOpen && (
        <GlobalGiftModal
          onConfirm={handleGlobalGift}
          onClose={() => { setGlobalGiftOpen(false); setGlobalGiftMsg('') }}
          loading={globalGiftLoading}
          message={globalGiftMsg}
        />
      )}
    </div>
  )
}
