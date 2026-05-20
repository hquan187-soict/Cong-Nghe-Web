import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Send, ImagePlus, Paperclip, X, FileText, Mic, ThumbsUp } from 'lucide-react'
import { useLang } from '../../context/LangContext'
import { useSocket } from '../../context/SocketContext'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_FILE_SIZE = 10 * 1024 * 1024

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const MessageInput = forwardRef(function MessageInput({ onSend, disabled = false, conversationId }, ref) {
  const { t } = useLang()
  const { socket, isConnected } = useSocket()
  const [text, setText] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [fileData, setFileData] = useState(null)
  const textareaRef = useRef(null)
  const imageInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const isTypingRef = useRef(false)
  const prevConvRef = useRef(conversationId)
  const heartbeatRef = useRef(null)

  const stopTyping = useCallback((convId) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = null
    if (isTypingRef.current && socket?.connected) {
      socket.emit('typing_stop', { conversationId: convId || conversationId })
      isTypingRef.current = false
    }
  }, [socket, conversationId])

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [])

  useEffect(() => {
    if (isTypingRef.current && socket?.connected && prevConvRef.current) {
      socket.emit('typing_stop', { conversationId: prevConvRef.current })
    }
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = null
    isTypingRef.current = false
    prevConvRef.current = conversationId
  }, [conversationId, socket])

  useEffect(() => {
    if (!isConnected || !socket?.connected || !conversationId || isTypingRef.current) return
    const currentText = textareaRef.current?.value || ''
    if (currentText.length > 0) {
      socket.emit('typing_start', { conversationId })
      isTypingRef.current = true
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      heartbeatRef.current = setInterval(() => {
        if (socket.connected && isTypingRef.current) {
          socket.emit('typing_start', { conversationId })
        }
      }, 4000)
    }
  }, [isConnected, socket, conversationId])

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  function handleChange(e) {
    const newText = e.target.value
    setText(newText)
    adjustHeight()

    if (socket?.connected && conversationId) {
      if (newText.length > 0) {
        if (!isTypingRef.current) {
          socket.emit('typing_start', { conversationId })
          isTypingRef.current = true

          if (heartbeatRef.current) clearInterval(heartbeatRef.current)
          heartbeatRef.current = setInterval(() => {
            if (socket.connected && isTypingRef.current) {
              socket.emit('typing_start', { conversationId })
            }
          }, 4000)
        }
      } else {
        stopTyping()
      }
    }
  }

  useImperativeHandle(ref, () => ({
    addFile: (file) => processFile(file),
  }))

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function processFile(file) {
    if (!file) return

    if (file.type.startsWith('image/')) {
      if (file.size > MAX_IMAGE_SIZE) return
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
        setImageBase64(reader.result)
      }
      reader.readAsDataURL(file)
    } else {
      if (file.size > MAX_FILE_SIZE) return
      const reader = new FileReader()
      reader.onloadend = () => {
        setFileData({
          data: reader.result,
          name: file.name,
          size: file.size,
          type: file.type,
        })
      }
      reader.readAsDataURL(file)
    }
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function clearImage() {
    setImagePreview(null)
    setImageBase64(null)
  }

  function clearFile() {
    setFileData(null)
  }

  function handleSend() {
    const trimmed = text.trim()
    if ((!trimmed && !imageBase64 && !fileData) || disabled) return

    stopTyping()

    onSend(trimmed || '', imageBase64 || null, fileData || null)
    setText('')
    clearImage()
    clearFile()

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const canSend = (text.trim() || imageBase64 || fileData) && !disabled
  const hasAttachment = imagePreview || fileData

  return (
    <div className="message-input">
      {hasAttachment && (
        <div className="message-input__preview">
          {imagePreview && (
            <div className="message-input__preview-container">
              <img src={imagePreview} alt="preview" className="message-input__preview-img" />
              <button
                type="button"
                className="message-input__preview-remove"
                onClick={clearImage}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {fileData && (
            <div className="message-input__preview-container message-input__preview-file">
              <FileText size={20} />
              <div className="message-input__preview-file-info">
                <span className="message-input__preview-file-name">{fileData.name}</span>
                <span className="message-input__preview-file-size">{formatFileSize(fileData.size)}</span>
              </div>
              <button
                type="button"
                className="message-input__preview-remove message-input__preview-remove--file"
                onClick={clearFile}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}
      <div className="message-input__row">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="message-input__file-input"
          onChange={handleImageSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="message-input__file-input"
          onChange={handleFileSelect}
        />
        <button
          type="button"
          className="message-input__action-btn tooltip-wrapper"
          onClick={() => {
            console.log('[MessageInput] Voice record clicked')
          }}
          disabled={disabled}
        >
          <Mic size={20} />
          <span className="tooltip tooltip--top tooltip--right">Gửi tin nhắn thoại</span>
        </button>
        <button
          type="button"
          className="message-input__action-btn tooltip-wrapper"
          onClick={() => imageInputRef.current?.click()}
          disabled={disabled}
        >
          <ImagePlus size={20} />
          <span className="tooltip tooltip--top">Gửi ảnh</span>
        </button>
        <button
          type="button"
          className="message-input__action-btn tooltip-wrapper"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Paperclip size={20} />
          <span className="tooltip tooltip--top">Gửi file đính kèm</span>
        </button>
        <textarea
          ref={textareaRef}
          className="message-input__textarea"
          placeholder={t('chat.inputPlaceholder')}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        {canSend ? (
          <button
            type="button"
            className="message-input__send-btn"
            onClick={handleSend}
            title={t('chat.send')}
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="message-input__like-btn"
            onClick={() => {
              console.log('[MessageInput] Like (thumbs up) clicked')
            }}
            disabled={disabled}
            title="Gửi like"
          >
            <ThumbsUp size={20} />
          </button>
        )}
      </div>
    </div>
  )
})

export default MessageInput
