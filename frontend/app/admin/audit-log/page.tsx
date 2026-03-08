'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { Filter, Calendar, User } from 'lucide-react'
import AdminNavbar from '@/components/AdminNavbar'

interface AuditLogEntry {
  id: number
  adminId: string
  adminEmail: string
  action: string
  targetResource: string | null
  targetId: string | null
  metadata: any
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

interface AdminInfo {
  name: string
  email: string
  role: string
}

export default function AuditLogPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState<AdminInfo | null>(null)
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [totalPages, setTotalPages] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [adminIdFilter, setAdminIdFilter] = useState('')
  const [daysFilter, setDaysFilter] = useState(30)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchAuditLogs = useCallback(async () => {
    const token = sessionStorage.getItem('admin-token')
    if (!token) {
      router.push('/admin/login')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        days: String(daysFilter),
      })
      
      if (actionFilter) params.append('action', actionFilter)
      if (adminIdFilter) params.append('adminId', adminIdFilter)

      const res = await fetch(`/api/admin/audit-log?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 401 || res.status === 403) {
        router.push('/admin/login')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to fetch audit logs')
      }

      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setLastRefresh(new Date())
    } catch (err: any) {
      console.error('Error fetching audit logs:', err)
      setError(err.message || 'Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }, [router, page, actionFilter, adminIdFilter, daysFilter, limit])

  useEffect(() => {
    // Load cached admin info immediately
    const cached = sessionStorage.getItem('admin-info')
    if (cached) {
      try {
        const adminInfo = JSON.parse(cached)
        setAdmin(adminInfo)
        
        // Only super_admin can access audit logs
        if (adminInfo.role !== 'super_admin') {
          router.push('/admin/dashboard')
          return
        }
      } catch {}
    }
    
    fetchAuditLogs()
  }, [fetchAuditLogs, router])

  const handleLogout = async () => {
    sessionStorage.removeItem('admin-token')
    sessionStorage.removeItem('admin-info')
    document.cookie = 'admin-session=; path=/; max-age=0; SameSite=Lax'
    if (auth) await signOut(auth)
    router.push('/admin/login')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  if (loading && logs.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#070710', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#71717a' }}>Loading audit logs...</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#070710' }}>
      <AdminNavbar 
        activePage="audit-log"
        adminInfo={admin}
        onLogout={handleLogout}
        onRefresh={fetchAuditLogs}
        lastRefresh={lastRefresh}
      />
      
      <div style={{ padding: '40px 32px', maxWidth: 1600, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#e4e4e7' }}>Admin Audit Log</h2>
          <p style={{ color: '#52525b', fontSize: 13, marginTop: 4 }}>Immutable record of all privileged admin actions</p>
        </div>

        {/* Filters */}
        <div style={{
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 13, marginBottom: 6 }}>
                <Filter size={14} style={{ display: 'inline', marginRight: 6 }} />
                Action Filter
              </label>
              <input
                type="text"
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
                placeholder="e.g., approve_admin_request"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: 6,
                  color: '#e4e4e7',
                  fontSize: 14,
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 13, marginBottom: 6 }}>
                <User size={14} style={{ display: 'inline', marginRight: 6 }} />
                Admin ID Filter
              </label>
              <input
                type="text"
                value={adminIdFilter}
                onChange={(e) => { setAdminIdFilter(e.target.value); setPage(1) }}
                placeholder="Firebase UID"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: 6,
                  color: '#e4e4e7',
                  fontSize: 14,
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 13, marginBottom: 6 }}>
                <Calendar size={14} style={{ display: 'inline', marginRight: 6 }} />
                Days to Show
              </label>
              <select
                value={daysFilter}
                onChange={(e) => { setDaysFilter(Number(e.target.value)); setPage(1) }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: 6,
                  color: '#e4e4e7',
                  fontSize: 14,
                }}
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>Last year</option>
              </select>
            </div>
          </div>
          
          {(actionFilter || adminIdFilter) && (
            <button
              onClick={() => { setActionFilter(''); setAdminIdFilter(''); setPage(1) }}
              style={{
                marginTop: 12,
                padding: '6px 12px',
                background: '#27272a',
                border: 'none',
                borderRadius: 6,
                color: '#a1a1aa',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#7f1d1d',
            border: '1px solid #991b1b',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            color: '#fecaca',
          }}>
            {error}
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'flex',
          gap: 16,
          marginBottom: 24,
        }}>
          <div style={{
            flex: 1,
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ color: '#71717a', fontSize: 13, marginBottom: 8 }}>Total Events</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#e4e4e7' }}>{total.toLocaleString()}</div>
          </div>
          <div style={{
            flex: 1,
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ color: '#71717a', fontSize: 13, marginBottom: 8 }}>Showing</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#e4e4e7' }}>{logs.length}</div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#27272a' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#a1a1aa', fontSize: 13, fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#a1a1aa', fontSize: 13, fontWeight: 600 }}>Admin</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#a1a1aa', fontSize: 13, fontWeight: 600 }}>Action</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#a1a1aa', fontSize: 13, fontWeight: 600 }}>Target</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#a1a1aa', fontSize: 13, fontWeight: 600 }}>IP Address</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#a1a1aa', fontSize: 13, fontWeight: 600 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr
                    key={log.id}
                    style={{
                      borderTop: index > 0 ? '1px solid #27272a' : 'none',
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: '#e4e4e7', fontSize: 13 }}>
                      {formatDate(log.createdAt)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#e4e4e7', fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{log.adminEmail}</div>
                      <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>
                        {log.adminId.substring(0, 8)}...
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      <span style={{
                        background: '#2563eb22',
                        color: '#2563eb',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#e4e4e7', fontSize: 13 }}>
                      {log.targetResource && (
                        <>
                          <div style={{ fontWeight: 600 }}>{log.targetResource}</div>
                          {log.targetId && (
                            <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>
                              ID: {log.targetId}
                            </div>
                          )}
                        </>
                      )}
                      {!log.targetResource && <span style={{ color: '#71717a' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#a1a1aa', fontSize: 12, fontFamily: 'monospace' }}>
                      {log.ipAddress || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <details>
                          <summary style={{ cursor: 'pointer', color: '#2563eb' }}>View</summary>
                          <pre style={{
                            marginTop: 8,
                            padding: 8,
                            background: '#09090b',
                            borderRadius: 4,
                            fontSize: 11,
                            color: '#e4e4e7',
                            overflow: 'auto',
                            maxWidth: 300,
                          }}>
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span style={{ color: '#71717a' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logs.length === 0 && !loading && (
            <div style={{ padding: 40, textAlign: 'center', color: '#71717a' }}>
              No audit log entries found.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 24,
          }}>
            <div style={{ color: '#71717a', fontSize: 13 }}>
              Page {page} of {totalPages}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{
                  padding: '8px 16px',
                  background: page === 1 ? '#27272a' : '#2563eb',
                  color: page === 1 ? '#71717a' : 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '8px 16px',
                  background: page === totalPages ? '#27272a' : '#2563eb',
                  color: page === totalPages ? '#71717a' : 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
