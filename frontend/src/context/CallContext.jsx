import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import _SimplePeer from 'simple-peer'
const SimplePeer = _SimplePeer.default || _SimplePeer
import { useSocket } from './SocketContext'
import { useAuth } from './AuthContext'
import axiosInstance from '../utils/axios'
import { setRingingStatus } from '../utils/documentTitle'

const CallContext = createContext(null)

const FALLBACK_ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

let cachedIceConfig = null
let iceCacheExpiry = 0

async function getIceServers() {
  if (cachedIceConfig && Date.now() < iceCacheExpiry) return cachedIceConfig
  try {
    const data = await axiosInstance.get('/api/config/webrtc')
    if (data?.iceServers?.length) {
      cachedIceConfig = { iceServers: data.iceServers }
      iceCacheExpiry = Date.now() + 4 * 60 * 60 * 1000
      return cachedIceConfig
    }
  } catch (err) {
    console.error('[CALL-FE] Failed to fetch ICE servers:', err.message)
  }
  return cachedIceConfig || FALLBACK_ICE
}

export function CallProvider({ children }) {
  const { socket } = useSocket()
  const { user } = useAuth()

  const [activeCall, setActiveCall] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStreams, setRemoteStreams] = useState(new Map())
  const [callDuration, setCallDuration] = useState(0)
  const [participantMedia, setParticipantMedia] = useState(new Map())
  const [participantInfo, setParticipantInfo] = useState(new Map())
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isScreenAudioEnabled, setIsScreenAudioEnabled] = useState(false)
  const [videoUpgradeStatus, setVideoUpgradeStatus] = useState(null)
  const [upgradeRequesterName, setUpgradeRequesterName] = useState(null)

  useEffect(() => {
    setRingingStatus(!!incomingCall)
  }, [incomingCall])

  const peersRef = useRef(new Map())
  const pendingPeersRef = useRef(new Set())
  const signalQueueRef = useRef(new Map())
  const localStreamRef = useRef(null)
  const originalStreamRef = useRef(null)
  const screenTrackRef = useRef(null)   // track màn hình đang chia sẻ
  const cameraTrackRef = useRef(null)   // track camera lưu lại để khôi phục sau khi dừng share
  const screenAudioTrackRef = useRef(null)
  const audioContextRef = useRef(null)
  const audioDestinationRef = useRef(null)
  const micSourceRef = useRef(null)
  const screenAudioSourceRef = useRef(null)
  const timerRef = useRef(null)
  const ringtoneRef = useRef(null)
  const dialtoneRef = useRef(null)
  const activeCallRef = useRef(null)
  const ongoingTriggered = useRef(false)
  const socketRef = useRef(null)

  useEffect(() => { socketRef.current = socket }, [socket])
  useEffect(() => { activeCallRef.current = activeCall }, [activeCall])

  function stopAudioRef(ref) {
    if (ref.current) {
      ref.current.pause()
      ref.current.currentTime = 0
      ref.current = null
    }
  }

  function playLoopAudio(ref, src) {
    try {
      const audio = new Audio(src)
      audio.loop = true
      audio.play().catch(() => {})
      ref.current = audio
    } catch {}
  }

  function playSingleAudio(src) {
    try {
      const audio = new Audio(src)
      audio.play().catch(() => {})
    } catch {}
  }

  const cleanupCall = useCallback((endReason = null) => {
    console.log('[CALL-FE] cleanupCall', endReason)
    stopAudioRef(ringtoneRef)
    stopAudioRef(dialtoneRef)

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    ongoingTriggered.current = false

    peersRef.current.forEach((peer) => {
      try { peer.destroy() } catch {}
    })
    peersRef.current = new Map()

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
    originalStreamRef.current = null
    if (screenTrackRef.current) {
      try { screenTrackRef.current.stop() } catch {}
      screenTrackRef.current = null
    }
    if (cameraTrackRef.current) {
      try { cameraTrackRef.current.stop() } catch {}
      cameraTrackRef.current = null
    }

    setLocalStream(null)
    setRemoteStreams(new Map())
    setActiveCall((prev) => {
      if (prev) return { ...prev, status: 'ended', endReason }
      return null
    })
    setIncomingCall(null)
    setIsAudioEnabled(true)
    setIsVideoEnabled(true)
    // Giữ lại callDuration và participantInfo cho màn hình kết thúc
    setParticipantMedia(new Map())
    setIsScreenSharing(false)
    setIsScreenAudioEnabled(false)
    setVideoUpgradeStatus(null)

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    audioDestinationRef.current = null
    micSourceRef.current = null
    screenAudioSourceRef.current = null
    if (screenAudioTrackRef.current) {
      try { screenAudioTrackRef.current.stop() } catch {}
      screenAudioTrackRef.current = null
    }
  }, [])

  function markOngoing() {
    if (ongoingTriggered.current) return
    ongoingTriggered.current = true
    console.log('[CALL-FE] markOngoing -> starting timer')

    stopAudioRef(dialtoneRef)
    stopAudioRef(ringtoneRef)

    setActiveCall((prev) => {
      if (!prev || prev.status === 'ongoing') return prev
      return { ...prev, status: 'ongoing' }
    })

    setCallDuration(0)
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)
  }

  async function createPeerConnection(targetUserId, initiator, stream, callId) {
    const existing = peersRef.current.get(targetUserId)
    if (existing) {
      try { existing.destroy() } catch {}
      peersRef.current.delete(targetUserId)
    }

    console.log(`[CALL-FE] createPeer for ${targetUserId}, initiator=${initiator}`)

    const iceConfig = await getIceServers()
    console.log('[CALL-FE] ICE servers:', iceConfig.iceServers.map(s => s.urls))

    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream,
      config: iceConfig,
    })

    peer.on('signal', (signal) => {
      console.log(`[CALL-FE] peer signal -> ${targetUserId}, type=${signal?.type || 'candidate'}`)
      socketRef.current?.emit('call_signal', { callId, targetUserId, signal })
    })

    peer.on('stream', (remoteStream) => {
      console.log(`[CALL-FE] peer stream received from ${targetUserId}`)
      setRemoteStreams((prev) => {
        const updated = new Map(prev)
        updated.set(targetUserId, remoteStream)
        return updated
      })
      markOngoing()
    })

    peer.on('track', (track, stream) => {
      console.log(`[CALL-FE] peer track received from ${targetUserId}:`, track.kind)
      setRemoteStreams((prev) => {
        const updated = new Map(prev)
        updated.set(targetUserId, new MediaStream(stream.getTracks()))
        return updated
      })
    })

    peer.on('connect', () => {
      console.log(`[CALL-FE] peer connected with ${targetUserId}`)
      markOngoing()
    })

    peer.on('error', (err) => {
      console.error(`[CALL-FE] peer error with ${targetUserId}:`, err.message)
      peersRef.current.delete(targetUserId)
      setRemoteStreams((prev) => {
        const updated = new Map(prev)
        updated.delete(targetUserId)
        return updated
      })
    })

    peer.on('close', () => {
      console.log(`[CALL-FE] peer closed with ${targetUserId}`)
      peersRef.current.delete(targetUserId)
      setRemoteStreams((prev) => {
        const updated = new Map(prev)
        updated.delete(targetUserId)
        return updated
      })
    })

    peersRef.current.set(targetUserId, peer)
    return peer
  }

  const getMediaStream = useCallback(async (callType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    })
    localStreamRef.current = stream
    originalStreamRef.current = stream
    setLocalStream(stream)
    return stream
  }, [])

  const initiateCall = useCallback(async (conversationId, callType, convInfo = {}) => {
    if (!socket || !user || activeCallRef.current) return

    let stream
    try {
      stream = await getMediaStream(callType)
    } catch (err) {
      console.error('[CALL-FE] Media access denied:', err)
      return { success: false, reason: 'media_denied' }
    }

    return new Promise((resolve) => {
      socket.emit('call_initiate', { conversationId, callType }, (response) => {
        console.log('[CALL-FE] call_initiate response:', response)
        if (!response?.success) {
          stream.getTracks().forEach((t) => t.stop())
          localStreamRef.current = null
          setLocalStream(null)
          resolve(response)
          return
        }

        ongoingTriggered.current = false
        setActiveCall({
          callId: response.callId,
          callType,
          conversationId,
          role: 'caller',
          status: 'ringing',
          participants: [],
          conversationName: convInfo.conversationName || null,
          conversationAvatar: convInfo.conversationAvatar || null,
          isGroup: convInfo.isGroup || false,
        })

        setIsVideoEnabled(callType === 'video')
        playLoopAudio(dialtoneRef, '/sounds/dialtone.mp3')
        resolve(response)
      })
    })
  }, [socket, user, getMediaStream])

  const acceptCall = useCallback(async () => {
    if (!socket || !incomingCall) return

    const { callId, callType, conversationId } = incomingCall

    let stream
    try {
      stream = await getMediaStream(callType)
    } catch (err) {
      console.error('[CALL-FE] Media access denied:', err)
      socket.emit('call_reject', { callId })
      cleanupCall()
      return { success: false, reason: 'media_denied' }
    }

    stopAudioRef(ringtoneRef)

    return new Promise((resolve) => {
      socket.emit('call_accept', { callId }, (response) => {
        console.log('[CALL-FE] call_accept response:', response)
        if (!response?.success) {
          stream.getTracks().forEach((t) => t.stop())
          localStreamRef.current = null
          setLocalStream(null)
          cleanupCall()
          resolve(response)
          return
        }

        ongoingTriggered.current = false
        setActiveCall({
          callId,
          callType,
          conversationId,
          role: 'receiver',
          status: 'connecting',
          participants: response.participants || [],
          conversationName: incomingCall.conversationName || null,
          isGroup: incomingCall.isGroup || false,
        })

        setIncomingCall(null)
        setIsVideoEnabled(callType === 'video')
        resolve(response)
      })
    })
  }, [socket, incomingCall, getMediaStream, cleanupCall])

  const rejectCall = useCallback(() => {
    if (!socket || !incomingCall) return
    socket.emit('call_reject', { callId: incomingCall.callId })
    stopAudioRef(ringtoneRef)
    setIncomingCall(null)
  }, [socket, incomingCall])

  const endCall = useCallback(() => {
    if (!socket || !activeCallRef.current) return
    socket.emit('call_end', { callId: activeCallRef.current.callId })
    cleanupCall()
  }, [socket, cleanupCall])

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return
    const track = localStreamRef.current.getAudioTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setIsAudioEnabled(track.enabled)
      socketRef.current?.emit('call_toggle_media', {
        callId: activeCallRef.current?.callId,
        mediaType: 'audio',
        enabled: track.enabled,
      })
    }
  }, [])

  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return
    if (screenTrackRef.current) return // đang chia sẻ màn hình — không thao tác camera

    if (activeCallRef.current?.callType === 'voice') {
      if (activeCallRef.current.isGroup) {
        return // handled in UI via toast
      }
      setVideoUpgradeStatus('requesting')
      socketRef.current?.emit('call_upgrade_request', { callId: activeCallRef.current.callId })
      return
    }

    const oldTrack = localStreamRef.current.getVideoTracks()[0]
    if (!oldTrack) return

    const wasEnabled = oldTrack.enabled

    if (wasEnabled) {
      oldTrack.enabled = false
      oldTrack.stop()
      setIsVideoEnabled(false)
      socketRef.current?.emit('call_toggle_media', {
        callId: activeCallRef.current?.callId,
        mediaType: 'video',
        enabled: false,
      })
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        const newTrack = newStream.getVideoTracks()[0]
        const peerStream = originalStreamRef.current || localStreamRef.current

        peersRef.current.forEach((peer) => {
          if (!peer.destroyed) {
            try { peer.replaceTrack(oldTrack, newTrack, peerStream) } catch (e) {
              console.warn('[CALL-FE] replaceTrack failed, trying removeTrack+addTrack:', e.message)
              try {
                peer.removeTrack(oldTrack, peerStream)
                peer.addTrack(newTrack, peerStream)
              } catch {}
            }
          }
        })

        localStreamRef.current.removeTrack(oldTrack)
        oldTrack.stop()
        localStreamRef.current.addTrack(newTrack)

        setLocalStream(localStreamRef.current)
        setIsVideoEnabled(true)
        socketRef.current?.emit('call_toggle_media', {
          callId: activeCallRef.current?.callId,
          mediaType: 'video',
          enabled: true,
        })
      } catch (err) {
        console.error('[CALL-FE] Failed to re-enable camera:', err)
      }
    }
  }, [])

  const performVideoUpgrade = useCallback(async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      const videoTrack = newStream.getVideoTracks()[0]
      const peerStream = originalStreamRef.current || localStreamRef.current
      
      peersRef.current.forEach((peer) => {
        if (!peer.destroyed) {
          try { peer.addTrack(videoTrack, peerStream) } catch (e) {}
        }
      })
      
      localStreamRef.current.addTrack(videoTrack)
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
      setIsVideoEnabled(true)
      
      setActiveCall(prev => ({ ...prev, callType: 'video' }))
      setVideoUpgradeStatus(null)
      
      socketRef.current?.emit('call_toggle_media', { callId: activeCallRef.current?.callId, mediaType: 'video', enabled: true })
    } catch (err) {
      console.error('[CALL-FE] Failed to perform video upgrade:', err)
      setVideoUpgradeStatus(null)
    }
  }, [])

  const acceptVideoUpgrade = useCallback(async () => {
    if (!activeCallRef.current) return
    socketRef.current?.emit('call_upgrade_accept', { callId: activeCallRef.current.callId })
    await performVideoUpgrade()
  }, [performVideoUpgrade])

  const rejectVideoUpgrade = useCallback(() => {
    if (!activeCallRef.current) return
    setVideoUpgradeStatus(null)
    socketRef.current?.emit('call_upgrade_reject', { callId: activeCallRef.current.callId })
  }, [])

  const closeCallWindow = useCallback(() => {
    setActiveCall(null)
    setCallDuration(0)
    setParticipantInfo(new Map())
  }, [])

  const toggleScreenAudio = useCallback(() => {
    setIsScreenAudioEnabled((prev) => {
      const nextState = !prev
      if (nextState) {
        if (!screenAudioTrackRef.current) {
          console.warn('[CALL-FE] No screen audio track found')
          return false
        }
        
        const peerStream = originalStreamRef.current || localStreamRef.current
        const currentMicTrack = peerStream.getAudioTracks()[0]
        
        if (!audioContextRef.current) {
          try {
            const AudioContext = window.AudioContext || window.webkitAudioContext
            const audioCtx = new AudioContext()
            audioContextRef.current = audioCtx
            const dest = audioCtx.createMediaStreamDestination()
            audioDestinationRef.current = dest
            
            if (currentMicTrack) {
              const micStream = new MediaStream([currentMicTrack])
              const micSource = audioCtx.createMediaStreamSource(micStream)
              micSource.connect(dest)
              micSourceRef.current = micSource
            }
            
            const screenStream = new MediaStream([screenAudioTrackRef.current])
            const screenSource = audioCtx.createMediaStreamSource(screenStream)
            screenSource.connect(dest)
            screenAudioSourceRef.current = screenSource
            
            const mixedAudioTrack = dest.stream.getAudioTracks()[0]
            
            peersRef.current.forEach((peer) => {
              if (!peer.destroyed && currentMicTrack && mixedAudioTrack) {
                try { peer.replaceTrack(currentMicTrack, mixedAudioTrack, peerStream) } catch (e) {
                  console.warn('[CALL-FE] toggleScreenAudio replaceTrack error:', e.message)
                }
              }
            })
          } catch (e) {
            console.error('[CALL-FE] Failed to mix audio:', e)
            return false
          }
        } else {
          if (screenAudioSourceRef.current && audioDestinationRef.current) {
            try {
              screenAudioSourceRef.current.connect(audioDestinationRef.current)
            } catch (e) {}
          }
        }
        return true
      } else {
        if (screenAudioSourceRef.current && audioDestinationRef.current) {
          try {
            screenAudioSourceRef.current.disconnect(audioDestinationRef.current)
          } catch (e) {}
        }
        return false
      }
    })
  }, [])

  // ============ SCREEN SHARE ============

  // ID của người KHÁC đang chia sẻ màn hình (giới hạn: 1 người share tại 1 thời điểm)
  let remoteScreenSharerId = null
  for (const [uid, media] of participantMedia.entries()) {
    if (media.screen) {
      remoteScreenSharerId = uid
      break
    }
  }

  const stopScreenShare = useCallback(async () => {
    const peerStream = originalStreamRef.current || localStreamRef.current
    const screenTrack = screenTrackRef.current
    if (!screenTrack || !peerStream || !localStreamRef.current) {
      setIsScreenSharing(false)
      return
    }

    console.log('[CALL-FE] stopScreenShare')

    // Chỉ khôi phục camera nếu trước khi share camera đang bật (track còn sống)
    let restoreTrack = cameraTrackRef.current
    if (!restoreTrack || restoreTrack.readyState !== 'live') {
      restoreTrack = null
    }

    peersRef.current.forEach((peer) => {
      if (peer.destroyed) return
      try {
        if (restoreTrack) {
          peer.replaceTrack(screenTrack, restoreTrack, peerStream)
        } else {
          peer.removeTrack(screenTrack, peerStream)
        }
      } catch (e) {
        console.warn('[CALL-FE] stopScreenShare replaceTrack lỗi:', e.message)
      }
    })

    try { localStreamRef.current.removeTrack(screenTrack) } catch {}
    screenTrack.stop()
    if (restoreTrack && !localStreamRef.current.getVideoTracks().includes(restoreTrack)) {
      localStreamRef.current.addTrack(restoreTrack)
    }
    setLocalStream(localStreamRef.current)

    // Khôi phục audio gốc nếu đang mix
    if (audioContextRef.current) {
      const currentMicTrack = peerStream.getAudioTracks()[0]
      const mixedAudioTrack = audioDestinationRef.current?.stream.getAudioTracks()[0]
      
      peersRef.current.forEach((peer) => {
        if (!peer.destroyed && currentMicTrack && mixedAudioTrack) {
          try { peer.replaceTrack(mixedAudioTrack, currentMicTrack, peerStream) } catch (e) {
            console.warn('[CALL-FE] stopScreenShare restore mic track error:', e.message)
          }
        }
      })
      
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
      audioDestinationRef.current = null
      micSourceRef.current = null
      screenAudioSourceRef.current = null
    }
    
    if (screenAudioTrackRef.current) {
      try { screenAudioTrackRef.current.stop() } catch {}
      screenAudioTrackRef.current = null
    }
    setIsScreenAudioEnabled(false)

    screenTrackRef.current = null
    cameraTrackRef.current = null
    setIsScreenSharing(false)

    socketRef.current?.emit('call_toggle_media', {
      callId: activeCallRef.current?.callId,
      mediaType: 'screen',
      enabled: false,
    })
  }, [])

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare()
      return
    }

    // Chỉ cho phép 1 người chia sẻ màn hình tại 1 thời điểm
    if (remoteScreenSharerId) {
      console.log('[CALL-FE] toggleScreenShare bị chặn — người khác đang chia sẻ')
      return
    }

    const peerStream = originalStreamRef.current || localStreamRef.current
    if (!peerStream || !localStreamRef.current) return

    let displayStream
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
    } catch (err) {
      // Người dùng bấm "Cancel" trong hộp chọn màn hình — không phải lỗi
      console.warn('[CALL-FE] Hủy chia sẻ màn hình:', err.message)
      return
    }

    const screenTrack = displayStream.getVideoTracks()[0]
    if (!screenTrack) return
    
    const screenAudioTrack = displayStream.getAudioTracks()[0] || null
    if (screenAudioTrack) {
      screenAudioTrackRef.current = screenAudioTrack
    }

    console.log('[CALL-FE] toggleScreenShare — bắt đầu chia sẻ')

    const currentVideoTrack = localStreamRef.current.getVideoTracks()[0] || null

    peersRef.current.forEach((peer) => {
      if (peer.destroyed) return
      try {
        if (currentVideoTrack) {
          peer.replaceTrack(currentVideoTrack, screenTrack, peerStream)
        } else {
          peer.addTrack(screenTrack, peerStream)
        }
      } catch (e) {
        console.warn('[CALL-FE] toggleScreenShare replaceTrack lỗi:', e.message)
      }
    })

    // Lưu camera track để khôi phục (KHÔNG stop — giữ sống để bật lại tức thì)
    cameraTrackRef.current = currentVideoTrack
    screenTrackRef.current = screenTrack

    if (currentVideoTrack) {
      try { localStreamRef.current.removeTrack(currentVideoTrack) } catch {}
    }
    localStreamRef.current.addTrack(screenTrack)
    setLocalStream(localStreamRef.current)
    setIsScreenSharing(true)

    // Người dùng bấm nút "Stop sharing" của trình duyệt
    screenTrack.onended = () => { stopScreenShare() }

    socketRef.current?.emit('call_toggle_media', {
      callId: activeCallRef.current?.callId,
      mediaType: 'screen',
      enabled: true,
    })
  }, [isScreenSharing, remoteScreenSharerId, stopScreenShare])

  // Socket event listeners — stable deps only
  useEffect(() => {
    if (!socket) return

    const onCallIncoming = (data) => {
      console.log('[CALL-FE] call_incoming:', data.callerName, data.callType)
      if (activeCallRef.current) return
      setIncomingCall(data)
      if (data.callerId) {
        setParticipantInfo((prev) => {
          const updated = new Map(prev)
          updated.set(data.callerId, { fullName: data.callerName, avatar: data.callerAvatar })
          return updated
        })
      }
      playLoopAudio(ringtoneRef, '/sounds/ringtone.mp3')
    }

    const onCallUserJoined = async ({ callId, userId: joinedUserId, fullName, avatar }) => {
      console.log(`[CALL-FE] call_user_joined: ${fullName} (${joinedUserId})`)
      const current = activeCallRef.current
      if (!current || current.callId !== callId) {
        console.log('[CALL-FE] call_user_joined IGNORED — no matching activeCall')
        return
      }

      setParticipantInfo((prev) => {
        const updated = new Map(prev)
        updated.set(joinedUserId, { fullName, avatar })
        return updated
      })

      setActiveCall((prev) => {
        if (!prev) return prev
        return { ...prev, status: prev.status === 'ringing' ? 'connecting' : prev.status }
      })

      stopAudioRef(dialtoneRef)

      if (localStreamRef.current) {
        await createPeerConnection(joinedUserId, true, localStreamRef.current, callId)
      } else {
        console.log('[CALL-FE] WARNING: no localStream when call_user_joined')
      }
    }

    const onCallSignal = async ({ callId, fromUserId, signal }) => {
      const current = activeCallRef.current
      if (!current || current.callId !== callId) return

      console.log(`[CALL-FE] call_signal from ${fromUserId}, type=${signal?.type || 'candidate'}`)

      const existingPeer = peersRef.current.get(fromUserId)
      if (existingPeer && !existingPeer.destroyed) {
        try { existingPeer.signal(signal) } catch (e) {
          console.error('[CALL-FE] signal error on existing peer:', e.message)
        }
        return
      }

      if (pendingPeersRef.current.has(fromUserId)) {
        const queue = signalQueueRef.current.get(fromUserId) || []
        queue.push(signal)
        signalQueueRef.current.set(fromUserId, queue)
        return
      }

      if (localStreamRef.current) {
        console.log(`[CALL-FE] creating non-initiator peer for ${fromUserId}`)
        pendingPeersRef.current.add(fromUserId)
        const peer = await createPeerConnection(fromUserId, false, localStreamRef.current, callId)
        pendingPeersRef.current.delete(fromUserId)
        try { peer.signal(signal) } catch (e) {
          console.error('[CALL-FE] signal error on new peer:', e.message)
        }
        const queued = signalQueueRef.current.get(fromUserId) || []
        signalQueueRef.current.delete(fromUserId)
        for (const s of queued) {
          try { peer.signal(s) } catch (e) {
            console.error('[CALL-FE] signal error on queued signal:', e.message)
          }
        }
      } else {
        console.log('[CALL-FE] WARNING: no localStream when call_signal received')
      }
    }

    const onCallRejected = ({ callId, userId: rejectedUserId, fullName }) => {
      console.log(`[CALL-FE] call_user_rejected: ${fullName}`)
    }

    const onCallEnded = ({ callId, endReason, duration }) => {
      console.log(`[CALL-FE] call_ended: reason=${endReason}, duration=${duration}`)
      cleanupCall(endReason)
    }

    const onCallNoAnswer = ({ callId }) => {
      console.log('[CALL-FE] call_no_answer')
      cleanupCall('no_answer')
    }

    const onCallUserLeft = ({ callId, userId: leftUserId }) => {
      console.log(`[CALL-FE] call_user_left: ${leftUserId}`)
      const peer = peersRef.current.get(leftUserId)
      if (peer) {
        try { peer.destroy() } catch {}
        peersRef.current.delete(leftUserId)
      }
      setRemoteStreams((prev) => {
        const updated = new Map(prev)
        updated.delete(leftUserId)
        return updated
      })
      setParticipantMedia((prev) => {
        const updated = new Map(prev)
        updated.delete(leftUserId)
        return updated
      })
    }

    const onCallMediaToggled = ({ userId: uid, mediaType, enabled }) => {
      setParticipantMedia((prev) => {
        const updated = new Map(prev)
        const cur = updated.get(uid) || { audio: true, video: true }
        updated.set(uid, { ...cur, [mediaType]: enabled })
        return updated
      })
    }

    const onCallUpgradeRequest = ({ callId, fromUserName }) => {
      if (activeCallRef.current?.callId !== callId) return
      setUpgradeRequesterName(fromUserName)
      setVideoUpgradeStatus('incoming')
      playSingleAudio('/sounds/ringtone.mp3')
    }

    const onCallUpgradeAccept = async ({ callId }) => {
      if (activeCallRef.current?.callId !== callId) return
      setTimeout(async () => {
        await performVideoUpgrade()
      }, 1000)
    }

    const onCallUpgradeReject = ({ callId }) => {
      if (activeCallRef.current?.callId !== callId) return
      setVideoUpgradeStatus('rejected')
      setTimeout(() => {
        setVideoUpgradeStatus(prev => prev === 'rejected' ? null : prev)
      }, 3000)
    }

    socket.on('call_incoming', onCallIncoming)
    socket.on('call_user_joined', onCallUserJoined)
    socket.on('call_signal', onCallSignal)
    socket.on('call_user_rejected', onCallRejected)
    socket.on('call_ended', onCallEnded)
    socket.on('call_no_answer', onCallNoAnswer)
    socket.on('call_user_left', onCallUserLeft)
    socket.on('call_media_toggled', onCallMediaToggled)
    socket.on('call_upgrade_request', onCallUpgradeRequest)
    socket.on('call_upgrade_accept', onCallUpgradeAccept)
    socket.on('call_upgrade_reject', onCallUpgradeReject)

    return () => {
      socket.off('call_incoming', onCallIncoming)
      socket.off('call_user_joined', onCallUserJoined)
      socket.off('call_signal', onCallSignal)
      socket.off('call_user_rejected', onCallRejected)
      socket.off('call_ended', onCallEnded)
      socket.off('call_no_answer', onCallNoAnswer)
      socket.off('call_user_left', onCallUserLeft)
      socket.off('call_media_toggled', onCallMediaToggled)
      socket.off('call_upgrade_request', onCallUpgradeRequest)
      socket.off('call_upgrade_accept', onCallUpgradeAccept)
      socket.off('call_upgrade_reject', onCallUpgradeReject)
    }
  }, [socket, cleanupCall, performVideoUpgrade])

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeCallRef.current && socketRef.current) {
        socketRef.current.emit('call_end', { callId: activeCallRef.current.callId })
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const value = {
    activeCall,
    incomingCall,
    isAudioEnabled,
    isVideoEnabled,
    localStream,
    remoteStreams,
    callDuration,
    participantMedia,
    participantInfo,
    initiateCall,
    acceptCall,
    rejectCall,
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
  }

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  )
}

export function useCall() {
  const context = useContext(CallContext)
  if (context === null) {
    throw new Error('useCall() phải được dùng bên trong <CallProvider>')
  }
  return context
}
