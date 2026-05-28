import { useEffect, useRef, useMemo } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'
import { useCall } from '../../context/CallContext'
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
  }, [stream])

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
    endCall,
    toggleAudio,
    toggleVideo,
  } = useCall()

  const { t } = useLang()

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
    <div className={`call-window ${isVideo ? 'call-window--video' : 'call-window--voice'}`}>
      <div className="call-window__header">
        <span className="call-window__timer">{statusText}</span>
      </div>

      {isVideo ? (
        <div className={`call-window__grid ${gridClass}`}>
          {remoteEntries.map(([userId, stream]) => {
            const media = participantMedia.get(userId)
            return (
              <VideoTile
                key={userId}
                stream={stream}
                muted={false}
                label=""
                isLocal={false}
                videoEnabled={media?.video !== false}
              />
            )
          })}

          <VideoTile
            stream={localStream}
            muted={true}
            label={t('call.you') || ''}
            isLocal={!isGroupCall}
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
                  src="/default-avatar.png"
                  alt=""
                  className="call-window__voice-avatar"
                />
              </div>
              <span className="call-window__voice-status">{statusText}</span>
            </div>
          ) : (
            <div className="call-window__voice-participants">
              {remoteEntries.map(([userId]) => (
                <div key={userId} className="call-window__voice-participant">
                  <img
                    src="/default-avatar.png"
                    alt=""
                    className="call-window__voice-avatar"
                  />
                </div>
              ))}
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
