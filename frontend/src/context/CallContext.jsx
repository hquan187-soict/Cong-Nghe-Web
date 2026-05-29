import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import _SimplePeer from 'simple-peer'
const SimplePeer = _SimplePeer.default || _SimplePeer
import { useSocket } from './SocketContext'
import { useAuth } from './AuthContext'
import axiosInstance from '../utils/axios'

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

  const peersRef = useRef(new Map())
  const pendingPeersRef = useRef(new Set())
  const signalQueueRef = useRef(new Map())
  const localStreamRef = useRef(null)
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

  const cleanupCall = useCallback(() => {
    console.log('[CALL-FE] cleanupCall')
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

    setLocalStream(null)
    setRemoteStreams(new Map())
    setActiveCall(null)
    setIncomingCall(null)
    setIsAudioEnabled(true)
    setIsVideoEnabled(true)
    setCallDuration(0)
    setParticipantMedia(new Map())
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
    setLocalStream(stream)
    return stream
  }, [])

  const initiateCall = useCallback(async (conversationId, callType) => {
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

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return
    const track = localStreamRef.current.getVideoTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setIsVideoEnabled(track.enabled)
      socketRef.current?.emit('call_toggle_media', {
        callId: activeCallRef.current?.callId,
        mediaType: 'video',
        enabled: track.enabled,
      })
    }
  }, [])

  // Socket event listeners — stable deps only
  useEffect(() => {
    if (!socket) return

    const onCallIncoming = (data) => {
      console.log('[CALL-FE] call_incoming:', data.callerName, data.callType)
      if (activeCallRef.current) return
      setIncomingCall(data)
      playLoopAudio(ringtoneRef, '/sounds/ringtone.mp3')
    }

    const onCallUserJoined = async ({ callId, userId: joinedUserId, fullName, avatar }) => {
      console.log(`[CALL-FE] call_user_joined: ${fullName} (${joinedUserId})`)
      const current = activeCallRef.current
      if (!current || current.callId !== callId) {
        console.log('[CALL-FE] call_user_joined IGNORED — no matching activeCall')
        return
      }

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
      cleanupCall()
    }

    const onCallNoAnswer = ({ callId }) => {
      console.log('[CALL-FE] call_no_answer')
      cleanupCall()
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
    }

    const onCallMediaToggled = ({ userId: uid, mediaType, enabled }) => {
      setParticipantMedia((prev) => {
        const updated = new Map(prev)
        const cur = updated.get(uid) || { audio: true, video: true }
        updated.set(uid, { ...cur, [mediaType]: enabled })
        return updated
      })
    }

    socket.on('call_incoming', onCallIncoming)
    socket.on('call_user_joined', onCallUserJoined)
    socket.on('call_signal', onCallSignal)
    socket.on('call_user_rejected', onCallRejected)
    socket.on('call_ended', onCallEnded)
    socket.on('call_no_answer', onCallNoAnswer)
    socket.on('call_user_left', onCallUserLeft)
    socket.on('call_media_toggled', onCallMediaToggled)

    return () => {
      socket.off('call_incoming', onCallIncoming)
      socket.off('call_user_joined', onCallUserJoined)
      socket.off('call_signal', onCallSignal)
      socket.off('call_user_rejected', onCallRejected)
      socket.off('call_ended', onCallEnded)
      socket.off('call_no_answer', onCallNoAnswer)
      socket.off('call_user_left', onCallUserLeft)
      socket.off('call_media_toggled', onCallMediaToggled)
    }
  }, [socket, cleanupCall])

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
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
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
