import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  MoreHorizontal, BellOff, Bell, MailOpen, Phone, Video,
  Archive, Trash2, Pin, PinOff, LogOut, ShieldBan, ShieldCheck, ChevronRight, ChevronDown, Tag
} from 'lucide-react'
import Avatar from '../ui/Avatar'
import { formatRelativeTime } from '../../utils/timeUtils'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import { useSocket } from '../../context/SocketContext'
import { translateSystemMessage } from '../../utils/systemMessageTranslator'

const CONVERSATION_MENU_WIDTH = 200
const ESTIMATED_CONVERSATION_MENU_HEIGHT = 320
const VIEWPORT_PADDING = 8

function ConversationItem({ conversation, isActive, onClick, unreadCount = 0, collapsed = false, onlineUsers = [], onPin, onMute, onLeaveGroup, onArchive, onBlock, onUnblock, onMarkRead, onMarkUnread, onDeleteChat, onUpdateLabel }) {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const { onlineUsers: contextOnlineUsers } = useSocket()
  const [showMenu, setShowMenu] = useState(false)
  const [showLabelSubmenu, setShowLabelSubmenu] = useState(false)
  const menuRef = useRef(null)
  const optionsBtnRef = useRef(null)
  const dropdownRef = useRef(null)
  const [dropdownStyle, setDropdownStyle] = useState(null)
  const [isDropdownMeasured, setIsDropdownMeasured] = useState(false)

  const isGroup = conversation.isGroup;
  const isArchivedByMe = conversation.archivedBy?.some(
    id => (id._id || id).toString() === user?._id?.toString()
  );

  const otherMember = conversation.members?.find(
    (m) => m._id !== user?._id
  )

  const otherMemberId = otherMember?._id?.toString()
  const isOtherDeleted = !isGroup && otherMember?.status === 'deleted'
  const effectiveOnlineUsers = Array.isArray(onlineUsers) && onlineUsers.length > 0 ? onlineUsers : contextOnlineUsers

  const isOtherOnline = isOtherDeleted ? false : (isGroup
    ? conversation.members.some(m => m._id !== user?._id && effectiveOnlineUsers.some(id => id.toString() === m._id.toString()))
    : (otherMemberId ? effectiveOnlineUsers.some((id) => id.toString() === otherMemberId) : false));

  const getNickname = (id) => {
    if (!conversation.nicknames || !id) return null
    if (conversation.nicknames instanceof Map) return conversation.nicknames.get(id.toString())
    if (typeof conversation.nicknames === 'object') return conversation.nicknames[id.toString()]
    return null
  }

  const displayTitle = isGroup
    ? (conversation.name || conversation.groupName)
    : isOtherDeleted
      ? t('chat2.deletedUser')
      : (getNickname(otherMember?._id) || otherMember?.fullName || t('chat.unknownUser'));

  const lastMessagePreview = (() => {
    const msg = conversation.lastMessage
    if (!msg) return t('chat.noMessage')

    const senderName = (() => {
      if (!msg.senderId) return ''
      if (typeof msg.senderId === 'object') {
        if (msg.senderId._id === user?._id) return t('chat2.you')
        return getNickname(msg.senderId._id) || msg.senderId.fullName || ''
      }
      if (msg.senderId === user?._id) return t('chat2.you')
      return getNickname(msg.senderId) || ''
    })()

    const prefixStr = senderName === t('chat2.you') || isGroup ? senderName + ': ' : ''

    if (msg.isRecalled) {
      return prefixStr + (t('chat.recalled') || 'Tin nhắn đã bị thu hồi')
    }

    if (msg.messageType === 'system') {
      return translateSystemMessage(msg.text, t)
    }

    if (msg.messageType === 'like') {
      return prefixStr + t('chat2.sentEmoji')
    }

    if (msg.messageType === 'call' && msg.callInfo) {
      const ci = msg.callInfo
      const isVideo = ci.callType === 'video'
      if (ci.status === 'missed' || ci.status === 'no_answer') {
        return prefixStr + (isVideo ? t('chat2.missedVideoCall') : t('chat2.missedCall'))
      }
      if (ci.status === 'rejected') {
        return prefixStr + t('chat2.rejectedCall')
      }
      const mins = Math.floor((ci.duration || 0) / 60)
      const secs = (ci.duration || 0) % 60
      const dur = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      return prefixStr + (isVideo ? t('chat2.videoCallLabel') : t('chat2.voiceCallLabel')) + ` - ${dur}`
    }

    if (msg.text) {
      const text = msg.text
      const truncated = text.length > 30 ? text.slice(0, 30) + '…' : text
      return prefixStr + truncated
    }

    if (msg.file?.url) return prefixStr + t('chat2.sentAttachment')
    if (msg.image) return prefixStr + t('chat2.sentPhoto')

    return t('chat.noMessage')
  })()

  const timeAgo = formatRelativeTime(
    conversation.lastMessage?.createdAt || conversation.updatedAt,
    lang
  )

  const hasUnread = unreadCount > 0

  useEffect(() => {
    function handleClickOutside(e) {
      const clickedInMenuButton = menuRef.current?.contains(e.target)
      const clickedInDropdown = dropdownRef.current?.contains(e.target)
      if (!clickedInMenuButton && !clickedInDropdown) {
        setShowMenu(false)
        setShowLabelSubmenu(false)
        setDropdownStyle(null)
        setIsDropdownMeasured(false)
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') {
        setShowMenu(false)
        setShowLabelSubmenu(false)
        setDropdownStyle(null)
        setIsDropdownMeasured(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [showMenu])

  const getDropdownStyle = useCallback((rect, menuHeight = ESTIMATED_CONVERSATION_MENU_HEIGHT) => {
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING
    const spaceAbove = rect.top - VIEWPORT_PADDING
    const shouldOpenUp = spaceBelow < menuHeight && spaceAbove > spaceBelow
    const top = shouldOpenUp
      ? Math.max(VIEWPORT_PADDING, rect.top - menuHeight - 4)
      : Math.max(
          VIEWPORT_PADDING,
          Math.min(rect.bottom + 4, window.innerHeight - menuHeight - VIEWPORT_PADDING)
        )
    const left = Math.max(
      VIEWPORT_PADDING,
      Math.min(rect.right - CONVERSATION_MENU_WIDTH, window.innerWidth - CONVERSATION_MENU_WIDTH - VIEWPORT_PADDING)
    )

    return {
      top,
      left,
      width: CONVERSATION_MENU_WIDTH,
      maxHeight: Math.max(180, shouldOpenUp ? spaceAbove : spaceBelow),
    }
  }, [])

  useLayoutEffect(() => {
    if (!showMenu || !optionsBtnRef.current) return

    const rect = optionsBtnRef.current.getBoundingClientRect()
    const menuHeight = dropdownRef.current?.scrollHeight || ESTIMATED_CONVERSATION_MENU_HEIGHT
    setDropdownStyle(getDropdownStyle(rect, menuHeight))
    setIsDropdownMeasured(true)
  }, [showMenu, showLabelSubmenu, getDropdownStyle])

  const handleMenuAction = (action, payload) => (e) => {
    e.stopPropagation()
    setShowMenu(false)
    setShowLabelSubmenu(false)
    setDropdownStyle(null)
    setIsDropdownMeasured(false)
    if (action === 'Pin' && onPin) onPin(conversation._id)
    if (action === 'Mute' && onMute) onMute(conversation._id)
    if (action === 'Archive' && onArchive) onArchive(conversation._id)
    if (action === 'LeaveGroup' && onLeaveGroup) onLeaveGroup(conversation._id)
    if (action === 'Block' && onBlock) onBlock(conversation._id, otherMemberId)
    if (action === 'Unblock' && onUnblock) onUnblock(conversation._id, otherMemberId)
    if (action === 'MarkRead' && onMarkRead) onMarkRead(conversation._id)
    if (action === 'MarkUnread' && onMarkUnread) onMarkUnread(conversation._id)
    if (action === 'Delete' && onDeleteChat) onDeleteChat(conversation._id)
    if (action === 'Label' && onUpdateLabel) onUpdateLabel(conversation._id, payload)
  }

  const isBlockedByMe = user?.blockedUsers?.some(id => id?.toString() === otherMemberId)
  
  const currentLabel = conversation.labels ? (conversation.labels instanceof Map ? conversation.labels.get(user?._id?.toString()) : conversation.labels[user?._id?.toString()]) : null;

  const getLabelColor = (label) => {
    switch(label) {
      case 'Khách hàng': return '#ef4444';
      case 'Gia đình': return '#22c55e';
      case 'Công việc': return '#f97316';
      case 'Bạn bè': return '#a855f7';
      case 'Khác': return '#eab308';
      default: return 'transparent';
    }
  };

  const getTranslatedLabel = (label) => {
    switch(label) {
      case 'Khách hàng': return t('chat2.labelCustomer') || 'Khách hàng';
      case 'Gia đình': return t('chat2.labelFamily') || 'Gia đình';
      case 'Công việc': return t('chat2.labelWork') || 'Công việc';
      case 'Bạn bè': return t('chat2.labelFriends') || 'Bạn bè';
      case 'Khác': return t('chat2.labelOther') || 'Khác';
      default: return label;
    }
  };

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
          src={isOtherDeleted ? '' : (isGroup ? (conversation.avatar || conversation.groupAvatar) : otherMember?.avatar)}
          alt={displayTitle}
          size="sm"
          isOnline={!isGroup && !isOtherDeleted && isOtherOnline}
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
      style={{ zIndex: showMenu ? 50 : undefined }}
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
          <span className={`conversation-item__name ${hasUnread ? 'conversation-item__name--unread' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {conversation.isPinned && <Pin size={16} style={{ color: '#e6a817', flexShrink: 0 }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTitle}</span>
            {currentLabel && <Tag size={14} color={getLabelColor(currentLabel)} style={{ flexShrink: 0, marginTop: '2px' }} title={getTranslatedLabel(currentLabel)} />}
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
      {/* Hover option button */}
      <div 
        className="conversation-item__options" 
        ref={menuRef}
        style={showMenu ? { opacity: 1, visibility: 'visible' } : {}}
      >
        <button
          ref={optionsBtnRef}
          className="conversation-item__options-btn"
          onClick={(e) => {
            e.stopPropagation()
            setShowLabelSubmenu(false)
            if (showMenu) {
              setShowMenu(false)
              setDropdownStyle(null)
              setIsDropdownMeasured(false)
              return
            }
            const rect = optionsBtnRef.current?.getBoundingClientRect()
            if (rect) {
              setDropdownStyle(getDropdownStyle(rect))
            } else {
              setDropdownStyle(null)
            }
            setIsDropdownMeasured(false)
            setShowMenu(true)
          }}
          title={t('chat2.options')}
        >
          <MoreHorizontal size={16} />
        </button>
        {showMenu && dropdownStyle && createPortal(
          <div
            ref={dropdownRef}
            className="conversation-item__dropdown"
            style={{
              ...dropdownStyle,
              visibility: isDropdownMeasured ? 'visible' : 'hidden',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('Pin')}>
              {conversation.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              <span>{conversation.isPinned ? t('chat.unpinConversation') : t('chat.pinConversation')}</span>
            </button>
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('Mute')}>
              {conversation.isMuted ? <Bell size={14} /> : <BellOff size={14} />}
              <span>{conversation.isMuted ? t('chat.unmuteConversation') : t('chat.muteConversation')}</span>
            </button>
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction(hasUnread ? 'MarkRead' : 'MarkUnread')}>
              <MailOpen size={14} />
              <span>{hasUnread ? t('chat2.markRead') : t('chat2.markUnread')}</span>
            </button>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div 
                role="button"
                className="conversation-item__dropdown-item" 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '8px', width: '100%', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setShowLabelSubmenu((prev) => !prev) }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Tag size={14} />
                  <span>{t('chat2.labelTitle')}</span>
                </div>
                {showLabelSubmenu ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
              {showLabelSubmenu && (
                <div style={{ background: 'var(--color-surface-hover)', borderRadius: '4px', margin: '4px 8px', overflow: 'hidden' }}>
                   <button className="conversation-item__dropdown-item" style={{ paddingLeft: '32px', fontSize: '13px' }} onClick={handleMenuAction('Label', 'Khách hàng')}><Tag size={12} color="#ef4444" style={{marginRight: '8px'}}/> {t('chat2.labelCustomer')}</button>
                   <button className="conversation-item__dropdown-item" style={{ paddingLeft: '32px', fontSize: '13px' }} onClick={handleMenuAction('Label', 'Gia đình')}><Tag size={12} color="#22c55e" style={{marginRight: '8px'}}/> {t('chat2.labelFamily')}</button>
                   <button className="conversation-item__dropdown-item" style={{ paddingLeft: '32px', fontSize: '13px' }} onClick={handleMenuAction('Label', 'Công việc')}><Tag size={12} color="#f97316" style={{marginRight: '8px'}}/> {t('chat2.labelWork')}</button>
                   <button className="conversation-item__dropdown-item" style={{ paddingLeft: '32px', fontSize: '13px' }} onClick={handleMenuAction('Label', 'Bạn bè')}><Tag size={12} color="#a855f7" style={{marginRight: '8px'}}/> {t('chat2.labelFriends')}</button>
                   <button className="conversation-item__dropdown-item" style={{ paddingLeft: '32px', fontSize: '13px' }} onClick={handleMenuAction('Label', 'Khác')}><Tag size={12} color="#eab308" style={{marginRight: '8px'}}/> {t('chat2.labelOther')}</button>
                   {currentLabel && (
                     <>
                        <div className="conversation-item__dropdown-divider" style={{ margin: '4px 0', height: '1px', backgroundColor: 'var(--color-border-subtle)' }} />
                        <button className="conversation-item__dropdown-item" onClick={handleMenuAction('Label', null)} style={{ color: '#ef4444', paddingLeft: '32px', fontSize: '13px' }}>{t('chat2.removeLabel')}</button>
                     </>
                   )}
                </div>
              )}
            </div>

            <div className="conversation-item__dropdown-divider" />
            {!isGroup && (
              <>
                <button className="conversation-item__dropdown-item" onClick={handleMenuAction('VoiceCall')}>
                  <Phone size={14} />
                  <span>{t('chat2.voiceCallMenu')}</span>
                </button>
                <button className="conversation-item__dropdown-item" onClick={handleMenuAction('VideoCall')}>
                  <Video size={14} />
                  <span>{t('chat2.videoCallMenu')}</span>
                </button>
              </>
            )}
            <button className="conversation-item__dropdown-item" onClick={handleMenuAction('Archive')}>
              <Archive size={14} />
              <span>{isArchivedByMe ? t('chat2.unarchive') : t('chat2.archive')}</span>
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
              <span>{t('chat2.deleteChat')}</span>
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}

export default ConversationItem
