import { useEffect, useRef, useState, useCallback } from 'react'
import { Upload, ArrowDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../context/LangContext'
import { messageService } from '../services/message.service'
import MessageBubble from './MessageBubble'
import MessageInput from './chat/MessageInput'
import TypingIndicator from './chat/TypingIndicator'
import Spinner from './ui/Spinner'

const LIMIT = 20
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_FILE_SIZE = 10 * 1024 * 1024

function ChatWindow({ conversationId, otherMember, onMessageSent }) {
  const { user } = useAuth()
  const { socket, isConnected, joinConversation, leaveConversation } = useSocket()
  const toast = useToast()
  const { t } = useLang()

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [sending, setSending] = useState(false)

  const [isTyping, setIsTyping] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // Drag & drop state
  const [dragOver, setDragOver] = useState(false)
  const [dropZone, setDropZone] = useState(null) // 'messages' | 'input' | null
  const dragCounterRef = useRef(0)

  const messagesEndRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const prevScrollHeightRef = useRef(0)
  const messageInputRef = useRef(null)

  const currentUserId = user?._id?.toString()

  const getSenderId = (senderId) =>
    (typeof senderId === 'object' ? senderId?._id : senderId)?.toString()

  const getReadByIds = (readBy) => {
    if (!Array.isArray(readBy)) return []
    return readBy.map((r) => (typeof r === 'object' ? r?._id : r)?.toString())
  }

  const computeStatus = (msg) => {
    if (msg.status === 'sending' || msg.status === 'error') return msg.status
    const readByIds = getReadByIds(msg.readBy)
    if (readByIds.length > 1) return 'read'
    return 'sent'
  }

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
      const sorted = [...data.messages].reverse()

      if (isLoadMore) {
        setMessages((prev) => [...sorted, ...prev])
      } else {
        setMessages(sorted)
      }
      setHasMore(data.pagination?.hasMore ?? data.count === LIMIT)
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

  useEffect(() => {
    if (!conversationId || conversationId.startsWith('mock_')) return
    messageService.markAsRead(conversationId).catch(() => {})
  }, [conversationId])

  useEffect(() => {
    if (!conversationId || !socket?.connected) return

    joinConversation(conversationId)

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
      messageService.markAsRead(conversationId).catch(() => {})
    }

    const handleMessagesRead = ({ conversationId: incomingConvId, messages: updatedMessages }) => {
      if (incomingConvId !== conversationId) return
      const updatedMap = new Map(updatedMessages.map((m) => [m._id, m.readBy]))
      setMessages((prev) =>
        prev.map((msg) => {
          const newReadBy = updatedMap.get(msg._id)
          if (newReadBy) return { ...msg, readBy: newReadBy }
          return msg
        })
      )
    }

    socket.on('sendMessage', handleNewMessage)
    socket.on('messagesRead', handleMessagesRead)

    return () => {
      socket.off('sendMessage', handleNewMessage)
      socket.off('messagesRead', handleMessagesRead)
      leaveConversation(conversationId)
    }
  }, [conversationId, socket, isConnected, joinConversation, leaveConversation])

  useEffect(() => {
    if (!loading && messages.length > 0 && page === 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [loading, conversationId, messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loadingMore && prevScrollHeightRef.current > 0 && scrollContainerRef.current) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight
      scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current
      prevScrollHeightRef.current = 0
    }
  }, [loadingMore])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(distanceFromBottom > 200)

    if (!loadingMore && hasMore && el.scrollTop < 60) {
      fetchMessages(conversationId, page + 1, true)
    }
  }, [loadingMore, hasMore, conversationId, page, fetchMessages])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!socket?.connected || !conversationId) return

    const handleTyping = ({ conversationId: cid, userId }) => {
      if (cid === conversationId && userId !== currentUserId) {
        setIsTyping(true)
      }
    }

    const handleStopTyping = ({ conversationId: cid, userId }) => {
      if (cid === conversationId && userId !== currentUserId) {
        setIsTyping(false)
      }
    }

    socket.on('typing', handleTyping)
    socket.on('stopTyping', handleStopTyping)

    return () => {
      socket.off('typing', handleTyping)
      socket.off('stopTyping', handleStopTyping)
    }
  }, [socket, conversationId, currentUserId])

  useEffect(() => {
    setIsTyping(false)
  }, [conversationId])

  // ─── Gửi tin nhắn (text + image + file) ──────────────────
  const handleSendMessage = useCallback(async (text, imageBase64, fileData) => {
    if (!conversationId || !currentUserId) return
    if (!text && !imageBase64 && !fileData) return

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)

    const optimisticMsg = {
      _id: tempId,
      conversationId,
      senderId: currentUserId,
      text: text || '',
      image: imageBase64 || null,
      file: fileData ? { url: '', name: fileData.name, size: fileData.size, type: fileData.type } : null,
      createdAt: new Date().toISOString(),
      readBy: [currentUserId],
      status: 'sending',
    }

    setMessages((prev) => [...prev, optimisticMsg])
    setSending(true)

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)

    try {
      const payload = { conversationId }
      if (text) payload.text = text
      if (imageBase64) payload.image = imageBase64
      if (fileData) payload.file = fileData

      const savedMsg = await messageService.sendMessage(payload)

      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempId ? { ...savedMsg, status: 'sent' } : msg
        )
      )

      if (onMessageSent) {
        onMessageSent({ conversationId, lastMessage: savedMsg })
      }
    } catch (err) {
      console.error('Gửi tin nhắn thất bại:', err)
      setMessages((prev) => prev.filter((msg) => msg._id !== tempId))
      toast.error(err.response?.data?.message || t('chat.sendError'))
    } finally {
      setSending(false)
    }
  }, [conversationId, currentUserId, onMessageSent, toast, t])

  // ─── Drag & Drop ──────────────────────────────────────────
  const readFileAsBase64 = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(file)
    })

  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setDragOver(false)
      setDropZone(null)
    }
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleZoneDragOver = useCallback((zone) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDropZone(zone)
  }, [])

  const handleDrop = useCallback(async (zone, e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setDragOver(false)
    setDropZone(null)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const file = files[0]

    if (zone === 'messages') {
      // Thả vào vùng chat → gửi ngay
      const isImage = file.type.startsWith('image/')
      if (isImage && file.size > MAX_IMAGE_SIZE) {
        toast.error('Ảnh quá lớn (tối đa 5 MB)')
        return
      }
      if (!isImage && file.size > MAX_FILE_SIZE) {
        toast.error('File quá lớn (tối đa 10 MB)')
        return
      }

      const base64 = await readFileAsBase64(file)

      if (isImage) {
        handleSendMessage('', base64, null)
      } else {
        handleSendMessage('', null, {
          data: base64,
          name: file.name,
          size: file.size,
          type: file.type,
        })
      }
    } else {
      // Thả vào vùng soạn tin → đưa vào preview
      if (messageInputRef.current?.addFile) {
        messageInputRef.current.addFile(file)
      }
    }
  }, [handleSendMessage, toast])

  if (!conversationId) {
    return (
      <div className="chat-window chat-window--empty">
        <p className="placeholder-text">{t('chat.selectConversation')}</p>
      </div>
    )
  }

  return (
    <div
      className="chat-window"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
    >
      {/* Drag overlay với 2 vùng thả */}
      {dragOver && (
        <div className="chat-window__drop-overlay">
          <div
            className={`chat-window__drop-zone chat-window__drop-zone--messages ${dropZone === 'messages' ? 'chat-window__drop-zone--active' : ''}`}
            onDragOver={handleZoneDragOver('messages')}
            onDrop={(e) => handleDrop('messages', e)}
          >
            <Upload size={36} />
            <span>Thả để gửi ngay</span>
          </div>
          <div
            className={`chat-window__drop-zone chat-window__drop-zone--input ${dropZone === 'input' ? 'chat-window__drop-zone--active' : ''}`}
            onDragOver={handleZoneDragOver('input')}
            onDrop={(e) => handleDrop('input', e)}
          >
            <Upload size={36} />
            <span>Thả để soạn tin nhắn</span>
          </div>
        </div>
      )}

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
          messages.map((msg, idx) => {
            const msgSenderId = getSenderId(msg.senderId)
            const isOwn = msgSenderId === currentUserId
            const nextMsg = messages[idx + 1]
            const nextSenderId = nextMsg ? getSenderId(nextMsg.senderId) : null
            const showAvatar = nextSenderId !== msgSenderId

            const senderAvatar = isOwn ? user?.avatar : otherMember?.avatar
            const senderName = isOwn ? user?.fullName : otherMember?.fullName

            return (
              <MessageBubble
                key={msg._id}
                message={{ ...msg, status: computeStatus(msg) }}
                isOwn={isOwn}
                showAvatar={showAvatar}
                senderAvatar={senderAvatar}
                senderName={senderName}
              />
            )
          })
        )}

        {isTyping && <TypingIndicator userName={otherMember?.fullName} />}

        <div ref={messagesEndRef} />
      </div>

      {showScrollBtn && (
        <button
          className="chat-window__scroll-btn"
          onClick={scrollToBottom}
          type="button"
        >
          <ArrowDown size={20} />
        </button>
      )}

      <MessageInput ref={messageInputRef} onSend={handleSendMessage} disabled={sending} />
    </div>
  )
}

export default ChatWindow
