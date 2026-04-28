function MessageBubble({ message, isOwn }) {
  const time = new Date(message.createdAt).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`message-bubble-row ${isOwn ? 'message-bubble-row--own' : ''}`}>
      <div className={`message-bubble ${isOwn ? 'message-bubble--own' : 'message-bubble--other'}`}>
        {message.image && (
          <img src={message.image} alt="attachment" className="message-bubble__image" />
        )}
        {message.text && <p className="message-bubble__text">{message.text}</p>}
        <span className="message-bubble__time">{time}</span>
      </div>
    </div>
  )
}

export default MessageBubble
