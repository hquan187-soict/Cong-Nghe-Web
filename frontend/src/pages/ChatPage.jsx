import { useNavigate } from 'react-router-dom'
import { User } from 'lucide-react'
import { useLang } from '../context/LangContext'

function ChatPage() {
  const { t } = useLang()
  const navigate = useNavigate()

  function handleSend() {
    alert(`${t('chat.send')}`)
  }

  return (
    <div className="chat-layout">
      {/* Sidebar danh sach cuoc tro chuyen */}
      <aside className="chat-sidebar">
        <h2>{t('chat.conversations')}</h2>
        <p className="placeholder-text">{t('chat.conversationsPlaceholder')}</p>
      </aside>

      {/* Khu vuc chat chinh */}
      <main className="chat-main">
        <header className="chat-header">
          <h2>{t('chat.title')}</h2>
          <button
            type="button"
            className="btn-profile"
            title={t('profile.title')}
            onClick={() => navigate('/profile')}
          >
            <User size={20} />
          </button>
        </header>

        {/* Tin nhan */}
        <div className="chat-messages">
          <p className="placeholder-text">{t('chat.messagesPlaceholder')}</p>
        </div>

        {/* Input gui tin */}
        <div className="chat-input-area">
          <input
            type="text"
            placeholder={t('chat.inputPlaceholder')}
            className="chat-input"
          />
          <button type="button" className="btn-send" onClick={handleSend}>
            {t('chat.send')}
          </button>
        </div>
      </main>
    </div>
  )
}

export default ChatPage
