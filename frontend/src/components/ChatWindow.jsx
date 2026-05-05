import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../context/LangContext'
import { messageService } from '../services/message.service'
import MessageBubble from './MessageBubble'
import MessageInput from './chat/MessageInput'
import Spinner from './ui/Spinner'

const LIMIT = 20

// ─── DEV ONLY: mock data ──────────────────────────────────────
const MOCK_SELF_ID = 'mock_user_001'

function makeMockMsg(convId, senderId, text, minutesAgo) {
  return {
    _id: `${convId}_${minutesAgo}_${senderId}`,
    conversationId: convId,
    senderId,
    text,
    image: null,
    createdAt: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
    status: 'sent',
  }
}
const M = MOCK_SELF_ID
const MOCK_MESSAGES = {
  mock_conv_001: [
    makeMockMsg('mock_conv_001', 'mock_user_alice', 'Chào bạn! 👋', 120),
    makeMockMsg('mock_conv_001', M, 'Hello Alice!', 119),
    makeMockMsg('mock_conv_001', 'mock_user_alice', 'Bạn có khỏe không?', 118),
    makeMockMsg('mock_conv_001', M, 'Khỏe lắm bạn ơi, bạn thì sao?', 117),
    makeMockMsg('mock_conv_001', 'mock_user_alice', 'Mình cũng khỏe!', 116),
    makeMockMsg('mock_conv_001', M, 'OK', 115),
    makeMockMsg('mock_conv_001', 'mock_user_alice', 'Này bạn ơi, mình muốn hỏi về dự án Web đó, hôm qua thầy có gửi mail chưa?', 60),
    makeMockMsg('mock_conv_001', M, 'Ừ rồi, thầy gửi lúc tối qua. Deadline là cuối tuần này nên mình đang làm gấp 😅', 58),
    makeMockMsg('mock_conv_001', 'mock_user_alice', 'Trời ơi vậy sao, mình chưa đọc mail. Dự án về cái gì vậy?', 55),
    makeMockMsg('mock_conv_001', M, 'Làm ứng dụng chat real-time, stack là React + Node.js + Socket.io. Bạn biết mấy cái đó chưa?', 50),
    makeMockMsg('mock_conv_001', 'mock_user_alice', 'React thì biết rồi nhưng Socket.io thì chưa. Có tài liệu nào không?', 45),
    makeMockMsg('mock_conv_001', M, 'Bạn lên docs chính thức của socket.io đọc đi, khá dễ hiểu. Mình sẽ share repo lên GitHub sau.', 40),
    makeMockMsg('mock_conv_001', 'mock_user_alice', 'Oke bạn! Nhớ thêm mình vào collaborator nha 😊', 35),
    makeMockMsg('mock_conv_001', M, 'Haha oke, mình sẽ add. Chiều nay mình push code lên.', 30),
    makeMockMsg('mock_conv_001', 'mock_user_alice', 'Cảm ơn bạn nhiều! Nhân tiện, tối nay bạn có rảnh không? Nhóm muốn họp online.', 20),
    makeMockMsg('mock_conv_001', M, 'Tối nay 8h được không? Mình rảnh từ 7:30.', 15),
    makeMockMsg('mock_conv_001', 'mock_user_alice', 'Được luôn! Mình sẽ tạo link Meet gửi cả nhóm.', 10),
    makeMockMsg('mock_conv_001', M, '👍 Oke bạn, gặp tối nay nha!', 5),
    makeMockMsg('mock_conv_001', 'mock_user_alice', 'Oke bạn nhé! Hẹn gặp lại 😊', 2),
  ],
  mock_conv_002: [
    makeMockMsg('mock_conv_002', 'mock_user_bob', 'Hey man!', 200),
    makeMockMsg('mock_conv_002', M, 'Yo Bob!', 199),
    makeMockMsg('mock_conv_002', 'mock_user_bob', 'Haha lâu rồi không gặp', 198),
    makeMockMsg('mock_conv_002', M, 'Ừ nhỉ, dạo này bận quá', 195),
    makeMockMsg('mock_conv_002', 'mock_user_bob', 'ok ok', 190),
    makeMockMsg('mock_conv_002', M, 'Này tớ muốn hỏi bạn về thuật toán sort, bạn có nhớ QuickSort không?', 100),
    makeMockMsg('mock_conv_002', 'mock_user_bob', 'Nhớ chứ! Tại sao?', 98),
    makeMockMsg('mock_conv_002', M, 'Bài tập yêu cầu implement từ đầu không dùng library, tớ đang bí chỗ partition.', 95),
    makeMockMsg('mock_conv_002', 'mock_user_bob', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.', 90),
    makeMockMsg('mock_conv_002', M, 'Uầy dài quá, tóm tắt lại cho tớ đi 😂', 85),
    makeMockMsg('mock_conv_002', 'mock_user_bob', 'Tóm lại: chọn pivot, chia mảng thành 2 phần (nhỏ hơn | lớn hơn pivot), đệ quy từng phần.', 80),
    makeMockMsg('mock_conv_002', M, 'À ra vậy! Cảm ơn cậu nhiều lắm. Tớ thử code lại xem.', 75),
    makeMockMsg('mock_conv_002', 'mock_user_bob', 'Trong worst case (mảng đã sorted), QuickSort sẽ có O(n²). Dùng "median of three" để chọn pivot tốt hơn nhé.', 70),
    makeMockMsg('mock_conv_002', M, 'Oke bạn! Tớ sẽ đọc thêm.', 65),
    makeMockMsg('mock_conv_002', 'mock_user_bob', 'Ngoài ra nếu dữ liệu có nhiều phần tử trùng nhau thì nên dùng 3-way partition (Dutch National Flag). Cực kỳ hiệu quả.', 40),
    makeMockMsg('mock_conv_002', M, '😮 Nhiều thứ phải học quá. Đang code dở thì bạn nhắn thêm đống này 😅', 35),
    makeMockMsg('mock_conv_002', 'mock_user_bob', 'Haha sorry, mình hay bị "giải thích mode" quá đà 😅', 30),
    makeMockMsg('mock_conv_002', M, 'Không sao, cảm ơn bạn vì mình hiểu rõ hơn rồi!', 20),
    makeMockMsg('mock_conv_002', 'mock_user_bob', 'Lorem ipsum dolor sit amet consectetur...', 15),
  ],
  mock_conv_003: [
    makeMockMsg('mock_conv_003', 'mock_user_charlie', 'Bạn đã submit bài chưa?', 90),
    makeMockMsg('mock_conv_003', M, 'Chưa, đang sửa lỗi 😭', 88),
    makeMockMsg('mock_conv_003', 'mock_user_charlie', 'Deadline còn 2 tiếng nữa đó!', 85),
    makeMockMsg('mock_conv_003', M, 'Biết rồi biết rồi 😰', 84),
    makeMockMsg('mock_conv_003', 'mock_user_charlie', '😂 Cần mình giúp không?', 80),
    makeMockMsg('mock_conv_003', M, 'Giúp tớ debug cái hàm này với:', 75),
    makeMockMsg('mock_conv_003', M, 'function foo(arr) {\n  return arr.filter(x => x > 0).map(x => x * 2)\n}', 74),
    makeMockMsg('mock_conv_003', 'mock_user_charlie', 'Trông ổn mà? Lỗi ở đâu?', 70),
    makeMockMsg('mock_conv_003', M, 'Ah tớ truyền string vào thay vì number 😭', 65),
    makeMockMsg('mock_conv_003', 'mock_user_charlie', 'LOL 😂 parse trước khi filter đi', 63),
    makeMockMsg('mock_conv_003', M, 'Oke fix rồi! Cảm ơn!!', 60),
    makeMockMsg('mock_conv_003', 'mock_user_charlie', 'Haha no problem. Submit nhanh lên!', 58),
    makeMockMsg('mock_conv_003', M, 'Vừa submit xong rồi 😮‍💨', 55),
    makeMockMsg('mock_conv_003', 'mock_user_charlie', 'GG', 54),
    makeMockMsg('mock_conv_003', M, '😊', 53),
    makeMockMsg('mock_conv_003', 'mock_user_charlie', 'OK', 52),
  ],
  mock_conv_004: [
    makeMockMsg('mock_conv_004', 'mock_user_diana', 'Bạn ơi, bạn có note buổi học hôm qua không?', 200),
    makeMockMsg('mock_conv_004', M, 'Có! Mình sẽ chụp ảnh gửi nhé.', 198),
    makeMockMsg('mock_conv_004', 'mock_user_diana', 'Cảm ơn bạn nhiều lắm! 🙏', 195),
    makeMockMsg('mock_conv_004', M, 'Test scroll — tin ngắn 1', 180),
    makeMockMsg('mock_conv_004', 'mock_user_diana', 'Test scroll — tin ngắn 2', 175),
    makeMockMsg('mock_conv_004', M, 'OK', 170),
    makeMockMsg('mock_conv_004', 'mock_user_diana', 'haha', 165),
    makeMockMsg('mock_conv_004', M, ':D', 160),
    makeMockMsg('mock_conv_004', 'mock_user_diana', 'Tin dài để test wrap: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.', 155),
    makeMockMsg('mock_conv_004', M, 'ok', 150),
    makeMockMsg('mock_conv_004', 'mock_user_diana', 'Thật ra mình muốn hỏi thêm về dự án, bạn đã làm phần nào rồi?', 135),
    makeMockMsg('mock_conv_004', M, 'Mình đã xong phần auth: login, register, forgot password. Đang làm phần chat.', 130),
    makeMockMsg('mock_conv_004', 'mock_user_diana', 'Hay đó! Phần real-time dùng gì vậy?', 125),
    makeMockMsg('mock_conv_004', M, 'Socket.io. Tuần sau mới integrate, giờ đang làm REST API trước.', 120),
    makeMockMsg('mock_conv_004', 'mock_user_diana', 'Cảm ơn bạn nhiều lắm!', 119),
  ],
}
// ─────────────────────────────────────────────────────────────

/**
 * ChatWindow — Hiển thị tin nhắn + ô gửi tin
 * Props:
 *   - conversationId: ID cuộc trò chuyện đang mở
 *   - onMessageSent(message): callback để ChatPage cập nhật Sidebar lastMessage
 */
function ChatWindow({ conversationId, onMessageSent }) {
  const { user } = useAuth()
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

  const currentUserId = conversationId?.startsWith('mock_') ? MOCK_SELF_ID : user?._id

  // ─── Fetch messages từ API ───────────────────────────────
  const fetchMessages = useCallback(async (convId, pageNum, isLoadMore = false) => {
    // DEV ONLY: trả mock messages cho mock conversation
    if (convId?.startsWith('mock_')) {
      setMessages(MOCK_MESSAGES[convId] || [])
      setLoading(false)
      setHasMore(false)
      return
    }


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

  // Load lại từ đầu khi đổi conversation
  useEffect(() => {
    if (!conversationId) return
    fetchMessages(conversationId, 1, false)
  }, [conversationId, fetchMessages])

  // Auto-scroll xuống cuối sau lần load đầu tiên
  useEffect(() => {
    if (!loading && messages.length > 0 && page === 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!conversationId) return

    // DEV ONLY: simulate gửi tin cho mock conversation (không gọi API)
    if (conversationId.startsWith('mock_')) {
      const tempId = 'mock_msg_' + Date.now()
      const mockMsg = {
        _id: tempId,
        conversationId,
        senderId: 'mock_user_001',
        text,
        image: null,
        createdAt: new Date().toISOString(),
        status: 'sending',
      }
      setMessages((prev) => [...prev, mockMsg])
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => m._id === tempId ? { ...m, status: 'sent' } : m)
        )
      }, 600)
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
      return
    }

    if (!currentUserId) return

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
      const savedMsg = await messageService.sendMessage({
        conversationId,
        text,
      })

      // 6. Thành công → thay thế optimistic message bằng message thật từ server
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempId
            ? { ...savedMsg, status: 'sent' }
            : msg
        )
      )

      // 7. Callback lên ChatPage để cập nhật Sidebar lastMessage
      if (onMessageSent) {
        onMessageSent({
          conversationId,
          lastMessage: savedMsg,
        })
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

      {/* Ô nhập tin nhắn */}
      <MessageInput onSend={handleSendMessage} />
    </div>
  )
}

export default ChatWindow
