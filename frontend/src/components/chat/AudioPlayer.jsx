import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Play, Pause } from 'lucide-react'

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const BAR_COUNT = 28

export default function AudioPlayer({ src, duration: serverDuration, isOwn }) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(serverDuration || 0)
  const audioRef = useRef(null)
  const animRef = useRef(null)

  const bars = useMemo(() => {
    const result = []
    for (let i = 0; i < BAR_COUNT; i++) {
      result.push(20 + Math.random() * 80)
    }
    return result
  }, [src])

  const updateProgress = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
    if (!audio.paused) {
      animRef.current = requestAnimationFrame(updateProgress)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      audio.play()
      setPlaying(true)
      animRef.current = requestAnimationFrame(updateProgress)
    } else {
      audio.pause()
      setPlaying(false)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [updateProgress])

  const handleEnded = useCallback(() => {
    setPlaying(false)
    setCurrentTime(0)
    if (animRef.current) cancelAnimationFrame(animRef.current)
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (audio && isFinite(audio.duration)) {
      setDuration(audio.duration)
    }
  }, [])

  const handleBarClick = useCallback((index) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const seekTo = (index / BAR_COUNT) * duration
    audio.currentTime = seekTo
    setCurrentTime(seekTo)
  }, [duration])

  const progress = duration > 0 ? currentTime / duration : 0
  const filledBars = Math.floor(progress * BAR_COUNT)

  return (
    <div className={`audio-player ${isOwn ? 'audio-player--own' : 'audio-player--other'}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
      />

      <button
        className={`audio-player__play-btn ${isOwn ? 'audio-player__play-btn--own' : ''}`}
        onClick={togglePlay}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>

      <div className="audio-player__waveform">
        {bars.map((height, i) => (
          <div
            key={i}
            className={`audio-player__bar ${i < filledBars ? 'audio-player__bar--filled' : ''} ${isOwn ? 'audio-player__bar--own' : ''}`}
            style={{ height: `${height}%` }}
            onClick={() => handleBarClick(i)}
          />
        ))}
      </div>

      <span className={`audio-player__time ${isOwn ? 'audio-player__time--own' : ''}`}>
        {playing ? formatDuration(currentTime) : formatDuration(duration)}
      </span>
    </div>
  )
}
