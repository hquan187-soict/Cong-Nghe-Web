import Avatar from '../ui/Avatar'
import { formatRelativeTime } from '../../utils/timeUtils'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'

/**
 * ConversationItem — Một dòng trong Sidebar danh sách conversations
 * Hiển thị: avatar, tên người chat, preview lastMessage (30 ký tự), thời gian tương đối
 * Props:
 *   - conversation: object (populated members + lastMessage)
 *   - isActive: boolean (đang được chọn?)
 *   - onClick: callback khi click
 */
function ConversationItem({ conversation, isActive, onClick }) {
  const { user } = useAuth()
  const { t, lang } = useLang()

  // Tìm member khác (không phải user hiện tại)
  const otherMember = conversation.members?.find(
    (m) => m._id !== user?._id
  )

  // Preview lastMessage — cắt 30 ký tự
  const lastMessagePreview = (() => {
    const msg = conversation.lastMessage
    if (!msg) return t('chat.noMessage')
    const text = msg.text || ''
    return text.length > 30 ? text.slice(0, 30) + '…' : text
  })()

  // Thời gian tương đối
  const timeAgo = formatRelativeTime(
    conversation.lastMessage?.createdAt || conversation.updatedAt,
    lang
  )

  return (
    <div
      className={`conversation-item ${isActive ? 'conversation-item--active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
    >
      {/* Avatar */}
      <div className="conversation-item__avatar">
        <Avatar
          src={otherMember?.avatar}
          alt={otherMember?.fullName || '?'}
          size="sm"
        />
      </div>

      {/* Nội dung */}
      <div className="conversation-item__content">
        <div className="conversation-item__header">
          <span className="conversation-item__name">
            {otherMember?.fullName || t('chat.unknownUser')}
          </span>
          <span className="conversation-item__time">
            {timeAgo}
          </span>
        </div>
        <p className="conversation-item__preview">
          {lastMessagePreview}
        </p>
      </div>
    </div>
  )
}

export default ConversationItem
