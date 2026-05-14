import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, MessageSquare } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

import Sidebar from '../components/chat/Sidebar'
import ChatWindow from '../components/ChatWindow'

function ChatPage() {
  const { t } = useLang()
  const { user } = useAuth()
  const { socket, isConnected } = useSocket()
  const navigate = useNavigate()

  const [selectedConversation, setSelectedConversation] = useState(() => {
    try {
      const saved = localStorage.getItem('last_conversation')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  // Ref giữ selectedConversation hiện tại cho socket handler (tránh stale closure)
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

  // Global socket listener — cập nhật sidebar cho TẤT CẢ conversation
  useEffect(() => {
    if (!socket?.connected) return

    const handleGlobalMessage = ({ conversationId, message }) => {
      // Luôn cập nhật lastMessage trên sidebar
      if (sidebarRef.current?.updateLastMessage) {
        sidebarRef.current.updateLastMessage(conversationId, message)
      }
      // Nếu tin nhắn đến conversation khác với đang mở → tăng unread badge
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

  // Callback khi ChatWindow gửi tin thành công (optimistic) → cập nhật sidebar cho sender
  const handleMessageSent = useCallback(({ conversationId, lastMessage }) => {
    if (sidebarRef.current?.updateLastMessage) {
      sidebarRef.current.updateLastMessage(conversationId, lastMessage)
    }
  }, [])

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <Sidebar
        ref={sidebarRef}
        selectedConversation={selectedConversation}
        onSelectConversation={handleSelectConversation}
      />

      <main className="chat-main">
        {/* Header */}
        <header className="chat-header">
          <h2>
            {selectedConversation
              ? otherMember?.fullName || t('chat.title')
              : t('chat.title')}
          </h2>
          <button
            type="button"
            className="btn-profile"
            title={t('profile.title')}
            onClick={() => navigate('/profile')}
          >
            <User size={20} />
          </button>
        </header>

        {selectedConversation ? (
          <ChatWindow
            conversationId={selectedConversation._id}
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
      </main>
    </div>
  )
}

export default ChatPage
