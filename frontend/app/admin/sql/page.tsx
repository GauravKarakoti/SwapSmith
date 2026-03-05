'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle, Ban, ChevronRight, Clock, FileCode,
  LogOut, Play, RotateCcw, Send, Terminal, XCircle,
} from 'lucide-react'
import AdminNavbar from '@/components/AdminNavbar'

// ── Types ────────────────────────────────────────────────────────────────────

interface AdminInfo { name: string; email: string; role: string }

interface SqlRequest {
  id: number
  submitted_by_uid: string
  submitted_by_email: string
  submitted_by_name: string
  sql_query: string
  description: string | null
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'
  reviewed_by_email: string | null
  reviewed_by_name: string | null
  review_note: string | null
  execution_result: {
    rowCount: number
    rows: Record<string, unknown>[]
    fields: { name: string; dataTypeID: number }[]
  } | null
  execution_error: string | null
  rows_affected: number | null
  submitted_at: string
  reviewed_at: string | null
  executed_at: string | null
}

// ── Theme helpers ─────────────────────────────────────────────────────────────

const STATUS_META: Record<SqlRequest['status'], { bg: string; border: string; text: string; label: string }> = {
  pending:  { bg: '#451a0333', border: '#92400e55', text: '#fbbf24', label: 'Pending'  },
  approved: { bg: '#14532d33', border: '#16a34a55', text: '#4ade80', label: 'Approved' },
  rejected: { bg: '#450a0a33', border: '#b91c1c55', text: '#f87171', label: 'Rejected' },
  executed: { bg: '#1e3a5f33', border: '#2563eb55', text: '#93c5fd', label: 'Executed' },
  failed:   { bg: '#450a0a33', border: '#b91c1c55', text: '#f87171', label: 'Failed'   },
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SqlRequest['status'] }) {
  const m = STATUS_META[status]
  return (
    <span style={{
      background: m.bg, border: `1px solid ${m.border}`, color: m.text,
      borderRadius: 20, fontSize: 11, padding: '2px 10px', fontWeight: 600, flexShrink: 0,
    }}>
      {m.label}
    </span>
  )
}

// ── SQL Editor component ─────────────────────────────────────────────────────

interface SqlEditorProps {
  onSubmit: (sql: string, description: string) => void
  submitting: boolean
}

function SqlEditorPanel({ onSubmit, submitting }: SqlEditorProps) {
  const [sql, setSql] = useState('')
  const [description, setDescription] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const lines = sql.split('\n').length

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta  = e.currentTarget
      const s   = ta.selectionStart
      const end = ta.selectionEnd
      const next = sql.substring(0, s) + '  ' + sql.substring(end)
      setSql(next)
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = s + 2
          textareaRef.current.selectionEnd   = s + 2
        }
      })
    }
  }

  const canSubmit = sql.trim().length > 0 && !submitting

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Security notice ── */}
      <div style={{
        background: '#451a0333', border: '1px solid #92400e55', borderRadius: 10,
        padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <AlertCircle size={15} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>
            Security Policy — All submissions are logged and queued for super-admin approval
          </div>
          <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.7 }}>
            <span style={{ color: '#86efac' }}>✓ Allowed: </span>
            SELECT · INSERT · UPDATE · DELETE · WITH&nbsp;&nbsp;&nbsp;
            <span style={{ color: '#f87171' }}>✗ Blocked: </span>
            DROP · TRUNCATE · ALTER · CREATE · GRANT · REVOKE · EXECUTE
          </div>
        </div>
      </div>

      {/* ── Editor box ── */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #27272a', boxShadow: '0 0 0 1px #0a0a14' }}>

        {/* Title bar */}
        <div style={{
          background: '#0f0f1a', padding: '8px 14px', borderBottom: '1px solid #1a1a2e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ fontSize: 11, color: '#3f3f46', fontFamily: 'monospace', marginLeft: 8 }}>
              query.sql
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#3f3f46' }}>
            {sql.length.toLocaleString()} / 10,000 chars · {lines} line{lines !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Editor body */}
        <div style={{ display: 'flex', background: '#07070f', minHeight: 280 }}>
          {/* Line numbers */}
          <div style={{
            background: '#0b0b18', padding: '14px 10px 14px 6px',
            minWidth: 44, textAlign: 'right', userSelect: 'none',
            borderRight: '1px solid #1a1a2e', flexShrink: 0,
          }}>
            {Array.from({ length: Math.max(lines, 12) }, (_, i) => (
              <div key={i} style={{
                fontSize: 12, fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                color: '#3f3f46', lineHeight: '21px',
              }}>
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code area */}
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={e => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            placeholder={
              '-- SQL Terminal — queries are reviewed before execution\n' +
              '-- Tab = 2-space indent\n\n' +
              'SELECT table_name\nFROM information_schema.tables\nWHERE table_schema = \'public\'\nORDER BY table_name;'
            }
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', padding: '14px 16px',
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontSize: 13, lineHeight: '21px', color: '#c4b5fd', minHeight: 280,
              caretColor: '#7c3aed',
            }}
          />
        </div>
      </div>

      {/* ── Description + actions ── */}
      <input
        type="text"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Brief description of what this query does (recommended — helps reviewers approve faster)"
        style={{
          background: '#0f0f1a', border: '1px solid #27272a', borderRadius: 8,
          padding: '10px 14px', color: '#e4e4e7', fontSize: 13, outline: 'none', width: '100%',
          boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          onClick={() => { setSql(''); setDescription('') }}
          style={{
            background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
            borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontSize: 13,
          }}
        >
          Clear
        </button>
        <button
          onClick={() => { if (canSubmit) onSubmit(sql, description) }}
          disabled={!canSubmit}
          style={{
            background: canSubmit ? '#1e1e40' : '#18181b',
            border: `1px solid ${canSubmit ? '#2563eb66' : '#27272a'}`,
            color: canSubmit ? '#93c5fd' : '#52525b',
            borderRadius: 8, padding: '9px 22px',
            cursor: canSubmit ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: 13, fontWeight: 600,
          }}
        >
          <Send size={14} />
          {submitting ? 'Submitting…' : 'Submit for Approval'}
        </button>
      </div>
    </div>
  )
}

// ── Request row (expandable) ─────────────────────────────────────────────────

interface RequestRowProps {
  req: SqlRequest
  isSuperAdmin: boolean
  onApprove: (id: number, note: string) => Promise<void>
  onReject: (id: number, note: string) => Promise<void>
  onCancel: (id: number) => Promise<void>
}

function RequestRow({ req, isSuperAdmin, onApprove, onReject, onCancel }: RequestRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote]         = useState('')
  const [acting, setActing]     = useState(false)

  const act = async (fn: () => Promise<void>) => {
    setActing(true)
    try { await fn() } finally { setActing(false) }
  }

  const resultRows   = req.execution_result?.rows   ?? []
  const resultFields = req.execution_result?.fields ?? []

  return (
    <div style={{ borderRadius: 10, border: '1px solid #27272a', overflow: 'hidden', marginBottom: 10 }}>
      {/* ── Collapsed header ── */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '13px 18px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 12, background: '#0f0f1a',
          userSelect: 'none',
        }}
      >
        <ChevronRight
          size={15}
          style={{ color: '#52525b', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none', flexShrink: 0 }}
        />
        <StatusBadge status={req.status} />
        <span style={{ fontSize: 13, color: '#a1a1aa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {req.description || req.sql_query.replace(/\s+/g, ' ').substring(0, 90)}
        </span>
        <span style={{ fontSize: 11, color: '#3f3f46', flexShrink: 0 }}>
          #{req.id} · {req.submitted_by_email} · {new Date(req.submitted_at).toLocaleString()}
        </span>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div style={{ background: '#07070f', borderTop: '1px solid #1a1a2e', padding: '16px 18px' }}>

          {/* SQL query */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#52525b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Query
            </div>
            <pre style={{
              background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 8,
              padding: '12px 14px', margin: 0,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 12,
              color: '#c4b5fd', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6,
            }}>
              {req.sql_query}
            </pre>
          </div>

          {/* Execution success */}
          {req.execution_result && !req.execution_error && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✓</span>
                <span>Executed successfully — <strong>{req.rows_affected ?? 0}</strong> row(s) affected</span>
              </div>
              {resultFields.length > 0 && resultRows.length > 0 && (
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #1a1a2e' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#0d0d1c' }}>
                        {resultFields.map(f => (
                          <th key={f.name} style={{ padding: '7px 12px', textAlign: 'left', color: '#52525b', fontWeight: 700, borderBottom: '1px solid #1a1a2e', whiteSpace: 'nowrap' }}>
                            {f.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultRows.slice(0, 100).map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid #12121e' }}>
                          {resultFields.map(f => (
                            <td key={f.name} style={{ padding: '6px 12px', color: '#a1a1aa', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row[f.name] === null ? <span style={{ color: '#3f3f46' }}>NULL</span> : String(row[f.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {resultRows.length > 100 && (
                    <div style={{ padding: '8px 12px', fontSize: 11, color: '#52525b', borderTop: '1px solid #1a1a2e' }}>
                      Showing 100 of {resultRows.length} rows
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Execution error */}
          {req.execution_error && (
            <div style={{
              background: '#450a0a33', border: '1px solid #b91c1c55', borderRadius: 8,
              padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#f87171',
            }}>
              ✗ Execution error: {req.execution_error}
            </div>
          )}

          {/* Review note */}
          {req.review_note && (
            <div style={{
              background: '#1e3a5f33', border: '1px solid #2563eb55', borderRadius: 8,
              padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#93c5fd',
            }}>
              Review note by {req.reviewed_by_name ?? req.reviewed_by_email}: {req.review_note}
            </div>
          )}

          {/* Timestamps */}
          {(req.reviewed_at || req.executed_at) && (
            <div style={{ fontSize: 11, color: '#3f3f46', marginBottom: 12, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {req.reviewed_at && <span>Reviewed: {new Date(req.reviewed_at).toLocaleString()}</span>}
              {req.executed_at && <span>Executed: {new Date(req.executed_at).toLocaleString()}</span>}
            </div>
          )}

          {/* Super-admin actions */}
          {isSuperAdmin && req.status === 'pending' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Optional review note…"
                disabled={acting}
                style={{
                  flex: 1, minWidth: 180, background: '#0f0f1a', border: '1px solid #27272a',
                  borderRadius: 6, padding: '7px 12px', color: '#e4e4e7', fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => act(() => onApprove(req.id, note))}
                disabled={acting}
                style={{
                  background: '#14532d33', border: '1px solid #16a34a66', color: '#4ade80',
                  borderRadius: 6, padding: '7px 18px', cursor: acting ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                }}
              >
                <Play size={12} /> Approve &amp; Execute
              </button>
              <button
                onClick={() => act(() => onReject(req.id, note))}
                disabled={acting}
                style={{
                  background: '#450a0a33', border: '1px solid #b91c1c55', color: '#f87171',
                  borderRadius: 6, padding: '7px 18px', cursor: acting ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                }}
              >
                <Ban size={12} /> Reject
              </button>
            </div>
          )}

          {/* Admin: cancel own pending request */}
          {!isSuperAdmin && req.status === 'pending' && (
            <button
              onClick={() => act(() => onCancel(req.id))}
              disabled={acting}
              style={{
                background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
                borderRadius: 6, padding: '7px 16px', cursor: acting ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 4,
              }}
            >
              <XCircle size={12} /> Cancel Request
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'editor' | 'requests' | 'pending'

export default function SqlCommandPage() {
  const router = useRouter()
  const [adminInfo, setAdminInfo]           = useState<AdminInfo | null>(null)
  const [authChecked, setAuthChecked]       = useState(false)
  const token = useRef<string | null>(null)

  const [tab, setTab]                       = useState<Tab>('editor')
  const [myRequests, setMyRequests]         = useState<SqlRequest[]>([])
  const [pendingRequests, setPendingRequests] = useState<SqlRequest[]>([])
  const [loadingList, setLoadingList]       = useState(false)
  const [submitting, setSubmitting]         = useState(false)
  const [toast, setToast]                   = useState<{ msg: string; ok: boolean } | null>(null)

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = sessionStorage.getItem('admin-token')
    if (!t) { router.push('/admin/login'); return }
    token.current = t
    const cached = sessionStorage.getItem('admin-info')
    if (cached) { try { setAdminInfo(JSON.parse(cached)) } catch { /* ignore */ } }
    setAuthChecked(true)
  }, [router])

  const isSuperAdmin = adminInfo?.role === 'super_admin'

  const handleLogout = () => {
    sessionStorage.removeItem('admin-token')
    sessionStorage.removeItem('admin-info')
    router.push('/admin/login')
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Fetch requests ────────────────────────────────────────────────────────
  const fetchMyRequests = useCallback(async () => {
    if (!token.current) return
    setLoadingList(true)
    try {
      const res  = await fetch('/api/admin/sql?limit=50', {
        headers: { Authorization: `Bearer ${token.current}` },
      })
      const data = await res.json()
      if (res.ok) setMyRequests(data.requests ?? [])
    } finally {
      setLoadingList(false)
    }
  }, [])

  const fetchPending = useCallback(async () => {
    if (!token.current) return
    const res  = await fetch('/api/admin/sql?status=pending&limit=50', {
      headers: { Authorization: `Bearer ${token.current}` },
    })
    const data = await res.json()
    if (res.ok) setPendingRequests(data.requests ?? [])
  }, [])

  useEffect(() => {
    if (!authChecked) return
    fetchMyRequests()
    if (isSuperAdmin) fetchPending()
  }, [authChecked, isSuperAdmin, fetchMyRequests, fetchPending])

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleSubmit = async (sql: string, description: string) => {
    setSubmitting(true)
    try {
      const res  = await fetch('/api/admin/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.current}` },
        body: JSON.stringify({ sql, description }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Request submitted — awaiting super-admin approval')
        fetchMyRequests()
        if (isSuperAdmin) fetchPending()
      } else {
        showToast(data.error ?? 'Submission failed', false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (id: number, note: string) => {
    const res  = await fetch(`/api/admin/sql/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.current}` },
      body: JSON.stringify({ action: 'approve', note }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast(data.status === 'executed'
        ? `Executed — ${data.rowsAffected} row(s) affected`
        : `Failed: ${data.error}`,
        data.status === 'executed')
    } else {
      showToast(data.error ?? 'Approval failed', false)
    }
    fetchMyRequests()
    fetchPending()
  }

  const handleReject = async (id: number, note: string) => {
    const res  = await fetch(`/api/admin/sql/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.current}` },
      body: JSON.stringify({ action: 'reject', note }),
    })
    if (res.ok) showToast('Request rejected')
    else showToast('Rejection failed', false)
    fetchMyRequests()
    fetchPending()
  }

  const handleCancel = async (id: number) => {
    const res = await fetch(`/api/admin/sql/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token.current}` },
    })
    if (res.ok) showToast('Request cancelled')
    else showToast('Cancellation failed', false)
    fetchMyRequests()
  }

  // ── Render guards ─────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#52525b', fontSize: 14 }}>Verifying access…</div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; Icon: React.FC<{ size?: number }> }[] = [
    { key: 'editor',   label: 'SQL Editor',   Icon: FileCode },
    { key: 'requests', label: 'My Requests',  Icon: Clock    },
    ...(isSuperAdmin ? [{
      key: 'pending' as Tab,
      label: pendingRequests.length ? `Pending (${pendingRequests.length})` : 'Pending Approval',
      Icon: AlertCircle,
    }] : []),
  ]

  const displayedRequests = tab === 'pending' ? pendingRequests : myRequests

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e4e7' }}>
      <AdminNavbar activePage="sql" adminInfo={adminInfo} onLogout={handleLogout} />

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 72, right: 24, zIndex: 9999,
          background: toast.ok ? '#14532d' : '#450a0a',
          border: `1px solid ${toast.ok ? '#16a34a' : '#b91c1c'}`,
          color: toast.ok ? '#4ade80' : '#f87171',
          borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 32px rgba(0,0,0,0.6)',
        }}>
          {toast.msg}
        </div>
      )}

      <main className="admin-content" style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Page header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid #18182a',
        }}>
          <div style={{ background: '#1a1a2e', borderRadius: 10, padding: 10 }}>
            <Terminal size={22} style={{ color: '#c4b5fd' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e4e4e7', margin: 0 }}>SQL Command Terminal</h1>
            <p style={{ fontSize: 13, color: '#52525b', margin: '4px 0 0' }}>
              Submit SQL commands for super-admin approval and audited execution
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {isSuperAdmin && (
              <span style={{
                background: '#4c1d9533', border: '1px solid #7c3aed55',
                color: '#a78bfa', borderRadius: 20, fontSize: 11, padding: '3px 12px', fontWeight: 600,
              }}>
                SUPER ADMIN
              </span>
            )}
            <span style={{
              background: '#450a0a33', border: '1px solid #b91c1c55',
              color: '#f87171', borderRadius: 20, fontSize: 11, padding: '3px 12px', fontWeight: 600,
            }}>
              HIGH RISK
            </span>
            <button
              onClick={() => { handleLogout() }}
              style={{
                background: '#450a0a22', border: '1px solid #dc262644', color: '#f87171',
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
              }}
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 24,
          background: '#0f0f1a', borderRadius: 10, padding: 4, width: 'fit-content',
        }}>
          {tabs.map(({ key, label, Icon }) => {
            const active = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  background: active ? '#1e1e40' : 'transparent',
                  border: `1px solid ${active ? '#2563eb55' : 'transparent'}`,
                  color: active ? '#93c5fd' : '#52525b',
                  borderRadius: 8, padding: '8px 18px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>

        {/* ── Tab: SQL Editor ── */}
        {tab === 'editor' && (
          <SqlEditorPanel onSubmit={handleSubmit} submitting={submitting} />
        )}

        {/* ── Tab: Requests list ── */}
        {(tab === 'requests' || tab === 'pending') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#52525b' }}>
                {tab === 'pending'
                  ? `${pendingRequests.length} request(s) awaiting approval`
                  : `${myRequests.length} total request(s)`}
              </div>
              <button
                onClick={() => { fetchMyRequests(); if (isSuperAdmin) fetchPending() }}
                style={{
                  background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                }}
              >
                <RotateCcw size={13} /> Refresh
              </button>
            </div>

            {loadingList ? (
              <div style={{ color: '#52525b', textAlign: 'center', padding: 48 }}>Loading…</div>
            ) : displayedRequests.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                border: '1px dashed #27272a', borderRadius: 12, color: '#3f3f46',
              }}>
                <Clock size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
                <div style={{ fontSize: 14 }}>
                  {tab === 'pending' ? 'No pending requests' : 'No SQL requests yet'}
                </div>
                {tab !== 'pending' && (
                  <div style={{ fontSize: 12, marginTop: 6, color: '#27272a' }}>
                    Switch to the SQL Editor tab to submit a command.
                  </div>
                )}
              </div>
            ) : (
              displayedRequests.map(req => (
                <RequestRow
                  key={req.id}
                  req={req}
                  isSuperAdmin={isSuperAdmin}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onCancel={handleCancel}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
