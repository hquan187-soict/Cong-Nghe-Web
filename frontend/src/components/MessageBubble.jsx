import { Check, Clock, AlertCircle } from 'lucide-react'

/**
 * Format thời gian: T4 6/5 02:06
 * Chủ nhật = CN, các ngày khác = T2~T7
 */
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

/**
 * MessageBubble — Hiển thị một tin nhắn
 * Props:
 *   - message: { _id, text, image?, createdAt, status? }
 *   - isOwn: boolean — tin của mình hay người khác
 *
 * status: 'sending' | 'sent' | 'error' | undefined (mặc định = sent)
 */
function MessageBubble({ message, isOwn }) {
  const time = formatTime(message.createdAt)
  const status = message.status || 'sent'

  return (
    <div className={`message-bubble-row ${isOwn ? 'message-bubble-row--own' : ''}`}>
      <div
        className={`message-bubble ${isOwn ? 'message-bubble--own' : 'message-bubble--other'} ${
          status === 'sending' ? 'message-bubble--sending' : ''
        }`}
      >
        {message.image && (
          <img src={message.image} alt="attachment" className="message-bubble__image" />
        )}
        {message.text && <p className="message-bubble__text">{message.text}</p>}
        <div className="message-bubble__footer">
          <span className="message-bubble__time">{time}</span>
          {/* Chỉ hiện status icon cho tin nhắn của mình */}
          {isOwn && (
            <span className={`message-bubble__status message-bubble__status--${status}`}>
              {status === 'sending' && <Clock size={12} />}
              {status === 'sent' && <Check size={12} />}
              {status === 'error' && <AlertCircle size={12} />}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default MessageBubble
