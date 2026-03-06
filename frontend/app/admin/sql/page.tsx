'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle, Ban, CheckCircle, ChevronRight, Clock,
  FileCode, Play, RotateCcw, Send, Terminal, XCircle,
} from 'lucide-react'
import AdminNavbar from '@/components/AdminNavbar'

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface DirectResult {
  rowCount: number
  rows: Record<string, unknown>[]
  fields: { name: string; dataTypeID: number }[]
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<SqlRequest['status'], { bg: string; border: string; text: string; label: string }> = {
  pending:  { bg: '#451a0333', border: '#92400e55', text: '#fbbf24', label: 'Pending'  },
  approved: { bg: '#14532d33', border: '#16a34a55', text: '#4ade80', label: 'Approved' },
  rejected: { bg: '#450a0a33', border: '#b91c1c55', text: '#f87171', label: 'Rejected' },
  executed: { bg: '#1e3a5f33', border: '#2563eb55', text: '#93c5fd', label: 'Executed' },
  failed:   { bg: '#450a0a33', border: '#b91c1c55', text: '#f87171', label: 'Failed'   },
}

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

// ── Result table ──────────────────────────────────────────────────────────────

function ResultTable({ result, error }: {
  result: DirectResult | null
  error: string | null
}) {
  if (error) {
    return (
      <div style={{
        background: '#450a0a33', border: '1px solid #b91c1c55', borderRadius: 8,
        padding: '12px 16px', fontSize: 13, color: '#f87171',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Execution Error</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{error}</div>
        </div>
      </div>
    )
  }
  if (!result) return null

  const { rows, fields, rowCount } = result

  return (
    <div>
      <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <CheckCircle size={13} />
        <span>Query executed — <strong>{rowCount}</strong> row(s) {rows.length > 0 ? 'returned' : 'affected'}</span>
      </div>
      {fields.length > 0 && rows.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #1a1a2e' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0d0d1c' }}>
                {fields.map(f => (
                  <th key={f.name} style={{
                    padding: '8px 14px', textAlign: 'left', color: '#7c3aed',
                    fontWeight: 700, borderBottom: '1px solid #1a1a2e', whiteSpace: 'nowrap',
                    fontFamily: 'monospace', letterSpacing: '0.03em',
                  }}>
                    {f.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #12121e', background: ri % 2 === 0 ? '#07070f' : '#09090f' }}>
                  {fields.map(f => (
                    <td key={f.name} style={{
                      padding: '7px 14px', color: '#a1a1aa',
                      maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontFamily: 'monospace', fontSize: 11,
                    }}>
                      {row[f.name] === null
                        ? <span style={{ color: '#3f3f46', fontStyle: 'italic' }}>NULL</span>
                        : String(row[f.name])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && (
            <div style={{ padding: '8px 14px', fontSize: 11, color: '#52525b', borderTop: '1px solid #1a1a2e' }}>
              Showing 200 of {rows.length} rows
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Request card (expandable) ─────────────────────────────────────────────────

interface RequestRowProps {
  req: SqlRequest
  isMasterAdmin: boolean
  onApprove: (id: number, note: string) => Promise<void>
  onReject: (id: number, note: string) => Promise<void>
  onCancel: (id: number) => Promise<void>
}

function RequestRow({ req, isMasterAdmin, onApprove, onReject, onCancel }: RequestRowProps) {
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
    <div style={{ borderRadius: 10, border: '1px solid #1e1e2e', overflow: 'hidden', marginBottom: 8 }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '12px 16px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 10, background: '#0f0f1a',
          userSelect: 'none',
        }}
      >
        <ChevronRight size={14} style={{
          color: '#52525b', transition: 'transform 0.2s',
          transform: expanded ? 'rotate(90deg)' : 'none', flexShrink: 0,
        }} />
        <StatusBadge status={req.status} />
        <span style={{ fontSize: 12, color: '#a1a1aa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {req.description || req.sql_query.replace(/\s+/g, ' ').substring(0, 80)}
        </span>
        <span style={{ fontSize: 11, color: '#3f3f46', flexShrink: 0 }}>
          #{req.id} · {new Date(req.submitted_at).toLocaleString()}
        </span>
      </div>

      {expanded && (
        <div style={{ background: '#07070f', borderTop: '1px solid #1a1a2e', padding: '14px 16px' }}>
          {isMasterAdmin && (
            <div style={{ fontSize: 11, color: '#52525b', marginBottom: 10 }}>
              Submitted by: <span style={{ color: '#a1a1aa' }}>{req.submitted_by_email}</span>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#52525b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Query
            </div>
            <pre style={{
              background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 8,
              padding: '10px 14px', margin: 0,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 12,
              color: '#c4b5fd', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6,
            }}>
              {req.sql_query}
            </pre>
          </div>

          {req.execution_result && !req.execution_error && resultFields.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#52525b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Result
              </div>
              <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={12} />
                <span>Executed — <strong>{req.rows_affected ?? 0}</strong> row(s)</span>
              </div>
              {resultRows.length > 0 && (
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #1a1a2e' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#0d0d1c' }}>
                        {resultFields.map(f => (
                          <th key={f.name} style={{ padding: '7px 12px', textAlign: 'left', color: '#7c3aed', fontWeight: 700, borderBottom: '1px solid #1a1a2e', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                            {f.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultRows.slice(0, 100).map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid #12121e' }}>
                          {resultFields.map(f => (
                            <td key={f.name} style={{ padding: '6px 12px', color: '#a1a1aa', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>
                              {row[f.name] === null ? <span style={{ color: '#3f3f46', fontStyle: 'italic' }}>NULL</span> : String(row[f.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {resultRows.length > 100 && (
                    <div style={{ padding: '6px 12px', fontSize: 10, color: '#52525b', borderTop: '1px solid #1a1a2e' }}>
                      Showing 100 of {resultRows.length} rows
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {req.execution_error && (
            <div style={{ background: '#450a0a33', border: '1px solid #b91c1c55', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: '#f87171' }}>
              ✗ {req.execution_error}
            </div>
          )}

          {req.review_note && (
            <div style={{ background: '#1e3a5f33', border: '1px solid #2563eb55', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: '#93c5fd' }}>
              Note from {req.reviewed_by_name ?? req.reviewed_by_email}: {req.review_note}
            </div>
          )}

          {(req.reviewed_at || req.executed_at) && (
            <div style={{ fontSize: 10, color: '#3f3f46', marginBottom: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {req.reviewed_at && <span>Reviewed: {new Date(req.reviewed_at).toLocaleString()}</span>}
              {req.executed_at && <span>Executed: {new Date(req.executed_at).toLocaleString()}</span>}
            </div>
          )}

          {isMasterAdmin && req.status === 'pending' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #1a1a2e' }}>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Optional review note…"
                disabled={acting}
                style={{
                  flex: 1, minWidth: 160, background: '#0f0f1a', border: '1px solid #27272a',
                  borderRadius: 6, padding: '7px 12px', color: '#e4e4e7', fontSize: 12, outline: 'none',
                }}
              />
              <button
                onClick={() => act(() => onApprove(req.id, note))}
                disabled={acting}
                style={{
                  background: '#14532d33', border: '1px solid #16a34a66', color: '#4ade80',
                  borderRadius: 6, padding: '7px 16px', cursor: acting ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                  opacity: acting ? 0.6 : 1,
                }}
              >
                <Play size={12} /> Approve &amp; Execute
              </button>
              <button
                onClick={() => act(() => onReject(req.id, note))}
                disabled={acting}
                style={{
                  background: '#450a0a33', border: '1px solid #b91c1c55', color: '#f87171',
                  borderRadius: 6, padding: '7px 16px', cursor: acting ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                  opacity: acting ? 0.6 : 1,
                }}
              >
                <Ban size={12} /> Reject
              </button>
            </div>
          )}

          {!isMasterAdmin && req.status === 'pending' && (
            <button
              onClick={() => act(() => onCancel(req.id))}
              disabled={acting}
              style={{
                background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
                borderRadius: 6, padding: '6px 14px', cursor: acting ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 8,
                opacity: acting ? 0.6 : 1,
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

// ── SQL Editor panel ──────────────────────────────────────────────────────────

interface SqlEditorProps {
  token: string | null
  isMasterAdmin: boolean
  onSubmitApproval: (sql: string, description: string) => Promise<void>
  submitting: boolean
  showToast: (msg: string, ok?: boolean) => void
}

function SqlEditorPanel({ token, isMasterAdmin, onSubmitApproval, submitting, showToast }: SqlEditorProps) {
  const [sql, setSql]                   = useState('')
  const [description, setDescription]   = useState('')
  const [directResult, setDirectResult] = useState<DirectResult | null>(null)
  const [directError, setDirectError]   = useState<string | null>(null)
  const [running, setRunning]           = useState(false)
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

  const needsApproval = (q: string): boolean => {
    const stripped = q.trim()
      .replace(/--[^\n]*/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
    return /\b(CREATE|INSERT|UPDATE|DELETE)\b/i.test(stripped)
  }

  const isApprovalQuery = needsApproval(sql)
  const canRun = sql.trim().length > 0 && !running && !submitting

  const runDirect = async (masterOverride = false) => {
    if (!canRun) return
    setDirectResult(null)
    setDirectError(null)
    setRunning(true)
    try {
      const res  = await fetch('/api/admin/sql/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sql, masterOverride }),
      })
      const data = await res.json()
      if (res.ok) {
        setDirectResult(data.result)
        showToast(`Executed — ${data.result.rowCount} row(s)`)
      } else {
        setDirectError(data.error ?? 'Query failed')
      }
    } finally {
      setRunning(false)
    }
  }

  const handleClear = () => {
    setSql('')
    setDescription('')
    setDirectResult(null)
    setDirectError(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Policy strip */}
      <div style={{
        background: '#0a0a12', border: '1px solid #1a1a2e', borderRadius: '10px 10px 0 0',
        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, flexWrap: 'wrap',
      }}>
        <span style={{ color: '#86efac' }}>✓ SELECT → runs directly</span>
        <span style={{ color: '#3f3f46' }}>·</span>
        <span style={{ color: '#fbbf24' }}>⚡ INSERT · UPDATE · DELETE · CREATE → approval required</span>
        <span style={{ color: '#3f3f46' }}>·</span>
        <span style={{ color: '#f87171' }}>✗ DROP · TRUNCATE · ALTER · GRANT blocked</span>
      </div>

      {/* Editor box */}
      <div style={{ border: '1px solid #1e1e2e', borderTop: 'none', overflow: 'hidden' }}>
        {/* Title bar */}
        <div style={{
          background: '#0b0b18', padding: '7px 14px', borderBottom: '1px solid #1a1a2e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ fontSize: 11, color: '#3f3f46', fontFamily: 'monospace', marginLeft: 8 }}>query.sql</span>
          </div>
          <span style={{ fontSize: 10, color: '#3f3f46' }}>
            {sql.length.toLocaleString()} chars · {lines} line{lines !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Editor body */}
        <div style={{ display: 'flex', background: '#07070f', minHeight: 260 }}>
          <div style={{
            background: '#0b0b18', padding: '14px 8px 14px 6px',
            minWidth: 40, textAlign: 'right', userSelect: 'none',
            borderRight: '1px solid #1a1a2e', flexShrink: 0,
          }}>
            {Array.from({ length: Math.max(lines, 12) }, (_, i) => (
              <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: '#2e2e42', lineHeight: '21px' }}>
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={e => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            placeholder={'-- Write your SQL here\n-- SELECT runs immediately · INSERT/UPDATE/CREATE sent for approval\n\nSELECT * FROM admins LIMIT 10;'}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', padding: '14px 16px',
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontSize: 13, lineHeight: '21px', color: '#c4b5fd', minHeight: 260,
              caretColor: '#7c3aed',
            }}
          />
        </div>
      </div>

      {/* Description (shown only for approval queries) */}
      {isApprovalQuery && (
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Brief description of what this query does (helps the master admin review faster)"
          style={{
            background: '#0f0f1a', border: '1px solid #1e1e2e', borderTop: 'none',
            padding: '9px 14px', color: '#e4e4e7', fontSize: 12, outline: 'none',
            width: '100%', boxSizing: 'border-box',
          }}
        />
      )}

      {/* Action bar */}
      <div style={{
        background: '#0b0b18', border: '1px solid #1e1e2e', borderTop: 'none',
        borderRadius: '0 0 10px 10px', padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button
          onClick={handleClear}
          style={{
            background: 'transparent', border: '1px solid #27272a', color: '#52525b',
            borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontSize: 12,
          }}
        >
          Clear
        </button>
        <div style={{ flex: 1 }} />

        {isApprovalQuery ? (
          <>
            <button
              onClick={() => onSubmitApproval(sql, description)}
              disabled={!canRun}
              style={{
                background: canRun ? '#1e1e40' : '#18181b',
                border: `1px solid ${canRun ? '#7c3aed55' : '#27272a'}`,
                color: canRun ? '#c4b5fd' : '#52525b',
                borderRadius: 7, padding: '7px 20px',
                cursor: canRun ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 12, fontWeight: 600,
              }}
            >
              <Send size={13} />
              {submitting ? 'Submitting…' : 'Submit for Approval'}
            </button>
            {isMasterAdmin && (
              <button
                onClick={() => runDirect(true)}
                disabled={!canRun}
                style={{
                  background: canRun ? '#14532d33' : '#18181b',
                  border: `1px solid ${canRun ? '#16a34a66' : '#27272a'}`,
                  color: canRun ? '#4ade80' : '#52525b',
                  borderRadius: 7, padding: '7px 16px',
                  cursor: canRun ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontSize: 12, fontWeight: 600,
                }}
              >
                <Play size={13} /> Run Direct
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => runDirect(false)}
            disabled={!canRun}
            style={{
              background: canRun ? '#14532d33' : '#18181b',
              border: `1px solid ${canRun ? '#16a34a66' : '#27272a'}`,
              color: canRun ? '#4ade80' : '#52525b',
              borderRadius: 7, padding: '7px 20px',
              cursor: canRun ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 12, fontWeight: 600,
            }}
          >
            <Play size={13} />
            {running ? 'Running…' : 'Run Query'}
          </button>
        )}

        <span style={{ fontSize: 11, color: isApprovalQuery ? '#fbbf24' : '#4ade80' }}>
          {sql.trim() === '' ? '' : isApprovalQuery ? '⚡ approval required' : '✓ safe to run'}
        </span>
      </div>

      {/* Output panel */}
      {(directResult || directError) && (
        <div style={{
          marginTop: 14, background: '#07070f', border: '1px solid #1e1e2e',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{
            fontSize: 10, color: '#52525b', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Terminal size={11} />
            Output
            <button
              onClick={() => { setDirectResult(null); setDirectError(null) }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#3f3f46', cursor: 'pointer', fontSize: 10, padding: 0 }}
            >
              ✕ clear
            </button>
          </div>
          <ResultTable result={directResult} error={directError} />
        </div>
      )}
    </div>
  )
}

// ── Requests list panel ───────────────────────────────────────────────────────

interface RequestsListProps {
  requests: SqlRequest[]
  loading: boolean
  isMasterAdmin: boolean
  isPendingView: boolean
  onApprove: (id: number, note: string) => Promise<void>
  onReject: (id: number, note: string) => Promise<void>
  onCancel: (id: number) => Promise<void>
  onRefresh: () => void
}

function RequestsList({ requests, loading, isMasterAdmin, isPendingView, onApprove, onReject, onCancel, onRefresh }: RequestsListProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: '#52525b' }}>
          {isPendingView
            ? `${requests.length} request(s) awaiting approval`
            : `${requests.length} total request(s)`}
        </span>
        <button
          onClick={onRefresh}
          style={{
            background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
            borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
          }}
        >
          <RotateCcw size={11} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#52525b', textAlign: 'center', padding: 40, fontSize: 13 }}>Loading…</div>
      ) : requests.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '50px 20px',
          border: '1px dashed #1e1e2e', borderRadius: 10, color: '#3f3f46',
        }}>
          <Clock size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
          <div style={{ fontSize: 13 }}>
            {isPendingView ? 'No pending requests' : 'No SQL requests yet'}
          </div>
        </div>
      ) : (
        requests.map(r => (
          <RequestRow
            key={r.id}
            req={r}
            isMasterAdmin={isMasterAdmin}
            onApprove={onApprove}
            onReject={onReject}
            onCancel={onCancel}
          />
        ))
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SidebarSection = 'editor' | 'requests' | 'pending'

export default function SqlCommandPage() {
  const router = useRouter()
  const [adminInfo, setAdminInfo]       = useState<AdminInfo | null>(null)
  const [authChecked, setAuthChecked]   = useState(false)
  const tokenRef = useRef<string | null>(null)

  const [section, setSection]           = useState<SidebarSection>('editor')
  const [myRequests, setMyRequests]     = useState<SqlRequest[]>([])
  const [pendingRequests, setPendingRequests] = useState<SqlRequest[]>([])
  const [loadingList, setLoadingList]   = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)
  const [isMasterAdmin, setIsMasterAdmin] = useState(false)

  useEffect(() => {
    const t = sessionStorage.getItem('admin-token')
    if (!t) { router.push('/admin/login'); return }
    tokenRef.current = t
    const cached = sessionStorage.getItem('admin-info')
    if (cached) { try { setAdminInfo(JSON.parse(cached)) } catch { /* ignore */ } }
    setAuthChecked(true)
  }, [router])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchMyRequests = useCallback(async () => {
    if (!tokenRef.current) return
    setLoadingList(true)
    try {
      const res  = await fetch('/api/admin/sql?limit=50', {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      })
      const data = await res.json()
      if (res.ok) {
        setMyRequests(data.requests ?? [])
        if (data.isMasterAdmin !== undefined) setIsMasterAdmin(!!data.isMasterAdmin)
      }
    } finally {
      setLoadingList(false)
    }
  }, [])

  const fetchPending = useCallback(async () => {
    if (!tokenRef.current) return
    const res  = await fetch('/api/admin/sql?status=pending&limit=50', {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    })
    const data = await res.json()
    if (res.ok) setPendingRequests(data.requests ?? [])
  }, [])

  useEffect(() => {
    if (!authChecked) return
    fetchMyRequests()
  }, [authChecked, fetchMyRequests])

  useEffect(() => {
    if (isMasterAdmin) fetchPending()
  }, [isMasterAdmin, fetchPending])

  const handleSubmitApproval = async (sql: string, description: string) => {
    setSubmitting(true)
    try {
      const res  = await fetch('/api/admin/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ sql, description }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Request submitted — awaiting master admin approval')
        fetchMyRequests()
        if (isMasterAdmin) fetchPending()
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
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
    const res = await fetch(`/api/admin/sql/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
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
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    })
    if (res.ok) showToast('Request cancelled')
    else showToast('Cancellation failed', false)
    fetchMyRequests()
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin-token')
    sessionStorage.removeItem('admin-info')
    router.push('/admin/login')
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#52525b', fontSize: 14 }}>Verifying access…</div>
      </div>
    )
  }

  const NAV_ITEMS: { key: SidebarSection; label: string; Icon: React.FC<{ size?: number }>; badge?: number }[] = [
    { key: 'editor',   label: 'SQL Editor',       Icon: FileCode  },
    { key: 'requests', label: 'My Requests',       Icon: Clock,    badge: myRequests.filter(r => r.status === 'pending').length || undefined },
    ...(isMasterAdmin ? [{ key: 'pending' as SidebarSection, label: 'Pending Approval', Icon: AlertCircle, badge: pendingRequests.length || undefined }] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e4e7' }}>
      <AdminNavbar activePage="sql" adminInfo={adminInfo} onLogout={handleLogout} />

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

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 220, flexShrink: 0,
          background: '#0a0a12', borderRight: '1px solid #1a1a2e',
          padding: '24px 12px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ padding: '0 8px 18px', borderBottom: '1px solid #1a1a2e', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 6 }}>
                <Terminal size={16} style={{ color: '#c4b5fd' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }}>SQL Terminal</div>
                <div style={{ fontSize: 10, color: '#52525b' }}>
                  {isMasterAdmin ? '★ Master Admin' : adminInfo?.role ?? 'admin'}
                </div>
              </div>
            </div>
          </div>

          {NAV_ITEMS.map(({ key, label, Icon, badge }) => {
            const active = section === key
            return (
              <button
                key={key}
                onClick={() => setSection(key)}
                style={{
                  background: active ? '#1e1e40' : 'transparent',
                  border: `1px solid ${active ? '#7c3aed44' : 'transparent'}`,
                  color: active ? '#c4b5fd' : '#52525b',
                  borderRadius: 8, padding: '9px 12px',
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 9,
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={15} />
                <span style={{ flex: 1 }}>{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span style={{
                    background: key === 'pending' ? '#7c3aed' : '#1e3a5f',
                    color: key === 'pending' ? '#fff' : '#93c5fd',
                    borderRadius: 20, fontSize: 10, fontWeight: 700,
                    padding: '1px 7px', minWidth: 18, textAlign: 'center',
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}

          <div style={{ marginTop: 'auto', padding: '14px 8px 0', borderTop: '1px solid #1a1a2e' }}>
            <div style={{ fontSize: 10, color: '#3f3f46', lineHeight: 1.9 }}>
              <div style={{ color: '#86efac' }}>✓ SELECT — runs directly</div>
              <div style={{ color: '#fbbf24' }}>⚡ INSERT/UPDATE — master approval</div>
              <div style={{ color: '#f87171' }}>✗ DROP/ALTER — always blocked</div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main style={{ flex: 1, padding: '28px 32px', overflow: 'auto' }}>
          {section === 'editor' && (
            <SqlEditorPanel
              token={tokenRef.current}
              isMasterAdmin={isMasterAdmin}
              onSubmitApproval={handleSubmitApproval}
              submitting={submitting}
              showToast={showToast}
            />
          )}
          {section === 'requests' && (
            <RequestsList
              requests={myRequests}
              loading={loadingList}
              isMasterAdmin={isMasterAdmin}
              isPendingView={false}
              onApprove={handleApprove}
              onReject={handleReject}
              onCancel={handleCancel}
              onRefresh={() => { fetchMyRequests(); if (isMasterAdmin) fetchPending() }}
            />
          )}
          {section === 'pending' && isMasterAdmin && (
            <RequestsList
              requests={pendingRequests}
              loading={loadingList}
              isMasterAdmin={isMasterAdmin}
              isPendingView={true}
              onApprove={handleApprove}
              onReject={handleReject}
              onCancel={handleCancel}
              onRefresh={() => { fetchMyRequests(); fetchPending() }}
            />
          )}
        </main>
      </div>
    </div>
  )
}
