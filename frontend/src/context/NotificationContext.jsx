import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const NotificationContext = createContext()

const SOUND_OPTIONS = [
  { value: 'none', file: null },
  { value: 'pop1', file: '/sounds/message_pop_alert.mp3' },
  { value: 'pop2', file: '/sounds/message_pop_alert_2.mp3' },
  { value: 'pop3', file: '/sounds/message_pop_alert_3.mp3' },
]

export function NotificationProvider({ children }) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('notif_sound_enabled')
    return saved !== null ? saved === 'true' : true
  })

  const [selectedSound, setSelectedSound] = useState(() => {
    return localStorage.getItem('notif_selected_sound') || 'pop1'
  })

  const audioPrimedRef = useRef(false)
  const audioRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('notif_sound_enabled', String(soundEnabled))
  }, [soundEnabled])

  useEffect(() => {
    localStorage.setItem('notif_selected_sound', selectedSound)
  }, [selectedSound])

  useEffect(() => {
    function primeAudio() {
      if (audioPrimedRef.current) return
      const a = new Audio()
      a.volume = 0
      a.play().then(() => { a.pause() }).catch(() => {})
      audioPrimedRef.current = true
      document.removeEventListener('click', primeAudio)
      document.removeEventListener('keydown', primeAudio)
    }
    document.addEventListener('click', primeAudio)
    document.addEventListener('keydown', primeAudio)
    return () => {
      document.removeEventListener('click', primeAudio)
      document.removeEventListener('keydown', primeAudio)
    }
  }, [])

  const playSound = useCallback((overrideSound) => {
    const soundKey = overrideSound || selectedSound
    if (!soundEnabled && !overrideSound) return
    if (soundKey === 'none') return

    const option = SOUND_OPTIONS.find(o => o.value === soundKey)
    if (!option?.file) return

    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      const audio = new Audio(option.file)
      audio.volume = 1
      audioRef.current = audio
      audio.play().catch(() => {})
    } catch {}
  }, [soundEnabled, selectedSound])

  const previewSound = useCallback((soundKey) => {
    if (soundKey === 'none') return
    const option = SOUND_OPTIONS.find(o => o.value === soundKey)
    if (!option?.file) return
    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      const audio = new Audio(option.file)
      audio.volume = 1
      audioRef.current = audio
      audio.play().catch(() => {})
    } catch {}
  }, [])

  return (
    <NotificationContext.Provider value={{
      soundEnabled, setSoundEnabled,
      selectedSound, setSelectedSound,
      playSound, previewSound,
      SOUND_OPTIONS,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  return useContext(NotificationContext)
}
