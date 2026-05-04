import { useState } from 'react'
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

  const [selectedConversation, setSelectedConversation] = useState(null)

  const otherMember = selectedConversation?.members?.find(
    (m) => m._id !== user?._id
  )

  return (
    <div className="chat-layout">
      {/*  Sidebar thật (nhánh W4) */}
      <Sidebar
        selectedConversation={selectedConversation}
        onSelectConversation={setSelectedConversation}
      />

      <main className="chat-main">
        {/*  Header có nút Profile (nhánh W4) */}
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
          <ChatWindow conversationId={selectedConversation._id} />
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
