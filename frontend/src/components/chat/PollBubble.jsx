import { useState, useMemo } from 'react'
import { BarChart2, Lock, Repeat, CheckCircle } from 'lucide-react'
import PollDetailModal from './PollDetailModal'

function formatDeadline(deadline) {
  if (!deadline) return null
  const d = new Date(deadline)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${hh}:${mm} ngày ${dd}/${mo}`
}

export default function PollBubble({ message, currentUserId, isOwn, conversation }) {
  const [showDetail, setShowDetail] = useState(false)
  const poll = message.poll

  const totalVotes = useMemo(() => {
    const voterSet = new Set()
    poll.options.forEach(opt => {
      opt.voters.forEach(v => {
        const vid = typeof v === 'object' ? v._id : v
        voterSet.add(vid?.toString())
      })
    })
    return voterSet.size
  }, [poll])

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

  const isExpired = poll.deadline && new Date(poll.deadline) <= new Date()
  const isClosed = poll.isClosed || isExpired

  return (
    <>
      <div className="poll-bubble" onClick={() => setShowDetail(true)}>
        <div className="poll-bubble__header">
          <BarChart2 size={16} />
          <span className="poll-bubble__question">{poll.question}</span>
        </div>

        {poll.deadline && (
          <div className="poll-bubble__deadline">
            {isClosed ? 'Đã kết thúc' : `Kéo dài đến ${formatDeadline(poll.deadline)}`}
          </div>
        )}

        <div className="poll-bubble__tags">
          <span className="poll-bubble__tag">
            {poll.allowMultiple ? 'Chọn nhiều' : 'Chọn 1'}
          </span>
          {!poll.allowChange && (
            <span className="poll-bubble__tag poll-bubble__tag--lock">
              <Lock size={10} /> Khóa lựa chọn
            </span>
          )}
        </div>

        <div className="poll-bubble__options-preview">
          {poll.options.map(opt => {
            const pct = totalVotesCount > 0
              ? Math.round((opt.voters.length / totalVotesCount) * 100)
              : 0
            const isVoted = userVotedOptionIds.has(opt._id)
            return (
              <div key={opt._id} className="poll-bubble__option">
                <div className="poll-bubble__option-info">
                  {isVoted && <CheckCircle size={12} className="poll-bubble__voted-icon" />}
                  <span className="poll-bubble__option-text">{opt.text}</span>
                  <span className="poll-bubble__option-pct">{pct}%</span>
                </div>
                <div className="poll-bubble__bar-track">
                  <div
                    className={`poll-bubble__bar-fill ${isVoted ? 'poll-bubble__bar-fill--voted' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="poll-bubble__footer-info">
          {totalVotes > 0
            ? `${totalVotes} người đã bình chọn`
            : 'Chưa có ai bình chọn'}
          <span className="poll-bubble__tap-hint"> · Bấm để xem chi tiết</span>
        </div>
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
