import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLang } from '../../context/LangContext'
import { X, Loader2, Lock, AlertCircle, Plus } from 'lucide-react'
import { messageService } from '../../services/message.service'
import { useToast } from '../../context/ToastContext'
import Avatar from '../ui/Avatar'

function formatDeadline(deadline) {
  if (!deadline) return null
  const d = new Date(deadline)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${hh}:${mm} ngày ${dd}/${mo}`
}

export default function PollDetailModal({ message, currentUserId, conversation, onClose }) {
  const toast = useToast()
  const { t } = useLang()
  const [poll, setPoll] = useState(message.poll)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [newOptionText, setNewOptionText] = useState('')
  const [addingOption, setAddingOption] = useState(false)

  const senderId = typeof message.senderId === 'object' ? message.senderId?._id : message.senderId
  const isCreator = senderId?.toString() === currentUserId

  useEffect(() => {
    let cancelled = false
    messageService.getPollDetail(message._id)
      .then(res => {
        if (cancelled) return
        const data = res?.poll || res?.data?.poll || (res?.messageType === 'poll' ? res.poll : null)
        if (data) setPoll(data)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [message._id])

  const isExpired = poll.deadline && new Date(poll.deadline) <= new Date()
  const isClosed = poll.isClosed || isExpired

  const userVotedOptionIds = useMemo(() => {
    const ids = new Set()
    poll.options.forEach(opt => {
      (opt.voters || []).forEach(v => {
        const vid = typeof v === 'object' ? v._id : v
        if (vid?.toString() === currentUserId) ids.add(opt._id)
      })
    })
    return ids
  }, [poll, currentUserId])

  const hasVoted = userVotedOptionIds.size > 0
  const isLocked = hasVoted && !poll.allowChange
  const isDisabled = isClosed || isLocked

  useEffect(() => {
    setSelectedIds(new Set(userVotedOptionIds))
  }, [userVotedOptionIds])

  const totalVotesCount = useMemo(() => {
    return poll.options.reduce((sum, opt) => sum + (opt.voters?.length || 0), 0)
  }, [poll])

  const handleToggleOption = useCallback((optId) => {
    if (isDisabled) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (poll.allowMultiple) {
        if (next.has(optId)) next.delete(optId)
        else next.add(optId)
      } else {
        next.clear()
        next.add(optId)
      }
      return next
    })
  }, [isDisabled, poll.allowMultiple])

  const handleSubmit = async () => {
    if (selectedIds.size === 0 || isDisabled) return
    setSubmitting(true)
    try {
      const res = await messageService.votePoll(message._id, Array.from(selectedIds))
      const updated = res?.poll || res?.data?.poll
      if (updated) setPoll(updated)
      toast.success(t('poll.voteSuccess'))
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddOption = async () => {
    if (!newOptionText.trim() || addingOption) return
    setAddingOption(true)
    try {
      const res = await messageService.addPollOption(message._id, newOptionText.trim())
      const updated = res?.poll || res?.data?.poll
      if (updated) setPoll(updated)
      setNewOptionText('')
      toast.success(t('poll.addOptionSuccess'))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra.')
    } finally {
      setAddingOption(false)
    }
  }

  const getNickname = (userId) => {
    const id = typeof userId === 'object' ? userId._id : userId
    return conversation?.nicknames?.[id?.toString()] || null
  }

  return (
    <div className="poll-detail-overlay" onClick={onClose}>
      <div className="poll-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="poll-detail-modal__header">
          <span className="poll-detail-modal__title">{t('poll.title')}</span>
          <button className="poll-detail-modal__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="poll-detail-modal__body">
          <h3 className="poll-detail-modal__question">{poll.question}</h3>

          {poll.deadline && (
            <div className="poll-detail-modal__deadline">
              {isClosed
                ? t('poll.pollEnded')
                : `${t('poll.pollExtendsUntil')} ${formatDeadline(poll.deadline)}`}
            </div>
          )}

          {isLocked && (
            <div className="poll-detail-modal__locked-notice">
              <Lock size={12} />
              <span>{t('poll.lockedNotice')}</span>
            </div>
          )}

          {isClosed && !isLocked && (
            <div className="poll-detail-modal__locked-notice">
              <AlertCircle size={12} />
              <span>{t('poll.closedNotice')}</span>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
          ) : (
            <div className="poll-detail-modal__options">
              {poll.options.map(opt => {
                const pct = totalVotesCount > 0
                  ? Math.round((opt.voters.length / totalVotesCount) * 100)
                  : 0
                const isSelected = selectedIds.has(opt._id)
                const voters = opt.voters || []

                return (
                  <div
                    key={opt._id}
                    className={`poll-detail-modal__option ${isSelected ? 'poll-detail-modal__option--selected' : ''} ${isDisabled ? 'poll-detail-modal__option--disabled' : ''}`}
                    onClick={() => handleToggleOption(opt._id)}
                  >
                    <div className="poll-detail-modal__option-top">
                      <div className="poll-detail-modal__option-radio">
                        {poll.allowMultiple ? (
                          <div className={`poll-detail-modal__checkbox ${isSelected ? 'poll-detail-modal__checkbox--checked' : ''}`}>
                            {isSelected && <span>&#10003;</span>}
                          </div>
                        ) : (
                          <div className={`poll-detail-modal__radio ${isSelected ? 'poll-detail-modal__radio--checked' : ''}`}>
                            {isSelected && <div className="poll-detail-modal__radio-dot" />}
                          </div>
                        )}
                      </div>
                      <span className="poll-detail-modal__option-text">{opt.text}</span>
                      <span className="poll-detail-modal__option-pct">{pct}% ({voters.length})</span>
                    </div>

                    <div className="poll-detail-modal__bar-track">
                      <div
                        className={`poll-detail-modal__bar-fill ${isSelected ? 'poll-detail-modal__bar-fill--selected' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {voters.length > 0 && (
                      <div className="poll-detail-modal__voters">
                        {voters.slice(0, 8).map((voter, vi) => {
                          const v = typeof voter === 'object' ? voter : { _id: voter }
                          const nickname = getNickname(v._id)
                          const displayName = nickname || v.fullName || t('msg.unknownUser')
                          return (
                            <div
                              key={v._id || vi}
                              className="poll-detail-modal__voter"
                              style={{ zIndex: 10 - vi }}
                              title={displayName}
                            >
                              <Avatar src={v.avatar} alt={displayName} size="sm" />
                            </div>
                          )
                        })}
                        {voters.length > 8 && (
                          <span className="poll-detail-modal__voters-more">+{voters.length - 8}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {isCreator && !isClosed && (
            <div className="poll-detail-modal__add-option">
              <input
                type="text"
                className="poll-detail-modal__add-option-input"
                placeholder={t('poll.addNewPlaceholder')}
                value={newOptionText}
                onChange={e => setNewOptionText(e.target.value)}
                maxLength={200}
                onKeyDown={e => { if (e.key === 'Enter') handleAddOption() }}
              />
              <button
                className="poll-detail-modal__add-option-btn"
                onClick={handleAddOption}
                disabled={!newOptionText.trim() || addingOption}
              >
                {addingOption ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </div>
          )}

          <div className="poll-detail-modal__info-tags">
            <span>{poll.allowMultiple ? t('poll.multiTag') : t('poll.singleTag')}</span>
            <span>·</span>
            <span>{poll.allowChange ? t('poll.changeable') : t('poll.lockedTag')}</span>
          </div>
        </div>

        {!isDisabled && (
          <div className="poll-detail-modal__footer">
            <button
              className="poll-detail-modal__submit"
              onClick={handleSubmit}
              disabled={selectedIds.size === 0 || submitting}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Xác nhận
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
