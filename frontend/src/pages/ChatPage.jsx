import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, MessageSquare } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'

import Sidebar from '../components/chat/Sidebar'
import ChatWindow from '../components/ChatWindow'

function ChatPage() {
  const { t } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [selectedConversation, setSelectedConversation] = useState(() => {
    try {
      const saved = localStorage.getItem('last_conversation')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const handleSelectConversation = useCallback((conv) => {
    setSelectedConversation(conv)
    localStorage.setItem('last_conversation', JSON.stringify(conv))
  }, [])

  // Ref để gọi hàm updateLastMessage trên Sidebar từ ChatWindow
  const sidebarRef = useRef(null)

  const otherMember = selectedConversation?.members?.find(
    (m) => m._id !== user?._id
  )

  // Callback khi ChatWindow gửi tin thành công → cập nhật Sidebar lastMessage
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
