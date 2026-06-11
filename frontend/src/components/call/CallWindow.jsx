import { useEffect, useRef, useMemo, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2, MonitorUp, MonitorOff, Volume2, VolumeX } from 'lucide-react'
import { useCall } from '../../context/CallContext'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import { useToast } from '../../context/ToastContext'
import '../../styles/call.css'

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function FallbackAvatar({ src, alt, className }) {
  if (src) return <img src={src} alt={alt} className={className} />
  const initial = (alt || '?').charAt(0).toUpperCase()
  return (
    <div className={`${className} bg-indigo-100 flex items-center justify-center text-indigo-500 font-bold`} style={{ fontSize: '1.5em' }}>
      {initial}
    </div>
  )
}

// Audio sink ẩn cho remote stream — đảm bảo audio luôn phát kể cả khi
// không render <video> (gọi thoại, hoặc đối phương tắt camera)
function RemoteAudio({ stream }) {
  const audioRef = useRef(null)

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream
      audioRef.current.play().catch(() => {})
    }
  }, [stream])

  return <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
}

function VideoTile({ stream, muted, label, isLocal, avatarUrl, videoEnabled, isScreen }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream, videoEnabled, isScreen])

  const hasLiveVideo = !!stream && stream.getVideoTracks().some((t) => t.readyState === 'live')
  const showVideo = hasLiveVideo && videoEnabled !== false

  return (
    <div className={`call-window__video-tile ${isLocal ? 'call-window__video-tile--local' : ''} ${isScreen ? 'call-window__video-tile--screen' : ''}`}>
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
          <FallbackAvatar
            src={avatarUrl}
            alt={label || '?'}
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
    isScreenSharing,
    isScreenAudioEnabled,
    remoteScreenSharerId,
    toggleScreenShare,
    toggleScreenAudio,
    closeCallWindow,
    videoUpgradeStatus,
    upgradeRequesterName,
    acceptVideoUpgrade,
    rejectVideoUpgrade,
  } = useCall()

  const { user } = useAuth()
  const { t } = useLang()
  const toast = useToast()

  useEffect(() => {
    if (videoUpgradeStatus === 'rejected') {
      toast.error(t('call.rejectedVideo') || 'Đối phương đã từ chối bật video')
    }
  }, [videoUpgradeStatus, toast, t])

  const handleToggleVideo = async () => {
    if (activeCall?.callType === 'voice' && activeCall?.isGroup) {
      toast.error(t('call.groupVideoDisabled') || 'Tính năng này chỉ hỗ trợ gọi 1-1. Trong nhóm vui lòng gọi lại cuộc gọi video mới.')
      return
    }
    toggleVideo()
  }

  const renderUpgradeOverlay = () => {
    if (videoUpgradeStatus === 'requesting') {
      return (
        <div className="call-window__upgrade-overlay">
          <span>{t('call.waitingAccept') || 'Đang chờ đối phương chấp nhận...'}</span>
        </div>
      )
    }
    if (videoUpgradeStatus === 'incoming') {
      const msg = (t('call.upgradeRequest') || '{name} muốn chuyển sang cuộc gọi Video').replace('{name}', upgradeRequesterName || (t('call.unknownUser') || 'Người dùng'))
      return (
        <div className="call-window__upgrade-overlay call-window__upgrade-overlay--incoming">
          <span>{msg}</span>
          <div className="call-window__upgrade-actions">
            <button className="call-window__upgrade-btn call-window__upgrade-btn--accept" onClick={acceptVideoUpgrade}>{t('call.accept') || 'Chấp nhận'}</button>
            <button className="call-window__upgrade-btn call-window__upgrade-btn--reject" onClick={rejectVideoUpgrade}>{t('call.reject') || 'Từ chối'}</button>
          </div>
        </div>
      )
    }
    return null
  }

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

  if (activeCall.status === 'ended') {
    let title = t('call.ended') || 'Cuộc gọi đã kết thúc'
    if (activeCall.endReason === 'all_rejected' || activeCall.endReason === 'rejected') {
      title = t('call.rejected') || 'Đã bị từ chối'
    } else if (activeCall.endReason === 'no_answer') {
      title = t('call.noAnswer') || 'Không trả lời'
    }

    return (
      <div
        className={`call-window call-window--ended ${isExpanded ? 'call-window--expanded' : 'call-window--floating'}`}
        style={!isExpanded ? { right: `${position.x}px`, top: `${position.y}px` } : {}}
      >
        <div className="call-window__ended-content">
          <div className="call-window__ended-icon">
            <PhoneOff size={48} color="#ef4444" />
          </div>
          <h3 className="call-window__ended-title">{title}</h3>
          <p className="call-window__ended-duration">{formatDuration(callDuration)}</p>
          <button className="call-window__ended-close-btn" onClick={closeCallWindow}>
            {t('call.close') || 'Đóng'}
          </button>
        </div>
      </div>
    )
  }

  const isVideo = activeCall.callType === 'video'
  const remoteEntries = Array.from(remoteStreams.entries())
  const isGroupCall = remoteEntries.length > 1
  const participantCount = remoteEntries.length + 1

  // Chia sẻ màn hình chỉ khả dụng trên desktop (mobile không hỗ trợ getDisplayMedia)
  const canScreenShare = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getDisplayMedia === 'function'

  // Ai đang chia sẻ màn hình? Ưu tiên người khác (remote), sau đó tới mình
  const sharerId = remoteScreenSharerId && remoteStreams.has(remoteScreenSharerId)
    ? remoteScreenSharerId
    : (isScreenSharing ? 'local' : null)

  // Khi có người share, luôn hiển thị vùng video (kể cả cuộc gọi thoại)
  const showVideoArea = isVideo || sharerId !== null

  const gridClass = participantCount <= 2
    ? 'call-window__grid--duo'
    : participantCount <= 4
      ? 'call-window__grid--quad'
      : 'call-window__grid--many'

  const renderSpotlight = () => {
    const isLocalSharer = sharerId === 'local'
    const mainStream = isLocalSharer ? localStream : remoteStreams.get(sharerId)
    const sharerInfo = isLocalSharer ? null : participantInfo.get(sharerId)
    const badgeText = isLocalSharer
      ? (t('call.youAreSharing') || 'Bạn đang chia sẻ màn hình')
      : `${sharerInfo?.fullName || ''} ${t('call.sharingScreen') || 'đang chia sẻ màn hình'}`

    const stripEntries = remoteEntries.filter(([uid]) => uid !== sharerId)

    return (
      <div className="call-window__spotlight">
        <div className="call-window__spotlight-main">
          <VideoTile
            stream={mainStream}
            muted={true}
            label=""
            isLocal={false}
            avatarUrl={isLocalSharer ? user?.avatar : sharerInfo?.avatar}
            videoEnabled={true}
            isScreen={true}
          />
          <div className="call-window__share-badge">
            <MonitorUp size={14} />
            <span>{badgeText}</span>
          </div>
        </div>

        <div className="call-window__spotlight-strip">
          {stripEntries.map(([userId, stream]) => {
            const media = participantMedia.get(userId)
            const info = participantInfo.get(userId)
            return (
              <VideoTile
                key={userId}
                stream={stream}
                muted={true}
                label={info?.fullName || ''}
                isLocal={false}
                avatarUrl={info?.avatar}
                videoEnabled={media?.video !== false}
              />
            )
          })}

          {!isLocalSharer && (
            <VideoTile
              stream={localStream}
              muted={true}
              label=""
              isLocal={false}
              avatarUrl={user?.avatar}
              videoEnabled={isVideoEnabled}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`call-window ${isVideo ? 'call-window--video' : 'call-window--voice'} ${isExpanded ? 'call-window--expanded' : 'call-window--floating'}`}
      style={!isExpanded ? { right: `${position.x}px`, top: `${position.y}px` } : {}}
    >
      {/* Audio sink ẩn — luôn render để audio không phụ thuộc layout */}
      {remoteEntries.map(([userId, stream]) => (
        <RemoteAudio key={userId} stream={stream} />
      ))}

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
              : (Array.from(participantInfo.values()).map(p => p.fullName).filter(Boolean).join(', ') || activeCall.conversationName || '')}
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


      {renderUpgradeOverlay()}

      {showVideoArea ? (
        sharerId ? renderSpotlight() : (
          <div className={`call-window__grid ${gridClass}`}>
            {remoteEntries.map(([userId, stream]) => {
              const media = participantMedia.get(userId)
              const info = participantInfo.get(userId)
              return (
                <VideoTile
                  key={userId}
                  stream={stream}
                  muted={true}
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
        )
      ) : (
        <div className="call-window__voice-ui">
          {remoteEntries.length === 0 ? (
            <div className="call-window__voice-single">
              <div className="call-window__voice-avatar-wrap">
                <div className="call-window__voice-pulse" />
                <FallbackAvatar
                  src={Array.from(participantInfo.values())[0]?.avatar || activeCall.conversationAvatar}
                  alt={Array.from(participantInfo.values())[0]?.fullName || activeCall.conversationName || '?'}
                  className="call-window__voice-avatar"
                />
              </div>
              <span className="call-window__voice-name">
                {Array.from(participantInfo.values())[0]?.fullName || activeCall.conversationName || ''}
              </span>
              <span className="call-window__voice-status">{statusText}</span>
            </div>
          ) : (
            <div className="call-window__voice-participants">
              {remoteEntries.map(([userId]) => {
                const info = participantInfo.get(userId)
                return (
                  <div key={userId} className="call-window__voice-participant">
                    <FallbackAvatar
                      src={info?.avatar}
                      alt={info?.fullName || '?'}
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

        <button
          className={`call-window__control-btn ${!isVideoEnabled ? 'call-window__control-btn--off' : ''}`}
          onClick={handleToggleVideo}
          disabled={isScreenSharing}
          title={isScreenSharing
            ? (t('call.stopShareFirst') || 'Dừng chia sẻ màn hình trước')
            : (isVideoEnabled ? t('call.cameraOff') : t('call.cameraOn'))}
        >
          {isVideoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
        </button>

        {canScreenShare && isVideo && (
          <button
            className={`call-window__control-btn ${isScreenSharing ? 'call-window__control-btn--active' : ''}`}
            onClick={toggleScreenShare}
            disabled={!!remoteScreenSharerId}
            title={remoteScreenSharerId
              ? (t('call.someoneSharing') || 'Người khác đang chia sẻ màn hình')
              : (isScreenSharing ? t('call.stopShare') : t('call.shareScreen'))}
          >
            {isScreenSharing ? <MonitorOff size={22} /> : <MonitorUp size={22} />}
          </button>
        )}

        {isScreenSharing && (
          <button
            className={`call-window__control-btn ${!isScreenAudioEnabled ? 'call-window__control-btn--off' : 'call-window__control-btn--active'}`}
            onClick={toggleScreenAudio}
            title={isScreenAudioEnabled ? (t('call.screenAudioOff') || 'Tắt âm thanh màn hình') : (t('call.screenAudioOn') || 'Bật âm thanh màn hình')}
          >
            {isScreenAudioEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
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
