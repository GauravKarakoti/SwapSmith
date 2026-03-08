'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Shield, Database, BarChart2, Users, ArrowLeftRight, Coins, LineChart, Terminal } from 'lucide-react'

const YEAR = new Date().getFullYear()

const QUICK_LINKS = [
  { label: 'Analytics',    href: '/admin/dashboard', icon: BarChart2     },
  { label: 'Users',        href: '/admin/users',     icon: Users          },
  { label: 'Swaps',        href: '/admin/swaps',     icon: ArrowLeftRight },
  { label: 'Test Coins',   href: '/admin/coins',     icon: Coins          },
  { label: 'Stats',        href: '/admin/stats',     icon: LineChart      },
  { label: 'Database',     href: '/admin/database',  icon: Database       },
  { label: 'SQL Terminal', href: '/admin/sql',       icon: Terminal       },
]

export default function AdminFooter() {
  return (
    <footer style={{
      background:   '#0b0b18',
      borderTop:    '1px solid #18182a',
      marginTop:    'auto',
      padding:      '32px 40px 24px',
    }}>
      <div style={{ maxWidth: 1600, margin: '0 auto' }}>

        {/* Top row */}
        <div style={{
          display:       'flex',
          alignItems:    'flex-start',
          justifyContent:'space-between',
          gap:           32,
          flexWrap:      'wrap',
          marginBottom:  28,
          paddingBottom: 24,
          borderBottom:  '1px solid #18182a',
        }}>

          {/* Brand */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Image
                src="/swapsmithicon.png"
                alt="SwapSmith"
                width={32}
                height={32}
                style={{ borderRadius: 8 }}
                unoptimized
              />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#e4e4e7' }}>
                SwapSmith Admin
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#52525b', margin: 0, maxWidth: 240, lineHeight: 1.6 }}>
              Internal administration panel. Restricted access — authorised personnel only.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div style={{
                background:   '#14532d22',
                border:       '1px solid #16a34a44',
                borderRadius: 20,
                padding:      '2px 10px',
                display:      'flex',
                alignItems:   'center',
                gap:          5,
              }}>
                <Shield size={10} style={{ color: '#4ade80' }} />
                <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, letterSpacing: '0.05em' }}>
                  SECURE SESSION
                </span>
              </div>
            </div>
          </div>

          {/* Quick nav */}
          <div>
            <p style={{ fontSize: 11, color: '#3f3f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
              Quick Navigation
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 28px' }}>
              {QUICK_LINKS.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display:     'flex',
                    alignItems:  'center',
                    gap:         7,
                    color:       '#71717a',
                    fontSize:    12,
                    textDecoration: 'none',
                    transition:  'color 0.15s',
                  }}
                  onMouseOver={e => {(e.currentTarget as HTMLAnchorElement).style.color = '#93c5fd'}}
                  onMouseOut={e  => {(e.currentTarget as HTMLAnchorElement).style.color = '#71717a'}}
                >
                  <Icon size={12} />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <p style={{ fontSize: 11, color: '#3f3f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
              System
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'API Status',      dot: '#4ade80' },
                { label: 'Database',        dot: '#4ade80' },
                { label: 'Auth Service',    dot: '#4ade80' },
              ].map(({ label, dot }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: dot,
                    boxShadow: `0 0 6px ${dot}88`,
                  }} />
                  <span style={{ fontSize: 12, color: '#71717a' }}>{label}</span>
                  <span style={{ fontSize: 10, color: dot, fontWeight: 600, marginLeft: 'auto', paddingLeft: 12 }}>
                    LIVE
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          flexWrap:       'wrap',
          gap:            12,
        }}>
          <p style={{ fontSize: 11, color: '#3f3f46', margin: 0 }}>
            © {YEAR} SwapSmith. All rights reserved. · Admin Panel v2.0
          </p>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/" style={{ fontSize: 11, color: '#3f3f46', textDecoration: 'none' }}>
              ← Back to App
            </Link>
            <Link href="/admin/login" style={{ fontSize: 11, color: '#3f3f46', textDecoration: 'none' }}>
              Re-login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
