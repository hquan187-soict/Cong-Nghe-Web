import { useState, useRef, useEffect } from 'react'
import {
  MoreHorizontal, BellOff, MailOpen, Phone, Video,
  Archive, Trash2, Minus
} from 'lucide-react'
import Avatar from '../ui/Avatar'
import { formatRelativeTime } from '../../utils/timeUtils'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'

function ConversationItem({ conversation, isActive, onClick, unreadCount = 0 }) {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

  const otherMember = conversation.members?.find(
    (m) => m._id !== user?._id
  )

  const lastMessagePreview = (() => {
    const msg = conversation.lastMessage
    if (!msg) return t('chat.noMessage')

    if (msg.text) {
      const text = msg.text
      return text.length > 30 ? text.slice(0, 30) + '…' : text
    }

    const senderName = (() => {
      if (!msg.senderId) return ''
      if (typeof msg.senderId === 'object') {
        return msg.senderId._id === user?._id
          ? 'Bạn'
          : (msg.senderId.fullName || '')
      }
      return msg.senderId === user?._id ? 'Bạn' : ''
    })()

    const prefix = senderName ? senderName + ': ' : ''

    if (msg.file?.url) return prefix + 'Đã gửi một tệp đính kèm'
    if (msg.image) return prefix + 'Đã gửi một ảnh'

    return t('chat.noMessage')
  })()

  const timeAgo = formatRelativeTime(
    conversation.lastMessage?.createdAt || conversation.updatedAt,
    lang
  )

  const hasUnread = unreadCount > 0

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleMenuAction = (action) => (e) => {
    e.stopPropagation()
    console.log(`[ConversationItem] ${action} clicked, conversationId:`, conversation._id)
    setShowMenu(false)
  }

  return (
    <div
      className={`conversation-item ${isActive ? 'conversation-item--active' : ''} ${hasUnread ? 'conversation-item--unread' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
    >
      <div className="conversation-item__avatar">
        <Avatar
          src={otherMember?.avatar}
          alt={otherMember?.fullName || '?'}
          size="sm"
        />
      </div>

      <div className="conversation-item__content">
        <div className="conversation-item__header">
          <span className={`conversation-item__name ${hasUnread ? 'conversation-item__name--unread' : ''}`}>
            {otherMember?.fullName || t('chat.unknownUser')}
          </span>
          <span className="conversation-item__time">
            {timeAgo}
          </span>
        </div>
        <div className="conversation-item__footer">
          <p className={`conversation-item__preview ${hasUnread ? 'conversation-item__preview--unread' : ''}`}>
            {lastMessagePreview}
          </p>
          {hasUnread && (
            <span className="conversation-item__badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Hover option button */}
      <div className="conversation-item__options" ref={menuRef}>
        <button
          className="conversation-item__options-btn"
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu((v) => !v)
          }}
          title="Tùy chọn"
        >
          <MoreHorizontal size={16} />
        </button>
        {showMenu && (
          <div className="conversation-item__dropdown">
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('Mute')}>
              <BellOff size={14} />
              <span>Tắt thông báo</span>
            </button>
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('MarkUnread')}>
              <MailOpen size={14} />
              <span>Đánh dấu là chưa đọc</span>
            </button>
            <div className="conversation-item__dropdown-divider" />
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('VoiceCall')}>
              <Phone size={14} />
              <span>Gọi thoại</span>
            </button>
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('VideoCall')}>
              <Video size={14} />
              <span>Gọi Video</span>
            </button>
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('Archive')}>
              <Archive size={14} />
              <span>Lưu trữ đoạn chat</span>
            </button>
            <button className="conversation-item__dropdown-item conversation-item__dropdown-item--danger" onClick={handleMenuAction('Delete')}>
              <Trash2 size={14} />
              <span>Xóa đoạn chat</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConversationItem
