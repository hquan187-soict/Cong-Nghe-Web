import { useState, useRef, useEffect } from 'react'
import {
  Check, CheckCheck, Clock, AlertCircle, FileText, Download,
  MoreHorizontal, Reply, Smile, Trash2, Edit3, Flag, X
} from 'lucide-react'
import Avatar from './ui/Avatar'
import { messageService } from '../services/message.service'

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

function MessageBubble({ message, isOwn, showAvatar = true, showName = false, senderAvatar, senderName, isKicked = false }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showRecallModal, setShowRecallModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [recallOption, setRecallOption] = useState('everyone')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReactionDetail, setShowReactionDetail] = useState(false)
  const reactions = message.reactions || []
  const moreMenuRef = useRef(null)
  const emojiPickerRef = useRef(null)

  const time = formatTime(message.createdAt)
  const status = message.status || 'sent'
  const file = message.file
  const isRecalled = message.isRecalled;
  const isEdited = message.isEdited;

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

  const renderMessageContent = () => {
    if (isRecalled) {
      return (
        <p className="message-bubble__text message-bubble--recalled" style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
          Tin nhắn đã bị thu hồi
        </p>
      )
    }

    return (
      <>
        {message.replyTo && (
          <div className="message-bubble__reply-preview" style={{
            fontSize: '12px',
            padding: '6px 8px',
            background: 'var(--color-hover-bg)',
            borderRadius: '4px',
            marginBottom: '4px',
            color: 'var(--color-text-secondary)',
            borderLeft: '3px solid var(--color-primary)'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>{message.replyTo.senderName || 'Người dùng'}</div>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
              {message.replyTo.text || 'Đã gửi một tệp/ảnh'}
            </div>
          </div>
        )}

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
          {renderMessageContent()}

          <div className="message-bubble__footer">
            <span className="message-bubble__time">
              {isEdited && !isRecalled && <span className="message-bubble__edited" style={{ fontStyle: 'italic', marginRight: '4px' }}>(đã chỉnh sửa)</span>}
              {time}
            </span>
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

      {/* Reaction detail modal */}
      {showReactionDetail && reactions.length > 0 && (
        <ReactionDetailModal
          reactions={reactions}
          onClose={() => setShowReactionDetail(false)}
          onRemoveReaction={(emoji) => handleSelectEmoji(emoji)}
          isKicked={isKicked}
        />
      )}
    </>
  )
}

export default MessageBubble
