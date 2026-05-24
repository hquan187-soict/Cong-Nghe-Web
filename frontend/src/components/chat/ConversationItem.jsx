import { useState, useRef, useEffect } from 'react'
import {
  MoreHorizontal, BellOff, Bell, MailOpen, Phone, Video,
  Archive, Trash2, Pin, PinOff, LogOut, ShieldBan, ShieldCheck
} from 'lucide-react'
import Avatar from '../ui/Avatar'
import { formatRelativeTime } from '../../utils/timeUtils'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import { useSocket } from '../../context/SocketContext'

function ConversationItem({ conversation, isActive, onClick, unreadCount = 0, collapsed = false, onlineUsers = [], onPin, onMute, onLeaveGroup, onArchive, onBlock, onUnblock }) {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const { onlineUsers: contextOnlineUsers } = useSocket()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

  const isGroup = conversation.isGroup;
  const isArchivedByMe = conversation.archivedBy?.some(
    id => (id._id || id).toString() === user?._id?.toString()
  );

  const otherMember = conversation.members?.find(
    (m) => m._id !== user?._id
  )

  const otherMemberId = otherMember?._id?.toString()
  const effectiveOnlineUsers = Array.isArray(onlineUsers) && onlineUsers.length > 0 ? onlineUsers : contextOnlineUsers

  const isOtherOnline = isGroup
    ? conversation.members.some(m => m._id !== user?._id && effectiveOnlineUsers.some(id => id.toString() === m._id.toString()))
    : (otherMemberId ? effectiveOnlineUsers.some((id) => id.toString() === otherMemberId) : false);

  const getNickname = (id) => {
    if (!conversation.nicknames || !id) return null
    if (conversation.nicknames instanceof Map) return conversation.nicknames.get(id.toString())
    if (typeof conversation.nicknames === 'object') return conversation.nicknames[id.toString()]
    return null
  }

  const displayTitle = isGroup ? (conversation.name || conversation.groupName) : (getNickname(otherMember?._id) || otherMember?.fullName || t('chat.unknownUser'));

  const lastMessagePreview = (() => {
    const msg = conversation.lastMessage
    if (!msg) return t('chat.noMessage')

    const senderName = (() => {
      if (!msg.senderId) return ''
      if (typeof msg.senderId === 'object') {
        if (msg.senderId._id === user?._id) return 'Bạn'
        return getNickname(msg.senderId._id) || msg.senderId.fullName || ''
      }
      if (msg.senderId === user?._id) return 'Bạn'
      return getNickname(msg.senderId) || ''
    })()

    const prefixStr = senderName === 'Bạn' || isGroup ? senderName + ': ' : ''

    if (msg.messageType === 'like') {
      return prefixStr + 'Đã gửi một biểu tượng cảm xúc'
    }

    if (msg.text) {
      const text = msg.text
      const truncated = text.length > 30 ? text.slice(0, 30) + '…' : text
      return prefixStr + truncated
    }

    if (msg.file?.url) return prefixStr + 'Đã gửi một tệp đính kèm'
    if (msg.image) return prefixStr + 'Đã gửi một ảnh'

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
    setShowMenu(false)
    if (action === 'Pin' && onPin) onPin(conversation._id)
    if (action === 'Mute' && onMute) onMute(conversation._id)
    if (action === 'Archive' && onArchive) onArchive(conversation._id)
    if (action === 'LeaveGroup' && onLeaveGroup) onLeaveGroup(conversation._id)
    if (action === 'Block' && onBlock) onBlock(conversation._id, otherMemberId)
    if (action === 'Unblock' && onUnblock) onUnblock(conversation._id, otherMemberId)
  }

  const isBlockedByMe = user?.blockedUsers?.some(id => id?.toString() === otherMemberId)

  const renderAvatar = () => {
    const hasCustomAvatar = isGroup && !!(conversation.avatar || conversation.groupAvatar);
    if (isGroup && !hasCustomAvatar) {
      // Get up to 2 other members for stacked avatar
      const membersToAvatar = conversation.members.filter(m => m._id !== user?._id).slice(0, 2);
      if (membersToAvatar.length >= 2) {
        return (
          <div style={{ position: 'relative', width: '40px', height: '40px' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 1, border: '2px solid var(--color-surface)', borderRadius: '50%' }}>
              <Avatar src={membersToAvatar[0].avatar} alt={membersToAvatar[0].fullName} size="sm" style={{ width: '26px', height: '26px' }} />
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, zIndex: 2, border: '2px solid var(--color-surface)', borderRadius: '50%' }}>
              <Avatar src={membersToAvatar[1].avatar} alt={membersToAvatar[1].fullName} size="sm" style={{ width: '26px', height: '26px' }} />
            </div>
            {hasUnread && <span className="conversation-item__badge conversation-item__badge--dot" style={{ zIndex: 3 }} />}
          </div>
        );
      }
    }
    return (
      <>
        <Avatar
          src={isGroup ? (conversation.avatar || conversation.groupAvatar) : otherMember?.avatar}
          alt={displayTitle}
          size="sm"
          isOnline={!isGroup && isOtherOnline}
        />
        {hasUnread && (
          <span className="conversation-item__badge conversation-item__badge--dot" />
        )}
      </>
    )
  }

  if (collapsed) {
    return (
      <div
        className={`conversation-item conversation-item--collapsed ${isActive ? 'conversation-item--active' : ''}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
        title={displayTitle}
      >
        <div className="conversation-item__avatar">
          {renderAvatar()}
        </div>
      </div>
    )
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
        {renderAvatar()}
      </div>

      <div className="conversation-item__content">
        <div className="conversation-item__header">
          <span className={`conversation-item__name ${hasUnread ? 'conversation-item__name--unread' : ''}`}>
            {displayTitle}
            {conversation.isPinned && <Pin size={12} style={{ marginLeft: '6px', color: 'var(--color-primary)' }} />}
          </span>
          <span className="conversation-item__time" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {conversation.isMuted && <BellOff size={10} />}
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
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('Pin')}>
              {conversation.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              <span>{conversation.isPinned ? t('chat.unpinConversation') : t('chat.pinConversation')}</span>
            </button>
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('Mute')}>
              {conversation.isMuted ? <Bell size={14} /> : <BellOff size={14} />}
              <span>{conversation.isMuted ? t('chat.unmuteConversation') : t('chat.muteConversation')}</span>
            </button>
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('MarkUnread')}>
              <MailOpen size={14} />
              <span>Đánh dấu là chưa đọc</span>
            </button>
            <div className="conversation-item__dropdown-divider" />
            {!isGroup && (
              <>
                <button className="conversation-item__dropdown-item" onClick={handleMenuAction('VoiceCall')}>
                  <Phone size={14} />
                  <span>Gọi thoại</span>
                </button>
                <button className="conversation-item__dropdown-item" onClick={handleMenuAction('VideoCall')}>
                  <Video size={14} />
                  <span>Gọi Video</span>
                </button>
              </>
            )}
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('Archive')}>
              <Archive size={14} />
              <span>{isArchivedByMe ? 'Bỏ lưu trữ đoạn chat' : 'Lưu trữ đoạn chat'}</span>
            </button>
            {isGroup && (
              <button className="conversation-item__dropdown-item conversation-item__dropdown-item--danger" onClick={handleMenuAction('LeaveGroup')}>
                <LogOut size={14} />
                <span>{t('chat.leaveGroup')}</span>
              </button>
            )}
            {!isGroup && !isBlockedByMe && (
              <button className="conversation-item__dropdown-item conversation-item__dropdown-item--danger" onClick={handleMenuAction('Block')}>
                <ShieldBan size={14} />
                <span>{t('chat.blockUser')}</span>
              </button>
            )}
            {!isGroup && isBlockedByMe && (
              <button className="conversation-item__dropdown-item conversation-item__dropdown-item--danger" onClick={handleMenuAction('Unblock')}>
                <ShieldCheck size={14} />
                <span>{t('chat.unblockUser')}</span>
              </button>
            )}
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
