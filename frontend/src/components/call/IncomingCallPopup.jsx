import { Phone, PhoneOff, Video } from 'lucide-react'
import { useCall } from '../../context/CallContext'
import { useLang } from '../../context/LangContext'
import '../../styles/call.css'

function FallbackAvatar({ src, alt, className }) {
  if (src) return <img src={src} alt={alt} className={className} />
  const initial = (alt || '?').charAt(0).toUpperCase()
  return (
    <div className={`${className} bg-indigo-100 flex items-center justify-center text-indigo-500 font-bold`} style={{ fontSize: '1.25em' }}>
      {initial}
    </div>
  )
}

export default function IncomingCallPopup() {
  const { incomingCall, acceptCall, rejectCall } = useCall()
  const { t } = useLang()

  if (!incomingCall) return null

  const { callerName, callerAvatar, callType, isGroup, conversationName } = incomingCall
  const displayName = isGroup ? conversationName || callerName : callerName
  const callLabel = callType === 'video'
    ? (isGroup ? t('call.incomingGroupVideo') : t('call.incomingVideo'))
    : (isGroup ? t('call.incomingGroupVoice') : t('call.incomingVoice'))

  return (
    <div className="incoming-call-popup">
      <div className="incoming-call-popup__avatar-wrap">
        <div className="incoming-call-popup__pulse-ring" />
        <FallbackAvatar
          src={callerAvatar}
          alt={displayName || '?'}
          className="incoming-call-popup__avatar"
        />
        <div className="incoming-call-popup__type-badge">
          {callType === 'video' ? <Video size={14} /> : <Phone size={14} />}
        </div>
      </div>

      <div className="incoming-call-popup__info">
        <span className="incoming-call-popup__name">{displayName}</span>
        <span className="incoming-call-popup__label">{callLabel}</span>
      </div>

      <div className="incoming-call-popup__actions">
        <button
          className="incoming-call-popup__btn incoming-call-popup__btn--reject"
          onClick={rejectCall}
          title={t('call.reject')}
        >
          <PhoneOff size={22} />
        </button>
        <button
          className="incoming-call-popup__btn incoming-call-popup__btn--accept"
          onClick={acceptCall}
          title={t('call.accept')}
        >
          <Phone size={22} />
        </button>
      </div>
    </div>
  )
}
