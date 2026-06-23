import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { adminService } from '../services/admin.service'
import { useNavigate } from 'react-router-dom'
import {
  Users, FileText, Shield, Search, ChevronLeft, ChevronRight,
  Loader2, AlertTriangle, Eye, LogOut, MessageSquare, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, UserX, Settings, Moon, Sun, Languages
} from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import ConfirmModal from '../components/ui/ConfirmModal'
import { useLang } from '../context/LangContext'
import { useTheme } from '../context/ThemeContext'

const BAN_ACTIONS = [
  { value: '', label: 'Chọn hành động' },
  { value: 'warning', label: 'Cảnh cáo' },
  { value: 'ban_3_days', label: 'Cấm 3 ngày' },
  { value: 'ban_7_days', label: 'Cấm 7 ngày' },
  { value: 'ban_1_month', label: 'Cấm 1 tháng' },
  { value: 'ban_permanent', label: 'Cấm vĩnh viễn' },
  { value: 'unban', label: 'Gỡ phạt' },
]

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const badgeBase = { padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, display: 'inline-block', textAlign: 'center', lineHeight: 1.4, whiteSpace: 'nowrap' }

function BanStatusBadge({ banStatus, banExpiresAt }) {
  const { t } = useLang()
  if (banStatus === 'banned') {
    const label = banExpiresAt
      ? `${t('admin.bannedUntil') || 'Cấm đến'} ${formatDate(banExpiresAt)}`
      : (t('admin.bannedPermanent') || 'Cấm vĩnh viễn')
    return <span style={{ ...badgeBase, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{label}</span>
  }
  if (banStatus === 'warning') {
    return <span style={{ ...badgeBase, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>{t('admin.warning') || 'Cảnh cáo'}</span>
  }
  return <span style={{ ...badgeBase, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>{t('admin.statusNormal') || 'Bình thường'}</span>
}

function ReportStatusBadge({ status }) {
  const { t } = useLang()
  const map = {
    pending: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: t('admin.statusPending') || 'Chờ xử lý' },
    resolved: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: t('admin.statusResolved') || 'Đã xử lý' },
    dismissed: { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1', label: t('admin.statusDismissed') || 'Bác bỏ' },
  }
  const s = map[status] || map.pending
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
}

// ─── Settings Dropdown ─────────────────────────────
function SettingsDropdown() {
  const { t, lang, toggleLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
          borderRadius: 8, border: '1px solid var(--color-border)',
          background: 'var(--color-surface)', color: 'var(--color-text-muted)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        <Settings size={16} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: 8, minWidth: 200, zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          <button
            onClick={() => { toggleTheme(); setOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 12px', borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 14,
              color: 'var(--color-text)', fontWeight: 500,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-hover-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'light' ? (t('settings.darkMode') || 'Chế độ tối') : (t('settings.lightMode') || 'Chế độ sáng')}
          </button>
          <button
            onClick={() => { toggleLang(); setOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 12px', borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 14,
              color: 'var(--color-text)', fontWeight: 500,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-hover-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Languages size={16} />
            {lang === 'vi' ? 'English' : 'Tiếng Việt'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Users Tab ─────────────────────────────────────
function UsersTab() {
  const { t } = useLang()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [purgeTarget, setPurgeTarget] = useState(null)
  const [purging, setPurging] = useState(false)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const fetchUsers = useCallback(async (page = 1, searchQuery = '') => {
    setLoading(true)
    try {
      const data = await adminService.getUsers({ page, limit: 10, search: searchQuery })
      setUsers(data.users)
      setPagination(data.pagination)
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.loadUsersError') || 'Lỗi khi tải danh sách người dùng.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchUsers(1, search) }, [search])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const activeUsers = users.filter(u => u.status !== 'deleted')

  const banOrder = { none: 0, warning: 1, banned: 2 }
  const sortedUsers = [...activeUsers].sort((a, b) => {
    if (!sortKey) return 0
    let cmp = 0
    if (sortKey === 'fullName') {
      cmp = (a.fullName || '').localeCompare(b.fullName || '', 'vi')
    } else if (sortKey === 'banStatus') {
      cmp = (banOrder[a.banStatus] ?? 0) - (banOrder[b.banStatus] ?? 0)
    } else if (sortKey === 'createdAt') {
      cmp = new Date(a.createdAt) - new Date(b.createdAt)
    }
    return sortDir === 'desc' ? -cmp : cmp
  })

  function SortIcon({ field }) {
    if (sortKey !== field) return <ArrowUpDown size={13} style={{ opacity: 0.4 }} />
    return sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
  }

  function handleSearch(e) {
    e.preventDefault()
    setSearch(searchInput)
  }

  async function handlePurgeUser() {
    if (!purgeTarget) return
    setPurging(true)
    try {
      const data = await adminService.purgeUser(purgeTarget._id)
      toast.success(data.message || t('admin.purgeSuccess') || 'Xóa tài khoản thành công.')
      setUsers(prev => prev.filter(u => u._id !== purgeTarget._id))
    } catch (error) {
      toast.error(error.response?.data?.message || error?.message || t('admin.purgeFailed') || 'Xóa tài khoản thất bại.')
    } finally {
      setPurging(false)
      setPurgeTarget(null)
    }
  }

  async function handleBanAction(userId, action) {
    if (!action) return
    setActionLoading(userId)
    try {
      const data = await adminService.updateUserBan(userId, action)
      toast.success(data.message)
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, banStatus: data.user.banStatus, banExpiresAt: data.user.banExpiresAt } : u))
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.actionFailed') || 'Thao tác thất bại.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={t('admin.searchPlaceholder') || "Tìm theo tên hoặc email..."}
            style={{
              width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10,
              border: '1px solid var(--color-border)', fontSize: 14, outline: 'none',
              boxSizing: 'border-box', background: 'var(--color-input-bg)', color: 'var(--color-text)',
            }}
          />
        </div>
        <button type="submit" style={{
          padding: '10px 20px', borderRadius: 10, border: 'none',
          background: '#4f46e5', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}>
          {t('admin.searchBtn') || 'Tìm kiếm'}
        </button>
      </form>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#4f46e5', margin: '0 auto' }} />
        </div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>{t('admin.noUsersFound') || 'Không tìm thấy người dùng nào.'}</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th
                    onClick={() => handleSort('fullName')}
                    style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('admin.user') || 'Người dùng'} <SortIcon field="fullName" /></span>
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>Email</th>
                  <th
                    onClick={() => handleSort('banStatus')}
                    style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('admin.status') || 'Trạng thái'} <SortIcon field="banStatus" /></span>
                  </th>
                  <th
                    onClick={() => handleSort('createdAt')}
                    style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('admin.createdAt') || 'Ngày tạo'} <SortIcon field="createdAt" /></span>
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('admin.action') || 'Hành động'}</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map(u => (
                  <tr key={u._id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar src={u.avatar} alt={u.fullName} size="sm" />
                        <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{u.fullName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <BanStatusBadge banStatus={u.banStatus} banExpiresAt={u.banExpiresAt} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{formatDate(u.createdAt)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {actionLoading === u._id ? (
                        <Loader2 size={18} className="animate-spin" style={{ color: '#4f46e5', margin: '0 auto' }} />
                      ) : (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                          <select
                            defaultValue=""
                            onChange={e => { handleBanAction(u._id, e.target.value); e.target.value = '' }}
                            style={{
                              padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)',
                              fontSize: 13, cursor: 'pointer', background: 'var(--color-input-bg)',
                              color: 'var(--color-text)',
                            }}
                          >
                            {BAN_ACTIONS.filter(a => a.value !== 'unban' || u.banStatus !== 'none').map(a => (
                              <option key={a.value} value={a.value}>{t(`admin.action_${a.value || 'none'}`) || a.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setPurgeTarget(u)}
                            title={t('admin.deleteAccount') || "Xóa tài khoản"}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              padding: '6px 10px', borderRadius: 8, border: '1px solid #ef4444',
                              background: '#fef2f2', color: '#ef4444', fontSize: 12,
                              fontWeight: 600, cursor: 'pointer', gap: 4,
                              whiteSpace: 'nowrap', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444' }}
                          >
                            <Trash2 size={13} /> {t('admin.deleteAccount') || "Xóa tài khoản"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, fontSize: 14, color: 'var(--color-text-muted)' }}>
            <span>{(t('admin.total') || 'Tổng:') + ' ' + pagination.total + ' ' + (t('admin.users_lc') || 'người dùng')}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => fetchUsers(pagination.page - 1, search)}
                disabled={pagination.page <= 1}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer', opacity: pagination.page <= 1 ? 0.4 : 1, color: 'var(--color-text)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span>{t('admin.page') || 'Trang'} {pagination.page}/{pagination.totalPages}</span>
              <button
                onClick={() => fetchUsers(pagination.page + 1, search)}
                disabled={pagination.page >= pagination.totalPages}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer', opacity: pagination.page >= pagination.totalPages ? 0.4 : 1, color: 'var(--color-text)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={!!purgeTarget}
        onCancel={() => setPurgeTarget(null)}
        onConfirm={handlePurgeUser}
        title={t('admin.confirmDeleteTitle') || "Xác nhận xóa tài khoản"}
        message={(t('admin.confirmDeleteDesc') || 'Bạn có chắc chắn muốn xóa tài khoản "{name}" ({email})? Thao tác này sẽ ẩn danh hóa toàn bộ thông tin, xóa khỏi bạn bè và nhóm chat. KHÔNG THỂ hoàn tác.').replace('{name}', purgeTarget?.fullName).replace('{email}', purgeTarget?.email)}
        confirmText={t('admin.deleteAccount') || "Xóa tài khoản"}
        danger
      />
    </div>
  )
}

// ─── Deleted Users Tab ────────────────────────────────
function DeletedUsersTab() {
  const { t } = useLang()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchUsers = useCallback(async (page = 1, searchQuery = '') => {
    setLoading(true)
    try {
      const data = await adminService.getUsers({ page, limit: 50, search: searchQuery })
      const deletedUsers = data.users.filter(u => u.status === 'deleted')
      setUsers(deletedUsers)
      setPagination({ page: 1, totalPages: 1, total: deletedUsers.length })
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.loadListError') || 'Lỗi khi tải danh sách.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchUsers(1, search) }, [search])

  function handleSearch(e) {
    e.preventDefault()
    setSearch(searchInput)
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={t('admin.searchPlaceholder') || "Tìm theo tên hoặc email..."}
            style={{
              width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10,
              border: '1px solid var(--color-border)', fontSize: 14, outline: 'none',
              boxSizing: 'border-box', background: 'var(--color-input-bg)', color: 'var(--color-text)',
            }}
          />
        </div>
        <button type="submit" style={{
          padding: '10px 20px', borderRadius: 10, border: 'none',
          background: '#4f46e5', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}>
          {t('admin.searchBtn') || 'Tìm kiếm'}
        </button>
      </form>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#4f46e5', margin: '0 auto' }} />
        </div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>{t('admin.noDeletedUsers') || 'Không có tài khoản nào đã bị xóa.'}</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('admin.user') || 'Người dùng'}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('admin.emailAnonymized') || 'Email (đã ẩn danh)'}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('admin.status') || 'Trạng thái'}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('admin.createdAt') || 'Ngày tạo'}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar src="" alt={u.fullName} size="sm" />
                        <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{u.fullName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontSize: 12 }}>{u.email}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ ...badgeBase, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{t('admin.statusDeleted') || 'Đã xóa'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, fontSize: 14, color: 'var(--color-text-muted)' }}>
            <span>{(t('admin.total') || 'Tổng:') + ' ' + users.length + ' ' + (t('admin.deletedUsers_lc') || 'tài khoản đã xóa')}</span>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reports Tab ───────────────────────────────────
function ReportsTab() {
  const { t } = useLang()
  const toast = useToast()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [statusFilter, setStatusFilter] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [contextModal, setContextModal] = useState(null)
  const [contextLoading, setContextLoading] = useState(false)

  const fetchReports = useCallback(async (page = 1, status = '') => {
    setLoading(true)
    try {
      const data = await adminService.getReports({ page, limit: 15, status })
      setReports(data.reports)
      setPagination(data.pagination)
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.loadReportsError') || 'Lỗi khi tải danh sách báo cáo.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchReports(1, statusFilter) }, [statusFilter])

  async function handleStatusUpdate(reportId, newStatus) {
    setActionLoading(reportId)
    try {
      const data = await adminService.updateReportStatus(reportId, newStatus)
      toast.success(data.message)
      setReports(prev => prev.map(r => r._id === reportId ? { ...r, status: newStatus } : r))
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.updateFailed') || 'Cập nhật thất bại.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBanAction(reportId, reportedUserId, action) {
    if (!action || !reportedUserId) return
    setActionLoading('ban_' + reportedUserId)
    try {
      const data = await adminService.updateUserBan(reportedUserId, action)
      toast.success(data.message)
      setReports(prev => prev.map(r => {
        if (r.reportedUserId && r.reportedUserId._id === reportedUserId) {
          r = { ...r, reportedUserId: { ...r.reportedUserId, banStatus: data.user.banStatus, banExpiresAt: data.user.banExpiresAt } }
        }
        if (r._id === reportId && r.status === 'pending') {
          r = { ...r, status: 'resolved' }
        }
        return r
      }))
      if (reportId) {
        try {
          await adminService.updateReportStatus(reportId, 'resolved')
        } catch {}
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.actionFailed') || 'Thao tác thất bại.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleViewContext(reportId) {
    setContextLoading(true)
    try {
      const data = await adminService.getReportContext(reportId)
      setContextModal(data)
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.loadContextError') || 'Lỗi khi tải ngữ cảnh.')
    } finally {
      setContextLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['', 'pending', 'resolved', 'dismissed'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '8px 16px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: statusFilter === s ? '#4f46e5' : 'var(--color-surface-alt)',
              color: statusFilter === s ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {s === '' ? (t('admin.filterAll') || 'Tất cả') : s === 'pending' ? (t('admin.statusPending') || 'Chờ xử lý') : s === 'resolved' ? (t('admin.statusResolved') || 'Đã xử lý') : (t('admin.statusDismissed') || 'Bác bỏ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#4f46e5', margin: '0 auto' }} />
        </div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>{t('admin.noReports') || 'Không có báo cáo nào.'}</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map(r => (
              <div key={r._id} style={{
                padding: 16, borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>{r.reason}</span>
                      <ReportStatusBadge status={r.status} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{t('admin.reporter') || 'Người báo cáo:'}</span> {r.reporterId?.fullName || '—'} ({r.reporterId?.email || '—'})
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{t('admin.reportedUser') || 'Bị báo cáo:'}</span> {r.reportedUserId?.fullName || '—'} ({r.reportedUserId?.email || '—'})
                      {r.reportedUserId && <span style={{ marginLeft: 8 }}><BanStatusBadge banStatus={r.reportedUserId.banStatus} banExpiresAt={r.reportedUserId.banExpiresAt} /></span>}
                    </div>
                    {r.description && <p style={{ fontSize: 13, color: 'var(--color-text)', margin: '6px 0 0', lineHeight: 1.5 }}>{r.description}</p>}
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}>{formatDate(r.createdAt)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {r.messageId && (
                    <button
                      onClick={() => handleViewContext(r._id)}
                      disabled={contextLoading}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, color: '#4f46e5',
                      }}
                    >
                      <Eye size={14} /> {t('admin.viewContext') || 'Xem ngữ cảnh'}
                    </button>
                  )}
                  {r.status === 'pending' && (
                    <>
                      {actionLoading === r._id || actionLoading === 'ban_' + r.reportedUserId?._id ? (
                        <Loader2 size={18} className="animate-spin" style={{ color: '#4f46e5' }} />
                      ) : (
                        <>
                          <button
                            onClick={() => handleStatusUpdate(r._id, 'resolved')}
                            style={{
                              padding: '6px 14px', borderRadius: 8, border: 'none',
                              background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            {t('admin.statusResolved') || 'Đã xử lý'}
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(r._id, 'dismissed')}
                            style={{
                              padding: '6px 14px', borderRadius: 8, border: 'none',
                              background: '#64748b', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            {t('admin.statusDismissed') || 'Bác bỏ'}
                          </button>
                          {r.reportedUserId && (
                            <select
                              defaultValue=""
                              onChange={e => { handleBanAction(r._id, r.reportedUserId._id, e.target.value); e.target.value = '' }}
                              style={{
                                padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)',
                                fontSize: 13, cursor: 'pointer', background: 'var(--color-input-bg)',
                                color: 'var(--color-text)',
                              }}
                            >
                              {BAN_ACTIONS.filter(a => a.value !== 'unban' || r.reportedUserId.banStatus !== 'none').map(a => (
                                <option key={a.value} value={a.value}>{t(`admin.action_${a.value || 'none'}`) || a.label}</option>
                              ))}
                            </select>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, fontSize: 14, color: 'var(--color-text-muted)' }}>
            <span>{(t('admin.total') || 'Tổng:') + ' ' + pagination.total + ' ' + (t('admin.reports_lc') || 'báo cáo')}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => fetchReports(pagination.page - 1, statusFilter)}
                disabled={pagination.page <= 1}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer', opacity: pagination.page <= 1 ? 0.4 : 1, color: 'var(--color-text)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span>{t('admin.page') || 'Trang'} {pagination.page}/{pagination.totalPages}</span>
              <button
                onClick={() => fetchReports(pagination.page + 1, statusFilter)}
                disabled={pagination.page >= pagination.totalPages}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer', opacity: pagination.page >= pagination.totalPages ? 0.4 : 1, color: 'var(--color-text)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Context Modal */}
      {contextModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setContextModal(null) }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1200, padding: 20,
          }}
        >
          <div className="app-scrollbar" style={{
            background: 'var(--color-surface)', borderRadius: 16, maxWidth: 600, width: '100%',
            maxHeight: '80vh', overflow: 'auto', padding: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{t('admin.msgContextTitle') || 'Ngữ cảnh tin nhắn'}</h3>
              <button onClick={() => setContextModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <span style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>&times;</span>
              </button>
            </div>

            {contextModal.contextMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-secondary)' }}>
                {contextModal.reportedMessage
                  ? (t('admin.msgContextDeleted') || 'Tin nhắn bị báo cáo đã bị thu hồi hoặc xóa. Không có ngữ cảnh để hiển thị.')
                  : (t('admin.msgNotFound') || 'Tin nhắn không còn tồn tại.')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contextModal.contextMessages.map((msg, idx) => (
                  <div
                    key={msg._id || idx}
                    style={{
                      padding: '10px 14px', borderRadius: 10, fontSize: 14,
                      background: msg.isReportedMessage ? '#fef2f2' : 'var(--color-surface-alt)',
                      border: msg.isReportedMessage ? '2px solid #ef4444' : '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: msg.isReportedMessage ? '#dc2626' : 'var(--color-text)' }}>
                        {msg.senderId?.fullName || (t('admin.user') || 'Người dùng')}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{formatDate(msg.createdAt)}</span>
                      {msg.isReportedMessage && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginLeft: 4 }}>{t('admin.reported') || 'BỊ BÁO CÁO'}</span>
                      )}
                    </div>
                    <p style={{ margin: 0, color: 'var(--color-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                      {msg.isRecalled ? <em style={{ color: 'var(--color-text-secondary)' }}>{t('admin.recalledMsg') || 'Tin nhắn đã bị thu hồi'}</em> : msg.text || (msg.image ? (t('admin.imageMsg') || '[Hình ảnh]') : msg.file ? `[${t('admin.fileMsg') || 'Tệp'}: ${msg.file.name}]` : (t('admin.unknownMsg') || '[Nội dung không xác định]'))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Admin Page ───────────────────────────────
function AdminPage() {
  const { t } = useLang()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('users')

  const tabs = [
    { key: 'users', label: t('admin.tabUsers') || 'Quản lý người dùng', icon: <Users size={18} /> },
    { key: 'deleted', label: t('admin.tabDeleted') || 'Tài khoản đã xóa', icon: <UserX size={18} /> },
    { key: 'reports', label: t('admin.tabReports') || 'Báo cáo vi phạm', icon: <FileText size={18} /> },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={24} style={{ color: '#4f46e5' }} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>Admin Panel</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SettingsDropdown />
          <button
            onClick={() => navigate('/chat')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#4f46e5',
            }}
          >
            <MessageSquare size={16} /> {t('admin.chat') || 'Chat'}
          </button>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>{user?.fullName}</span>
          <button
            onClick={() => { logout(); navigate('/login') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px',
              borderRadius: 8, border: 'none', background: '#fee2e2', color: '#dc2626',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <LogOut size={14} /> {t('admin.logout') || 'Đăng xuất'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--color-surface-alt)', borderRadius: 12, padding: 4 }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', flex: 1,
                background: activeTab === tab.key ? 'var(--color-surface)' : 'transparent',
                color: activeTab === tab.key ? '#4f46e5' : 'var(--color-text-muted)',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                justifyContent: 'center',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div style={{ background: 'var(--color-surface)', borderRadius: 16, padding: 24, border: '1px solid var(--color-border)' }}>
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'deleted' && <DeletedUsersTab />}
          {activeTab === 'reports' && <ReportsTab />}
        </div>
      </div>
    </div>
  )
}

export default AdminPage
