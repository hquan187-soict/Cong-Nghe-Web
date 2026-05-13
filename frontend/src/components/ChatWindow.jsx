import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../context/LangContext'
import { messageService } from '../services/message.service'
import MessageBubble from './MessageBubble'
import MessageInput from './chat/MessageInput'
import Spinner from './ui/Spinner'

const LIMIT = 20

/**
 * ChatWindow — Hiển thị tin nhắn + ô gửi tin
 * Props:
 *   - conversationId: ID cuộc trò chuyện đang mở
 *   - onMessageSent(message): callback để ChatPage cập nhật Sidebar lastMessage
 */
function ChatWindow({ conversationId, onMessageSent }) {
  const { user } = useAuth()
  const { socket, joinConversation, leaveConversation } = useSocket()
  const toast = useToast()
  const { t } = useLang()

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const messagesEndRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const prevScrollHeightRef = useRef(0)

  const currentUserId = user?._id?.toString()

  /**
   * Lấy senderId dạng string, xử lý 2 trường hợp:
   * - Populated (từ API): msg.senderId là object { _id, fullName, ... } → lấy _id
   * - Optimistic (local): msg.senderId là string trực tiếp
   */
  const getSenderId = (senderId) =>
    (typeof senderId === 'object' ? senderId?._id : senderId)?.toString()

  // ─── Fetch messages từ API ───────────────────────────────
  const fetchMessages = useCallback(async (convId, pageNum, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true)
      prevScrollHeightRef.current = scrollContainerRef.current?.scrollHeight ?? 0
    } else {
      setLoading(true)
      setMessages([])
      setPage(1)
      setHasMore(false)
    }

    try {
      const data = await messageService.getMessages(convId, pageNum, LIMIT)

      if (isLoadMore) {
        setMessages((prev) => [...data.messages, ...prev])
      } else {
        setMessages(data.messages)
      }
      setHasMore(data.pagination.hasMore)
      setPage(pageNum)
    } catch (err) {
      console.error('ChatWindow: lỗi load messages', err)
    } finally {
      if (isLoadMore) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!conversationId) return
    fetchMessages(conversationId, 1, false)
  }, [conversationId, fetchMessages])

  // ─── Real-time: join/leave room + lắng nghe tin nhắn mới ───
  useEffect(() => {
    if (!conversationId || !socket) return

    joinConversation(conversationId)

    /**
     * Backend emit event 'sendMessage' với payload:
     * { conversationId, message, lastMessage, updatedAt }
     *
     * Deduplication: kiểm tra _id trước khi thêm để tránh duplicate
     * với optimistic message đã có.
     */
    const handleNewMessage = ({ conversationId: incomingConvId, message }) => {
      if (incomingConvId !== conversationId) return

      setMessages((prev) => {
        const alreadyExists = prev.some((m) => m._id === message._id)
        if (alreadyExists) return prev
        return [...prev, message]
      })

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)

      if (onMessageSent) {
        onMessageSent({ conversationId, lastMessage: message })
      }
    }

    socket.on('sendMessage', handleNewMessage)

    return () => {
      socket.off('sendMessage', handleNewMessage)
      leaveConversation(conversationId)
    }
  }, [conversationId, socket, joinConversation, leaveConversation, onMessageSent])
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!loading && messages.length > 0 && page === 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [loading, conversationId, messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sau khi load thêm tin cũ, giữ nguyên vị trí scroll
  useEffect(() => {
    if (!loadingMore && prevScrollHeightRef.current > 0 && scrollContainerRef.current) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight
      scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current
      prevScrollHeightRef.current = 0
    }
  }, [loadingMore])

  // Infinite scroll lên trên
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el || loadingMore || !hasMore) return
    if (el.scrollTop < 60) {
      fetchMessages(conversationId, page + 1, true)
    }
  }, [loadingMore, hasMore, conversationId, page, fetchMessages])

  // ─── Optimistic update — gửi tin nhắn ──────────────────
  const handleSendMessage = useCallback(async (text) => {
    if (!conversationId || !currentUserId) return

    // 1. Tạo tempId cho tin nhắn pending
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)

    // 2. Tạo optimistic message (hiện ngay trên UI với status 'sending')
    const optimisticMsg = {
      _id: tempId,
      conversationId,
      senderId: currentUserId,
      text,
      image: null,
      createdAt: new Date().toISOString(),
      status: 'sending',
    }

    // 3. Thêm vào cuối danh sách messages
    setMessages((prev) => [...prev, optimisticMsg])

    // 4. Scroll xuống cuối để thấy tin vừa gửi
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)

    try {
      // 5. Gọi API POST /api/messages
      const savedMsg = await messageService.sendMessage({ conversationId, text })

      // 6. Thành công → thay thế optimistic message bằng message thật từ server
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempId ? { ...savedMsg, status: 'sent' } : msg
        )
      )

      // 7. Callback lên ChatPage để cập nhật Sidebar lastMessage
      if (onMessageSent) {
        onMessageSent({ conversationId, lastMessage: savedMsg })
      }
    } catch (err) {
      console.error('Gửi tin nhắn thất bại:', err)

      // 8. Lỗi → xóa tin nhắn optimistic + hiện toast
      setMessages((prev) => prev.filter((msg) => msg._id !== tempId))
      toast.error(err.response?.data?.message || t('chat.sendError'))
    }
  }, [conversationId, currentUserId, onMessageSent, toast, t])

  // ─── Render ─────────────────────────────────────────────
  if (!conversationId) {
    return (
      <div className="chat-window chat-window--empty">
        <p className="placeholder-text">{t('chat.selectConversation')}</p>
      </div>
    )
  }

  return (
    <div className="chat-window">
      {/* Khu vực tin nhắn */}
      <div
        className="chat-window__messages"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {loadingMore && (
          <div className="chat-window__load-more-spinner">
            <Spinner className="h-4 w-4" />
          </div>
        )}

        {loading ? (
          <div className="chat-window__skeleton">
            {/* Skeleton mimics alternating chat bubbles */}
            <div className="chat-window__skeleton-row chat-window__skeleton-row--left">
              <div className="chat-window__skeleton-bubble chat-window__skeleton-bubble--medium"></div>
            </div>
            <div className="chat-window__skeleton-row chat-window__skeleton-row--right">
              <div className="chat-window__skeleton-bubble chat-window__skeleton-bubble--short"></div>
            </div>
            <div className="chat-window__skeleton-row chat-window__skeleton-row--left">
              <div className="chat-window__skeleton-bubble chat-window__skeleton-bubble--long"></div>
            </div>
            <div className="chat-window__skeleton-row chat-window__skeleton-row--left">
              <div className="chat-window__skeleton-bubble chat-window__skeleton-bubble--short"></div>
            </div>
            <div className="chat-window__skeleton-row chat-window__skeleton-row--right">
              <div className="chat-window__skeleton-bubble chat-window__skeleton-bubble--medium"></div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg._id}
              message={msg}
              isOwn={getSenderId(msg.senderId) === currentUserId}
            />
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Ô nhập tin nhắn */}
      <MessageInput onSend={handleSendMessage} />
    </div>
  )
}

export default ChatWindow
