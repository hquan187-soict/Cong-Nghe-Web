import { BarChart2, X } from 'lucide-react'

export default function PinnedPollBar({ pinnedPolls, onClickPoll, onUnpin }) {
  if (!pinnedPolls || pinnedPolls.length === 0) return null

  const poll = pinnedPolls[0]
  const question = poll.poll?.question || poll.text || 'Bình chọn'

  return (
    <div className="pinned-poll-bar" onClick={() => onClickPoll(poll._id)}>
      <div className="pinned-poll-bar__content">
        <BarChart2 size={14} className="pinned-poll-bar__icon" />
        <span className="pinned-poll-bar__text">{question}</span>
      </div>
      {onUnpin && (
        <button
          className="pinned-poll-bar__close"
          onClick={e => {
            e.stopPropagation()
            onUnpin(poll._id)
          }}
          title="Bỏ ghim"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
