import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Send, ImagePlus, Paperclip, X, FileText, Mic, ThumbsUp, Heart, Smile, Flame, Star, Coffee, Zap, Sun, Moon, Music, Leaf } from 'lucide-react'
import { useLang } from '../../context/LangContext'
import { useSocket } from '../../context/SocketContext'
import VoiceRecorder from './VoiceRecorder'

function removeAccents(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_FILE_SIZE = 10 * 1024 * 1024

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const LIKE_ICONS = {
  ThumbsUp, Heart, Smile, Flame, Star, Coffee, Zap, Sun, Moon, Music, Leaf,
}

const MessageInput = forwardRef(function MessageInput({ onSend, onSendLike, onSendAudio, disabled = false, conversationId, likeEmoji = 'ThumbsUp', members = [], isGroup = false, currentUserId }, ref) {
  const { t } = useLang()
  const { socket, isConnected } = useSocket()
  const [text, setText] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [fileData, setFileData] = useState(null)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  
  // Mentions state
  const [showMentionList, setShowMentionList] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionCursorPos, setMentionCursorPos] = useState(0)
  const [selectedMentions, setSelectedMentions] = useState([])
  const [filteredMembers, setFilteredMembers] = useState([])

  const textareaRef = useRef(null)
  const imageInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const mentionListRef = useRef(null)

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
    if (!disabled && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [conversationId, socket, disabled])

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

  useEffect(() => {
    if (showMentionList && isGroup && members.length > 0) {
      const search = removeAccents(mentionSearch);
      
      const ALL_MEMBER_TAG = { _id: 'all', fullName: 'Mọi người', isAll: true };
      const validMembers = members.filter(m => m._id !== currentUserId);
      const combinedMembers = [ALL_MEMBER_TAG, ...validMembers];
      
      const filtered = combinedMembers.filter(m => removeAccents(m.fullName).includes(search));
      
      setFilteredMembers(filtered);
      setMentionIndex(0);
    }
  }, [mentionSearch, showMentionList, isGroup, members, currentUserId]);

  // Click outside mention list
  useEffect(() => {
    function handleClickOutside(e) {
      if (mentionListRef.current && !mentionListRef.current.contains(e.target) && textareaRef.current && !textareaRef.current.contains(e.target)) {
        setShowMentionList(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(e) {
    const newText = e.target.value
    setText(newText)
    adjustHeight()

    // Mentions logic
    if (isGroup) {
      const cursorPosition = e.target.selectionStart;
      const textBeforeCursor = newText.slice(0, cursorPosition);
      const match = textBeforeCursor.match(/@([^\s@]*)$/);
      
      if (match) {
        setShowMentionList(true);
        setMentionSearch(match[1]);
        setMentionCursorPos(cursorPosition - match[1].length - 1);
      } else {
        setShowMentionList(false);
      }
    }

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
    focus: () => textareaRef.current?.focus(),
  }))

  function handleKeyDown(e) {
    if (showMentionList && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(prev => (prev + 1) % filteredMembers.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        insertMention(filteredMembers[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMentionList(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function insertMention(member) {
    if (!member) return;
    const textBefore = text.slice(0, mentionCursorPos);
    // cursor position at the end of what they typed for the mention search
    const textAfter = text.slice(textareaRef.current.selectionStart);
    const newText = textBefore + `@${member.fullName} ` + textAfter;
    
    setText(newText);
    setShowMentionList(false);
    
    if (!selectedMentions.find(m => m._id === member._id)) {
      setSelectedMentions(prev => [...prev, member]);
    }
    
    // Focus back and adjust cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = mentionCursorPos + member.fullName.length + 2;
        textareaRef.current.setSelectionRange(newPos, newPos);
        adjustHeight();
      }
    }, 0);
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

    // Filter mentions that are still present in text
    const finalMentions = selectedMentions.filter(m => trimmed.includes(`@${m.fullName}`))
    const mentionIds = finalMentions.map(m => m._id)

    onSend(trimmed || '', imageBase64 || null, fileData || null, mentionIds)
    setText('')
    clearImage()
    clearFile()
    setSelectedMentions([])
    setShowMentionList(false)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }
  }

  const canSend = (text.trim() || imageBase64 || fileData) && !disabled
  const hasAttachment = imagePreview || fileData

  return (
    <div className="message-input" style={{ position: 'relative' }}>
      {showMentionList && filteredMembers.length > 0 && (
        <div ref={mentionListRef} className="mention-dropdown" style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '8px',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
          maxHeight: '200px',
          overflowY: 'auto',
          width: '250px',
          zIndex: 100,
          marginBottom: '8px'
        }}>
          {filteredMembers.map((member, index) => (
            <div 
              key={member._id}
              className={`mention-item ${index === mentionIndex ? 'mention-item--active' : ''}`}
              onClick={() => insertMention(member)}
              onMouseEnter={() => setMentionIndex(index)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: index === mentionIndex ? 'var(--color-hover-bg)' : 'transparent',
                borderBottom: '1px solid var(--color-border-subtle)'
              }}
            >
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {member.avatar ? (
                  <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-primary)' }}>{member.fullName[0]}</span>
                )}
              </div>
              <span style={{ fontSize: '14px', color: 'var(--color-text)', fontWeight: 500 }}>{member.fullName}</span>
            </div>
          ))}
        </div>
      )}
      {showVoiceRecorder && (
        <div className="message-input__voice-recorder-popup">
          <VoiceRecorder
            onSend={(audioData) => {
              if (onSendAudio) onSendAudio(audioData)
              setShowVoiceRecorder(false)
            }}
            onClose={() => setShowVoiceRecorder(false)}
          />
        </div>
      )}
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
          className={`message-input__action-btn tooltip-wrapper ${showVoiceRecorder ? 'message-input__action-btn--active' : ''}`}
          onClick={() => setShowVoiceRecorder(v => !v)}
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
              if (onSendLike) onSendLike(likeEmoji)
            }}
            disabled={disabled}
            title="Gửi like"
          >
            {(() => {
              const Icon = LIKE_ICONS[likeEmoji] || ThumbsUp
              return <Icon size={20} />
            })()}
          </button>
        )}
      </div>
    </div>
  )
})

export default MessageInput
