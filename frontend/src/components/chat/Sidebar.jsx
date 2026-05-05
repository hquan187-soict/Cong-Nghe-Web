import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
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
 *
 * Ref methods:
 *   - updateLastMessage(conversationId, lastMessage): cập nhật lastMessage và đẩy lên đầu
 */
const Sidebar = forwardRef(function Sidebar({ selectedConversation, onSelectConversation }, ref) {
  const { t } = useLang()
  const toast = useToast()

  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSearchModal, setShowSearchModal] = useState(false)

  // Expose updateLastMessage cho parent (ChatPage) gọi qua ref
  useImperativeHandle(ref, () => ({
    updateLastMessage(conversationId, lastMessage) {
      setConversations((prev) => {
        const updated = prev.map((conv) =>
          conv._id === conversationId
            ? {
                ...conv,
                lastMessage,
                updatedAt: lastMessage.createdAt || new Date().toISOString(),
              }
            : conv
        )
        // Sắp xếp: conversation vừa có tin mới → lên đầu
        updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        return updated
      })
    },
  }), [])

  // Fetch conversations khi mount
  useEffect(() => {
    let cancelled = false

    // DEV ONLY: mock conversations để preview UI khi chưa có BE
    const MOCK_NOW = new Date()
    const ago = (minutes) => new Date(MOCK_NOW - minutes * 60 * 1000).toISOString()

    const MOCK_CONVERSATIONS = [
      {
        _id: 'mock_conv_001',
        members: [
          { _id: 'mock_user_001', fullName: 'Bạn', avatar: null },
          { _id: 'mock_user_alice', fullName: 'Alice Nguyễn', avatar: null },
        ],
        lastMessage: { text: 'Oke bạn nhé! Hẹn gặp lại 😊', createdAt: ago(2) },
        updatedAt: ago(2),
      },
      {
        _id: 'mock_conv_002',
        members: [
          { _id: 'mock_user_001', fullName: 'Bạn', avatar: null },
          { _id: 'mock_user_bob', fullName: 'Bob Trần', avatar: null },
        ],
        lastMessage: { text: 'Lorem ipsum dolor sit amet consectetur...', createdAt: ago(15) },
        updatedAt: ago(15),
      },
      {
        _id: 'mock_conv_003',
        members: [
          { _id: 'mock_user_001', fullName: 'Bạn', avatar: null },
          { _id: 'mock_user_charlie', fullName: 'Charlie Lê', avatar: null },
        ],
        lastMessage: { text: 'OK', createdAt: ago(60) },
        updatedAt: ago(60),
      },
      {
        _id: 'mock_conv_004',
        members: [
          { _id: 'mock_user_001', fullName: 'Bạn', avatar: null },
          { _id: 'mock_user_diana', fullName: 'Diana Phạm', avatar: null },
        ],
        lastMessage: { text: 'Cảm ơn bạn nhiều lắm!', createdAt: ago(120) },
        updatedAt: ago(120),
      },
    ]

    async function fetchConversations() {
      setIsLoading(true)
      try {
        const data = await conversationService.getConversations()
        if (!cancelled) {
          const list = Array.isArray(data) ? data : []
          // DEV ONLY: nếu API trả rỗng → thêm mock để preview UI
          setConversations(list.length === 0 && import.meta.env.DEV ? MOCK_CONVERSATIONS : list)
        }
      } catch (err) {
        console.error('Fetch conversations error:', err)
        // DEV ONLY: nếu API lỗi (BE chưa chạy) → thêm mock để preview UI
        if (!cancelled && import.meta.env.DEV) {
          setConversations(MOCK_CONVERSATIONS)
        } else if (!cancelled) {
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
})

export default Sidebar
