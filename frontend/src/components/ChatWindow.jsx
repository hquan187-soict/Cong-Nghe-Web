import { useEffect, useRef, useState, useCallback } from 'react'
import { Upload, ArrowDown, X, Reply } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../context/LangContext'
import { messageService } from '../services/message.service'
import { conversationService } from '../services/conversation.service'
import MessageBubble from './MessageBubble'
import MessageInput from './chat/MessageInput'
import TypingIndicator from './chat/TypingIndicator'
import Spinner from './ui/Spinner'

const LIMIT = 20
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_FILE_SIZE = 10 * 1024 * 1024

function hexToRgb(hex) {
  const num = parseInt(hex.slice(1), 16)
  return [(num >> 16) & 0xFF, (num >> 8) & 0xFF, num & 0xFF]
}

function darkenHex(hex, amount = 20) {
  const [r, g, b] = hexToRgb(hex)
  const dr = Math.max(0, r - amount)
  const dg = Math.max(0, g - amount)
  const db = Math.max(0, b - amount)
  return `#${(1 << 24 | dr << 16 | dg << 8 | db).toString(16).slice(1)}`
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function softenForDark(hex) {
  const [r, g, b] = hexToRgb(hex)
  const sr = Math.round(r * 0.78)
  const sg = Math.round(g * 0.78)
  const sb = Math.round(b * 0.78)
  return `#${(1 << 24 | sr << 16 | sg << 8 | sb).toString(16).slice(1)}`
}

function ChatWindow({ conversationId, otherMember, isGroup, onMessageSent, isKicked = false, conversation: convProp }) {
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
  const [isBlocked, setIsBlocked] = useState(false)

  // Reply state
  const [replyingTo, setReplyingTo] = useState(null)

  // Typing indicator state
  const [isOtherTyping, setIsOtherTyping] = useState(false)
  const typingAutoHideRef = useRef(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const [membersMap, setMembersMap] = useState({})

  // Drag & drop state
  const [dragOver, setDragOver] = useState(false)
  const [dropZone, setDropZone] = useState(null)
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
      setIsBlocked(!!data.blocked)
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
    if (!isGroup) return
    const fetchConv = async () => {
      try {
        const convs = await conversationService.getConversations()
        const conv = (Array.isArray(convs) ? convs : []).find(c => c._id === conversationId)
        if (conv?.members) {
          const map = {}
          conv.members.forEach(m => { map[m._id] = m })
          setMembersMap(map)
        }
      } catch {}
    }
    fetchConv()
  }, [conversationId, isGroup])

  useEffect(() => {
    if (!conversationId || conversationId.startsWith('mock_')) return
    messageService.markAsRead(conversationId).catch(() => { })
  }, [conversationId])

  useEffect(() => {
    if (!conversationId || !isConnected) return

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
      messageService.markAsRead(conversationId).catch(() => { })
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

    const handleTypingStart = (data) => {
      if (data.conversationId !== conversationId) return
      if (data.userId?.toString() === currentUserId) return
      setIsOtherTyping(true)
      clearTimeout(typingAutoHideRef.current)
      typingAutoHideRef.current = setTimeout(() => {
        setIsOtherTyping(false)
      }, 7000)
    }

    const handleTypingStop = (data) => {
      if (data.conversationId !== conversationId) return
      if (data.userId?.toString() === currentUserId) return
      clearTimeout(typingAutoHideRef.current)
      setIsOtherTyping(false)
    }

    const handleMessageReaction = ({ conversationId: cId, messageId, reactions }) => {
      if (cId !== conversationId) return
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, reactions } : msg
        )
      )
    }

    const handleRecallMessage = ({ conversationId: cId, messageId}) => {
      if (cId !== conversationId) return;
        // Thu hồi với mọi người: cập nhật message thành đã thu hồi
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  text: '',
                  image: null,
                  file: null,
                  isRecalled: true,
                }
              : msg
          )
        );
    }

    const handleEditMessage = ({ conversationId: cId, messageId, newText }) => {
      if (cId !== conversationId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? {
                ...msg,
                text: newText,
                isEdited: true,
              }
            : msg
        )
      );
    }

    const handleMessagePinned = ({ conversationId: cId, messageId, isPinned }) => {
      if (cId !== conversationId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, isPinned } : msg
        )
      );
    }

    socket.on('sendMessage', handleNewMessage)
    socket.on('messagesRead', handleMessagesRead)
    socket.on('typing_start', handleTypingStart)
    socket.on('typing_stop', handleTypingStop)
    socket.on('messageReaction', handleMessageReaction)
    socket.on('messageEdited', handleEditMessage)
    socket.on('messageRecalled', handleRecallMessage)
    socket.on('messagePinned', handleMessagePinned)
    return () => {
      socket.off('sendMessage', handleNewMessage)
      socket.off('messagesRead', handleMessagesRead)
      socket.off('typing_start', handleTypingStart)
      socket.off('typing_stop', handleTypingStop)
      socket.off('messageReaction', handleMessageReaction)
      socket.off('messageEdited', handleEditMessage)
      socket.off('messageRecalled', handleRecallMessage)
      socket.off('messagePinned', handleMessagePinned)
      clearTimeout(typingAutoHideRef.current)
      setIsOtherTyping(false)
      leaveConversation(conversationId)
    }
  }, [conversationId, socket, isConnected, joinConversation, leaveConversation, currentUserId])

  const lastConvIdRef = useRef(null)

  useEffect(() => {
    if (loading || messages.length === 0 || page !== 1) return
    const isNewConv = lastConvIdRef.current !== conversationId
    lastConvIdRef.current = conversationId

    const doScroll = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
      }
    }

    if (isNewConv) {
      doScroll()
      requestAnimationFrame(() => {
        doScroll()
        requestAnimationFrame(doScroll)
      })
      setTimeout(doScroll, 100)
      setTimeout(doScroll, 300)
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [loading, conversationId, messages.length, page])

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
    setIsOtherTyping(false)
    setReplyingTo(null)
    setIsBlocked(false)
    clearTimeout(typingAutoHideRef.current)
  }, [conversationId])

  useEffect(() => {
    if (!isOtherTyping) return
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [isOtherTyping])

  const handleSendLike = useCallback(async (emojiName) => {
    if (!conversationId || !currentUserId) return
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)
    const optimisticMsg = {
      _id: tempId,
      conversationId,
      senderId: currentUserId,
      text: emojiName,
      messageType: 'like',
      createdAt: new Date().toISOString(),
      readBy: [currentUserId],
      status: 'sending',
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
    try {
      const savedMsg = await messageService.sendMessage({
        conversationId,
        text: emojiName,
        messageType: 'like',
      })
      setMessages((prev) =>
        prev.map((msg) => msg._id === tempId ? { ...savedMsg, status: 'sent' } : msg)
      )
      if (onMessageSent) {
        onMessageSent({ conversationId, lastMessage: savedMsg })
      }
    } catch (err) {
      console.error('Gửi like thất bại:', err)
      setMessages((prev) => prev.filter((msg) => msg._id !== tempId))
      toast.error(t('chat.sendError'))
    }
  }, [conversationId, currentUserId, onMessageSent, toast, t])

  // Gửi tin nhắn (text + image + file)
  const handleSendMessage = useCallback(async (text, imageBase64, fileData, mentions = []) => {
    if (!conversationId || !currentUserId) return
    if (!text && !imageBase64 && !fileData) return

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)

    // Tạo mảng mentions giả lập cho optimistic update
    const optimisticMentions = mentions.map(id => membersMap[id] || { _id: id, fullName: 'User' })

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
      mentions: optimisticMentions,
      mentionAll: mentions.includes('all'),
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
      if (replyingTo) payload.replyTo = replyingTo._id
      if (mentions && mentions.length > 0) payload.mentions = mentions

      const savedMsg = await messageService.sendMessage(payload)

      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempId ? { ...savedMsg, status: 'sent' } : msg
        )
      )

      setReplyingTo(null)

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
  }, [conversationId, currentUserId, onMessageSent, toast, t, replyingTo, membersMap])

  const handleSendAudio = useCallback(async (audioData) => {
    if (!conversationId || !currentUserId || !audioData) return

    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)

    const optimisticMsg = {
      _id: tempId,
      conversationId,
      senderId: currentUserId,
      text: '',
      file: { url: '', name: audioData.name, size: audioData.size, type: audioData.type, duration: audioData.duration },
      messageType: 'audio',
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
      const payload = {
        conversationId,
        file: audioData,
      }
      if (replyingTo) payload.replyTo = replyingTo._id

      const savedMsg = await messageService.sendMessage(payload)

      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempId ? { ...savedMsg, status: 'sent' } : msg
        )
      )

      setReplyingTo(null)

      if (onMessageSent) {
        onMessageSent({ conversationId, lastMessage: savedMsg })
      }
    } catch (err) {
      console.error('Gửi tin nhắn thoại thất bại:', err)
      setMessages((prev) => prev.filter((msg) => msg._id !== tempId))
      toast.error(err.response?.data?.message || t('chat.sendError'))
    } finally {
      setSending(false)
    }
  }, [conversationId, currentUserId, onMessageSent, toast, t, replyingTo])

  // Drag & Drop
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

  const themeColor = convProp?.themeColor || null
  const themeStyle = themeColor ? (() => {
    const [r, g, b] = hexToRgb(themeColor)
    const lum = relativeLuminance(themeColor)
    const isLightColor = lum > 0.4
    const darkSoftened = softenForDark(themeColor)
    return {
      '--conv-theme': themeColor,
      '--conv-theme-hover': darkenHex(themeColor),
      '--conv-theme-text': isLightColor ? '#1f2937' : '#ffffff',
      '--conv-theme-tint-light': `rgba(${r}, ${g}, ${b}, 0.07)`,
      '--conv-theme-tint-dark': `rgba(${r}, ${g}, ${b}, 0.03)`,
      '--conv-theme-dark': darkSoftened,
      '--conv-theme-dark-hover': darkenHex(darkSoftened),
    }
  })() : undefined

  return (
    <div
      className="chat-window"
      style={themeStyle}
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
            if (msg.messageType === 'system') {
              return (
                <div key={msg._id} id={`msg-${msg._id}`} className="message-system" style={{
                  textAlign: 'center', padding: '8px 16px', margin: '4px 0',
                  fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic'
                }}>
                  {msg.text}
                </div>
              )
            }

            const msgSenderId = getSenderId(msg.senderId)
            const isOwn = msgSenderId === currentUserId
            const nextMsg = messages[idx + 1]
            const nextSenderId = nextMsg && nextMsg.messageType !== 'system' ? getSenderId(nextMsg.senderId) : null
            const showAvatar = nextSenderId !== msgSenderId

            const prevMsg = messages[idx - 1]
            const prevSenderId = prevMsg && prevMsg.messageType !== 'system' ? getSenderId(prevMsg.senderId) : null
            let senderAvatar, senderName
            const nicknames = convProp?.nicknames
            const getNickname = (id) => {
              if (!nicknames || !id) return null
              if (nicknames instanceof Map) return nicknames.get(id.toString())
              if (typeof nicknames === 'object') return nicknames[id.toString()]
              return null
            }
            const showName = !isOwn && prevSenderId !== msgSenderId

            if (isOwn) {
              senderAvatar = user?.avatar
              senderName = getNickname(currentUserId) || user?.fullName
            } else if (isGroup) {
              const member = membersMap[msgSenderId] || (typeof msg.senderId === 'object' ? msg.senderId : null)
              senderAvatar = member?.avatar
              senderName = getNickname(msgSenderId) || member?.fullName || otherMember?.fullName
            } else {
              senderAvatar = otherMember?.avatar
              senderName = getNickname(otherMember?._id) || otherMember?.fullName
            }

            return (
              <MessageBubble
                key={msg._id}
                message={{ ...msg, status: computeStatus(msg) }}
                isOwn={isOwn}
                showAvatar={showAvatar}
                showName={showName}
                senderAvatar={senderAvatar}
                senderName={senderName}
                isKicked={isKicked}
                onReply={(msg) => setReplyingTo(msg)}
                scrollContainerRef={scrollContainerRef}
                deleteMessage={(messageId) => {
                  setMessages((prev) => prev.filter((m) => m._id !== messageId))
                }}
              />
            )
          })
        )}

        {isOtherTyping && <TypingIndicator senderName={otherMember?.fullName} />}

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

      {isKicked ? (
        <div style={{
          padding: '16px', textAlign: 'center', borderTop: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-muted)', fontSize: '14px', background: 'var(--color-surface)'
        }}>
          Bạn đã bị buộc rời khỏi nhóm. Bạn không thể thực hiện hành động nào.
        </div>
      ) : isBlocked ? (
        <div style={{
          padding: '14px 16px',
          textAlign: 'center',
          borderTop: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-muted)',
          fontSize: '14px',
          background: 'var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
          </svg>
          Bạn không thể trả lời cuộc trò chuyện này
        </div>
      ) : (
        <>
          {replyingTo && (
            <div className="chat-window__reply-preview" style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderTop: '1px solid var(--color-border-subtle)',
              background: 'var(--color-surface)'
            }}>
              <Reply size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <div style={{
                flex: 1, minWidth: 0, borderLeft: '3px solid var(--color-primary)',
                paddingLeft: '8px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>
                  {(() => {
                    const sid = typeof replyingTo.senderId === 'object' ? replyingTo.senderId?._id : replyingTo.senderId
                    return sid?.toString() === currentUserId ? 'Bạn' : (typeof replyingTo.senderId === 'object' ? replyingTo.senderId?.fullName : null) || 'Người dùng'
                  })()}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {replyingTo.messageType === 'like'
                    ? 'Đã gửi biểu tượng cảm xúc'
                    : (replyingTo.text || (replyingTo.image ? 'Đã gửi một ảnh' : replyingTo.file ? 'Đã gửi một tệp' : ''))}
                </div>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <MessageInput
            ref={messageInputRef}
            onSend={handleSendMessage}
            onSendLike={handleSendLike}
            onSendAudio={handleSendAudio}
            disabled={sending}
            conversationId={conversationId}
            likeEmoji={convProp?.emoji || 'ThumbsUp'}
            members={Object.values(membersMap)}
            isGroup={isGroup}
            currentUserId={currentUserId}
          />
        </>
      )}
    </div>
  )
}

export default ChatWindow
