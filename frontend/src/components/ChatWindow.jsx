import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import MessageBubble from './MessageBubble'
import Spinner from './ui/Spinner'
//xóa khi API sẵn sàng
import { getMockMessages, MOCK_CURRENT_USER_ID } from '../services/mockData'

//xóa khi API sẵn sàng — dùng axiosInstance thật
// import axiosInstance from '../utils/axios'

const LIMIT = 20

function ChatWindow({ conversationId }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const messagesEndRef = useRef(null)
  const scrollContainerRef = useRef(null)
  // Lưu scrollHeight trước khi append tin cũ để giữ vị trí scroll
  const prevScrollHeightRef = useRef(0)

  //khi API thật bật lên → đổi thành: const currentUserId = user?._id
  // Giai đoạn mock: dùng MOCK_CURRENT_USER_ID để khớp senderId trong mockData
  const currentUserId = MOCK_CURRENT_USER_ID || user?._id

  const fetchMessages = useCallback(async (convId, pageNum, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true)
      // Ghi lại chiều cao hiện tại trước khi prepend
      prevScrollHeightRef.current = scrollContainerRef.current?.scrollHeight ?? 0
    } else {
      setLoading(true)
      setMessages([])
      setPage(1)
      setHasMore(false)
    }

    try {
      //xóa mock, dùng API thật:
      // const data = await axiosInstance.get(`/api/messages/${convId}?page=${pageNum}&limit=${LIMIT}`)
      const data = getMockMessages(convId, pageNum, LIMIT)

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

  // Load lại từ đầu khi đổi conversation
  useEffect(() => {
    if (!conversationId) return
    fetchMessages(conversationId, 1, false)
  }, [conversationId, fetchMessages])

  // Auto-scroll xuống cuối sau lần load đầu tiên
  useEffect(() => {
    if (!loading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [loading])

  // Sau khi load thêm tin cũ, giữ nguyên vị trí scroll (không nhảy lên đầu)
  useEffect(() => {
    if (!loadingMore && prevScrollHeightRef.current > 0 && scrollContainerRef.current) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight
      scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current
      prevScrollHeightRef.current = 0
    }
  }, [loadingMore])

  // Infinite scroll lên trên — khi scroll đến gần đầu thì load thêm
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el || loadingMore || !hasMore) return
    if (el.scrollTop < 60) {
      fetchMessages(conversationId, page + 1, true)
    }
  }, [loadingMore, hasMore, conversationId, page, fetchMessages])

  if (!conversationId) {
    return (
      <div className="chat-window chat-window--empty">
        <p className="placeholder-text">Chọn một cuộc trò chuyện để bắt đầu</p>
      </div>
    )
  }

  return (
    <div className="chat-window">
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
          <div className="chat-window__spinner-center">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg._id}
              message={msg}
              isOwn={msg.senderId === currentUserId}
            />
          ))
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

export default ChatWindow
