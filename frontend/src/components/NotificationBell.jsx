import { useState, useRef, useEffect, useCallback } from 'react'
import { useLang } from '../context/LangContext'
import { Bell, Check, CheckCheck, AtSign, Users, Loader2 } from 'lucide-react'
import { useMentionNotification } from '../context/MentionNotificationContext'
import Avatar from './ui/Avatar'

function formatTimeAgo(dateStr, t) {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return t('notif.justNow')
  if (diff < 3600) return t('notif.minutesAgo').replace('{n}', Math.floor(diff / 60))
  if (diff < 86400) return t('notif.hoursAgo').replace('{n}', Math.floor(diff / 3600))
  if (diff < 604800) return t('notif.daysAgo').replace('{n}', Math.floor(diff / 86400))
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

export default function NotificationBell({ onNotificationClick }) {
  const { t } = useLang()
  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useMentionNotification()

  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const isMobile = window.innerWidth < 768
      if (isMobile) {
        setDropdownPos({
          top: rect.bottom + 8,
          left: 12,
          right: 12,
          mobile: true,
        })
      } else {
        setDropdownPos({
          top: rect.bottom + 8,
          left: rect.left,
          right: undefined,
          mobile: false,
        })
      }
    }
  }, [open])

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
      loadMore()
    }
  }, [loadMore])

  const handleItemClick = async (notif) => {
    if (!notif.isRead) {
      markAsRead(notif._id)
    }
    setOpen(false)
    if (onNotificationClick) {
      onNotificationClick(notif.conversation?._id, notif.message?._id)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        className="sidebar__icon-btn"
        onClick={() => setOpen(v => !v)}
        style={{ position: 'relative' }}
        title={unreadCount > 0 ? t('notif.newCount').replace('{n}', unreadCount) : t('notif.bellTitle')}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '0', right: '0',
            width: '16px', height: '16px', borderRadius: '50%',
            background: '#e74c3c', color: 'white', fontSize: '9px',
            fontWeight: 700, display: 'flex', alignItems: 'center',
            justifyContent: 'center', lineHeight: 1,
            border: '2px solid var(--color-surface)',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div ref={dropdownRef} style={{
          position: 'fixed', top: dropdownPos.top,
          ...(dropdownPos.mobile
            ? { left: 12, right: 12, width: 'auto' }
            : { left: dropdownPos.left, width: '360px' }),
          maxHeight: dropdownPos.mobile ? 'calc(100vh - 120px)' : '480px',
          background: 'var(--color-surface)',
          borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          border: '1px solid var(--color-border-subtle)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
              {t('notif.mention') || 'Thông báo nhắc tên'}
            </h4>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--color-primary)', fontSize: '12px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <CheckCheck size={14} />
                {t('notif.markAsRead') || 'Đánh dấu đã đọc'}
              </button>
            )}
          </div>

          <div
            className="app-scrollbar"
            ref={listRef}
            onScroll={handleScroll}
            style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}
          >
            {notifications.length === 0 && !loading ? (
              <div style={{
                padding: '40px 16px', textAlign: 'center',
                color: 'var(--color-text-muted)', fontSize: '13px',
              }}>
                <AtSign size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <p>{t('notif.empty')}</p>
              </div>
            ) : (
              notifications.map(notif => {
                const sender = notif.sender
                const conv = notif.conversation
                const msg = notif.message
                const isRecalled = msg?.isRecalled

                return (
                  <div
                    key={notif._id}
                    onClick={() => handleItemClick(notif)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                      padding: '10px 16px', cursor: 'pointer',
                      background: notif.isRead ? 'transparent' : 'var(--color-primary-light)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (notif.isRead) e.currentTarget.style.background = 'var(--color-hover-bg)' }}
                    onMouseLeave={e => { if (notif.isRead) e.currentTarget.style.background = 'transparent' }}
                  >
                    <Avatar src={sender?.avatar} alt={sender?.fullName || '?'} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.4 }}>
                        <strong>{sender?.fullName || t('notif.someone')}</strong>
                        {t('notif.mentionedYou')}
                        {conv?.isGroup && (
                          <span>
                            {t('notif.inGroup')} <strong>{conv.name || t('notif.group')}</strong>
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '12px', color: 'var(--color-text-muted)',
                        marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {isRecalled
                          ? t('msg.recalled')
                          : (msg?.text || t('notif.sentMessage'))}
                      </div>
                      <div style={{
                        fontSize: '11px', color: 'var(--color-text-muted)',
                        marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        {notif.type === 'mention_all' ? <Users size={10} /> : <AtSign size={10} />}
                        {formatTimeAgo(notif.createdAt, t)}
                      </div>
                    </div>
                    {!notif.isRead && (
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: 'var(--color-primary)', flexShrink: 0, marginTop: '6px',
                      }} />
                    )}
                  </div>
                )
              })
            )}

            {loading && (
              <div style={{ padding: '12px', textAlign: 'center' }}>
                <Loader2 className="animate-spin" size={20} color="var(--color-primary)" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
