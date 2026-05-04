import { useState, useEffect, useCallback } from 'react'
import { Plus, MessageCircle } from 'lucide-react'
import { conversationService } from '../../services/conversation.service'
import { useLang } from '../../context/LangContext'
import { useToast } from '../../context/ToastContext'
import ConversationItem from './ConversationItem'
import SearchUserModal from './SearchUserModal'
import '../../styles/sidebar.css'

/**
 * Sidebar — Danh sách conversations bên trái ChatPage
 * Props:
 *   - selectedConversation: conversation đang chọn (hoặc null)
 *   - onSelectConversation: callback(conversation) khi click chọn
 */
function Sidebar({ selectedConversation, onSelectConversation }) {
  const { t } = useLang()
  const toast = useToast()

  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSearchModal, setShowSearchModal] = useState(false)

  // Fetch conversations khi mount
  useEffect(() => {
    let cancelled = false

    async function fetchConversations() {
      setIsLoading(true)
      try {
        const data = await conversationService.getConversations()
        if (!cancelled) {
          setConversations(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Fetch conversations error:', err)
        if (!cancelled) {
          toast.error(t('chat.loadError'))
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchConversations()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Callback khi tạo conversation mới từ SearchUserModal
  const handleConversationCreated = useCallback((newConversation) => {
    setConversations((prev) => {
      // Kiểm tra đã tồn tại chưa (API trả conversation cũ nếu đã có)
      const exists = prev.some((c) => c._id === newConversation._id)
      if (exists) {
        // Di chuyển lên đầu
        return [
          newConversation,
          ...prev.filter((c) => c._id !== newConversation._id),
        ]
      }
      // Thêm mới lên đầu
      return [newConversation, ...prev]
    })
    // Tự động chọn conversation vừa tạo
    onSelectConversation(newConversation)
  }, [onSelectConversation])

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar__header">
        <h2 className="sidebar__title">
          <MessageCircle size={18} />
          {t('chat.conversations')}
        </h2>
        <button
          className="sidebar__add-btn"
          onClick={() => setShowSearchModal(true)}
          title={t('chat.newConversation')}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Danh sách conversations */}
      <div className="sidebar__list">
        {/* Loading state */}
        {isLoading && (
          <div className="sidebar__loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sidebar__skeleton">
                <div className="sidebar__skeleton-avatar"></div>
                <div className="sidebar__skeleton-content">
                  <div className="sidebar__skeleton-line sidebar__skeleton-line--short"></div>
                  <div className="sidebar__skeleton-line sidebar__skeleton-line--long"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && conversations.length === 0 && (
          <div className="sidebar__empty">
            <MessageCircle size={40} className="sidebar__empty-icon" />
            <p className="sidebar__empty-title">{t('chat.noConversations')}</p>
            <p className="sidebar__empty-subtitle">{t('chat.startConversation')}</p>
          </div>
        )}

        {/* Conversation items */}
        {!isLoading && conversations.map((conv) => (
          <ConversationItem
            key={conv._id}
            conversation={conv}
            isActive={selectedConversation?._id === conv._id}
            onClick={() => onSelectConversation(conv)}
          />
        ))}
      </div>

      {/* Search User Modal */}
      <SearchUserModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onConversationCreated={handleConversationCreated}
      />
    </aside>
  )
}

export default Sidebar
