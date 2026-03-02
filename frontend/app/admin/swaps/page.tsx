'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import {
  ArrowLeftRight,
  Search, ChevronLeft, ChevronRight, Eye, X,
  AlertTriangle, Activity, ShieldAlert, ShieldCheck,
  Key, Clock, CheckCircle2, XCircle, Loader2, Zap,
  TrendingUp, ToggleLeft, ToggleRight, Save,
} from 'lucide-react'
import AdminNavbar from '@/components/AdminNavbar'

// ── Types ─────────────────────────────────────────────────────────────────

interface AdminSwap {
  id: number
  userId: string
  walletAddress: string | null
  sideshiftOrderId: string
  quoteId: string | null
  fromAsset: string
  fromNetwork: string
  fromAmount: number
  toAsset: string
  toNetwork: string
  settleAmount: string
  depositAddress: string | null
  status: string
  txHash: string | null
  createdAt: string | null
  updatedAt: string | null
}

interface SwapMetrics {
  totalAllTime: number
  last24h: number
  last1h: number
  last5min: number
  statusBreakdown: { status: string; count: number }[]
  perHour: { hour: string; count: number }[]
  errorRate: number
  spikeDetected: boolean
  averagePer5Min: number
}

interface PlatformConfig {
  swapExecutionEnabled: boolean
  sideshiftApiKey: string
  updatedAt: string | null
  updatedBy: string | null
}

interface SideshiftOrder {
  id?: string
  status?: string
  depositCoin?: string
  settleCoin?: string
  depositNetwork?: string
  settleNetwork?: string
  depositAddress?: string
  settleAddress?: string
  depositMin?: string
  depositMax?: string
  expiresAt?: string
  settleAmount?: string
  depositAmount?: string
  rate?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

interface AdminInfo { name: string; email: string; role: string }

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  settled:    '#16a34a',
  completed:  '#16a34a',
  waiting:    '#d97706',
  pending:    '#d97706',
  processing: '#2563eb',
  failed:     '#dc2626',
  refunded:   '#7c3aed',
  expired:    '#ef4444',
}

const STATUS_OPTIONS = [
  { value: 'all',        label: 'All' },
  { value: 'pending',    label: 'Pending' },
  { value: 'waiting',    label: 'Waiting' },
  { value: 'processing', label: 'Processing' },
  { value: 'settled',    label: 'Settled' },
  { value: 'failed',     label: 'Failed' },
  { value: 'refunded',   label: 'Refunded' },
  { value: 'expired',    label: 'Expired' },
]

// ── Helpers ───────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const color = STATUS_COLOR[status] ?? '#71717a'
  return (
    <span style={{
      display: 'inline-block', background: `${color}22`, color,
      border: `1px solid ${color}44`, padding: '2px 10px',
      borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {status}
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

function MetricCard({ icon: Icon, label, value, sub, color, alert }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; alert?: boolean
}) {
  return (
    <div style={{
      background: alert ? '#450a0a33' : '#18181b',
      border: `1px solid ${alert ? '#dc262655' : '#27272a'}`,
      borderRadius: 12, padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <div style={{ background: `${color}22`, borderRadius: 8, padding: 7 }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span style={{ color: '#71717a', fontSize: 12 }}>{label}</span>
        {alert && <AlertTriangle size={13} style={{ color: '#f59e0b', marginLeft: 'auto' }} />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: alert ? '#f87171' : '#e4e4e7', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div style={{ color: '#52525b', fontSize: 11, marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AdminSwapsPage() {
  const router = useRouter()

  // ── Admin state ──
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null)

  // ── Swap list state ──
  const [swaps, setSwaps]       = useState<AdminSwap[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]     = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loadingSwaps, setLoadingSwaps] = useState(true)
  const [swapsError, setSwapsError]     = useState('')
  const [lastRefresh, setLastRefresh]   = useState(new Date())

  // ── Detail modal ──
  const [detailOpen, setDetailOpen]       = useState(false)
  const [detailSwap, setDetailSwap]       = useState<AdminSwap | null>(null)
  const [sideshiftOrder, setSideshiftOrder] = useState<SideshiftOrder | null>(null)
  const [sideshiftQuote, setSideshiftQuote] = useState<Record<string, unknown> | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // ── Metrics ──
  const [metrics, setMetrics]       = useState<SwapMetrics | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)

  // ── Config (emergency stop + API key) ──
  const [config, setConfig]             = useState<PlatformConfig | null>(null)
  const [loadingConfig, setLoadingConfig]   = useState(true)
  const [savingConfig, setSavingConfig]     = useState(false)
  const [configMsg, setConfigMsg]           = useState('')
  const [apiKeyInput, setApiKeyInput]       = useState('')
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<'swaps' | 'metrics' | 'config'>('swaps')

  const token = useRef<string | null>(null)

  // ── Auth ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = sessionStorage.getItem('admin-token')
    if (!t) { router.push('/admin/login'); return }
    token.current = t
    const cached = sessionStorage.getItem('admin-info')
    if (cached) { try { setAdminInfo(JSON.parse(cached)) } catch {} }
  }, [router])

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${token.current ?? ''}`,
    'Content-Type': 'application/json',
  }), [])

  // ── Swap list fetch ────────────────────────────────────────────────────
  const fetchSwaps = useCallback(async (pg = page) => {
    if (!token.current) return
    setLoadingSwaps(true)
    setSwapsError('')
    try {
      const qs = new URLSearchParams({
        page: String(pg),
        limit: '25',
        status: statusFilter,
        ...(search ? { search } : {}),
      })
      const res = await fetch(`/api/admin/swaps?${qs}`, { headers: authHeaders() })
      if (res.status === 401 || res.status === 403) { router.push('/admin/login'); return }
      const data = await res.json()
      if (data.success) {
        setSwaps(data.swaps)
        setTotal(data.total)
        setTotalPages(data.totalPages)
        setPage(pg)
        setLastRefresh(new Date())
      } else {
        setSwapsError(data.error ?? 'Failed to load swaps.')
      }
    } catch {
      setSwapsError('Network error. Please retry.')
    } finally {
      setLoadingSwaps(false)
    }
  }, [page, statusFilter, search, authHeaders, router])

  // ── Metrics fetch ──────────────────────────────────────────────────────
  const fetchMetrics = useCallback(async () => {
    if (!token.current) return
    setLoadingMetrics(true)
    try {
      const res = await fetch('/api/admin/swaps/metrics', { headers: authHeaders() })
      const data = await res.json()
      if (data.success) setMetrics(data.metrics)
    } catch { /* ignore */ } finally {
      setLoadingMetrics(false)
    }
  }, [authHeaders])

  // ── Config fetch ───────────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    if (!token.current) return
    setLoadingConfig(true)
    try {
      const res = await fetch('/api/admin/swaps/config', { headers: authHeaders() })
      const data = await res.json()
      if (data.success) setConfig(data.config)
    } catch { /* ignore */ } finally {
      setLoadingConfig(false)
    }
  }, [authHeaders])

  // ── Bootstrap ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = sessionStorage.getItem('admin-token')
    if (!t) return
    token.current = t
    fetchSwaps(1)
    fetchMetrics()
    fetchConfig()
    const interval = setInterval(() => { fetchSwaps(1); fetchMetrics() }, 30_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch when filter/search changes
  useEffect(() => {
    if (token.current) fetchSwaps(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search])

  // ── Swap detail modal ──────────────────────────────────────────────────
  const openDetail = useCallback(async (swap: AdminSwap) => {
    setDetailSwap(swap)
    setSideshiftOrder(null)
    setSideshiftQuote(null)
    setDetailOpen(true)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/admin/swaps/${swap.sideshiftOrderId}`, { headers: authHeaders() })
      const data = await res.json()
      if (data.success) {
        setSideshiftOrder(data.sideshiftOrder)
        setSideshiftQuote(data.sideshiftQuote)
      }
    } catch { /* ignore */ } finally {
      setLoadingDetail(false)
    }
  }, [authHeaders])

  // ── Config save ────────────────────────────────────────────────────────
  const saveConfig = useCallback(async (patch: Partial<PlatformConfig>) => {
    if (!token.current) return
    setSavingConfig(true)
    setConfigMsg('')
    try {
      const body: Record<string, unknown> = {}
      if (typeof patch.swapExecutionEnabled === 'boolean') body.swapExecutionEnabled = patch.swapExecutionEnabled
      if (patch.sideshiftApiKey !== undefined) body.sideshiftApiKey = patch.sideshiftApiKey

      const res = await fetch('/api/admin/swaps/config', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setConfig(data.config)
        setConfigMsg('Configuration saved successfully.')
        setShowApiKeyInput(false)
        setApiKeyInput('')
      } else {
        setConfigMsg(data.error ?? 'Failed to save config.')
      }
    } catch {
      setConfigMsg('Network error. Please retry.')
    } finally {
      setSavingConfig(false)
      setTimeout(() => setConfigMsg(''), 4000)
    }
  }, [authHeaders])

  // ── Logout ─────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    sessionStorage.removeItem('admin-token')
    sessionStorage.removeItem('admin-info')
    document.cookie = 'admin-session=; path=/; max-age=0; SameSite=Lax'
    if (auth) await signOut(auth)
    router.push('/admin/login')
  }

  const isSuperAdmin = adminInfo?.role === 'super_admin'

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#070710', color: '#e4e4e7', fontFamily: 'inherit' }}>

      <AdminNavbar
        activePage="swaps"
        adminInfo={adminInfo}
        onLogout={handleLogout}
        onRefresh={() => { fetchSwaps(page); fetchMetrics() }}
        lastRefresh={lastRefresh}
      />

      {/* ── Content ── */}
      <div className="admin-content" style={{ maxWidth: '100%', margin: '0 auto', padding: '28px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowLeftRight size={22} style={{ color: '#2563eb' }} />
            Cross-Chain Swap Control
          </h2>
          <p style={{ color: '#52525b', fontSize: 13, marginTop: 4 }}>
            Live monitoring, API metrics & SideShift configuration
          </p>
        </div>

        {/* Spike alert banner */}
        {metrics?.spikeDetected && (
          <div style={{
            background: '#450a0a44', border: '1px solid #dc262688', borderRadius: 12,
            padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <AlertTriangle size={18} style={{ color: '#f87171', flexShrink: 0 }} />
            <div>
              <span style={{ color: '#f87171', fontWeight: 700, fontSize: 14 }}>Abnormal Activity Spike Detected</span>
              <p style={{ color: '#fca5a5', fontSize: 12, margin: '2px 0 0' }}>
                {metrics.last5min} swaps in last 5 min vs avg {metrics.averagePer5Min}/5 min. Investigate immediately.
              </p>
            </div>
          </div>
        )}

        {/* Emergency stop banner */}
        {config && !config.swapExecutionEnabled && (
          <div style={{
            background: '#7c3aed22', border: '1px solid #7c3aed88', borderRadius: 12,
            padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <ShieldAlert size={18} style={{ color: '#a78bfa', flexShrink: 0 }} />
            <span style={{ color: '#c4b5fd', fontWeight: 700, fontSize: 14 }}>
              🛑 Swap Execution Globally Disabled (Emergency Stop Active)
            </span>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#18181b', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {([
            { id: 'swaps', label: 'Live Swaps', icon: ArrowLeftRight },
            { id: 'metrics', label: 'API Metrics', icon: Activity },
            { id: 'config', label: 'Configuration', icon: Key },
          ] as { id: 'swaps' | 'metrics' | 'config'; label: string; icon: React.ElementType }[]).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                background: activeTab === t.id ? '#1e1e40' : 'transparent',
                border: activeTab === t.id ? '1px solid #2563eb55' : '1px solid transparent',
                color: activeTab === t.id ? '#93c5fd' : '#71717a',
                borderRadius: 8, padding: '8px 18px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
              }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: LIVE SWAPS
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'swaps' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Status filter pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUS_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setStatusFilter(o.value)}
                    style={{
                      background: statusFilter === o.value ? '#1e1e40' : '#18181b',
                      border: `1px solid ${statusFilter === o.value ? '#2563eb88' : '#27272a'}`,
                      color: statusFilter === o.value ? '#93c5fd' : '#71717a',
                      borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    }}>
                    {o.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#52525b' }} />
                  <input
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput.trim()) }}
                    placeholder="Order ID, user, asset…"
                    style={{
                      background: '#18181b', border: '1px solid #27272a', color: '#e4e4e7',
                      borderRadius: 8, padding: '7px 12px 7px 32px', fontSize: 13, outline: 'none', width: 220,
                    }}
                  />
                </div>
                <button onClick={() => setSearch(searchInput.trim())}
                  style={{ background: '#2563eb', border: 'none', color: 'white', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Search
                </button>
                {search && (
                  <button onClick={() => { setSearch(''); setSearchInput('') }}
                    style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13 }}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Summary */}
            <div style={{ color: '#52525b', fontSize: 12, marginBottom: 12 }}>
              Showing {swaps.length} of {total.toLocaleString()} swaps
              {search && <span> · Search: &quot;{search}&quot;</span>}
              {statusFilter !== 'all' && <span> · Status: {statusFilter}</span>}
            </div>

            {/* Table */}
            {loadingSwaps ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12, color: '#52525b' }}>
                <Loader2 size={22} style={{ animation: 'spin 0.8s linear infinite' }} />
                Loading swaps…
              </div>
            ) : swapsError ? (
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
                <AlertTriangle size={32} style={{ color: '#f59e0b', marginBottom: 12 }} />
                <p style={{ color: '#f87171', marginBottom: 16 }}>{swapsError}</p>
                <button onClick={() => fetchSwaps(page)}
                  style={{ background: '#2563eb', border: 'none', color: 'white', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600 }}>
                  Retry
                </button>
              </div>
            ) : (
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #27272a', background: '#0f0f1a' }}>
                        {['ID', 'Order ID', 'User', 'From', 'To', 'Amount', 'Status', 'Date', ''].map((h, i) => (
                          <th key={i} style={{ textAlign: 'left', padding: '10px 14px', color: '#52525b', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {swaps.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ padding: '40px 14px', textAlign: 'center', color: '#52525b' }}>
                            No swaps found{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.
                          </td>
                        </tr>
                      ) : swaps.map((s, i) => (
                        <tr key={s.id} style={{ borderBottom: i < swaps.length - 1 ? '1px solid #1a1a2a' : 'none', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#0f0f1a')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '11px 14px', color: '#52525b' }}>#{s.id}</td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ fontFamily: 'monospace', color: '#a1a1aa', fontSize: 11 }} title={s.sideshiftOrderId}>
                              {truncate(s.sideshiftOrderId, 16)}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', color: '#a1a1aa', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={s.userId}>
                            {truncate(s.userId, 13)}
                          </td>
                          <td style={{ padding: '11px 14px', color: '#e4e4e7', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {s.fromAsset}
                            <span style={{ color: '#52525b', fontWeight: 400 }}> ({s.fromNetwork})</span>
                          </td>
                          <td style={{ padding: '11px 14px', color: '#e4e4e7', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {s.toAsset}
                            <span style={{ color: '#52525b', fontWeight: 400 }}> ({s.toNetwork})</span>
                          </td>
                          <td style={{ padding: '11px 14px', color: '#a1a1aa', whiteSpace: 'nowrap' }}>
                            {s.fromAmount} → {s.settleAmount}
                          </td>
                          <td style={{ padding: '11px 14px' }}>{statusBadge(s.status)}</td>
                          <td style={{ padding: '11px 14px', color: '#52525b', whiteSpace: 'nowrap', fontSize: 11 }}>
                            {fmt(s.createdAt)}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <button onClick={() => openDetail(s)}
                              style={{ background: '#1e1e40', border: '1px solid #2563eb44', color: '#93c5fd', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                              <Eye size={12} /> Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ padding: '14px 20px', borderTop: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#52525b', fontSize: 12 }}>
                      Page {page} of {totalPages} · {total.toLocaleString()} total
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => fetchSwaps(page - 1)} disabled={page <= 1}
                        style={{ background: '#18181b', border: '1px solid #27272a', color: page <= 1 ? '#3f3f46' : '#a1a1aa', borderRadius: 8, padding: '6px 12px', cursor: page <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                        <ChevronLeft size={14} /> Prev
                      </button>
                      <button onClick={() => fetchSwaps(page + 1)} disabled={page >= totalPages}
                        style={{ background: '#18181b', border: '1px solid #27272a', color: page >= totalPages ? '#3f3f46' : '#a1a1aa', borderRadius: 8, padding: '6px 12px', cursor: page >= totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: METRICS
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'metrics' && (
          <div>
            {loadingMetrics ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12, color: '#52525b' }}>
                <Loader2 size={22} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading metrics…
              </div>
            ) : metrics ? (
              <>
                {/* KPI grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
                  <MetricCard icon={ArrowLeftRight} label="All Time Swaps"   value={metrics.totalAllTime}  color="#2563eb" />
                  <MetricCard icon={Clock}         label="Last 24 Hours"     value={metrics.last24h}       color="#7c3aed" />
                  <MetricCard icon={Zap}           label="Last 1 Hour"       value={metrics.last1h}        color="#0891b2" />
                  <MetricCard icon={Activity}      label="Last 5 Minutes"    value={metrics.last5min}      color="#059669" alert={metrics.spikeDetected} />
                  <MetricCard icon={XCircle}       label="Error Rate (24h)"  value={`${metrics.errorRate}%`} color={metrics.errorRate > 20 ? '#dc2626' : '#d97706'} alert={metrics.errorRate > 20} />
                  <MetricCard icon={TrendingUp}    label="Avg / 5 min"       value={metrics.averagePer5Min} color="#16a34a" sub="1h rolling average" />
                </div>

                {/* Status breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '20px 24px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={15} style={{ color: '#16a34a' }} /> Status Breakdown (All Time)
                    </h3>
                    {metrics.statusBreakdown.length === 0 ? (
                      <p style={{ color: '#52525b', fontSize: 13 }}>No data yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {metrics.statusBreakdown.map(s => {
                          const color = STATUS_COLOR[s.status] ?? '#71717a'
                          const pct = metrics.totalAllTime > 0 ? Math.round((s.count / metrics.totalAllTime) * 100) : 0
                          return (
                            <div key={s.status}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                                <span style={{ color: '#a1a1aa' }}>{s.status}</span>
                                <span style={{ color: '#52525b' }}>{s.count.toLocaleString()} ({pct}%)</span>
                              </div>
                              <div style={{ background: '#09090b', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Per-hour chart (last 24h) */}
                  <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '20px 24px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Activity size={15} style={{ color: '#2563eb' }} /> Swaps per Hour (Last 24h)
                    </h3>
                    {metrics.perHour.length < 2 ? (
                      <p style={{ color: '#52525b', fontSize: 13 }}>Not enough data yet.</p>
                    ) : (() => {
                      const max = Math.max(...metrics.perHour.map(h => h.count), 1)
                      const W = 300, H = 70
                      const pts = metrics.perHour.map((h, i) => {
                        const x = (i / (metrics.perHour.length - 1)) * W
                        const y = H - (h.count / max) * (H - 10) - 5
                        return `${x},${y}`
                      }).join(' ')
                      return (
                        <div>
                          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 70 }} preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
                              </linearGradient>
                            </defs>
                            <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
                            <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#mg)" />
                          </svg>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#3f3f46', marginTop: 4 }}>
                            <span>{new Date(metrics.perHour[0].hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>{new Date(metrics.perHour[metrics.perHour.length - 1].hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Spike alert detail */}
                {metrics.spikeDetected && (
                  <div style={{
                    background: '#450a0a33', border: '1px solid #dc262655', borderRadius: 12,
                    padding: '16px 20px', marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 14,
                  }}>
                    <AlertTriangle size={20} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ margin: '0 0 6px', color: '#f87171', fontWeight: 700 }}>⚠ Abnormal Activity Spike Detected</p>
                      <p style={{ margin: 0, color: '#fca5a5', fontSize: 13 }}>
                        <strong>{metrics.last5min}</strong> swaps in the last 5 minutes vs rolling average of{' '}
                        <strong>{metrics.averagePer5Min}</strong>/5 min. This is more than 3× the normal rate.
                        Review for bot activity or system issues.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: '#52525b' }}>No metrics available.</p>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: CONFIGURATION
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'config' && (
          <div style={{ maxWidth: 620 }}>
            {loadingConfig ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#52525b', padding: '40px 0' }}>
                <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading configuration…
              </div>
            ) : config ? (
              <>
                {/* Emergency Stop */}
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '24px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {config.swapExecutionEnabled
                          ? <ShieldCheck size={18} style={{ color: '#16a34a' }} />
                          : <ShieldAlert size={18} style={{ color: '#dc2626' }} />}
                        Emergency Stop
                      </h3>
                      <p style={{ margin: 0, color: '#71717a', fontSize: 13, maxWidth: 360 }}>
                        {config.swapExecutionEnabled
                          ? 'Swap execution is currently enabled globally. Toggle to disable all new swap processing immediately.'
                          : '🛑 Swap execution is DISABLED. No new swaps will be processed until re-enabled.'}
                      </p>
                      {!isSuperAdmin && (
                        <p style={{ margin: '8px 0 0', color: '#d97706', fontSize: 12 }}>
                          ⚠ Only super_admin can toggle swap execution.
                        </p>
                      )}
                      {config.updatedBy && (
                        <p style={{ margin: '8px 0 0', color: '#52525b', fontSize: 11 }}>
                          Last updated by {config.updatedBy} at {fmt(config.updatedAt)}
                        </p>
                      )}
                    </div>
                    <button
                      disabled={!isSuperAdmin || savingConfig}
                      onClick={() => saveConfig({ swapExecutionEnabled: !config.swapExecutionEnabled })}
                      style={{
                        background: config.swapExecutionEnabled ? '#16a34a22' : '#dc262622',
                        border: `1px solid ${config.swapExecutionEnabled ? '#16a34a55' : '#dc262655'}`,
                        color: config.swapExecutionEnabled ? '#4ade80' : '#f87171',
                        borderRadius: 10, padding: '10px 20px',
                        cursor: isSuperAdmin ? 'pointer' : 'not-allowed',
                        opacity: !isSuperAdmin ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {savingConfig
                        ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                        : config.swapExecutionEnabled
                          ? <ToggleRight size={20} />
                          : <ToggleLeft size={20} />}
                      {config.swapExecutionEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>

                {/* API Key Management */}
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: '24px', marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Key size={18} style={{ color: '#7c3aed' }} /> SideShift API Key
                  </h3>
                  <p style={{ margin: '0 0 16px', color: '#71717a', fontSize: 13 }}>
                    API key used for authenticated SideShift requests. Stored securely server-side.
                  </p>

                  {/* Current key (masked) */}
                  <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontFamily: 'monospace', fontSize: 13, color: '#a1a1aa' }}>
                    {config.sideshiftApiKey || <span style={{ color: '#3f3f46' }}>No API key configured</span>}
                  </div>

                  {!showApiKeyInput ? (
                    <button onClick={() => setShowApiKeyInput(true)}
                      style={{ background: '#1e1e40', border: '1px solid #2563eb44', color: '#93c5fd', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                      <Key size={14} /> Update API Key
                    </button>
                  ) : (
                    <div>
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={e => setApiKeyInput(e.target.value)}
                        placeholder="Enter new SideShift API key…"
                        style={{
                          background: '#09090b', border: '1px solid #3f3f46', color: '#e4e4e7',
                          borderRadius: 8, padding: '9px 14px', fontSize: 13, outline: 'none',
                          width: '100%', boxSizing: 'border-box', marginBottom: 10,
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          disabled={!apiKeyInput || savingConfig}
                          onClick={() => saveConfig({ sideshiftApiKey: apiKeyInput })}
                          style={{
                            background: '#2563eb', border: 'none', color: 'white',
                            borderRadius: 8, padding: '8px 18px', cursor: apiKeyInput ? 'pointer' : 'not-allowed',
                            opacity: !apiKeyInput ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
                          }}>
                          {savingConfig ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Save size={14} />}
                          Save Key
                        </button>
                        <button onClick={() => { setShowApiKeyInput(false); setApiKeyInput('') }}
                          style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Config message */}
                {configMsg && (
                  <div style={{
                    background: configMsg.includes('success') ? '#16a34a22' : '#dc262622',
                    border: `1px solid ${configMsg.includes('success') ? '#16a34a55' : '#dc262655'}`,
                    borderRadius: 10, padding: '12px 18px', fontSize: 13,
                    color: configMsg.includes('success') ? '#4ade80' : '#f87171',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {configMsg.includes('success') ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                    {configMsg}
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: '#52525b' }}>Failed to load configuration.</p>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SWAP DETAIL MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {detailOpen && detailSwap && (
        <>
          <div onClick={() => setDetailOpen(false)}
            style={{ position: 'fixed', inset: 0, background: '#00000080', backdropFilter: 'blur(4px)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: '#0f0f1a', border: '1px solid #27272a', borderRadius: 16,
            padding: 0, zIndex: 301, width: '94%', maxWidth: 680,
            maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #1a1a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowLeftRight size={15} style={{ color: '#2563eb' }} />
                  Swap Detail
                </h3>
                <span style={{ fontFamily: 'monospace', color: '#52525b', fontSize: 11 }}>{detailSwap.sideshiftOrderId}</span>
              </div>
              <button onClick={() => setDetailOpen(false)}
                style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
              {loadingDetail ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10, color: '#52525b' }}>
                  <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> Fetching SideShift data…
                </div>
              ) : (
                <>
                  {/* Local DB record */}
                  <Section title="Local Record" color="#2563eb">
                    <Row label="ID" value={`#${detailSwap.id}`} />
                    <Row label="Status" value={statusBadge(detailSwap.status)} />
                    <Row label="User ID" value={<Mono>{detailSwap.userId}</Mono>} />
                    <Row label="Wallet" value={<Mono>{detailSwap.walletAddress ?? '—'}</Mono>} />
                    <Row label="From" value={`${detailSwap.fromAmount} ${detailSwap.fromAsset} (${detailSwap.fromNetwork})`} />
                    <Row label="To" value={`${detailSwap.settleAmount} ${detailSwap.toAsset} (${detailSwap.toNetwork})`} />
                    <Row label="Deposit Addr" value={<Mono>{detailSwap.depositAddress ?? '—'}</Mono>} />
                    <Row label="Tx Hash" value={<Mono>{detailSwap.txHash ?? '—'}</Mono>} />
                    <Row label="Quote ID" value={<Mono>{detailSwap.quoteId ?? '—'}</Mono>} />
                    <Row label="Created" value={fmt(detailSwap.createdAt)} />
                    <Row label="Updated" value={fmt(detailSwap.updatedAt)} />
                  </Section>

                  {/* SideShift live order */}
                  {sideshiftOrder ? (
                    <Section title="SideShift Live Order" color="#059669">
                      <Row label="Status" value={sideshiftOrder.status ? statusBadge(String(sideshiftOrder.status)) : '—'} />
                      <Row label="Rate" value={String(sideshiftOrder.rate ?? '—')} />
                      <Row label="Deposit Amount" value={`${sideshiftOrder.depositAmount ?? '—'} ${sideshiftOrder.depositCoin ?? ''}`} />
                      <Row label="Settle Amount" value={`${sideshiftOrder.settleAmount ?? '—'} ${sideshiftOrder.settleCoin ?? ''}`} />
                      <Row label="Deposit Address" value={<Mono>{String(sideshiftOrder.depositAddress ?? '—')}</Mono>} />
                      <Row label="Settle Address" value={<Mono>{String(sideshiftOrder.settleAddress ?? '—')}</Mono>} />
                      <Row label="Expires At" value={sideshiftOrder.expiresAt ? fmt(String(sideshiftOrder.expiresAt)) : '—'} />
                      <Row label="SS Created" value={sideshiftOrder.createdAt ? fmt(String(sideshiftOrder.createdAt)) : '—'} />
                    </Section>
                  ) : (
                    <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
                      <p style={{ color: '#52525b', fontSize: 13, margin: 0 }}>
                        ℹ️ SideShift live data unavailable (order may be expired or network error).
                      </p>
                    </div>
                  )}

                  {/* SideShift quote */}
                  {sideshiftQuote && (
                    <Section title="SideShift Quote Details" color="#7c3aed">
                      {Object.entries(sideshiftQuote).slice(0, 12).map(([k, v]) => (
                        <Row key={k} label={k} value={<Mono>{String(v ?? '—')}</Mono>} />
                      ))}
                    </Section>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#18181b', border: `1px solid ${color}33`, borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ background: `${color}11`, borderBottom: `1px solid ${color}22`, padding: '10px 16px' }}>
        <span style={{ color, fontWeight: 700, fontSize: 13 }}>{title}</span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ color: '#52525b', fontSize: 12, minWidth: 120, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{ color: '#a1a1aa', fontSize: 12, wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{children}</span>
}
