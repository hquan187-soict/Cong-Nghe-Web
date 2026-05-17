import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, MessageSquare, Phone, Video, Info, X,
  BellOff, Search, ChevronDown, Lock
} from 'lucide-react'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

import Sidebar from '../components/chat/Sidebar'
import ChatWindow from '../components/ChatWindow'
import Avatar from '../components/ui/Avatar'

function ChatPage() {
  const { t } = useLang()
  const { user } = useAuth()
  const { socket, isConnected, onlineUsers } = useSocket()
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

  const selectedConvIdRef = useRef(selectedConversation?._id)
  useEffect(() => {
    selectedConvIdRef.current = selectedConversation?._id
  }, [selectedConversation])

  const handleSelectConversation = useCallback((conv) => {
    setSelectedConversation(conv)
    localStorage.setItem('last_conversation', JSON.stringify(conv))
  }, [])

  const sidebarRef = useRef(null)

  const otherMember = selectedConversation?.members?.find(
    (m) => m._id !== user?._id
  )

  const otherMemberIsOnline = otherMember ? onlineUsers.includes(otherMember._id) : false

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
    console.log('[ChatPage] Voice call clicked, conversationId:', selectedConversation?._id)
  }

  const handleVideoCall = () => {
    console.log('[ChatPage] Video call clicked, conversationId:', selectedConversation?._id)
  }

  const handleToggleInfoPanel = () => {
    setShowInfoPanel((v) => !v)
    console.log('[ChatPage] Info panel toggled')
  }

  // Info panel section toggles
  const [infoChatOpen, setInfoChatOpen] = useState(false)
  const [infoCustomizeOpen, setInfoCustomizeOpen] = useState(false)
  const [infoMediaOpen, setInfoMediaOpen] = useState(false)
  const [infoPrivacyOpen, setInfoPrivacyOpen] = useState(false)

  return (
    <div className="chat-layout">
      <Sidebar
        ref={sidebarRef}
        selectedConversation={selectedConversation}
        onSelectConversation={handleSelectConversation}
      />

      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-header__left">
            {selectedConversation && otherMember ? (
              <div className="chat-header__avatar">
                <Avatar
                  src={otherMember.avatar}
                  alt={otherMember.fullName || '?'}
                  size="sm"
                  isOnline={otherMemberIsOnline}
                />
              </div>
            ) : null}
            <h2>
              {selectedConversation
                ? otherMember?.fullName || t('chat.title')
                : t('chat.title')}
            </h2>
          </div>
          {selectedConversation && (
            <div className="chat-header__right">
              <button
                type="button"
                className="chat-header__icon-btn tooltip-wrapper"
                onClick={handleVoiceCall}
              >
                <Phone size={20} />
                <span className="tooltip">Gọi thoại</span>
              </button>
              <button
                type="button"
                className="chat-header__icon-btn tooltip-wrapper"
                onClick={handleVideoCall}
              >
                <Video size={20} />
                <span className="tooltip">Gọi video</span>
              </button>
              <button
                type="button"
                className={`chat-header__icon-btn tooltip-wrapper ${showInfoPanel ? 'chat-header__icon-btn--active' : ''}`}
                onClick={handleToggleInfoPanel}
              >
                <Info size={20} />
                <span className="tooltip">Xem thêm</span>
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
              <MessageSquare size={56} className="chat-empty-state__icon" />
              <h3 className="chat-empty-state__title">
                {t('chat.selectConversation')}
              </h3>
            </div>
          )}

          {/* Info Panel (right sidebar) */}
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
                    isOnline={otherMemberIsOnline}
                  />
                </div>
                <h3 className="info-panel__name">{otherMember?.fullName || 'Unknown'}</h3>
                <div className="info-panel__encryption">
                  <Lock size={12} />
                  <span>Được mã hóa đầu cuối</span>
                </div>
              </div>

              <div className="info-panel__quick-actions">
                <button
                  className="info-panel__quick-btn"
                  onClick={() => {
                    console.log('[InfoPanel] View profile clicked')
                    navigate('/profile')
                  }}
                >
                  <div className="info-panel__quick-icon"><User size={20} /></div>
                  <span>Trang cá n...</span>
                </button>
                <button
                  className="info-panel__quick-btn"
                  onClick={() => console.log('[InfoPanel] Mute notifications clicked')}
                >
                  <div className="info-panel__quick-icon"><BellOff size={20} /></div>
                  <span>Tắt thông báo</span>
                </button>
                <button
                  className="info-panel__quick-btn"
                  onClick={() => console.log('[InfoPanel] Search in chat clicked')}
                >
                  <div className="info-panel__quick-icon"><Search size={20} /></div>
                  <span>Tìm kiếm</span>
                </button>
              </div>

              <div className="info-panel__sections">
                <button
                  className="info-panel__section-toggle"
                  onClick={() => {
                    setInfoChatOpen((v) => !v)
                    console.log('[InfoPanel] Chat info section toggled')
                  }}
                >
                  <span>Thông tin về đoạn chat</span>
                  <ChevronDown size={16} className={infoChatOpen ? 'info-panel__chevron--open' : ''} />
                </button>
                {infoChatOpen && (
                  <div className="info-panel__section-content">
                    <p>Thông tin chi tiết về đoạn chat sẽ hiển thị ở đây.</p>
                  </div>
                )}

                <button
                  className="info-panel__section-toggle"
                  onClick={() => {
                    setInfoCustomizeOpen((v) => !v)
                    console.log('[InfoPanel] Customize section toggled')
                  }}
                >
                  <span>Tùy chỉnh đoạn chat</span>
                  <ChevronDown size={16} className={infoCustomizeOpen ? 'info-panel__chevron--open' : ''} />
                </button>
                {infoCustomizeOpen && (
                  <div className="info-panel__section-content">
                    <p>Các tùy chỉnh đoạn chat sẽ hiển thị ở đây.</p>
                  </div>
                )}

                <button
                  className="info-panel__section-toggle"
                  onClick={() => {
                    setInfoMediaOpen((v) => !v)
                    console.log('[InfoPanel] Media section toggled')
                  }}
                >
                  <span>File phương tiện và file</span>
                  <ChevronDown size={16} className={infoMediaOpen ? 'info-panel__chevron--open' : ''} />
                </button>
                {infoMediaOpen && (
                  <div className="info-panel__section-content">
                    <p>Ảnh, video và file đã chia sẻ sẽ hiển thị ở đây.</p>
                  </div>
                )}

                <button
                  className="info-panel__section-toggle"
                  onClick={() => {
                    setInfoPrivacyOpen((v) => !v)
                    console.log('[InfoPanel] Privacy section toggled')
                  }}
                >
                  <span>Quyền riêng tư và hỗ trợ</span>
                  <ChevronDown size={16} className={infoPrivacyOpen ? 'info-panel__chevron--open' : ''} />
                </button>
                {infoPrivacyOpen && (
                  <div className="info-panel__section-content">
                    <p>Cài đặt quyền riêng tư và hỗ trợ sẽ hiển thị ở đây.</p>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  )
}

export default ChatPage
