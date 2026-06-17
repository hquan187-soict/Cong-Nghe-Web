import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Pause, Play, Send, X, Trash2 } from 'lucide-react'
import { useLang } from '../../context/LangContext'

const MAX_DURATION = 300

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VoiceRecorder({ onSend, onClose }) {
  const { t } = useLang()
  const [state, setState] = useState('idle')
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const canvasRef = useRef(null)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const animFrameRef = useRef(null)
  const previewRef = useRef(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(dataArray)

      ctx.fillStyle = 'rgba(0, 0, 0, 0)'
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.lineWidth = 2
      ctx.strokeStyle = 'var(--color-primary, #3b82f6)'
      ctx.beginPath()

      const sliceWidth = canvas.width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * canvas.height) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }

      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }

    draw()
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setState('preview')
      }

      recorder.start(100)
      setState('recording')
      setDuration(0)

      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= MAX_DURATION) {
            recorder.stop()
            clearInterval(timerRef.current)
            return prev
          }
          return prev + 1
        })
      }, 1000)

      drawWaveform()
    } catch {
      setError(t('voice.micError'))
    }
  }, [drawWaveform])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
  }, [])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      if (timerRef.current) clearInterval(timerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      setState('paused')
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= MAX_DURATION) {
            mediaRecorderRef.current.stop()
            clearInterval(timerRef.current)
            return prev
          }
          return prev + 1
        })
      }, 1000)
      drawWaveform()
      setState('recording')
    }
  }, [drawWaveform])

  const discardRecording = useCallback(() => {
    if (state === 'recording' || state === 'paused') {
      stopRecording()
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setDuration(0)
    setState('idle')
  }, [state, audioUrl, stopRecording])

  const handleSend = useCallback(() => {
    if (!audioBlob) return

    const reader = new FileReader()
    reader.onloadend = () => {
      const ext = audioBlob.type.includes('webm') ? 'webm' : 'mp4'
      const baseType = audioBlob.type.split(';')[0]
      onSend({
        data: reader.result,
        name: `voice_${Date.now()}.${ext}`,
        size: audioBlob.size,
        type: baseType,
        duration: duration,
      })
      cleanup()
      onClose()
    }
    reader.readAsDataURL(audioBlob)
  }, [audioBlob, duration, onSend, onClose, cleanup])

  const handleClose = useCallback(() => {
    if (state === 'recording' || state === 'paused') {
      stopRecording()
    }
    cleanup()
    onClose()
  }, [state, stopRecording, cleanup, onClose])

  return (
    <div className="voice-recorder">
      <div className="voice-recorder__header">
        <span className="voice-recorder__title">
          {state === 'idle' && t('voice.title')}
          {state === 'recording' && t('voice.recording')}
          {state === 'paused' && t('voice.paused')}
          {state === 'preview' && t('voice.preview')}
        </span>
        <button className="voice-recorder__close" onClick={handleClose}>
          <X size={18} />
        </button>
      </div>

      {error && <div className="voice-recorder__error">{error}</div>}

      <div className="voice-recorder__body">
        {(state === 'recording' || state === 'paused') && (
          <>
            <canvas
              ref={canvasRef}
              className="voice-recorder__waveform"
              width={280}
              height={48}
            />
            <div className="voice-recorder__timer">
              {state === 'recording' && <span className="voice-recorder__rec-dot" />}
              {formatDuration(duration)}
            </div>
          </>
        )}

        {state === 'preview' && audioUrl && (
          <>
            <audio ref={previewRef} src={audioUrl} className="voice-recorder__audio-preview" controls />
            <div className="voice-recorder__timer">{formatDuration(duration)}</div>
          </>
        )}

        {state === 'idle' && (
          <div className="voice-recorder__idle-hint">
            {t('voice.idleHint')}
          </div>
        )}
      </div>

      <div className="voice-recorder__actions">
        {state === 'idle' && (
          <button className="voice-recorder__btn voice-recorder__btn--record" onClick={startRecording}>
            <Mic size={22} />
          </button>
        )}

        {state === 'recording' && (
          <>
            <button className="voice-recorder__btn voice-recorder__btn--discard" onClick={discardRecording}>
              <Trash2 size={18} />
            </button>
            <button className="voice-recorder__btn voice-recorder__btn--pause" onClick={pauseRecording}>
              <Pause size={20} />
            </button>
            <button className="voice-recorder__btn voice-recorder__btn--stop" onClick={stopRecording}>
              <Square size={20} />
            </button>
          </>
        )}

        {state === 'paused' && (
          <>
            <button className="voice-recorder__btn voice-recorder__btn--discard" onClick={discardRecording}>
              <Trash2 size={18} />
            </button>
            <button className="voice-recorder__btn voice-recorder__btn--resume" onClick={resumeRecording}>
              <Play size={20} />
            </button>
            <button className="voice-recorder__btn voice-recorder__btn--stop" onClick={stopRecording}>
              <Square size={20} />
            </button>
          </>
        )}

        {state === 'preview' && (
          <>
            <button className="voice-recorder__btn voice-recorder__btn--discard" onClick={discardRecording}>
              <Trash2 size={18} />
            </button>
            <button className="voice-recorder__btn voice-recorder__btn--send" onClick={handleSend}>
              <Send size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
