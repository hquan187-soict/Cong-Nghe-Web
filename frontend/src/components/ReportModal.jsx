import { useState } from 'react'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { reportService } from '../services/report.service'
import { useToast } from '../context/ToastContext'

const REPORT_REASONS = [
  'Nội dung spam',
  'Quấy rối / bắt nạt',
  'Nội dung không phù hợp',
  'Thông tin sai lệch',
  'Mạo danh',
  'Khác',
]

function ReportModal({ isOpen, onClose, reportedUserId, messageId }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason) {
      toast.error('Vui lòng chọn lý do báo cáo.')
      return
    }

    setLoading(true)
    try {
      await reportService.createReport({
        reportedUserId,
        messageId: messageId || null,
        reason,
        description,
      })
      toast.success('Báo cáo đã được gửi thành công.')
      setReason('')
      setDescription('')
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gửi báo cáo thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="profile-modal__overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ zIndex: 1100 }}
    >
      <div style={{
        background: 'var(--color-surface, #fff)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 440,
        padding: '24px',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted, #64748b)', padding: 4,
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <AlertTriangle size={22} style={{ color: '#ef4444' }} />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text, #1e293b)' }}>
            Báo cáo vi phạm
          </h3>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--color-text, #334155)' }}>
            Lý do báo cáo *
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {REPORT_REASONS.map(r => (
              <label key={r} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                background: reason === r ? 'var(--color-primary-light, #eef2ff)' : 'transparent',
                border: `1px solid ${reason === r ? 'var(--color-primary, #4f46e5)' : 'var(--color-border, #e2e8f0)'}`,
                transition: 'all 0.15s',
              }}>
                <input
                  type="radio"
                  name="report-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  style={{ accentColor: 'var(--color-primary, #4f46e5)' }}
                />
                <span style={{ fontSize: 14, color: 'var(--color-text, #334155)' }}>{r}</span>
              </label>
            ))}
          </div>

          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--color-text, #334155)' }}>
            Mô tả thêm
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Mô tả chi tiết hành vi vi phạm (tùy chọn)..."
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--color-border, #e2e8f0)',
              fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
              background: 'var(--color-surface, #fff)',
              color: 'var(--color-text, #334155)',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 20px', borderRadius: 8, border: '1px solid var(--color-border, #e2e8f0)',
                background: 'var(--color-surface, #fff)', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, color: 'var(--color-text, #334155)',
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !reason}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: '#ef4444', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14, fontWeight: 600, opacity: loading || !reason ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Gửi báo cáo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ReportModal
