import { useState, useMemo } from 'react'
import { Lock, Pin } from 'lucide-react'
import PollDetailModal from './PollDetailModal'
import Avatar from '../ui/Avatar'
import { messageService } from '../../services/message.service'

function formatDeadline(deadline) {
  if (!deadline) return null
  const d = new Date(deadline)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${hh}:${mm} ngày ${dd}/${mo}`
}

export default function PollBubble({ message, currentUserId, conversation, isGroup }) {
  const [showDetail, setShowDetail] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const poll = message.poll

  const handleTogglePin = async (e) => {
    e.stopPropagation()
    if (pinLoading) return
    setPinLoading(true)
    try {
      await messageService.togglePinMessage(message._id)
    } catch {
    } finally {
      setPinLoading(false)
    }
  }

  const totalVotesCount = useMemo(() => {
    return poll.options.reduce((sum, opt) => sum + opt.voters.length, 0)
  }, [poll])

  const userVotedOptionIds = useMemo(() => {
    const ids = new Set()
    poll.options.forEach(opt => {
      opt.voters.forEach(v => {
        const vid = typeof v === 'object' ? v._id : v
        if (vid?.toString() === currentUserId) ids.add(opt._id)
      })
    })
    return ids
  }, [poll, currentUserId])

  const hasVoted = userVotedOptionIds.size > 0
  const isExpired = poll.deadline && new Date(poll.deadline) <= new Date()
  const isClosed = poll.isClosed || isExpired
  const isLocked = hasVoted && !poll.allowChange

  const getNickname = (userId) => {
    const id = typeof userId === 'object' ? userId._id : userId
    return conversation?.nicknames?.[id?.toString()] || null
  }

  return (
    <>
      <div className="poll-bubble-centered" style={{ position: 'relative' }}>
        {isGroup && (
          <button
            className={`poll-bubble-centered__pin-btn ${message.isPinned ? 'poll-bubble-centered__pin-btn--active' : ''}`}
            onClick={handleTogglePin}
            disabled={pinLoading}
            title={message.isPinned ? 'Bỏ ghim' : 'Ghim bình chọn'}
          >
            <Pin size={14} />
          </button>
        )}
        <div className="poll-bubble-centered__question">{poll.question}</div>

        {poll.deadline && (
          <div className="poll-bubble-centered__deadline">
            {isClosed ? 'Đã kết thúc' : `Kéo dài đến ${formatDeadline(poll.deadline)}`}
          </div>
        )}

        <div className="poll-bubble-centered__options">
          {poll.options.map(opt => {
            const pct = totalVotesCount > 0
              ? Math.round((opt.voters.length / totalVotesCount) * 100)
              : 0
            const voters = opt.voters || []

            return (
              <div key={opt._id} className="poll-bubble-centered__option">
                <div className="poll-bubble-centered__option-row">
                  <span className="poll-bubble-centered__option-text">{opt.text}</span>
                  {voters.length > 0 && (
                    <div className="poll-bubble-centered__voters-inline">
                      {voters.slice(0, 2).map((voter, vi) => {
                        const v = typeof voter === 'object' ? voter : { _id: voter }
                        const displayName = getNickname(v._id) || v.fullName || 'Người dùng'
                        return (
                          <div
                            key={v._id || vi}
                            className="poll-bubble-centered__voter-avatar"
                            style={{ zIndex: 5 - vi }}
                            title={displayName}
                          >
                            <Avatar src={v.avatar} alt={displayName} size="sm" />
                          </div>
                        )
                      })}
                      {voters.length > 2 && (
                        <span className="poll-bubble-centered__voters-count">+{voters.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="poll-bubble-centered__bar-track">
                  <div
                    className={`poll-bubble-centered__bar-fill ${pct > 0 ? 'poll-bubble-centered__bar-fill--active' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {!poll.allowChange && (
          <div className="poll-bubble-centered__lock-tag">
            <Lock size={10} /> Khóa lựa chọn
          </div>
        )}

        <button
          className="poll-bubble-centered__action-btn"
          onClick={() => setShowDetail(true)}
        >
          {isClosed
            ? 'Xem kết quả'
            : isLocked
              ? 'Xem bình chọn'
              : hasVoted
                ? 'Thay đổi bình chọn'
                : 'Bình chọn'}
        </button>
      </div>

      {showDetail && (
        <PollDetailModal
          message={message}
          currentUserId={currentUserId}
          conversation={conversation}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  )
}
