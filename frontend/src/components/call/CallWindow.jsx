import { useEffect, useRef, useMemo, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2 } from 'lucide-react'
import { useCall } from '../../context/CallContext'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import '../../styles/call.css'

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function VideoTile({ stream, muted, label, isLocal, avatarUrl, videoEnabled }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream, videoEnabled])

  const showVideo = stream && videoEnabled !== false

  return (
    <div className={`call-window__video-tile ${isLocal ? 'call-window__video-tile--local' : ''}`}>
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="call-window__video-element"
        />
      ) : (
        <div className="call-window__video-placeholder">
          <img
            src={avatarUrl || '/default-avatar.png'}
            alt={label}
            className="call-window__placeholder-avatar"
          />
        </div>
      )}
      {label && !isLocal && (
        <span className="call-window__video-label">{label}</span>
      )}
    </div>
  )
}

export default function CallWindow() {
  const {
    activeCall,
    isAudioEnabled,
    isVideoEnabled,
    localStream,
    remoteStreams,
    callDuration,
    participantMedia,
    participantInfo,
    endCall,
    toggleAudio,
    toggleVideo,
  } = useCall()

  const { user } = useAuth()
  const { t } = useLang()

  const [isExpanded, setIsExpanded] = useState(false)
  const [position, setPosition] = useState({ x: 24, y: 80 }) // default top-right
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 })

  const handlePointerDown = (e) => {
    if (isExpanded) return
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    }
    e.target.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!dragRef.current.isDragging || isExpanded) return
    const dx = dragRef.current.startX - e.clientX // reversed for 'right' positioning
    const dy = e.clientY - dragRef.current.startY // normal for 'top' positioning
    setPosition({ x: dragRef.current.initialX + dx, y: dragRef.current.initialY + dy })
  }

  const handlePointerUp = (e) => {
    dragRef.current.isDragging = false
    e.target.releasePointerCapture(e.pointerId)
  }

  const toggleExpand = () => setIsExpanded(!isExpanded)

  const statusText = useMemo(() => {
    if (!activeCall) return ''
    switch (activeCall.status) {
      case 'ringing': return t('call.ringing')
      case 'connecting': return t('call.connecting')
      case 'ongoing': return formatDuration(callDuration)
      default: return ''
    }
  }, [activeCall, callDuration, t])

  if (!activeCall) return null

  const isVideo = activeCall.callType === 'video'
  const remoteEntries = Array.from(remoteStreams.entries())
  const isGroupCall = remoteEntries.length > 1
  const participantCount = remoteEntries.length + 1

  const gridClass = participantCount <= 2
    ? 'call-window__grid--duo'
    : participantCount <= 4
      ? 'call-window__grid--quad'
      : 'call-window__grid--many'

  return (
    <div 
      className={`call-window ${isVideo ? 'call-window--video' : 'call-window--voice'} ${isExpanded ? 'call-window--expanded' : 'call-window--floating'}`}
      style={!isExpanded ? { right: `${position.x}px`, top: `${position.y}px` } : {}}
    >
      <div 
        className="call-window__header"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="call-window__header-info">
          <span className="call-window__header-name">
            {activeCall.isGroup
              ? (activeCall.conversationName || t('call.groupCall') || 'Cuộc gọi nhóm')
              : (Array.from(participantInfo.values()).map(p => p.fullName).filter(Boolean).join(', ') || '')}
          </span>
          <span className="call-window__timer">{statusText}</span>
        </div>
        <button 
          className="call-window__expand-btn"
          onClick={toggleExpand}
          onPointerDown={(e) => e.stopPropagation()}
          title={isExpanded ? (t('call.minimize') || 'Thu nhỏ') : (t('call.maximize') || 'Phóng to')}
        >
          {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>


      {isVideo ? (
        <div className={`call-window__grid ${gridClass}`}>
          {remoteEntries.map(([userId, stream]) => {
            const media = participantMedia.get(userId)
            const info = participantInfo.get(userId)
            return (
              <VideoTile
                key={userId}
                stream={stream}
                muted={false}
                label={info?.fullName || ''}
                isLocal={false}
                avatarUrl={info?.avatar}
                videoEnabled={media?.video !== false}
              />
            )
          })}

          <VideoTile
            stream={localStream}
            muted={true}
            label={t('call.you') || ''}
            isLocal={!isGroupCall}
            avatarUrl={user?.avatar}
            videoEnabled={isVideoEnabled}
          />

          {remoteEntries.length === 0 && (
            <div className="call-window__waiting">
              <div className="call-window__waiting-pulse" />
              <span>{statusText}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="call-window__voice-ui">
          {remoteEntries.length === 0 ? (
            <div className="call-window__voice-single">
              <div className="call-window__voice-avatar-wrap">
                <div className="call-window__voice-pulse" />
                <img
                  src={Array.from(participantInfo.values())[0]?.avatar || '/default-avatar.png'}
                  alt=""
                  className="call-window__voice-avatar"
                />
              </div>
              <span className="call-window__voice-name">
                {Array.from(participantInfo.values())[0]?.fullName || ''}
              </span>
              <span className="call-window__voice-status">{statusText}</span>
            </div>
          ) : (
            <div className="call-window__voice-participants">
              {remoteEntries.map(([userId]) => {
                const info = participantInfo.get(userId)
                return (
                  <div key={userId} className="call-window__voice-participant">
                    <img
                      src={info?.avatar || '/default-avatar.png'}
                      alt={info?.fullName || ''}
                      className="call-window__voice-avatar"
                    />
                    <span className="call-window__voice-participant-name">
                      {info?.fullName || ''}
                    </span>
                  </div>
                )
              })}
              <span className="call-window__voice-status">{statusText}</span>
            </div>
          )}
        </div>
      )}

      <div className="call-window__controls">
        <button
          className={`call-window__control-btn ${!isAudioEnabled ? 'call-window__control-btn--off' : ''}`}
          onClick={toggleAudio}
          title={isAudioEnabled ? t('call.mute') : t('call.unmute')}
        >
          {isAudioEnabled ? <Mic size={22} /> : <MicOff size={22} />}
        </button>

        {isVideo && (
          <button
            className={`call-window__control-btn ${!isVideoEnabled ? 'call-window__control-btn--off' : ''}`}
            onClick={toggleVideo}
            title={isVideoEnabled ? t('call.cameraOff') : t('call.cameraOn')}
          >
            {isVideoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
          </button>
        )}

        <button
          className="call-window__control-btn call-window__control-btn--end"
          onClick={endCall}
          title={t('call.endCall')}
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  )
}
