'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { auth } from '@/lib/firebase'
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Database,
  Download,
  Eye,
  EyeOff,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TableMeta {
  table_name: string
  column_count: number
  row_estimate: number
  table_size: string
  last_vacuum: string | null
  last_autovacuum: string | null
  last_analyze: string | null
  last_autoanalyze: string | null
}

interface ColumnMeta {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface TableData {
  columns: ColumnMeta[]
  primaryKeys: string[]
  rows: Record<string, unknown>[]
  pagination: Pagination
}

type SortDir = 'asc' | 'desc'

const PAGE_SIZES = [20, 50, 100, 200]
const CELL_MAX_WIDTH = 260

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCell(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function downloadCSV(columns: string[], rows: Record<string, unknown>[], filename: string) {
  const header = columns.map(c => `"${c}"`).join(',')
  const body = rows
    .map(r => columns.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const csv = [header, body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function inputTypeForDataType(dt: string): string {
  if (['integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision', 'serial', 'bigserial'].includes(dt)) return 'number'
  if (['date'].includes(dt)) return 'date'
  if (['timestamp without time zone', 'timestamp with time zone', 'timestamptz'].includes(dt)) return 'datetime-local'
  if (['boolean'].includes(dt)) return 'checkbox'
  return 'text'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 11, color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

interface ColumnTogglePopoverProps {
  allColumns: ColumnMeta[]
  visibleCols: Set<string>
  onToggle: (col: string) => void
  onShowAll: () => void
  onHideAll: () => void
}
function ColumnTogglePopover({ allColumns, visibleCols, onToggle, onShowAll, onHideAll }: ColumnTogglePopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Toggle column visibility"
        style={{
          background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
          borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
        }}
      >
        <Columns3 size={14} />
        Columns
        <ChevronDown size={12} style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
          background: '#18181b', border: '1px solid #27272a', borderRadius: 10,
          minWidth: 200, maxHeight: 340, overflowY: 'auto', boxShadow: '0 8px 32px #0008',
          padding: '8px 0',
        }}>
          <div style={{ display: 'flex', gap: 6, padding: '6px 12px 10px', borderBottom: '1px solid #27272a' }}>
            <button onClick={onShowAll} style={{ flex: 1, background: '#27272a', border: 'none', color: '#a1a1aa', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>Show all</button>
            <button onClick={onHideAll} style={{ flex: 1, background: '#27272a', border: 'none', color: '#a1a1aa', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>Hide all</button>
          </div>
          {allColumns.map(col => {
            const visible = visibleCols.has(col.column_name)
            return (
              <button
                key={col.column_name}
                onClick={() => onToggle(col.column_name)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, padding: '8px 14px', background: 'transparent', border: 'none',
                  color: visible ? '#e4e4e7' : '#52525b', cursor: 'pointer', fontSize: 12,
                  fontFamily: 'monospace', textAlign: 'left',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.column_name}</span>
                {visible ? <Eye size={12} style={{ color: '#2563eb', flexShrink: 0 }} /> : <EyeOff size={12} style={{ flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Row Form Modal (Insert / Edit) ───────────────────────────────────────────

interface RowFormModalProps {
  mode: 'insert' | 'edit'
  tableName: string
  columns: ColumnMeta[]
  primaryKeys: string[]
  initialValues?: Record<string, unknown>
  onConfirm: (values: Record<string, string | boolean>) => Promise<void>
  onClose: () => void
}

function RowFormModal({ mode, tableName, columns, primaryKeys, initialValues, onConfirm, onClose }: RowFormModalProps) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {}
    for (const col of columns) {
      if (mode === 'edit' && initialValues) {
        const v = initialValues[col.column_name]
        if (col.data_type === 'boolean') {
          init[col.column_name] = v === true || v === 'true' || v === 't'
        } else {
          init[col.column_name] = v == null ? '' : String(v)
        }
      } else {
        init[col.column_name] = col.data_type === 'boolean' ? false : ''
      }
    }
    return init
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(values)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  // Columns to show in the form: for edit, skip auto-filled PK columns (serial/sequence)
  const formCols = columns.filter(col => {
    if (mode === 'insert') {
      // Skip columns with a sequence default (auto-increment PKs)
      const hasSequenceDefault = col.column_default?.includes('nextval') ?? false
      return !hasSequenceDefault
    }
    return true
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#000a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#18181b', border: '1px solid #27272a', borderRadius: 14,
        width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px #0009',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: mode === 'insert' ? '#14532d22' : '#1e3a5f22', borderRadius: 7, padding: 7 }}>
              {mode === 'insert' ? <Plus size={15} style={{ color: '#4ade80' }} /> : <Pencil size={15} style={{ color: '#93c5fd' }} />}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7' }}>
                {mode === 'insert' ? 'Insert Row' : 'Edit Row'}
              </div>
              <div style={{ fontSize: 11, color: '#52525b', fontFamily: 'monospace' }}>{tableName}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', display: 'flex', padding: 4, borderRadius: 6 }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {formCols.map(col => {
            const isPK = primaryKeys.includes(col.column_name)
            const inputType = inputTypeForDataType(col.data_type)
            const isReadOnly = mode === 'edit' && isPK
            const val = values[col.column_name]
            return (
              <div key={col.column_name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: isReadOnly ? '#52525b' : '#a1a1aa', fontFamily: 'monospace' }}>
                    {col.column_name}
                  </label>
                  <span style={{ fontSize: 10, color: '#3f3f46', background: '#27272a', borderRadius: 4, padding: '1px 5px' }}>{col.data_type}</span>
                  {isPK && <span style={{ fontSize: 9, color: '#f59e0b', background: '#78350f22', border: '1px solid #f59e0b33', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>PK</span>}
                  {col.is_nullable === 'YES' && <span style={{ fontSize: 9, color: '#52525b', background: '#27272a', borderRadius: 4, padding: '1px 5px' }}>nullable</span>}
                </div>
                {inputType === 'checkbox' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => !isReadOnly && setValues(v => ({ ...v, [col.column_name]: !v[col.column_name] }))}
                      style={{
                        width: 20, height: 20, borderRadius: 5,
                        border: `1px solid ${val ? '#2563eb' : '#27272a'}`,
                        background: val ? '#2563eb' : '#09090b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: isReadOnly ? 'not-allowed' : 'pointer', flexShrink: 0,
                      }}
                    >
                      {val && <Check size={12} style={{ color: '#fff' }} />}
                    </button>
                    <span style={{ fontSize: 12, color: '#71717a' }}>{val ? 'true' : 'false'}</span>
                  </div>
                ) : (
                  <input
                    type={inputType}
                    readOnly={isReadOnly}
                    value={typeof val === 'boolean' ? String(val) : (val ?? '')}
                    onChange={e => !isReadOnly && setValues(v => ({ ...v, [col.column_name]: e.target.value }))}
                    placeholder={col.column_default ? `default: ${col.column_default}` : `Enter ${col.column_name}…`}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: isReadOnly ? '#09090b88' : '#09090b',
                      border: `1px solid ${isReadOnly ? '#1c1c1c' : '#27272a'}`,
                      color: isReadOnly ? '#52525b' : '#e4e4e7',
                      borderRadius: 7, padding: '8px 12px', fontSize: 13,
                      fontFamily: 'monospace', outline: 'none',
                      cursor: isReadOnly ? 'not-allowed' : 'text',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#450a0a22', border: '1px solid #dc262644', borderRadius: 8, padding: '8px 12px' }}>
              <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#f87171' }}>{error}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ background: '#27272a', border: 'none', color: '#a1a1aa', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                background: mode === 'insert' ? '#14532d' : '#1e3a5f',
                border: `1px solid ${mode === 'insert' ? '#16a34a44' : '#2563eb44'}`,
                color: mode === 'insert' ? '#4ade80' : '#93c5fd',
                borderRadius: 8, padding: '8px 18px', cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting
                ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : mode === 'insert' ? <Plus size={13} /> : <Check size={13} />}
              {mode === 'insert' ? 'Insert' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

interface ConfirmDeleteModalProps {
  count: number
  tableName: string
  onConfirm: () => Promise<void>
  onClose: () => void
}

function ConfirmDeleteModal({ count, tableName, onConfirm, onClose }: ConfirmDeleteModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setDeleting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#000a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#18181b', border: '1px solid #450a0a', borderRadius: 14,
        width: '100%', maxWidth: 420, boxShadow: '0 24px 80px #0009',
      }}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#450a0a', borderRadius: 10, padding: 10 }}>
              <Trash2 size={18} style={{ color: '#f87171' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f87171' }}>Confirm Delete</div>
              <div style={{ fontSize: 12, color: '#52525b', fontFamily: 'monospace' }}>{tableName}</div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.6, margin: '0 0 4px' }}>
            You are about to permanently delete{' '}
            <strong style={{ color: '#fca5a5' }}>{count} row{count !== 1 ? 's' : ''}</strong> from{' '}
            <code style={{ background: '#27272a', color: '#f87171', borderRadius: 4, padding: '1px 6px', fontSize: 12 }}>{tableName}</code>.
          </p>
          <p style={{ fontSize: 12, color: '#52525b', margin: '8px 0 0' }}>This action cannot be undone.</p>
        </div>
        {error && (
          <div style={{ margin: '0 24px', display: 'flex', alignItems: 'center', gap: 8, background: '#450a0a22', border: '1px solid #dc262644', borderRadius: 8, padding: '8px 12px' }}>
            <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#f87171' }}>{error}</span>
          </div>
        )}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ background: '#27272a', border: 'none', color: '#a1a1aa', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}>
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: '#450a0a', border: '1px solid #dc262644',
              color: '#f87171', borderRadius: 8, padding: '8px 18px',
              cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6, opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
            {deleting ? 'Deleting…' : `Delete ${count} Row${count !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminTableList() {
  // ── Table list state ──
  const [tables, setTables] = useState<TableMeta[]>([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [tablesError, setTablesError] = useState<string | null>(null)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [selected, setSelected] = useState<TableMeta | null>(null)

  // ── Data viewer state ──
  const [data, setData] = useState<TableData | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [globalSearch, setGlobalSearch] = useState('')
  const [filterCol, setFilterCol] = useState('')
  const [filterVal, setFilterVal] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set())
  const [showFilter, setShowFilter] = useState(false)

  // ── CRUD UI state ──
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showInsert, setShowInsert] = useState(false)
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<'selected' | Record<string, unknown> | null>(null)
  const [mutating, setMutating] = useState(false)
  const [mutateSuccess, setMutateSuccess] = useState<string | null>(null)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Auth helper ──
  const getToken = async () => {
    const user = auth?.currentUser
    return (await user?.getIdToken()) ?? ''
  }


  // ── Fetch table list ──
  const fetchTables = useCallback(async () => {
    setTablesLoading(true)
    setTablesError(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/tables', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      const fetched: TableMeta[] = json.tables ?? []
      setTables(fetched)
      setLastRefresh(new Date())
      setSelected(prev =>
        prev
          ? (fetched.find(t => t.table_name === prev.table_name) ?? fetched[0] ?? null)
          : (fetched[0] ?? null)
      )
    } catch (err: unknown) {
      setTablesError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setTablesLoading(false)
    }
  }, [])

  // ── Fetch table data ──
  const fetchData = useCallback(async (params: {
    table: string
    page: number
    limit: number
    search: string
    filterCol: string
    filterVal: string
    sortCol: string
    sortDir: SortDir
  }) => {
    setDataLoading(true)
    setDataError(null)
    try {
      const token = await getToken()
      const qs = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        search: params.search,
        filterCol: params.filterCol,
        filterVal: params.filterVal,
        sortCol: params.sortCol,
        sortDir: params.sortDir,
      })
      const res = await fetch(`/api/admin/tables/${encodeURIComponent(params.table)}?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json: TableData & { columns: ColumnMeta[] } = await res.json()
      setData(json)
      setSelectedRows(new Set())
      // Initialize visible columns on first load for this table
      setVisibleCols(prev => {
        const cols: string[] = json.columns?.map((c: ColumnMeta) => c.column_name) ?? []
        if (prev.size === 0) return new Set(cols)
        return prev
      })
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDataLoading(false)
    }
  }, [])

  // ── CRUD API helpers ──
  const getAuthHeader = async () => {
    const token = await getToken()
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  }

  const apiMutate = async (method: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<void> => {
    if (!selected) return
    const headers = await getAuthHeader()
    const res = await fetch(`/api/admin/tables/${encodeURIComponent(selected.table_name)}`, {
      method,
      headers,
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  }

  const handleInsert = async (values: Record<string, string | boolean>) => {
    setMutating(true)
    try {
      await apiMutate('POST', { row: values })
      setShowInsert(false)
      setMutateSuccess('Row inserted successfully.')
      await fetchData({ table: selected!.table_name, page, limit: pageSize, search: globalSearch, filterCol, filterVal, sortCol, sortDir })
      setTimeout(() => setMutateSuccess(null), 3000)
    } finally {
      setMutating(false)
    }
  }

  const handleEdit = async (values: Record<string, string | boolean>) => {
    if (!data || !editRow) return
    setMutating(true)
    try {
      const pk = data.primaryKeys[0] ?? 'id'
      await apiMutate('PATCH', { pkColumn: pk, pkValue: editRow[pk], updates: values })
      setEditRow(null)
      setMutateSuccess('Row updated successfully.')
      await fetchData({ table: selected!.table_name, page, limit: pageSize, search: globalSearch, filterCol, filterVal, sortCol, sortDir })
      setTimeout(() => setMutateSuccess(null), 3000)
    } finally {
      setMutating(false)
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!data) return
    const pk = data.primaryKeys[0] ?? 'id'
    let pkValues: unknown[]
    if (deleteTarget === 'selected') {
      pkValues = Array.from(selectedRows)
    } else if (deleteTarget && typeof deleteTarget === 'object') {
      pkValues = [deleteTarget[pk]]
    } else {
      return
    }
    await apiMutate('DELETE', { pkColumn: pk, pkValues })
    setShowDeleteConfirm(false)
    setDeleteTarget(null)
    setSelectedRows(new Set())
    setMutateSuccess(`Deleted ${pkValues.length} row${pkValues.length !== 1 ? 's' : ''}.`)
    await fetchData({ table: selected!.table_name, page, limit: pageSize, search: globalSearch, filterCol, filterVal, sortCol, sortDir })
    setTimeout(() => setMutateSuccess(null), 3000)
  }

  // ── Effect: fetch tables on mount ──
  useEffect(() => { fetchTables() }, [fetchTables])

  // ── Effect: fetch data when selected table / params change ──
  useEffect(() => {
    if (!selected) return
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    const run = () => fetchData({ table: selected.table_name, page, limit: pageSize, search: globalSearch, filterCol, filterVal, sortCol, sortDir })
    if (globalSearch || filterVal) {
      searchTimeout.current = setTimeout(run, 400)
    } else {
      run()
    }
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [selected, page, pageSize, globalSearch, filterCol, filterVal, sortCol, sortDir, fetchData])

  // ── Handlers ──
  const handleSearchChange = (val: string) => { setGlobalSearch(val); setPage(1) }
  const handleFilterValChange = (val: string) => { setFilterVal(val); setPage(1) }
  const handleFilterColChange = (val: string) => { setFilterCol(val); setFilterVal(''); setPage(1) }
  const handleSort = (col: string) => {
    if (sortCol === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') } else { setSortCol(col); setSortDir('asc') }
    setPage(1)
  }
  const selectTable = (t: TableMeta) => {
    setSelected(t); setPage(1); setData(null); setGlobalSearch(''); setFilterCol(''); setFilterVal(''); setSortCol(''); setSortDir('asc'); setVisibleCols(new Set()); setSelectedRows(new Set())
  }
  const toggleCol = (col: string) => setVisibleCols(prev => {
    const next = new Set(prev)
    if (next.has(col)) { next.delete(col) } else { next.add(col) }
    return next
  })

  // ── Row selection helpers ──
  const pk = data?.primaryKeys[0] ?? ''
  const rowKey = (row: Record<string, unknown>) => String(row[pk] ?? JSON.stringify(row))
  const toggleRowSelect = (row: Record<string, unknown>) => {
    const key = rowKey(row)
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }
  const toggleSelectAll = () => {
    if (!data) return
    const allKeys = data.rows.map(rowKey)
    const allSelected = allKeys.every(k => selectedRows.has(k))
    setSelectedRows(allSelected ? new Set() : new Set(allKeys))
  }
  const canMutate = (data?.primaryKeys?.length ?? 0) > 0 && !dataLoading

  // ── Derived ──
  const filteredTables = tables.filter(t => t.table_name.toLowerCase().includes(sidebarSearch.toLowerCase()))
  const colMeta = data?.columns ?? []
  const displayCols = colMeta.map(c => c.column_name).filter(c => visibleCols.has(c))
  const { pagination } = data ?? { pagination: null }
  const hasSelection = selectedRows.size > 0

  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Modals ── */}
      {showInsert && data && (
        <RowFormModal
          mode="insert"
          tableName={selected!.table_name}
          columns={data.columns}
          primaryKeys={data.primaryKeys}
          onConfirm={handleInsert}
          onClose={() => setShowInsert(false)}
        />
      )}
      {editRow && data && (
        <RowFormModal
          mode="edit"
          tableName={selected!.table_name}
          columns={data.columns}
          primaryKeys={data.primaryKeys}
          initialValues={editRow}
          onConfirm={handleEdit}
          onClose={() => setEditRow(null)}
        />
      )}
      {showDeleteConfirm && deleteTarget !== null && (
        <ConfirmDeleteModal
          count={deleteTarget === 'selected' ? selectedRows.size : 1}
          tableName={selected!.table_name}
          onConfirm={handleDeleteConfirmed}
          onClose={() => { setShowDeleteConfirm(false); setDeleteTarget(null) }}
        />
      )}

      {/* ── Top header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <p style={{ fontSize: 12, color: '#52525b', margin: 0 }}>
              {lastRefresh ? `Last updated ${lastRefresh.toLocaleTimeString()}` : 'Loading...'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Insert Row */}
          {selected && canMutate && (
            <button
              onClick={() => setShowInsert(true)}
              style={{
                background: '#14532d', border: '1px solid #16a34a44', color: '#4ade80',
                borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
              }}
            >
              <Plus size={14} />
              Insert Row
            </button>
          )}
          {/* Delete Selected */}
          {hasSelection && canMutate && (
            <button
              onClick={() => { setDeleteTarget('selected'); setShowDeleteConfirm(true) }}
              style={{
                background: '#450a0a', border: '1px solid #dc262644', color: '#f87171',
                borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
              }}
            >
              <Trash2 size={14} />
              Delete Selected ({selectedRows.size})
            </button>
          )}
          <button
            onClick={fetchTables}
            disabled={tablesLoading}
            style={{
              background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
              borderRadius: 8, padding: '7px 14px', cursor: tablesLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
            }}
          >
            <RefreshCw size={14} style={tablesLoading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Success toast ── */}
      {mutateSuccess && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#14532d22', border: '1px solid #16a34a44', borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
          <Check size={15} style={{ color: '#4ade80', flexShrink: 0 }} />
          <span style={{ color: '#4ade80', fontSize: 13 }}>{mutateSuccess}</span>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Tables" value={tables.length} color="#2563eb" />
        <StatCard label="Showing" value={filteredTables.length} color="#7c3aed" />
        <StatCard label="Total Rows (est.)" value={tables.reduce((a, t) => a + Number(t.row_estimate), 0).toLocaleString()} color="#16a34a" />
        {selected && <StatCard label="Active Table" value={selected.table_name} color="#f59e0b" />}
      </div>

      {/* ── Table list error ── */}
      {tablesError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#450a0a22', border: '1px solid #dc262644', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <AlertTriangle size={16} style={{ color: '#f87171' }} />
          <span style={{ color: '#f87171', fontSize: 13 }}>{tablesError}</span>
        </div>
      )}

      {/* ── Split layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #27272a' }}>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#52525b', pointerEvents: 'none' }} />
              <input
                placeholder="Search tables..."
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: '#09090b', border: '1px solid #27272a', color: '#e4e4e7', borderRadius: 7, padding: '6px 10px 6px 28px', fontSize: 12, outline: 'none' }}
              />
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 600 }}>
            {tablesLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#52525b', fontSize: 13 }}>
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
                Loading...
              </div>
            ) : filteredTables.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#52525b', fontSize: 13 }}>No tables found</div>
            ) : (
              filteredTables.map(t => {
                const isActive = selected?.table_name === t.table_name
                return (
                  <button
                    key={t.table_name}
                    onClick={() => selectTable(t)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', background: isActive ? '#1e1e40' : 'transparent',
                      border: 'none', borderBottom: '1px solid #1c1c1c',
                      borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
                      color: isActive ? '#93c5fd' : '#a1a1aa',
                      cursor: 'pointer', textAlign: 'left', fontSize: 12,
                      fontFamily: 'monospace', fontWeight: isActive ? 600 : 400, transition: 'all 0.15s',
                    }}
                  >
                    <Table2 size={12} style={{ flexShrink: 0, color: isActive ? '#2563eb' : '#3f3f46' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.table_name}</span>
                    <span style={{ fontSize: 10, color: '#52525b', flexShrink: 0 }}>{Number(t.row_estimate).toLocaleString()}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {!selected && !tablesLoading && (
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 40, textAlign: 'center', color: '#52525b', fontSize: 13 }}>
              Select a table from the sidebar to view its data
            </div>
          )}

          {selected && (
            <>
              {/* ── Metadata strip ── */}
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Table2 size={15} style={{ color: '#2563eb' }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7', fontFamily: 'monospace' }}>{selected.table_name}</span>
                  </div>
                  <span style={{ background: '#1e3a5f22', color: '#93c5fd', border: '1px solid #2563eb33', borderRadius: 6, padding: '2px 10px', fontSize: 12 }}>
                    {selected.table_size}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
                  {[
                    { label: 'Columns', value: selected.column_count, color: '#93c5fd' },
                    { label: 'Row Estimate', value: Number(selected.row_estimate).toLocaleString(), color: '#4ade80' },
                    { label: 'Size on Disk', value: selected.table_size, color: '#f59e0b' },
                    { label: 'Last Vacuum', value: selected.last_vacuum ?? selected.last_autovacuum ?? '—', color: '#a1a1aa' },
                    { label: 'Last Analyze', value: selected.last_analyze ?? selected.last_autoanalyze ?? '—', color: '#a1a1aa' },
                  ].map(({ label, value, color }, i) => (
                    <div key={label} style={{ padding: '12px 16px', borderRight: i < 4 ? '1px solid #27272a' : 'none' }}>
                      <div style={{ fontSize: 10, color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Data viewer ── */}
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, overflow: 'hidden' }}>

                {/* Toolbar */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Global search */}
                  <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 140 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#52525b', pointerEvents: 'none' }} />
                    <input
                      placeholder={`Search ${selected.table_name}…`}
                      value={globalSearch}
                      onChange={e => handleSearchChange(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', background: '#09090b', border: '1px solid #27272a', color: '#e4e4e7', borderRadius: 8, padding: '7px 10px 7px 32px', fontSize: 13, outline: 'none' }}
                    />
                    {globalSearch && (
                      <button onClick={() => handleSearchChange('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', display: 'flex', padding: 0 }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Filter toggle */}
                  <button
                    onClick={() => setShowFilter(f => !f)}
                    style={{
                      background: showFilter ? '#1e1e40' : '#18181b',
                      border: `1px solid ${showFilter ? '#2563eb55' : '#27272a'}`,
                      color: showFilter ? '#93c5fd' : '#a1a1aa',
                      borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                    }}
                  >
                    <Filter size={13} />
                    Filter
                    {filterVal && <span style={{ background: '#2563eb', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', lineHeight: 1.4 }}>1</span>}
                  </button>

                  {/* Column visibility */}
                  {colMeta.length > 0 && (
                    <ColumnTogglePopover
                      allColumns={colMeta}
                      visibleCols={visibleCols}
                      onToggle={toggleCol}
                      onShowAll={() => setVisibleCols(new Set(colMeta.map(c => c.column_name)))}
                      onHideAll={() => setVisibleCols(new Set())}
                    />
                  )}

                  {/* Page size */}
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                    style={{ background: '#09090b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer', outline: 'none' }}
                  >
                    {PAGE_SIZES.map(s => <option key={s} value={s}>{s} rows</option>)}
                  </select>

                  {/* Download CSV */}
                  <button
                    disabled={!data || dataLoading || displayCols.length === 0}
                    onClick={() => { if (data) downloadCSV(displayCols, data.rows, `${selected.table_name}-p${page}.csv`) }}
                    title="Download current page as CSV"
                    style={{
                      background: '#14532d22', border: '1px solid #16a34a44', color: '#4ade80',
                      borderRadius: 8, padding: '7px 12px',
                      cursor: (!data || dataLoading) ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                      opacity: (!data || dataLoading) ? 0.4 : 1,
                    }}
                  >
                    <Download size={13} />
                    CSV
                  </button>

                  {/* Refresh data */}
                  <button
                    onClick={() => fetchData({ table: selected.table_name, page, limit: pageSize, search: globalSearch, filterCol, filterVal, sortCol, sortDir })}
                    disabled={dataLoading}
                    title="Refresh data"
                    style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: 8, padding: '7px 10px', cursor: dataLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <RefreshCw size={13} style={dataLoading ? { animation: 'spin 1s linear infinite' } : {}} />
                  </button>
                </div>

                {/* Filter bar */}
                {showFilter && (
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: 8, background: '#0e0e12', flexWrap: 'wrap' }}>
                    <Filter size={13} style={{ color: '#52525b', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#52525b' }}>Filter by:</span>
                    <select
                      value={filterCol}
                      onChange={e => handleFilterColChange(e.target.value)}
                      style={{ background: '#09090b', border: '1px solid #27272a', color: filterCol ? '#e4e4e7' : '#52525b', borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="">— Select column —</option>
                      {colMeta.map(c => (
                        <option key={c.column_name} value={c.column_name}>{c.column_name} ({c.data_type})</option>
                      ))}
                    </select>
                    {filterCol && (
                      <>
                        <span style={{ fontSize: 12, color: '#52525b' }}>contains</span>
                        <input
                          placeholder="Filter value…"
                          value={filterVal}
                          onChange={e => handleFilterValChange(e.target.value)}
                          style={{ background: '#09090b', border: '1px solid #2563eb55', color: '#e4e4e7', borderRadius: 7, padding: '5px 10px', fontSize: 12, outline: 'none', minWidth: 160 }}
                        />
                        {filterVal && (
                          <button onClick={() => { setFilterVal(''); setPage(1) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', display: 'flex', padding: 0 }}><X size={12} /></button>
                        )}
                      </>
                    )}
                    {(filterCol || filterVal) && (
                      <button
                        onClick={() => { setFilterCol(''); setFilterVal(''); setPage(1) }}
                        style={{ marginLeft: 'auto', background: '#27272a', border: 'none', color: '#a1a1aa', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}

                {/* Active filters badges */}
                {(globalSearch || (filterVal && filterCol)) && (
                  <div style={{ padding: '6px 16px', background: '#1e1e40', borderBottom: '1px solid #2563eb22', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {globalSearch && (
                      <span style={{ background: '#2563eb22', border: '1px solid #2563eb44', color: '#93c5fd', borderRadius: 20, fontSize: 11, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Search: &quot;{globalSearch}&quot;
                        <button onClick={() => handleSearchChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', padding: 0, display: 'flex' }}><X size={10} /></button>
                      </span>
                    )}
                    {filterVal && filterCol && (
                      <span style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#c4b5fd', borderRadius: 20, fontSize: 11, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {filterCol} contains &quot;{filterVal}&quot;
                        <button onClick={() => { setFilterVal(''); setPage(1) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4b5fd', padding: 0, display: 'flex' }}><X size={10} /></button>
                      </span>
                    )}
                    {pagination && (
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#52525b' }}>
                        {pagination.total.toLocaleString()} result{pagination.total !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}

                {/* Data table */}
                <div style={{ overflowX: 'auto' }}>
                  {dataError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#450a0a22', padding: '12px 16px' }}>
                      <AlertTriangle size={16} style={{ color: '#f87171' }} />
                      <span style={{ color: '#f87171', fontSize: 13 }}>{dataError}</span>
                    </div>
                  )}

                  {dataLoading && (
                    <div style={{ padding: 48, textAlign: 'center', color: '#52525b', fontSize: 13 }}>
                      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 10px' }} />
                      Loading {selected.table_name}…
                    </div>
                  )}

                  {!dataLoading && !dataError && data && displayCols.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
                      <thead>
                        <tr style={{ background: '#09090b', borderBottom: '2px solid #27272a' }}>
                          {/* Select-all checkbox */}
                          {canMutate && (
                            <th style={{ padding: '8px 12px', textAlign: 'center', width: 40, borderRight: '1px solid #1c1c1c' }}>
                              <button
                                onClick={toggleSelectAll}
                                style={{
                                  width: 16, height: 16, borderRadius: 4,
                                  border: `1px solid ${data.rows.length > 0 && data.rows.every(r => selectedRows.has(rowKey(r))) ? '#2563eb' : '#3f3f46'}`,
                                  background: data.rows.length > 0 && data.rows.every(r => selectedRows.has(rowKey(r))) ? '#2563eb' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', padding: 0,
                                }}
                              >
                                {data.rows.length > 0 && data.rows.every(r => selectedRows.has(rowKey(r))) && <Check size={10} style={{ color: '#fff' }} />}
                              </button>
                            </th>
                          )}
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#3f3f46', fontWeight: 600, width: 48, borderRight: '1px solid #1c1c1c' }}>#</th>
                          {displayCols.map(col => {
                            const isSort = sortCol === col
                            return (
                              <th
                                key={col}
                                onClick={() => handleSort(col)}
                                style={{
                                  padding: '10px 14px', textAlign: 'left', fontSize: 11,
                                  color: isSort ? '#93c5fd' : '#71717a',
                                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                                  cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                                  borderRight: '1px solid #1c1c1c', maxWidth: CELL_MAX_WIDTH,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {col}
                                  {isSort
                                    ? <ArrowDownUp size={10} style={{ color: '#2563eb', flexShrink: 0 }} />
                                    : <ArrowUpDown size={10} style={{ color: '#3f3f46', flexShrink: 0 }} />}
                                  {isSort && <span style={{ fontSize: 9, color: '#2563eb' }}>{sortDir.toUpperCase()}</span>}
                                </div>
                              </th>
                            )
                          })}
                          {canMutate && (
                            <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 10, color: '#3f3f46', fontWeight: 600, width: 90 }}>ACTIONS</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.length === 0 ? (
                          <tr>
                            <td colSpan={displayCols.length + (canMutate ? 3 : 1)} style={{ padding: 32, textAlign: 'center', color: '#52525b', fontSize: 13 }}>
                              No rows match the current filters
                            </td>
                          </tr>
                        ) : (
                          data.rows.map((row, ri) => {
                            const key = rowKey(row)
                            const isSelected = selectedRows.has(key)
                            return (
                              <tr key={ri} style={{ borderBottom: '1px solid #1c1c1c', background: isSelected ? '#1e1e4022' : ri % 2 === 0 ? 'transparent' : '#0d0d0f' }}>
                                {/* Row checkbox */}
                                {canMutate && (
                                  <td style={{ padding: '7px 12px', textAlign: 'center', borderRight: '1px solid #1c1c1c' }}>
                                    <button
                                      onClick={() => toggleRowSelect(row)}
                                      style={{
                                        width: 16, height: 16, borderRadius: 4,
                                        border: `1px solid ${isSelected ? '#2563eb' : '#3f3f46'}`,
                                        background: isSelected ? '#2563eb' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', padding: 0,
                                      }}
                                    >
                                      {isSelected && <Check size={10} style={{ color: '#fff' }} />}
                                    </button>
                                  </td>
                                )}
                                <td style={{ padding: '7px 12px', color: '#3f3f46', fontSize: 11, borderRight: '1px solid #1c1c1c', textAlign: 'right', userSelect: 'none' }}>
                                  {(page - 1) * pageSize + ri + 1}
                                </td>
                                {displayCols.map(col => {
                                  const raw = row[col]
                                  const isNull = raw === null || raw === undefined
                                  const cell = formatCell(raw)
                                  return (
                                    <td
                                      key={col}
                                      title={isNull ? 'NULL' : cell}
                                      style={{
                                        padding: '7px 14px', color: isNull ? '#3f3f46' : '#d4d4d8',
                                        fontSize: 12, borderRight: '1px solid #1c1c1c',
                                        maxWidth: CELL_MAX_WIDTH, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {isNull
                                        ? <span style={{ color: '#3f3f46', fontStyle: 'italic', fontFamily: 'monospace' }}>null</span>
                                        : cell}
                                    </td>
                                  )
                                })}
                                {/* Row actions: Edit + Delete */}
                                {canMutate && (
                                  <td style={{ padding: '4px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    <button
                                      onClick={() => setEditRow(row)}
                                      disabled={mutating}
                                      title="Edit row"
                                      style={{
                                        background: '#1e3a5f22', border: '1px solid #2563eb33',
                                        color: '#93c5fd', borderRadius: 6, padding: '4px 7px',
                                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                                        marginRight: 4,
                                      }}
                                    >
                                      <Pencil size={11} />
                                    </button>
                                    <button
                                      onClick={() => { setDeleteTarget(row); setShowDeleteConfirm(true) }}
                                      disabled={mutating}
                                      title="Delete row"
                                      style={{
                                        background: '#450a0a22', border: '1px solid #dc262633',
                                        color: '#f87171', borderRadius: 6, padding: '4px 7px',
                                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                                      }}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  )}

                  {!dataLoading && !dataError && data && displayCols.length === 0 && (
                    <div style={{ padding: 40, textAlign: 'center', color: '#52525b', fontSize: 13 }}>
                      <EyeOff size={18} style={{ display: 'block', margin: '0 auto 8px' }} />
                      All columns are hidden — use <strong style={{ color: '#a1a1aa' }}>Columns</strong> to show some.
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {pagination && !dataLoading && (
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: '#0e0e12' }}>
                    <div style={{ fontSize: 12, color: '#52525b' }}>
                      Rows{' '}
                      <strong style={{ color: '#a1a1aa' }}>
                        {((pagination.page - 1) * pagination.limit + 1).toLocaleString()}–{Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString()}
                      </strong>{' '}
                      of <strong style={{ color: '#a1a1aa' }}>{pagination.total.toLocaleString()}</strong>
                      &nbsp;·&nbsp;Page <strong style={{ color: '#a1a1aa' }}>{pagination.page}</strong>/{pagination.totalPages}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([
                        { icon: <ChevronsLeft size={13} />, label: 'First', action: () => setPage(1), disabled: !pagination.hasPrev },
                        { icon: <ChevronLeft size={13} />, label: 'Prev', action: () => setPage(p => Math.max(1, p - 1)), disabled: !pagination.hasPrev },
                        { icon: <ChevronRight size={13} />, label: 'Next', action: () => setPage(p => Math.min(pagination.totalPages, p + 1)), disabled: !pagination.hasNext },
                        { icon: <ChevronsRight size={13} />, label: 'Last', action: () => setPage(pagination.totalPages), disabled: !pagination.hasNext },
                      ] as const).map(({ icon, label, action, disabled }) => (
                        <button
                          key={label}
                          onClick={action}
                          disabled={disabled}
                          title={label}
                          style={{ background: '#18181b', border: '1px solid #27272a', color: disabled ? '#3f3f46' : '#a1a1aa', borderRadius: 7, padding: '5px 8px', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #3f3f46; }
      `}</style>
    </div>
  )
}

