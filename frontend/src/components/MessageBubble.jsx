import { useState } from 'react'
import { Check, CheckCheck, Clock, AlertCircle, FileText, Download } from 'lucide-react'

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

function MessageBubble({ message, isOwn }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const time = formatTime(message.createdAt)
  const status = message.status || 'sent'
  const file = message.file

  return (
    <div className={`message-bubble-row ${isOwn ? 'message-bubble-row--own' : ''}`}>
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
    </div>
  )
}

export default MessageBubble
