'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { BarChart2, Users, ArrowLeftRight, Coins, RefreshCw, LogOut, Menu, X } from 'lucide-react'

export type AdminPage = 'dashboard' | 'users' | 'swaps' | 'coins'

export interface AdminNavbarProps {
  activePage: AdminPage
  adminInfo: { name: string; email: string; role: string } | null
  onLogout: () => void
  /** Optional per-page refresh callback – renders a Refresh button when provided */
  onRefresh?: () => void
  /** When provided, shows "Refreshed HH:MM:SS" in the navbar */
  lastRefresh?: Date
}

const NAV_ITEMS = [
  { label: 'Analytics',  icon: BarChart2,      path: '/admin/dashboard', key: 'dashboard' },
  { label: 'Users',      icon: Users,           path: '/admin/users',     key: 'users'     },
  { label: 'Swaps',      icon: ArrowLeftRight,  path: '/admin/swaps',     key: 'swaps'     },
  { label: 'Test Coins', icon: Coins,           path: '/admin/coins',     key: 'coins'     },
] as const

export default function AdminNavbar({ activePage, adminInfo, onLogout, onRefresh, lastRefresh }: AdminNavbarProps) {
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const desktopBtnStyle = (isActive: boolean): React.CSSProperties => ({
    background:   isActive ? '#1e1e40' : '#18181b',
    border:       `1px solid ${isActive ? '#2563eb55' : '#27272a'}`,
    color:        isActive ? '#93c5fd' : '#a1a1aa',
    borderRadius: 8,
    padding:      '6px 14px',
    cursor:       isActive ? 'default' : 'pointer',
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    fontSize:     13,
    fontWeight:   isActive ? 600 : 400,
  })

  const mobileBtnStyle = (isActive: boolean): React.CSSProperties => ({
    background:   isActive ? '#1e1e40' : '#18181b',
    border:       `1px solid ${isActive ? '#2563eb55' : '#27272a'}`,
    color:        isActive ? '#93c5fd' : '#a1a1aa',
    borderRadius: 10,
    padding:      '12px 16px',
    cursor:       isActive ? 'default' : 'pointer',
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    fontSize:     14,
    fontWeight:   isActive ? 600 : 400,
    width:        '100%',
    textAlign:    'left',
  })

  return (
    <>
      {/* ── Responsive styles injected once per navbar ── */}
      <style>{`
        .admin-nav-label     { display: inline; }
        .admin-nav-sep       { display: inline; }
        .admin-nav-right     { display: flex; }
        .admin-nav-hamburger { display: none !important; }
        @media (max-width: 768px) {
          .admin-nav-label     { display: none !important; }
          .admin-nav-sep       { display: none !important; }
          .admin-nav-right     { display: none !important; }
          .admin-nav-hamburger { display: flex !important; }
          .admin-nav           { padding: 10px 16px !important; }
          .admin-content       { padding: 16px 10px !important; }
          .admin-2col          { grid-template-columns: 1fr !important; }
          .admin-kpi-grid      { grid-template-columns: 1fr 1fr !important; }
          .admin-stats-grid    { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
        }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      {/* ── Desktop / tablet navbar ── */}
      <nav
        className="admin-nav"
        style={{
          background:      '#0b0b18',
          borderBottom:    '1px solid #18182a',
          padding:         '14px 32px',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          position:        'sticky',
          top:             0,
          zIndex:          50,
          gap:             8,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Image
            src="/swapsmithicon.png"
            alt="SwapSmith"
            width={36}
            height={36}
            style={{ borderRadius: 8 }}
            unoptimized
          />
          <span className="admin-nav-label" style={{ fontSize: 18, fontWeight: 700 }}>
            SwapSmith Admin
          </span>
          {adminInfo?.role && (
            <span style={{
              background:   '#1e3a5f',
              color:        '#93c5fd',
              border:       '1px solid #2563eb44',
              borderRadius: 20,
              fontSize:     11,
              padding:      '2px 10px',
              marginLeft:   4,
              fontWeight:   600,
            }}>
              {adminInfo.role.replace('_', ' ').toUpperCase()}
            </span>
          )}
        </div>

        {/* Desktop right side */}
        <div className="admin-nav-right" style={{ alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {(adminInfo?.name || lastRefresh) && (
            <span className="admin-nav-label" style={{ color: '#52525b', fontSize: 13 }}>
              {adminInfo?.name}
              {lastRefresh ? ` · Refreshed ${lastRefresh.toLocaleTimeString()}` : ''}
            </span>
          )}

          {NAV_ITEMS.map(({ label, icon: Icon, path, key }) => {
            const isActive = activePage === key
            return (
              <button
                key={key}
                onClick={isActive ? undefined : () => router.push(path)}
                style={desktopBtnStyle(isActive)}
              >
                <Icon size={14} />
                <span className="admin-nav-label">{label}</span>
              </button>
            )
          })}

          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                background:   '#18181b',
                border:       '1px solid #27272a',
                color:        '#a1a1aa',
                borderRadius: 8,
                padding:      '6px 14px',
                cursor:       'pointer',
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                fontSize:     13,
              }}
            >
              <RefreshCw size={14} />
              <span className="admin-nav-label">Refresh</span>
            </button>
          )}

          <button
            onClick={onLogout}
            style={{
              background:   '#450a0a22',
              border:       '1px solid #dc262644',
              color:        '#f87171',
              borderRadius: 8,
              padding:      '6px 14px',
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              fontSize:     13,
            }}
          >
            <LogOut size={14} />
            <span className="admin-nav-label">Logout</span>
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="admin-nav-hamburger"
          onClick={() => setMobileNavOpen(true)}
          style={{
            background:   '#18181b',
            border:       '1px solid #27272a',
            color:        '#a1a1aa',
            borderRadius: 8,
            padding:      '6px 10px',
            cursor:       'pointer',
            alignItems:   'center',
            gap:          6,
          }}
        >
          <Menu size={20} />
        </button>
      </nav>

      {/* ── Mobile drawer ── */}
      {mobileNavOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMobileNavOpen(false)}
            style={{
              position:       'fixed',
              inset:          0,
              background:     '#00000070',
              backdropFilter: 'blur(2px)',
              zIndex:         200,
            }}
          />

          {/* Drawer panel */}
          <div style={{
            position:       'fixed',
            top:            0,
            right:          0,
            bottom:         0,
            width:          '80%',
            maxWidth:       300,
            background:     '#0b0b18',
            borderLeft:     '1px solid #1e1e2a',
            zIndex:         201,
            display:        'flex',
            flexDirection:  'column',
            padding:        24,
            gap:            8,
          }}>
            {/* Drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Image src="/swapsmithicon.png" alt="SwapSmith" width={32} height={32} style={{ borderRadius: 8 }} unoptimized />
                <span style={{ fontSize: 16, fontWeight: 700 }}>SwapSmith Admin</span>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: 6, cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Admin info card */}
            {adminInfo && (
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                <p style={{ color: '#71717a', fontSize: 12, margin: 0 }}>{adminInfo.name}</p>
                <p style={{ color: '#52525b', fontSize: 11, margin: '2px 0 0' }}>
                  {lastRefresh ? `Refreshed: ${lastRefresh.toLocaleTimeString()}` : adminInfo.email}
                </p>
              </div>
            )}

            {/* Nav buttons */}
            {NAV_ITEMS.map(({ label, icon: Icon, path, key }) => {
              const isActive = activePage === key
              return (
                <button
                  key={key}
                  onClick={isActive ? undefined : () => { setMobileNavOpen(false); router.push(path) }}
                  style={mobileBtnStyle(isActive)}
                >
                  <Icon size={16} /> {label}
                </button>
              )
            })}

            {onRefresh && (
              <button
                onClick={() => { setMobileNavOpen(false); onRefresh() }}
                style={mobileBtnStyle(false)}
              >
                <RefreshCw size={16} /> Refresh
              </button>
            )}

            <div style={{ flex: 1 }} />

            <button
              onClick={() => { setMobileNavOpen(false); onLogout() }}
              style={{
                background:   '#450a0a22',
                border:       '1px solid #dc262644',
                color:        '#f87171',
                borderRadius: 10,
                padding:      '12px 16px',
                cursor:       'pointer',
                display:      'flex',
                alignItems:   'center',
                gap:          10,
                fontSize:     14,
              }}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </>
      )}
    </>
  )
}
