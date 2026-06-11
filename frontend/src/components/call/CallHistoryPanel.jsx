import { useState, useEffect, useCallback, useRef } from 'react'
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff } from 'lucide-react'
import { callService } from '../../services/call.service'
import { useAuth } from '../../context/AuthContext'
import { useCall } from '../../context/CallContext'
import { useLang } from '../../context/LangContext'
import '../../styles/call-history.css'

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function formatCallTime(dateStr, t) {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `${t('call.today')} ${time}`
  if (isYesterday) return `${t('call.yesterday')} ${time}`
  return `${date.toLocaleDateString()} ${time}`
}

export default function CallHistoryPanel({ onSelectConversation, collapsed }) {
  const { user } = useAuth()
  const { initiateCall } = useCall()
  const { t } = useLang()

  const [calls, setCalls] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const listRef = useRef(null)
  const fetchedRef = useRef(false)

  const fetchHistory = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setIsLoading(true)
      else setLoadingMore(true)
      setError(null)

      const data = await callService.getCallHistory(pageNum, 20)
      const newCalls = data.calls || []

      if (append) {
        setCalls((prev) => [...prev, ...newCalls])
      } else {
        setCalls(newCalls)
      }
      setHasMore(data.pagination?.hasMore || false)
      setPage(pageNum)
    } catch (err) {
      console.error('Failed to load call history:', err)
      setError(t('call.loadError'))
    } finally {
      setIsLoading(false)
      setLoadingMore(false)
    }
  }, [t])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchHistory(1)
  }, [fetchHistory])

  const handleScroll = useCallback(() => {
    if (!listRef.current || loadingMore || !hasMore) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    if (scrollHeight - scrollTop - clientHeight < 100) {
      fetchHistory(page + 1, true)
    }
  }, [loadingMore, hasMore, page, fetchHistory])

  const handleItemClick = useCallback((call) => {
    if (call.conversationId) {
      onSelectConversation?.({ _id: call.conversationId })
    }
  }, [onSelectConversation])

  const handleCallBack = useCallback(async (e, call) => {
    e.stopPropagation()
    if (call.conversationId) {
      await initiateCall(call.conversationId, call.callType || 'voice')
    }
  }, [initiateCall])

  const currentUserId = user?._id?.toString()

  const getCallStatus = (call) => {
    const isCaller = call.isCaller ?? (call.caller?._id?.toString() === currentUserId)

    if (call.status === 'ended' && call.endReason === 'all_rejected') {
      if (isCaller) return { type: 'rejected', label: t('call.rejectedCall') }
      return { type: 'rejected', label: t('call.rejectedCall') }
    }

    if (call.status === 'ended' && call.endReason === 'no_answer') {
      if (isCaller) return { type: 'missed', label: t('call.noAnswer') }
      return { type: 'missed', label: t('call.missedCall') }
    }

    if (call.participantStatus === 'missed' || call.participantStatus === 'ringing') {
      return { type: 'missed', label: t('call.missedCall') }
    }

    if (call.participantStatus === 'rejected') {
      return { type: 'rejected', label: t('call.rejectedCall') }
    }

    if (isCaller) return { type: 'outgoing', label: t('call.outgoingCall') }
    return { type: 'incoming', label: t('call.incomingCall') }
  }

  if (collapsed) {
    return (
      <div className="call-history call-history--collapsed">
        <div className="call-history__list" ref={listRef} onScroll={handleScroll}>
          {isLoading && (
            <div className="call-history__loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="call-history__skeleton">
                  <div className="call-history__skeleton-avatar" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && calls.map((call) => {
            const isCaller = call.isCaller ?? (call.caller?._id?.toString() === currentUserId)
            const otherUser = isCaller ? call.callee : call.caller
            const status = getCallStatus(call)
            const isMissed = status.type === 'missed' || status.type === 'rejected'
            return (
              <button
                key={call._id}
                className={`call-history__item-collapsed ${isMissed ? 'call-history__item--missed' : ''}`}
                onClick={() => handleItemClick(call)}
                title={`${otherUser?.fullName || ''} — ${status.label}`}
              >
                <div className="call-history__avatar-wrap">
                  <img
                    src={otherUser?.avatar || '/default_avatar/avatar_1.png'}
                    alt={otherUser?.fullName || ''}
                    className="call-history__avatar"
                  />
                  <span className={`call-history__type-icon call-history__type-icon--${status.type}`}>
                    {call.callType === 'video' ? <Video size={10} /> : <Phone size={10} />}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="call-history">
      <div className="call-history__list" ref={listRef} onScroll={handleScroll}>
        {isLoading && (
          <div className="call-history__loading">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="call-history__skeleton">
                <div className="call-history__skeleton-avatar" />
                <div className="call-history__skeleton-content">
                  <div className="call-history__skeleton-line call-history__skeleton-line--short" />
                  <div className="call-history__skeleton-line call-history__skeleton-line--long" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="call-history__error">
            <p>{error}</p>
            <button onClick={() => fetchHistory(1)} className="call-history__retry-btn">
              {t('call.callBack')}
            </button>
          </div>
        )}

        {!isLoading && !error && calls.length === 0 && (
          <div className="call-history__empty">
            <Phone size={40} className="call-history__empty-icon" />
            <p className="call-history__empty-title">{t('call.noHistory')}</p>
          </div>
        )}

        {!isLoading && !error && calls.map((call) => {
          const isCaller = call.isCaller ?? (call.caller?._id?.toString() === currentUserId)
          const otherUser = isCaller ? call.callee : call.caller
          const status = getCallStatus(call)
          const isMissed = status.type === 'missed' || status.type === 'rejected'
          const duration = formatDuration(call.duration)

          return (
            <div
              key={call._id}
              className={`call-history__item ${isMissed ? 'call-history__item--missed' : ''}`}
              onClick={() => handleItemClick(call)}
            >
              <div className="call-history__avatar-wrap">
                <img
                  src={otherUser?.avatar || '/default_avatar/avatar_1.png'}
                  alt={otherUser?.fullName || ''}
                  className="call-history__avatar"
                />
              </div>

              <div className="call-history__info">
                <span className={`call-history__name ${isMissed ? 'call-history__name--missed' : ''}`}>
                  {otherUser?.fullName || t('chat.unknownUser')}
                </span>
                <div className="call-history__meta">
                  <span className={`call-history__direction-icon call-history__direction-icon--${status.type}`}>
                    {status.type === 'outgoing' && <PhoneOutgoing size={13} />}
                    {status.type === 'incoming' && <PhoneIncoming size={13} />}
                    {status.type === 'missed' && <PhoneMissed size={13} />}
                    {status.type === 'rejected' && <PhoneOff size={13} />}
                  </span>
                  <span className={`call-history__status ${isMissed ? 'call-history__status--missed' : ''}`}>
                    {status.label}
                  </span>
                  {duration && <span className="call-history__duration">({duration})</span>}
                </div>
              </div>

              <div className="call-history__right">
                <span className="call-history__time">{formatCallTime(call.createdAt, t)}</span>
                <button
                  className="call-history__callback-btn"
                  onClick={(e) => handleCallBack(e, call)}
                  title={t('call.callBack')}
                >
                  {call.callType === 'video' ? <Video size={18} /> : <Phone size={18} />}
                </button>
              </div>
            </div>
          )
        })}

        {loadingMore && (
          <div className="call-history__loading-more">
            <div className="call-history__spinner" />
          </div>
        )}
      </div>
    </div>
  )
}
