import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, MessageSquare } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/chat/Sidebar'

function ChatPage() {
  const { t } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()

  // State: conversation đang được chọn
  const [selectedConversation, setSelectedConversation] = useState(null)

  // Tìm member khác trong conversation đang chọn
  const otherMember = selectedConversation?.members?.find(
    (m) => m._id !== user?._id
  )

  return (
    <div className="chat-layout">
      {/* Sidebar — Danh sách conversations */}
      <Sidebar
        selectedConversation={selectedConversation}
        onSelectConversation={setSelectedConversation}
      />

      {/* Khu vực chat chính */}
      <main className="chat-main">
        {/* Header */}
        <header className="chat-header">
          <h2>{selectedConversation ? (otherMember?.fullName || t('chat.title')) : t('chat.title')}</h2>
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
          <>
            {/* Vùng tin nhắn */}
            <div className="chat-messages">
              <p className="placeholder-text">{t('chat.messagesPlaceholder')}</p>
            </div>

            {/* Input gửi tin */}
            <div className="chat-input-area">
              <input
                type="text"
                placeholder={t('chat.inputPlaceholder')}
                className="chat-input"
              />
              <button type="button" className="btn-send">
                {t('chat.send')}
              </button>
            </div>
          </>
        ) : (
          /* Empty state — chưa chọn conversation nào */
          <div className="chat-empty-state">
            <MessageSquare size={56} className="chat-empty-state__icon" />
            <h3 className="chat-empty-state__title">{t('chat.selectConversation')}</h3>
          </div>
        )}
      </main>
    </div>
  )
}

export default ChatPage
