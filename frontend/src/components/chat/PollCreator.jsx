import { useState } from 'react'
import { useLang } from '../../context/LangContext'
import { X, Trash2, Plus, Loader2 } from 'lucide-react'
import { messageService } from '../../services/message.service'
import { useToast } from '../../context/ToastContext'

export default function PollCreator({ conversationId, onClose, onCreated }) {
  const toast = useToast()
  const { t } = useLang()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [allowChange, setAllowChange] = useState(true)
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [useDeadline, setUseDeadline] = useState(false)
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [sending, setSending] = useState(false)

  const validOptions = options.filter(o => o.trim().length > 0)
  const canSubmit = question.trim().length > 0 && validOptions.length >= 2 && !sending

  const handleAddOption = () => {
    setOptions(prev => [...prev, ''])
  }

  const handleRemoveOption = (index) => {
    if (options.length <= 2) return
    setOptions(prev => prev.filter((_, i) => i !== index))
  }

  const handleOptionChange = (index, value) => {
    setOptions(prev => prev.map((o, i) => i === index ? value : o))
  }

  const handleSubmit = async () => {
    if (!canSubmit) return

    let deadline = null
    if (useDeadline && deadlineDate) {
      const timeStr = deadlineTime || '23:59'
      const dt = new Date(`${deadlineDate}T${timeStr}:00`)
      if (isNaN(dt.getTime())) {
        toast.error(t('poll.invalidDeadline'))
        return
      }
      if (dt <= new Date()) {
        toast.error(t('poll.deadlineFuture'))
        return
      }
      deadline = dt.toISOString()
    }

    setSending(true)
    try {
      const result = await messageService.createPoll({
        conversationId,
        question: question.trim(),
        options: options.filter(o => o.trim().length > 0),
        allowMultiple,
        allowChange,
        deadline,
      })
      if (onCreated) onCreated(result)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi tạo bình chọn.')
    } finally {
      setSending(false)
    }
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="poll-creator">
      <div className="poll-creator__header">
        <span className="poll-creator__title">{t('poll.createTitle')}</span>
        <button className="poll-creator__close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="poll-creator__body">
        <input
          type="text"
          className="poll-creator__question"
          placeholder={t('poll.questionPlaceholder')}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          maxLength={500}
          autoFocus
        />

        <div className="poll-creator__divider" />

        <div className="poll-creator__options-scroll">
          {options.map((opt, i) => (
            <div key={i} className="poll-creator__option-row">
              <input
                type="text"
                className="poll-creator__option-input"
                placeholder={`${t('poll.optionPlaceholder')} ${i + 1}`}
                value={opt}
                onChange={e => handleOptionChange(i, e.target.value)}
                maxLength={200}
              />
              {options.length > 2 && (
                <button
                  className="poll-creator__option-remove"
                  onClick={() => handleRemoveOption(i)}
                  title={t('poll.removeOption')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <button className="poll-creator__add-option" onClick={handleAddOption}>
            <Plus size={14} />
            <span>{t('poll.addOption')}</span>
          </button>
        </div>

        <div className="poll-creator__divider" />

        <div className="poll-creator__settings">
          <div className="poll-creator__setting-row">
            <span className="poll-creator__setting-label">{t('poll.noChangeLabel')}</span>
            <label className="poll-creator__toggle">
              <input
                type="checkbox"
                checked={!allowChange}
                onChange={e => setAllowChange(!e.target.checked)}
              />
              <span className="poll-creator__toggle-track" />
            </label>
          </div>
          <div className="poll-creator__setting-row">
            <span className="poll-creator__setting-label">{t('poll.multipleLabel')}</span>
            <label className="poll-creator__toggle">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={e => setAllowMultiple(e.target.checked)}
              />
              <span className="poll-creator__toggle-track" />
            </label>
          </div>
        </div>

        <div className="poll-creator__divider" />

        <div className="poll-creator__deadline-section">
          <div className="poll-creator__setting-row">
            <span className="poll-creator__setting-label">{t('poll.deadlineLabel')}</span>
            <label className="poll-creator__toggle">
              <input
                type="checkbox"
                checked={useDeadline}
                onChange={e => setUseDeadline(e.target.checked)}
              />
              <span className="poll-creator__toggle-track" />
            </label>
          </div>
          {useDeadline && (
            <div className="poll-creator__deadline-inputs">
              <input
                type="date"
                className="poll-creator__deadline-input"
                value={deadlineDate}
                onChange={e => setDeadlineDate(e.target.value)}
                min={todayStr}
              />
              <input
                type="time"
                className="poll-creator__deadline-input"
                value={deadlineTime}
                onChange={e => setDeadlineTime(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="poll-creator__footer">
        <button
          className="poll-creator__submit"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {sending && <Loader2 size={14} className="animate-spin" />}
          Xác nhận tạo cuộc bình chọn
        </button>
      </div>
    </div>
  )
}
