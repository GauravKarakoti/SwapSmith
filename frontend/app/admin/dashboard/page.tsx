'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import {
  BarChart2, Users, ArrowLeftRight, TrendingUp, AlertTriangle,
  Activity, Clock, RefreshCw, LogOut, ShieldCheck, CheckCircle2, XCircle,
  Layers, Zap, Menu, X,
} from 'lucide-react'

interface Analytics {
  totalSwaps: number
  totalSwapsToday: number
  totalSwapsWeek: number
  totalSwapsMonth: number
  successCount: number
  failedCount: number
  totalUsers: number
  activeUsersToday: number
  topAssets: { asset: string; network: string; count: number }[]
  topChains: { chain: string; count: number }[]
  recentSwaps: {
    id: number
    userId: string
    fromAsset: string
    toAsset: string
    fromNetwork: string
    toNetwork: string
    fromAmount: number
    status: string
    createdAt: string | null
  }[]
  swapsByDay: { date: string; count: number }[]
}

interface AdminInfo { name: string; email: string; role: string }

const STATUS_COLOR: Record<string, string> = {
  settled:    '#16a34a',
  completed:  '#16a34a',
  pending:    '#d97706',
  processing: '#2563eb',
  failed:     '#dc2626',
}

function statusBadge(status: string) {
  const color = STATUS_COLOR[status] ?? '#71717a'
  return (
    <span style={{
      display: 'inline-block', background: `${color}22`,
      color, border: `1px solid ${color}44`,
      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
    }}>
      {status}
    </span>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }: {
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
      <div style={{ fontSize: 28, fontWeight: 700, color: '#e4e4e7', lineHeight: 1 }}>{value.toLocaleString()}</div>
      {sub && <div style={{ color: '#52525b', fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

/** Simple horizontal bar chart rendered with CSS */
function BarChartSimple({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 90, fontSize: 12, color: '#a1a1aa', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={d.label}>{d.label}</div>
          <div style={{ flex: 1, background: '#09090b', borderRadius: 4, height: 18, overflow: 'hidden' }}>
            <div style={{
              width: `${(d.value / max) * 100}%`, height: '100%',
              background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)',
              borderRadius: 4, transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{ width: 32, fontSize: 12, color: '#71717a', textAlign: 'right', flexShrink: 0 }}>{d.value}</div>
        </div>
      ))}
    </div>
  )
}

/** Simple sparkline for swaps-by-day */
function SwapSparkline({ data }: { data: { date: string; count: number }[] }) {
  if (data.length < 2) return <div style={{ color: '#52525b', fontSize: 13 }}>Not enough data yet.</div>
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 500, H = 80
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (d.count / max) * (H - 10) - 5
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)" />
    </svg>
  )
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [adminInfo, setAdminInfo]  = useState<AdminInfo | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchAnalytics = useCallback(async () => {
    const token = sessionStorage.getItem('admin-token')
    if (!token) { router.push('/admin/login'); return }

    try {
      const res = await fetch('/api/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 401 || res.status === 403) {
        router.push('/admin/login')
        return
      }

      const data = await res.json()
      if (data.success) {
        setAnalytics(data.data)
        setAdminInfo(data.admin)
        setLastRefresh(new Date())
      } else {
        setError(data.error ?? 'Failed to load analytics.')
      }
    } catch {
      setError('Network error. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    // Load cached admin info immediately
    const cached = sessionStorage.getItem('admin-info')
    if (cached) { try { setAdminInfo(JSON.parse(cached)) } catch {} }
    fetchAnalytics()
    // Auto-refresh every 60 s
    const t = setInterval(fetchAnalytics, 60_000)
    return () => clearInterval(t)
  }, [fetchAnalytics])

  const handleLogout = async () => {
    sessionStorage.removeItem('admin-token')
    sessionStorage.removeItem('admin-info')
    // Clear the middleware cookie
    document.cookie = 'admin-session=; path=/; max-age=0; SameSite=Lax'
    if (auth) await signOut(auth)
    router.push('/admin/login')
  }

  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const successRate = analytics
    ? analytics.totalSwaps > 0
      ? Math.round((analytics.successCount / analytics.totalSwaps) * 100)
      : 0
    : 0

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#070710', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#71717a' }}>Loading admin dashboard…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#070710', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 16, padding: 40, maxWidth: 420, textAlign: 'center' }}>
          <AlertTriangle size={40} style={{ color: '#f59e0b', margin: '0 auto 16px' }} />
          <h2 style={{ color: '#e4e4e7', marginBottom: 8 }}>Failed to load</h2>
          <p style={{ color: '#71717a', marginBottom: 24 }}>{error}</p>
          <button onClick={() => { setError(''); setLoading(true); fetchAnalytics() }}
            style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  const a = analytics!

  return (
    <div style={{ minHeight: '100vh', background: '#070710', color: '#e4e4e7', fontFamily: 'inherit' }}>

      {/* Responsive styles */}
      <style>{`
        .admin-nav-label { display: inline; }
        .admin-nav-sep   { display: inline; }
        .admin-nav-hamburger { display: none !important; }
        @media (max-width: 768px) {
          .admin-nav-label    { display: none !important; }
          .admin-nav-sep      { display: none !important; }
          .admin-nav-right    { display: none !important; }
          .admin-nav-hamburger{ display: flex !important; }
          .admin-nav          { padding: 10px 16px !important; }
          .admin-content      { padding: 16px 10px !important; }
          .admin-2col         { grid-template-columns: 1fr !important; }
          .admin-kpi-grid     { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .admin-kpi-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* ── Navbar ── */}
      <nav className="admin-nav" style={{ background: '#0b0b18', borderBottom: '1px solid #18182a', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/swapsmithicon.png" alt="SwapSmith" width={36} height={36} style={{ borderRadius: 8 }} unoptimized />
          <span className="admin-nav-label" style={{ fontSize: 18, fontWeight: 700 }}>SwapSmith Admin</span>
          <span style={{ background: '#1e3a5f', color: '#93c5fd', border: '1px solid #2563eb44', borderRadius: 20, fontSize: 11, padding: '2px 10px', marginLeft: 4, fontWeight: 600 }}>
            {adminInfo?.role?.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {/* Desktop actions */}
        <div className="admin-nav-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#52525b', fontSize: 13 }}>
            {adminInfo?.name} · Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <button onClick={() => router.push('/admin/users')}
            style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Users size={14} /> Users
          </button>
          <button onClick={fetchAnalytics}
            style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleLogout}
            style={{ background: '#450a0a22', border: '1px solid #dc262644', color: '#f87171', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <LogOut size={14} /> Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="admin-nav-hamburger"
          onClick={() => setMobileNavOpen(true)}
          style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', alignItems: 'center', gap: 6, fontSize: 13 }}
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
              <p style={{ color: '#52525b', fontSize: 11, margin: '2px 0 0' }}>Last refresh: {lastRefresh.toLocaleTimeString()}</p>
            </div>
            {/* Nav buttons */}
            <button onClick={() => { setMobileNavOpen(false); router.push('/admin/dashboard'); }}
              style={{ background: '#1e1e40', border: '1px solid #2563eb55', color: '#93c5fd', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
              <BarChart2 size={16} /> Analytics
            </button>
            <button onClick={() => { setMobileNavOpen(false); router.push('/admin/users'); }}
              style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <Users size={16} /> Users
            </button>
            <button onClick={() => { setMobileNavOpen(false); fetchAnalytics(); }}
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

        {/* ── Section title ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Platform Analytics</h2>
          <p style={{ color: '#52525b', fontSize: 13, marginTop: 4 }}>Real-time overview of SwapSmith activity</p>
        </div>

        {/* ── Top KPI cards ─────────────────────────────────────────────── */}
        <div className="admin-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16, marginBottom: 32 }}>
          <StatCard icon={ArrowLeftRight} label="Total Swaps"         value={a.totalSwaps}        color="#2563eb" />
          <StatCard icon={Zap}             label="Swaps Today"         value={a.totalSwapsToday}   color="#7c3aed" sub={`${a.totalSwapsWeek} this week`} />
          <StatCard icon={BarChart2}       label="Swaps (30 days)"     value={a.totalSwapsMonth}   color="#0891b2" />
          <StatCard icon={Users}           label="Total Users"         value={a.totalUsers}         color="#059669" sub={`${a.activeUsersToday} joined today`} />
          <StatCard icon={CheckCircle2}    label="Successful Swaps"    value={a.successCount}       color="#16a34a" sub={`${successRate}% success rate`} />
          <StatCard icon={XCircle}         label="Failed Swaps"        value={a.failedCount}        color="#dc2626" />
        </div>

        {/* ── Success / Fail rate bar ────────────────────────────────────── */}
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              <TrendingUp size={16} style={{ display: 'inline', marginRight: 6, color: '#16a34a', verticalAlign: 'middle' }} />
              Transaction Success Rate
            </h3>
            <span style={{ fontSize: 20, fontWeight: 700, color: successRate >= 80 ? '#16a34a' : successRate >= 50 ? '#d97706' : '#dc2626' }}>
              {successRate}%
            </span>
          </div>
          <div style={{ background: '#09090b', borderRadius: 6, height: 12, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 6, background: 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)', width: `${successRate}%`, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#52525b' }}>
            <span>✅ {a.successCount} successful</span>
            <span>❌ {a.failedCount} failed</span>
          </div>
        </div>

        {/* ── Swaps over time sparkline ─────────────────────────────────── */}
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
            <Activity size={16} style={{ display: 'inline', marginRight: 6, color: '#2563eb', verticalAlign: 'middle' }} />
            Swaps – Last 30 Days
          </h3>
          <SwapSparkline data={a.swapsByDay} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#3f3f46' }}>
            {a.swapsByDay.length > 0 && (
              <>
                <span>{a.swapsByDay[0]?.date}</span>
                <span>{a.swapsByDay[a.swapsByDay.length - 1]?.date}</span>
              </>
            )}
          </div>
        </div>

        {/* ── 2-col: top assets + top chains ───────────────────────────── */}
        <div className="admin-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '20px 24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
              <Layers size={16} style={{ display: 'inline', marginRight: 6, color: '#7c3aed', verticalAlign: 'middle' }} />
              Top 10 Swapped Assets
            </h3>
            {a.topAssets.length === 0
              ? <p style={{ color: '#52525b', fontSize: 13 }}>No data yet.</p>
              : <BarChartSimple data={a.topAssets.map(x => ({ label: `${x.asset} (${x.network})`, value: x.count }))} />
            }
          </div>

          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '20px 24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
              <TrendingUp size={16} style={{ display: 'inline', marginRight: 6, color: '#0891b2', verticalAlign: 'middle' }} />
              Most Used Chains
            </h3>
            {a.topChains.length === 0
              ? <p style={{ color: '#52525b', fontSize: 13 }}>No data yet.</p>
              : <BarChartSimple data={a.topChains.map(x => ({ label: x.chain, value: x.count }))} />
            }
          </div>
        </div>

        {/* ── Recent swap activity log ──────────────────────────────────── */}
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
            <Clock size={16} style={{ display: 'inline', marginRight: 6, color: '#d97706', verticalAlign: 'middle' }} />
            Recent Swap Activity (Last 20)
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  {['ID', 'User', 'From', 'To', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#52525b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.recentSwaps.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '20px 12px', color: '#52525b', textAlign: 'center' }}>No swaps recorded yet.</td></tr>
                ) : a.recentSwaps.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: i < a.recentSwaps.length - 1 ? '1px solid #18182a' : 'none' }}>
                    <td style={{ padding: '10px 12px', color: '#52525b' }}>#{s.id}</td>
                    <td style={{ padding: '10px 12px', color: '#a1a1aa', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={s.userId}>{s.userId.substring(0, 12)}…</td>
                    <td style={{ padding: '10px 12px', color: '#e4e4e7', fontWeight: 500 }}>{s.fromAsset}<span style={{ color: '#52525b', fontWeight: 400 }}> ({s.fromNetwork})</span></td>
                    <td style={{ padding: '10px 12px', color: '#e4e4e7', fontWeight: 500 }}>{s.toAsset}<span style={{ color: '#52525b', fontWeight: 400 }}> ({s.toNetwork})</span></td>
                    <td style={{ padding: '10px 12px', color: '#a1a1aa' }}>{s.fromAmount}</td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(s.status)}</td>
                    <td style={{ padding: '10px 12px', color: '#52525b', whiteSpace: 'nowrap' }}>
                      {s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#27272a', fontSize: 12, marginTop: 32 }}>
          SwapSmith Admin Dashboard · Auto-refreshes every 60 seconds
        </p>
      </div>
    </div>
  )
}
