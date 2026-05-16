import { useLang } from '../../context/LangContext'

function TypingIndicator({ userName }) {
  const { t } = useLang()

  return (
    <div className="typing-indicator">
      <div className="typing-indicator__dots">
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
      </div>
      <span className="typing-indicator__text">
        {userName ? `${userName} ${t('chat.typing')}` : t('chat.typing')}
      </span>
    </div>
  )
}

export default TypingIndicator
