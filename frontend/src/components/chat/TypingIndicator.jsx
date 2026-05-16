/**
TypingIndicator — Hiển thị trạng thái "đang soạn tin..." với 3 chấm nhảy
 */
const TypingIndicator = ({ senderName }) => {
  return (
    <div className="typing-indicator">
      <div className="typing-indicator__dots">
        <span className="typing-indicator__dot"></span>
        <span className="typing-indicator__dot"></span>
        <span className="typing-indicator__dot"></span>
      </div>
      <span className="typing-indicator__text">
        {senderName ? `${senderName} đang soạn tin...` : 'Đang soạn tin...'}
      </span>
    </div>
  )
}

export default TypingIndicator
