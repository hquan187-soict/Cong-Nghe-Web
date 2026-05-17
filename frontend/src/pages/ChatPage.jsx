import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  User, MessageSquare, Phone, Video, Info, X,
  BellOff, Search, ChevronDown, Lock, Sparkles,
  Palette, AtSign, SmilePlus, Image, FileText,
  ShieldBan, Flag, ChevronRight
} from 'lucide-react'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { formatLastActive } from '../utils/timeUtils'
import { userService } from '../services/user.service'

import Sidebar from '../components/chat/Sidebar'
import ChatWindow from '../components/ChatWindow'
import Avatar from '../components/ui/Avatar'
import ProfileModal from '../components/ProfileModal'

function ChatPage() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const { socket, isConnected, onlineUsers } = useSocket()
  const { conversationId: urlConversationId } = useParams()
  const navigate = useNavigate()
  const [selectedConversation, setSelectedConversation] = useState(() => {
    try {
      const saved = localStorage.getItem('last_conversation')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  const SIDEBAR_MIN = 72
  const SIDEBAR_COLLAPSE_THRESHOLD = 180
  const SIDEBAR_DEFAULT = 320
  const SIDEBAR_MAX_RATIO = 0.5

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar_width')
    return saved ? Number(saved) : SIDEBAR_DEFAULT
  })
  const sidebarCollapsed = sidebarWidth <= SIDEBAR_MIN

  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    isDraggingRef.current = true
    setIsDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return
      const maxWidth = window.innerWidth * SIDEBAR_MAX_RATIO
      let newWidth = moveEvent.clientX
      if (newWidth < SIDEBAR_COLLAPSE_THRESHOLD) {
        newWidth = SIDEBAR_MIN
      } else if (newWidth < SIDEBAR_DEFAULT) {
        newWidth = Math.max(newWidth, 240)
      }
      newWidth = Math.min(newWidth, maxWidth)
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setSidebarWidth((w) => {
        localStorage.setItem('sidebar_width', String(w))
        return w
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handleSidebarDoubleClick = useCallback(() => {
    const newWidth = sidebarCollapsed ? SIDEBAR_DEFAULT : SIDEBAR_MIN
    setSidebarWidth(newWidth)
    localStorage.setItem('sidebar_width', String(newWidth))
  }, [sidebarCollapsed])

  const handleToggleCollapse = useCallback(() => {
    const newWidth = sidebarCollapsed ? SIDEBAR_DEFAULT : SIDEBAR_MIN
    setSidebarWidth(newWidth)
    localStorage.setItem('sidebar_width', String(newWidth))
  }, [sidebarCollapsed])

  useEffect(() => {
    if (urlConversationId && (!selectedConversation || selectedConversation._id !== urlConversationId)) {
      const saved = localStorage.getItem('last_conversation')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed._id === urlConversationId) {
            setSelectedConversation(parsed)
            return
          }
        } catch { /* ignore */ }
      }
    }
    if (!urlConversationId && selectedConversation?._id) {
      navigate(`/chat/${selectedConversation._id}`, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedConvIdRef = useRef(selectedConversation?._id)
  useEffect(() => {
    selectedConvIdRef.current = selectedConversation?._id
  }, [selectedConversation])

  const handleSelectConversation = useCallback((conv) => {
    setSelectedConversation(conv)
    localStorage.setItem('last_conversation', JSON.stringify(conv))
    if (conv?._id) {
      navigate(`/chat/${conv._id}`, { replace: true })
    }
  }, [navigate])

  const sidebarRef = useRef(null)

  const currentUserId = user?._id?.toString()
  const otherMember = selectedConversation?.members?.find(
    (m) => m._id?.toString() !== currentUserId
  )

  const otherMemberId = otherMember?._id?.toString()
  const myActiveStatus = user?.showActiveStatus !== false
  const isOtherOnline = myActiveStatus && otherMemberId ? onlineUsers.some((id) => id.toString() === otherMemberId) : false
  const [lastSeen, setLastSeen] = useState(null)

  useEffect(() => {
    if (!otherMemberId) return
    if (isOtherOnline) {
      setLastSeen(null)
      return
    }
    let cancelled = false
    userService.getUserById(otherMemberId)
      .then((userData) => {
        if (!cancelled && userData?.lastSeen) {
          setLastSeen(userData.lastSeen)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [otherMemberId, isOtherOnline])

  useEffect(() => {
    if (!socket?.connected) return
    const handleUserLastSeen = ({ userId, lastSeen: ls }) => {
      if (userId?.toString() === otherMemberId) {
        setLastSeen(ls)
      }
    }
    socket.on('userLastSeen', handleUserLastSeen)
    return () => socket.off('userLastSeen', handleUserLastSeen)
  }, [socket, otherMemberId])

  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (isOtherOnline || !lastSeen) return
    const interval = setInterval(() => forceUpdate((n) => n + 1), 60000)
    return () => clearInterval(interval)
  }, [isOtherOnline, lastSeen])

  useEffect(() => {
    if (!socket?.connected) return

    const handleGlobalMessage = ({ conversationId, message }) => {
      if (sidebarRef.current?.updateLastMessage) {
        sidebarRef.current.updateLastMessage(conversationId, message)
      }
      if (conversationId !== selectedConvIdRef.current) {
        if (sidebarRef.current?.incrementUnread) {
          sidebarRef.current.incrementUnread(conversationId)
        }
      }
    }

    socket.on('sendMessage', handleGlobalMessage)
    return () => {
      socket.off('sendMessage', handleGlobalMessage)
    }
  }, [socket, isConnected])

  const handleMessageSent = useCallback(({ conversationId, lastMessage }) => {
    if (sidebarRef.current?.updateLastMessage) {
      sidebarRef.current.updateLastMessage(conversationId, lastMessage)
    }
  }, [])

  const handleVoiceCall = () => {
    // TODO: integrate voice call
  }

  const handleVideoCall = () => {
    // TODO: integrate video call
  }

  const handleToggleInfoPanel = () => {
    setShowInfoPanel((v) => !v)
  }

  // Info panel section toggles
  const [infoChatOpen, setInfoChatOpen] = useState(false)
  const [infoCustomizeOpen, setInfoCustomizeOpen] = useState(false)
  const [infoMediaOpen, setInfoMediaOpen] = useState(false)
  const [infoPrivacyOpen, setInfoPrivacyOpen] = useState(false)

  return (
    <div className="chat-layout">
      <div className={`sidebar-wrapper ${isDragging ? 'sidebar-wrapper--dragging' : ''}`} style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
        <Sidebar
          ref={sidebarRef}
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onOpenProfile={() => setShowProfileModal(true)}
          onlineUsers={myActiveStatus ? onlineUsers : []}
        />
        <div
          className="sidebar-resize-handle"
          onMouseDown={handleResizeStart}
          onDoubleClick={handleSidebarDoubleClick}
        />
      </div>

      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-header__left">
            {selectedConversation && otherMember ? (
              <div className="chat-header__avatar">
                <Avatar
                  src={otherMember.avatar}
                  alt={otherMember.fullName || '?'}
                  size="sm"
                  isOnline={isOtherOnline}
                />
              </div>
            ) : null}
            <div className="chat-header__user-info">
              <h2>
                {selectedConversation
                  ? otherMember?.fullName || t('chat.title')
                  : t('chat.title')}
              </h2>
              {selectedConversation && otherMember && (
                <span className="chat-header__status">
                  {isOtherOnline
                    ? t('chat.activeNow')
                    : lastSeen
                      ? formatLastActive(lastSeen, lang)
                      : ''}
                </span>
              )}
            </div>
          </div>
          {selectedConversation && (
            <div className="chat-header__right">
              <button
                type="button"
                className="chat-header__icon-btn tooltip-wrapper"
                onClick={handleVoiceCall}
                title={t('chat.comingSoon')}
              >
                <Phone size={20} />
                <span className="tooltip">{t('chat.voiceCall')}</span>
              </button>
              <button
                type="button"
                className="chat-header__icon-btn tooltip-wrapper"
                onClick={handleVideoCall}
                title={t('chat.comingSoon')}
              >
                <Video size={20} />
                <span className="tooltip">{t('chat.videoCall')}</span>
              </button>
              <button
                type="button"
                className={`chat-header__icon-btn tooltip-wrapper ${showInfoPanel ? 'chat-header__icon-btn--active' : ''}`}
                onClick={handleToggleInfoPanel}
              >
                <Info size={20} />
                <span className="tooltip">{t('chat.moreInfo')}</span>
              </button>
            </div>
          )}
        </header>

        <div className="chat-main__body">
          {selectedConversation ? (
            <ChatWindow
              conversationId={selectedConversation._id}
              otherMember={otherMember}
              onMessageSent={handleMessageSent}
            />
          ) : (
            <div className="chat-empty-state">
              <div className="chat-empty-state__icon-wrapper">
                <Sparkles size={24} className="chat-empty-state__sparkle" />
                <MessageSquare size={56} className="chat-empty-state__icon" />
              </div>
              <h3 className="chat-empty-state__title">
                {t('chat.emptyStateGreeting')}
              </h3>
              <p className="chat-empty-state__subtitle">
                {t('chat.emptyStateSubtitle')}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Info Panel — separate full-height column */}
      {showInfoPanel && selectedConversation && (
        <aside className="info-panel">
          <div className="info-panel__header">
            <button className="info-panel__close" onClick={() => setShowInfoPanel(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="info-panel__profile">
            <div className="info-panel__avatar">
              <Avatar
                src={otherMember?.avatar}
                alt={otherMember?.fullName || '?'}
                size="lg"
                isOnline={isOtherOnline}
              />
            </div>
            <h3 className="info-panel__name">{otherMember?.fullName || t('chat.unknownUser')}</h3>
            <div className="info-panel__encryption">
              <Lock size={12} />
              <span>{t('chat.endToEndEncrypted')}</span>
            </div>
          </div>

          <div className="info-panel__quick-actions">
            <button
              className="info-panel__quick-btn"
              onClick={() => setShowProfileModal(true)}
            >
              <div className="info-panel__quick-icon"><User size={20} /></div>
              <span>{t('chat.viewProfile')}</span>
            </button>
            <button
              className="info-panel__quick-btn"
              title={t('chat.comingSoon')}
            >
              <div className="info-panel__quick-icon"><BellOff size={20} /></div>
              <span>{t('chat.muteNotifications')}</span>
            </button>
            <button
              className="info-panel__quick-btn"
              title={t('chat.comingSoon')}
            >
              <div className="info-panel__quick-icon"><Search size={20} /></div>
              <span>{t('chat.search')}</span>
            </button>
          </div>

          <div className="info-panel__sections">
            <button
              className="info-panel__section-toggle"
              onClick={() => setInfoChatOpen((v) => !v)}
            >
              <span>{t('chat.chatInfo')}</span>
              <ChevronDown size={16} className={infoChatOpen ? 'info-panel__chevron--open' : ''} />
            </button>
            {infoChatOpen && (
              <div className="info-panel__section-content">
                <div className="info-panel__detail-row">
                  <span className="info-panel__detail-label">{t('profile.email')}</span>
                  <span className="info-panel__detail-value">{otherMember?.email || '—'}</span>
                </div>
              </div>
            )}

            <button
              className="info-panel__section-toggle"
              onClick={() => setInfoCustomizeOpen((v) => !v)}
            >
              <span>{t('chat.customizeChat')}</span>
              <ChevronDown size={16} className={infoCustomizeOpen ? 'info-panel__chevron--open' : ''} />
            </button>
            {infoCustomizeOpen && (
              <div className="info-panel__section-content">
                <button className="info-panel__action-row">
                  <Palette size={16} />
                  <span>{t('chat.themeColor')}</span>
                  <ChevronRight size={14} className="info-panel__action-arrow" />
                </button>
                <button className="info-panel__action-row">
                  <AtSign size={16} />
                  <span>{t('chat.changeNickname')}</span>
                  <ChevronRight size={14} className="info-panel__action-arrow" />
                </button>
                <button className="info-panel__action-row">
                  <SmilePlus size={16} />
                  <span>{t('chat.changeEmoji')}</span>
                  <ChevronRight size={14} className="info-panel__action-arrow" />
                </button>
              </div>
            )}

            <button
              className="info-panel__section-toggle"
              onClick={() => setInfoMediaOpen((v) => !v)}
            >
              <span>{t('chat.mediaAndFiles')}</span>
              <ChevronDown size={16} className={infoMediaOpen ? 'info-panel__chevron--open' : ''} />
            </button>
            {infoMediaOpen && (
              <div className="info-panel__section-content">
                <div className="info-panel__media-tabs">
                  <span className="info-panel__media-tab info-panel__media-tab--active">
                    <Image size={14} /> {t('chat.sharedPhotos')}
                  </span>
                  <span className="info-panel__media-tab">
                    <FileText size={14} /> {t('chat.sharedFiles')}
                  </span>
                </div>
                <div className="info-panel__media-empty">
                  <Image size={32} />
                  <p>{t('chat.noMedia')}</p>
                </div>
              </div>
            )}

            <button
              className="info-panel__section-toggle"
              onClick={() => setInfoPrivacyOpen((v) => !v)}
            >
              <span>{t('chat.privacyAndSupport')}</span>
              <ChevronDown size={16} className={infoPrivacyOpen ? 'info-panel__chevron--open' : ''} />
            </button>
            {infoPrivacyOpen && (
              <div className="info-panel__section-content">
                <button className="info-panel__action-row info-panel__action-row--danger">
                  <ShieldBan size={16} />
                  <span>{t('chat.blockUser')}</span>
                </button>
                <button className="info-panel__action-row info-panel__action-row--danger">
                  <Flag size={16} />
                  <span>{t('chat.reportConversation')}</span>
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </div>
  )
}

export default ChatPage
