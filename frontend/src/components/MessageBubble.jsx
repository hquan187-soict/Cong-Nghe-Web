import { useState, useRef, useEffect } from 'react'
import {
  Check, CheckCheck, Clock, AlertCircle, FileText, Download,
  MoreHorizontal, Reply, Smile, Trash2, Edit3, Flag, X
} from 'lucide-react'
import Avatar from './ui/Avatar'

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

const STATUS_LABELS = {
  sending: 'Đang gửi',
  sent: 'Đã gửi',
  read: 'Đã xem',
  error: 'Lỗi gửi',
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡']

function MessageBubble({ message, isOwn, showAvatar = true, showName = false, senderAvatar, senderName }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showRecallModal, setShowRecallModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [recallOption, setRecallOption] = useState('everyone')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [reactions, setReactions] = useState(message.reactions || [])
  const moreMenuRef = useRef(null)
  const emojiPickerRef = useRef(null)

  const time = formatTime(message.createdAt)
  const status = message.status || 'sent'
  const file = message.file

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
    // TODO: integrate reply
  }

  const handleSelectEmoji = (emoji) => {
    const existing = reactions.find((r) => r.emoji === emoji)
    if (existing) {
      setReactions((prev) => prev.filter((r) => r.emoji !== emoji))
    } else {
      setReactions((prev) => [...prev, { emoji, userId: 'self' }])
    }
    setShowEmojiPicker(false)
    // TODO: emit reaction via socket/API
  }

  const handleRecall = () => {
    setShowMoreMenu(false)
    if (isOwn) {
      setShowRecallModal(true)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const handleConfirmRecall = () => {
    console.log('[MessageBubble] Recall confirmed, messageId:', message._id, 'option:', recallOption)
    setShowRecallModal(false)
  }

  const handleConfirmDelete = () => {
    console.log('[MessageBubble] Delete other\'s message confirmed, messageId:', message._id)
    setShowDeleteConfirm(false)
  }

  const handleEdit = () => {
    console.log('[MessageBubble] Edit clicked, messageId:', message._id)
    setShowMoreMenu(false)
  }

  const handleReport = () => {
    console.log('[MessageBubble] Report clicked, messageId:', message._id)
    setShowMoreMenu(false)
  }

  const actionButtons = (
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
          onClick={() => setShowMoreMenu((v) => !v)}
          title="Xem thêm"
        >
          <MoreHorizontal size={16} />
        </button>
        {showMoreMenu && (
          <div className={`message-actions__dropdown ${isOwn ? 'message-actions__dropdown--own' : ''}`}>
            <button className="message-actions__dropdown-item" onClick={handleRecall}>
              <Trash2 size={14} />
              <span>{isOwn ? 'Thu hồi tin nhắn' : 'Xóa tin nhắn'}</span>
            </button>
            {isOwn && (
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

  return (
    <>
      {showName && !isOwn && senderName && (
        <div className="message-bubble-sender-name">
          {senderName}
        </div>
      )}
      <div className={`message-bubble-row ${isOwn ? 'message-bubble-row--own' : ''}`}>
        {/* Avatar bên trái (tin nhắn người khác) */}
        {!isOwn && (
          <div className="message-bubble-row__avatar-slot">
            {showAvatar && (
              <Avatar src={senderAvatar} alt={senderName || '?'} size="sm" />
            )}
          </div>
        )}
        {isOwn && actionButtons}
        <div
          className={`message-bubble ${isOwn ? 'message-bubble--own' : 'message-bubble--other'} ${
            status === 'sending' ? 'message-bubble--sending' : ''
          }`}
        >
          {message.image && (
            <div className="message-bubble__image-wrapper">
              {!imgLoaded && <div className="message-bubble__image-placeholder" />}
              <img
                src={message.image}
                alt="attachment"
                className={`message-bubble__image ${imgLoaded ? '' : 'message-bubble__image--loading'}`}
                onLoad={() => setImgLoaded(true)}
                onClick={() => window.open(message.image, '_blank')}
              />
            </div>
          )}

          {file && (file.url || file.name) && (
            file.url ? (
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

          {message.text && <p className="message-bubble__text">{message.text}</p>}

          <div className="message-bubble__footer">
            <span className="message-bubble__time">{time}</span>
            {isOwn && (
              <span
                className={`message-bubble__status message-bubble__status--${status}`}
                title={STATUS_LABELS[status] || ''}
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
      {reactions.length > 0 && (
        <div className={`message-reactions ${isOwn ? 'message-reactions--own' : ''}`}>
          {reactions.map((r, i) => (
            <span key={i} className="message-reactions__item" onClick={() => handleSelectEmoji(r.emoji)}>
              {r.emoji}
            </span>
          ))}
        </div>
      )}

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
                  value="everyone"
                  checked={recallOption === 'everyone'}
                  onChange={() => setRecallOption('everyone')}
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
                  value="self"
                  checked={recallOption === 'self'}
                  onChange={() => setRecallOption('self')}
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
    </>
  )
}

export default MessageBubble
