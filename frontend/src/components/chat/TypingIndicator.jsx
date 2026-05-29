import { useLang } from '../../context/LangContext'

function TypingIndicator({ typingUsers = [], senderName }) {
  const { t } = useLang()

  let text = ''
  if (typingUsers.length > 0) {
    if (typingUsers.length === 1) {
      text = `${typingUsers[0]} ${t('chat.typing')}`
    } else if (typingUsers.length === 2) {
      text = `${typingUsers[0]}, ${typingUsers[1]} ${t('chat.typing')}`
    } else {
      text = `${typingUsers[0]}, ${typingUsers[1]} và ${typingUsers.length - 2} người khác ${t('chat.typing')}`
    }
  } else if (senderName) {
    text = `${senderName} ${t('chat.typing')}`
  } else {
    text = t('chat.typing')
  }

  return (
    <div className="typing-indicator">
      <div className="typing-indicator__dots">
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
      </div>

      <span className="typing-indicator__text">
        {text}
      </span>
    </div>
  )
}

export default TypingIndicator
