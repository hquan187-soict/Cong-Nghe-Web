import { AtSign, X } from 'lucide-react'
import { useMentionNotification } from '../context/MentionNotificationContext'
import { useLang } from '../context/LangContext'
import Avatar from './ui/Avatar'

export default function MentionToast() {
  const { toastNotification, dismissToast, navigateToMessage, markAsRead } = useMentionNotification()
  const { t } = useLang()

  if (!toastNotification) return null

  const sender = toastNotification.sender
  const conv = toastNotification.conversation
  const msg = toastNotification.message

  const handleClick = () => {
    if (!toastNotification.isRead) {
      markAsRead(toastNotification._id)
    }
    navigateToMessage(conv?._id, msg?._id)
    dismissToast()
  }

  return (
    <div
      style={{
        position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
        width: '340px', background: 'var(--color-surface)',
        borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        border: '1px solid var(--color-border-subtle)',
        animation: 'toast-slide-in 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) forwards',
        cursor: 'pointer', overflow: 'hidden',
      }}
      onClick={handleClick}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '8px 12px',
        background: 'var(--color-primary)', color: 'white',
        fontSize: '12px', fontWeight: 600,
      }}>
        <AtSign size={14} />
        <span>{t('mention.title') || 'Bạn được nhắc đến'}</span>
        <button
          onClick={(e) => { e.stopPropagation(); dismissToast() }}
          style={{
            marginLeft: 'auto', background: 'transparent', border: 'none',
            color: 'white', cursor: 'pointer', padding: '2px',
            display: 'flex', alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
        <Avatar src={sender?.avatar} alt={sender?.fullName || '?'} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
            {sender?.fullName || t('mention.someone') || 'Ai đó'}
            {conv?.isGroup && (
              <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>
                {' '}trong {conv.name || t('mention.group') || 'nhóm'}
              </span>
            )}
          </div>
          <div style={{
            fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {msg?.text || t('mention.sentMessage') || 'Đã gửi một tin nhắn'}
          </div>
        </div>
      </div>
    </div>
  )
}
