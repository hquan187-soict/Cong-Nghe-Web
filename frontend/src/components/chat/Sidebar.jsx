import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Plus, MessageCircle, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { conversationService } from '../../services/conversation.service'
import { messageService } from '../../services/message.service'
import { useLang } from '../../context/LangContext'
import { useToast } from '../../context/ToastContext'
import { useSocket } from '../../context/SocketContext'
import { useAuth } from '../../context/AuthContext'
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
 *   - clearUnread(conversationId): xóa badge unread cho conversation
 *   - incrementUnread(conversationId): tăng badge unread +1 (dùng khi nhận tin mới qua socket)
 */
const Sidebar = forwardRef(function Sidebar({ selectedConversation, onSelectConversation }, ref) {
  const { t } = useLang()
  const toast = useToast()
  const navigate = useNavigate()
  const { socket } = useSocket()
  const { user } = useAuth()

  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSearchModal, setShowSearchModal] = useState(false)

  // Map lưu unreadCount cho mỗi conversation: { [conversationId]: number }
  const [unreadMap, setUnreadMap] = useState({})

  // Expose updateLastMessage, clearUnread, incrementUnread cho parent (ChatPage) gọi qua ref
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

    /** Xóa badge unread (khi user mở conversation đó) */
    clearUnread(conversationId) {
      setUnreadMap((prev) => {
        const next = { ...prev }
        delete next[conversationId]
        return next
      })
    },

    /** Tăng badge unread +1 (khi nhận tin mới qua socket mà conversation chưa đang mở) */
    incrementUnread(conversationId) {
      setUnreadMap((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || 0) + 1,
      }))
    },
  }), [])

  // (Trạng thái online/offline hiện được quản lý tập trung ở SocketContext)

  // Fetch conversations khi mount
  useEffect(() => {
    let cancelled = false

    async function fetchConversations() {
      setIsLoading(true)
      try {
        const data = await conversationService.getConversations()
        if (!cancelled) {
          const list = Array.isArray(data) ? data : []
          setConversations(list)
          // Trích unreadCount từ API response (nếu backend trả về)
          const uMap = {}
          list.forEach((conv) => {
            if (conv.unreadCount && conv.unreadCount > 0) {
              uMap[conv._id] = conv.unreadCount
            }
          })
          setUnreadMap(uMap)
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

  // Khi click vào conversation → gọi mark-as-read + xóa badge
  const handleSelectConversation = useCallback(async (conv) => {
    // Cập nhật UI ngay lập tức
    onSelectConversation(conv)

    // Xóa badge unread ngay (optimistic)
    setUnreadMap((prev) => {
      if (!prev[conv._id]) return prev
      const next = { ...prev }
      delete next[conv._id]
      return next
    })

    // Gọi API mark-as-read (không block UI, fire-and-forget)
    if (!conv._id.startsWith('mock_')) {
      try {
        await messageService.markAsRead(conv._id)
      } catch (err) {
        console.error('Mark as read error:', err)
        // Không hiện toast lỗi — đây là thao tác ngầm, không quan trọng tới UX
      }
    }
  }, [onSelectConversation])


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
        <div className="sidebar__header-left">
          <button
            className="sidebar__profile-btn"
            title={t('profile.title')}
            onClick={() => navigate('/profile')}
            style={user?.avatar ? { padding: 0, overflow: 'hidden' } : {}}
          >
            {user?.avatar ? (
              <img 
                src={user.avatar} 
                alt={user.fullName || 'Profile'} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            ) : (
              <User size={18} />
            )}
          </button>
          <h2 className="sidebar__title">
            <MessageCircle size={18} />
            {t('chat.conversations')}
          </h2>
        </div>
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
        {/* Loading skeleton */}
        {isLoading && (
          <div className="sidebar__loading">
            {[1, 2, 3, 4, 5].map((i) => (
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
            onClick={() => handleSelectConversation(conv)}
            unreadCount={unreadMap[conv._id] || 0}
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

