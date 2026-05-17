import { useLang } from '../../context/LangContext'

function TypingIndicator({ senderName, userName }) {
  const { t } = useLang()
  const name = senderName || userName

  return (
    <div className="typing-indicator">
      <div className="typing-indicator__dots">
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
      </div>

      <span className="typing-indicator__text">
        {name ? `${name} ${t('chat.typing')}` : t('chat.typing')}
      </span>
    </div>
  )
}

export default TypingIndicator
      </span>
    </div>
  )
}

export default TypingIndicator
