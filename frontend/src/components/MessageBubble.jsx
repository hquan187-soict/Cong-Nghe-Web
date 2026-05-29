import { useState, useRef, useEffect } from 'react'
import {
  Check, CheckCheck, Clock, AlertCircle, FileText, Download,
  MoreHorizontal, Reply, Smile, Trash2, Edit3, Flag, X,
  Pin, Forward, ThumbsUp, Heart, Flame, Star, Coffee, Zap, Sun, Moon, Music, Leaf,
  Phone, Video, PhoneOff, PhoneMissed
} from 'lucide-react'

const LIKE_ICONS = {
  ThumbsUp, Heart, Smile, Flame, Star, Coffee, Zap, Sun, Moon, Music, Leaf,
}
import Avatar from './ui/Avatar'
import AudioPlayer from './chat/AudioPlayer'
import ImageLightbox from './chat/ImageLightbox'
import { messageService } from '../services/message.service'

/**
 * Kiểm tra URL an toàn: chặn javascript: và data:text/html scheme
 * React tự escape JSX text (đã an toàn), nhưng href/src cần validate.
 */
const isSafeUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.trim().toLowerCase();
  if (lower.startsWith('javascript:')) return false;
  if (lower.startsWith('data:text/html')) return false;
  return true;
};

function formatTime(dateInput) {
  const date = new Date(dateInput)
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  const dayLabel = days[date.getDay()]
  const d = date.getDate()
  const m = date.getMonth() + 1
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${dayLabel} ${d}/${m} ${hh}:${mm}`
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function renderTextWithMentions(text, mentions, mentionAll) {
  if (!text) return text;
  
  const names = mentions ? mentions.map(m => typeof m === 'object' ? m.fullName : null).filter(Boolean) : [];
  if (mentionAll) {
    names.push('Mọi người');
  }
  
  if (names.length === 0) return text;

  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(@(?:${names.map(escapeRegExp).join('|')}))`, 'g');

  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (part.startsWith('@') && names.some(name => part === `@${name}`)) {
      return <span key={i} className="mention-highlight" style={{ fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '0 2px', borderRadius: '4px' }}>{part}</span>;
    }
    return part;
  });
}

const STATUS_LABELS = {
  sending: 'Đang gửi',
  sent: 'Đã gửi',
  read: 'Đã xem',
  error: 'Lỗi gửi',
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡']

function ReactionDetailModal({ reactions, onClose, onRemoveReaction, isKicked }) {
  const [activeTab, setActiveTab] = useState('all')

  const grouped = {}
  reactions.forEach(r => {
    if (!grouped[r.emoji]) grouped[r.emoji] = []
    grouped[r.emoji].push(r)
  })

  const displayReactions = activeTab === 'all' ? reactions : (grouped[activeTab] || [])

  return (
    <div className="recall-modal__overlay" onClick={onClose}>
      <div className="recall-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px' }}>
        <div className="recall-modal__header">
          <h3>Cảm xúc về tin nhắn</h3>
          <button className="recall-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '4px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer',
              background: activeTab === 'all' ? 'var(--color-primary-light)' : 'transparent',
              color: activeTab === 'all' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: 600, fontSize: '13px'
            }}
          >
            Tất cả {reactions.length}
          </button>
          {Object.entries(grouped).map(([emoji, users]) => (
            <button
              key={emoji}
              onClick={() => setActiveTab(emoji)}
              style={{
                padding: '4px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                background: activeTab === emoji ? 'var(--color-primary-light)' : 'transparent',
                color: activeTab === emoji ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              {emoji} {users.length}
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 16px', maxHeight: '300px', overflowY: 'auto' }}>
          {displayReactions.map((r, i) => {
            const userName = typeof r.userId === 'object' ? r.userId?.fullName : null
            const userAvatar = typeof r.userId === 'object' ? r.userId?.avatar : null
            const userId = typeof r.userId === 'object' ? r.userId?._id : r.userId
            return (
              <div key={`${userId}-${r.emoji}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0',
                borderBottom: '1px solid var(--color-border-subtle)'
              }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', background: 'var(--color-hover-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {userAvatar ? (
                    <img src={userAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      {(userName || '?')[0]}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
                    {userName || 'Người dùng'}
                  </div>
                  {!isKicked && (
                    <div
                      style={{ fontSize: '12px', color: 'var(--color-primary)', cursor: 'pointer' }}
                      onClick={() => onRemoveReaction(r.emoji)}
                    >
                      Nhấp để gỡ
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '24px' }}>{r.emoji}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, isOwn, showAvatar = true, showName = false, senderAvatar, senderName, isKicked = false, isMentioned = false, deleteMessage, onReply, scrollContainerRef, onAvatarClick }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showRecallModal, setShowRecallModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [recallOption, setRecallOption] = useState('me')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReactionDetail, setShowReactionDetail] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message.text || '')
  const [editLoading, setEditLoading] = useState(false)
  const [dropdownUp, setDropdownUp] = useState(false)
  const reactions = message.reactions || []
  const moreMenuRef = useRef(null)
  const emojiPickerRef = useRef(null)

  const time = formatTime(message.createdAt)
  const status = message.status || 'sent'
  const file = message.file
  const isRecalled = message.isRecalled;
  const isEdited = message.isEdited;
  const isLikeMessage = message.messageType === 'like'

  useEffect(() => {
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false)
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false)
      }
    }
    if (showMoreMenu || showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMoreMenu, showEmojiPicker])

  const handleReply = () => {
    if (onReply) onReply(message)
    setShowMoreMenu(false)
  }

  const handleSelectEmoji = async (emoji) => {
    if (isKicked) return
    setShowEmojiPicker(false)
    try {
      await messageService.toggleReaction(message._id, emoji)
    } catch (err) {
      console.error('Toggle reaction error:', err)
    }
  }

  const handleRecall = () => {
    setShowMoreMenu(false)
    if (isOwn) {
      setShowRecallModal(true)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const handleConfirmRecall = async () => {
    try {
      const type = recallOption === 'all' ? 'all' : 'me'
      await messageService.deleteMessage(message._id, type)
      if (type === 'me') {
        deleteMessage(message._id)
        window.dispatchEvent(new CustomEvent('localMessageDeleted', { detail: message._id }))
      }
      setShowRecallModal(false)
    } catch (err) {
      console.error('Recall message error:', err)
      setShowRecallModal(false)
    }
  }

  const handleConfirmDelete = async () => {
    try {
      await messageService.deleteMessage(message._id, 'me')
      deleteMessage(message._id)
      window.dispatchEvent(new CustomEvent('localMessageDeleted', { detail: message._id }))
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error('Delete message error:', err)
      setShowDeleteConfirm(false)
    }
  }

  const handleEdit = () => {
    setEditText(message.text || '')
    setIsEditing(true)
    setShowMoreMenu(false)
  }

  const handleEditCancel = () => {
    setIsEditing(false)
    setEditText(message.text || '')
  }

  const handleEditSave = async () => {
    if (!editText.trim() || editText === message.text) {
      setIsEditing(false)
      return
    }
    setEditLoading(true)
    try {
      await messageService.editMessage(message._id, editText.trim())
      setIsEditing(false)
    } catch (err) {
      console.error('Edit message error:', err)
    } finally {
      setEditLoading(false)
      setIsEditing(false)
    }
  }

  const handleTogglePin = async () => {
    setShowMoreMenu(false)
    try {
      await messageService.togglePinMessage(message._id)
    } catch (err) {
      console.error('Toggle pin error:', err)
    }
  }

  const handleReport = () => {
    console.log('[MessageBubble] Report clicked, messageId:', message._id)
    setShowMoreMenu(false)
  }

  const actionButtons = !isRecalled && !isKicked && (
    <div className={`message-actions ${isOwn ? 'message-actions--own' : 'message-actions--other'}`}>
      <div className="message-actions__emoji-wrapper" ref={emojiPickerRef}>
        <button className="message-actions__btn" onClick={() => setShowEmojiPicker((v) => !v)} title="Bày tỏ cảm xúc">
          <Smile size={16} />
        </button>
        {showEmojiPicker && (
          <div className={`message-actions__emoji-picker ${isOwn ? 'message-actions__emoji-picker--own' : ''}`}>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className="message-actions__emoji-btn"
                onClick={() => handleSelectEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="message-actions__btn" onClick={handleReply} title="Trả lời">
        <Reply size={16} />
      </button>
      <div className="message-actions__more-wrapper" ref={moreMenuRef}>
        <button
          className="message-actions__btn"
          onClick={(e) => {
            setShowMoreMenu((v) => {
              if (!v) {
                const btn = e.currentTarget
                const container = scrollContainerRef?.current
                if (btn && container) {
                  const btnRect = btn.getBoundingClientRect()
                  const containerRect = container.getBoundingClientRect()
                  const spaceBelow = containerRect.bottom - btnRect.bottom
                  setDropdownUp(spaceBelow < 200)
                } else {
                  setDropdownUp(false)
                }
              }
              return !v
            })
          }}
          title="Xem thêm"
        >
          <MoreHorizontal size={16} />
        </button>
        {showMoreMenu && (
          <div className={`message-actions__dropdown ${isOwn ? 'message-actions__dropdown--own' : ''} ${dropdownUp ? 'message-actions__dropdown--up' : ''}`}>
            <button className="message-actions__dropdown-item" onClick={handleTogglePin}>
              <Pin size={14} />
              <span>{message.isPinned ? 'Bỏ ghim' : 'Ghim tin nhắn'}</span>
            </button>
            <button className="message-actions__dropdown-item" onClick={handleRecall}>
              <Trash2 size={14} />
              <span>{isOwn ? 'Thu hồi tin nhắn' : 'Xóa tin nhắn'}</span>
            </button>
            {isOwn && !isLikeMessage && !isRecalled && (((new Date() - new Date(message.createdAt))) < 15 * 60 * 1000) && (
              <button className="message-actions__dropdown-item" onClick={handleEdit}>
                <Edit3 size={14} />
                <span>Sửa tin nhắn</span>
              </button>
            )}
            <button className="message-actions__dropdown-item" onClick={handleReport}>
              <Flag size={14} />
              <span>Báo cáo</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )

  const renderMessageContent = () => {
    if (isRecalled) {
      return (
        <p className="message-bubble__text message-bubble--recalled" style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
          Tin nhắn đã bị thu hồi
        </p>
      )
    }

    if (isLikeMessage) {
      const LikeIcon = LIKE_ICONS[message.text] || ThumbsUp
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
          <LikeIcon size={48} color="var(--color-primary)" strokeWidth={1.5} />
        </div>
      )
    }

    if (message.messageType === 'call' && message.callInfo) {
      const ci = message.callInfo
      const isMissed = ci.status === 'missed' || ci.status === 'no_answer'
      const isRejected = ci.status === 'rejected'
      const CallIcon = isMissed || isRejected
        ? PhoneMissed
        : ci.callType === 'video' ? Video : Phone
      const iconColor = isMissed || isRejected ? '#ef4444' : 'var(--color-primary)'

      let label = ''
      if (isMissed) label = ci.callType === 'video' ? 'Cuộc gọi video nhỡ' : 'Cuộc gọi nhỡ'
      else if (isRejected) label = 'Cuộc gọi bị từ chối'
      else {
        const mins = Math.floor((ci.duration || 0) / 60)
        const secs = (ci.duration || 0) % 60
        const dur = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        label = `${ci.callType === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'} - ${dur}`
      }

      return (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
          color: 'var(--color-text-muted)', fontSize: 14,
        }}>
          <CallIcon size={20} color={iconColor} />
          <span>{label}</span>
        </div>
      )
    }

    if (isEditing) {
      return (
        <div className="message-bubble__edit-box">
          <textarea
            className="message-bubble__edit-input"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={2}
            autoFocus
            disabled={editLoading}
            style={{ width: '100%', resize: 'vertical', borderRadius: 6, padding: 8, fontSize: 15, border: '1px solid #ccc', background: '#fff' , color: '#333' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="message-bubble__edit-btn" onClick={handleEditSave} disabled={editLoading || !editText.trim() || editText === message.text} style={{ background: '#3c8ccd', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 16px', fontWeight: 600 }}>
              Lưu
            </button>
            <button className="message-bubble__edit-btn" onClick={handleEditCancel} disabled={editLoading} style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 4, padding: '4px 16px', fontWeight: 600 }}>
              Hủy
            </button>
          </div>
        </div>
      )
    }

    const isVideoFile = file && file.type && file.type.startsWith('video/')
    const isAudioType = message.messageType === 'audio'
    const isGenericFile = file && !isVideoFile && !isAudioType

    const replyPreviewText = () => {
      if (!message.replyTo) return ''
      const rt = message.replyTo
      if (rt.messageType === 'like') return 'Đã gửi biểu tượng cảm xúc'
      if (rt.messageType === 'audio') return '🎤 Tin nhắn thoại'
      if (rt.file && rt.file.type && rt.file.type.startsWith('video/')) return '🎬 Đã gửi một video'
      if (rt.text) return rt.text
      if (rt.image) return 'Đã gửi một ảnh'
      if (rt.file) return 'Đã gửi một tệp'
      return ''
    }

    return (
      <>
        {/* Reply preview */}
        {message.replyTo && (
          <div
            className="message-bubble__reply-preview"
            style={{
              fontSize: '12px',
              padding: '6px 8px',
              background: 'var(--color-hover-bg)',
              borderRadius: '4px',
              marginBottom: '4px',
              color: 'var(--color-text-secondary)',
              borderLeft: '3px solid var(--color-primary)',
              cursor: 'pointer'
            }}
            onClick={() => {
              const replyId = typeof message.replyTo === 'object' ? message.replyTo._id : message.replyTo
              const el = document.getElementById(`msg-${replyId}`)
              if (el && scrollContainerRef?.current) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.style.transition = 'background 0.3s'
                el.style.background = 'var(--color-primary-light)'
                setTimeout(() => { el.style.background = '' }, 1500)
              }
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>
              {typeof message.replyTo?.senderId === 'object'
                ? message.replyTo.senderId.fullName
                : 'Người dùng'}
            </div>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
              {replyPreviewText()}
            </div>
          </div>
        )}

        {/* 1. Image */}
        {message.image && isSafeUrl(message.image) && (
          <div className="message-bubble__image-wrapper">
            {!imgLoaded && <div className="message-bubble__image-placeholder" />}
            <img
              src={message.image}
              alt="attachment"
              className={`message-bubble__image ${imgLoaded ? '' : 'message-bubble__image--loading'}`}
              onLoad={() => setImgLoaded(true)}
              onClick={() => setLightboxSrc(message.image)}
            />
          </div>
        )}

        {/* 2. Video */}
        {isVideoFile && file.url && isSafeUrl(file.url) && (
          <div className="message-bubble__video-wrapper">
            <video
              className="message-bubble__video"
              src={file.url}
              controls
              preload="metadata"
            />
          </div>
        )}

        {/* 3. Audio */}
        {isAudioType && file && (
          file.url && isSafeUrl(file.url) ? (
            <AudioPlayer src={file.url} duration={file.duration} isOwn={isOwn} />
          ) : (
            <div className={`audio-player ${isOwn ? 'audio-player--own' : 'audio-player--other'}`}>
              <div className="audio-player__play-btn" style={{ opacity: 0.5 }}>
                <Clock size={16} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Đang gửi...</span>
            </div>
          )
        )}

        {/* 4. Generic file (not video, not audio) */}
        {isGenericFile && (file.url || file.name) && (
          file.url && isSafeUrl(file.url) ? (
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`message-bubble__file ${isOwn ? 'message-bubble__file--own' : ''}`}
            >
              <FileText size={28} className="message-bubble__file-icon" />
              <div className="message-bubble__file-info">
                <span className="message-bubble__file-name">{file.name || 'file'}</span>
                {file.size > 0 && (
                  <span className="message-bubble__file-size">{formatFileSize(file.size)}</span>
                )}
              </div>
              <Download size={16} className="message-bubble__file-download" />
            </a>
          ) : (
            <div className={`message-bubble__file ${isOwn ? 'message-bubble__file--own' : ''}`}>
              <FileText size={28} className="message-bubble__file-icon" />
              <div className="message-bubble__file-info">
                <span className="message-bubble__file-name">{file.name || 'file'}</span>
                {file.size > 0 && (
                  <span className="message-bubble__file-size">{formatFileSize(file.size)}</span>
                )}
              </div>
            </div>
          )
        )}

        {/* 5. Text */}
        {message.text && <p className="message-bubble__text" style={{ whiteSpace: 'pre-wrap' }}>{renderTextWithMentions(message.text, message.mentions, message.mentionAll)}</p>}
      </>
    )
  }

  return (
    <>
      {showName && !isOwn && senderName && (
        <div className="message-bubble-sender-name">
          {senderName}
        </div>
      )}
      {message.isPinned && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-muted)', padding: '2px 0', fontStyle: 'italic', justifyContent: isOwn ? 'flex-end' : 'flex-start', paddingLeft: isOwn ? '0' : '52px', paddingRight: isOwn ? '8px' : '0' }}>
          <Pin size={10} /> Tin nhắn đã ghim
        </div>
      )}
      {message.isForwarded && !isRecalled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-muted)', padding: '2px 0', fontStyle: 'italic', justifyContent: isOwn ? 'flex-end' : 'flex-start', paddingLeft: isOwn ? '0' : '52px', paddingRight: isOwn ? '8px' : '0' }}>
          <Forward size={10} /> Đã chuyển tiếp
        </div>
      )}
      <div id={`msg-${message._id}`} className={`message-bubble-row ${isOwn ? 'message-bubble-row--own' : ''} ${isMentioned ? 'message-bubble-row--mentioned' : ''}`}>
        {/* Avatar bên trái (tin nhắn người khác) */}
        {!isOwn && (
          <div
            className={`message-bubble-row__avatar-slot ${onAvatarClick ? 'message-bubble-row__avatar-slot--clickable' : ''}`}
            onClick={() => {
              if (onAvatarClick && showAvatar) {
                const senderId = typeof message.senderId === 'object' ? message.senderId?._id : message.senderId
                if (senderId) onAvatarClick(senderId.toString())
              }
            }}
          >
            {showAvatar && (
              <Avatar src={senderAvatar} alt={senderName || '?'} size="sm" />
            )}
          </div>
        )}
        {isOwn && actionButtons}
        <div
          className={`message-bubble ${isOwn ? 'message-bubble--own' : 'message-bubble--other'} ${
            status === 'sending' ? 'message-bubble--sending' : ''
          } ${isLikeMessage ? 'message-bubble--like' : ''}`}
          style={isLikeMessage ? { background: 'transparent', boxShadow: 'none', padding: '2px 4px' } : undefined}
        >
          {renderMessageContent()}

          <div className="message-bubble__footer" style={isLikeMessage ? { color: 'var(--color-text-muted)' } : undefined}>
            <span className="message-bubble__time" style={isLikeMessage ? { color: 'var(--color-text-muted)' } : undefined}>
              {isEdited && !isRecalled && <span className="message-bubble__edited" style={{ fontStyle: 'italic', marginRight: '4px' }}>(đã chỉnh sửa)</span>}
              {time}
            </span>
            {isOwn && (
              <span
                className={`message-bubble__status message-bubble__status--${status}`}
                title={STATUS_LABELS[status] || ''}
                style={isLikeMessage ? { color: 'var(--color-text-muted)' } : undefined}
              >
                {status === 'sending' && <Clock size={12} />}
                {status === 'sent' && <Check size={12} />}
                {status === 'read' && <CheckCheck size={12} />}
                {status === 'error' && <AlertCircle size={12} />}
              </span>
            )}
          </div>
        </div>
        {!isOwn && actionButtons}
      </div>
      {/* Reactions display — below the bubble row */}
      {!isRecalled && reactions.length > 0 && (() => {
        const grouped = {}
        reactions.forEach(r => {
          if (!grouped[r.emoji]) grouped[r.emoji] = []
          grouped[r.emoji].push(r)
        })
        return (
          <div className={`message-reactions ${isOwn ? 'message-reactions--own' : ''}`}>
            {Object.entries(grouped).map(([emoji, users]) => (
              <span
                key={emoji}
                className="message-reactions__item"
                onClick={() => setShowReactionDetail(true)}
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
              >
                {emoji} {users.length > 1 && <span style={{ fontSize: '11px' }}>{users.length}</span>}
              </span>
            ))}
          </div>
        )
      })()}

      {/* Modal thu hồi tin nhắn (own message) */}
      {showRecallModal && (
        <div className="recall-modal__overlay" onClick={() => setShowRecallModal(false)}>
          <div className="recall-modal" onClick={(e) => e.stopPropagation()}>
            <div className="recall-modal__header">
              <h3>Bạn muốn thu hồi tin nhắn này ở phía ai?</h3>
              <button className="recall-modal__close" onClick={() => setShowRecallModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="recall-modal__body">
              <label className="recall-modal__option">
                <input
                  type="radio"
                  name="recallOption"
                  value="all"
                  checked={recallOption === 'all'}
                  onChange={() => setRecallOption('all')}
                />
                <div className="recall-modal__option-content">
                  <span className="recall-modal__option-title">Thu hồi với mọi người</span>
                  <span className="recall-modal__option-desc">
                    Tin nhắn này sẽ bị thu hồi với mọi người trong đoạn chat. Những người khác có thể đã xem hoặc chuyển tiếp tin nhắn đó. Tin nhắn đã thu hồi vẫn có thể bị báo cáo.
                  </span>
                </div>
              </label>
              <label className="recall-modal__option">
                <input
                  type="radio"
                  name="recallOption"
                  value="me"
                  checked={recallOption === 'me'}
                  onChange={() => setRecallOption('me')}
                />
                <div className="recall-modal__option-content">
                  <span className="recall-modal__option-title">Thu hồi với bạn</span>
                  <span className="recall-modal__option-desc">
                    Tin nhắn này sẽ bị gỡ khỏi thiết bị của bạn, nhưng vẫn hiển thị với các thành viên khác trong đoạn chat.
                  </span>
                </div>
              </label>
            </div>
            <div className="recall-modal__footer">
              <button className="recall-modal__btn recall-modal__btn--cancel" onClick={() => setShowRecallModal(false)}>
                Hủy
              </button>
              <button className="recall-modal__btn recall-modal__btn--confirm" onClick={handleConfirmRecall}>
                Gỡ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa tin nhắn người khác */}
      {showDeleteConfirm && (
        <div className="recall-modal__overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="recall-modal" onClick={(e) => e.stopPropagation()}>
            <div className="recall-modal__header">
              <h3>Xóa tin nhắn này?</h3>
              <button className="recall-modal__close" onClick={() => setShowDeleteConfirm(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="recall-modal__body">
              <p className="recall-modal__confirm-text">
                Tin nhắn này sẽ bị xóa khỏi phía bạn. Các thành viên khác trong đoạn chat vẫn có thể xem được.
              </p>
            </div>
            <div className="recall-modal__footer">
              <button className="recall-modal__btn recall-modal__btn--cancel" onClick={() => setShowDeleteConfirm(false)}>
                Hủy
              </button>
              <button className="recall-modal__btn recall-modal__btn--confirm" onClick={handleConfirmDelete}>
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reaction detail modal */}
      {showReactionDetail && reactions.length > 0 && (
        <ReactionDetailModal
          reactions={reactions}
          onClose={() => setShowReactionDetail(false)}
          onRemoveReaction={(emoji) => handleSelectEmoji(emoji)}
          isKicked={isKicked}
        />
      )}

      {/* Image Lightbox */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="attachment"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  )
}

export default MessageBubble
