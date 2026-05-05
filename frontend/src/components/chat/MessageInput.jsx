import { useState, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'
import { useLang } from '../../context/LangContext'

/**
 * MessageInput — textarea auto-resize với Enter gửi, Shift+Enter xuống dòng
 * Props:
 *   - onSend(text): callback khi gửi tin nhắn
 *   - disabled: boolean — vô hiệu hóa khi đang xử lý
 */
function MessageInput({ onSend, disabled = false }) {
  const { t } = useLang()
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  // Auto-resize textarea theo nội dung (tối đa 120px)
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  function handleChange(e) {
    setText(e.target.value)
    adjustHeight()
  }

  function handleKeyDown(e) {
    // Enter (không Shift) → gửi tin
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    // Shift+Enter → xuống dòng (mặc định của textarea)
  }

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return

    onSend(trimmed)
    setText('')

    // Reset height sau khi gửi
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  return (
    <div className="message-input">
      <textarea
        ref={textareaRef}
        className="message-input__textarea"
        placeholder={t('chat.inputPlaceholder')}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
      <button
        type="button"
        className="message-input__send-btn"
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        title={t('chat.send')}
      >
        <Send size={18} />
      </button>
    </div>
  )
}

export default MessageInput
