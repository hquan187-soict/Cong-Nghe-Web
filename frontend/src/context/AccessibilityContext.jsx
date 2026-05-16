import { createContext, useContext, useState, useEffect } from 'react'

const AccessibilityContext = createContext()

const FONT_SIZES = [
  { value: 13, label: 'S' },
  { value: 14, label: 'M' },
  { value: 16, label: 'L' },
  { value: 18, label: 'XL' },
]

const FONT_FAMILIES = [
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Nunito', sans-serif", label: 'Nunito' },
]

export function AccessibilityProvider({ children }) {
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('a11y_fontSize')
    return saved ? Number(saved) : 14
  })

  const [fontFamily, setFontFamily] = useState(() => {
    return localStorage.getItem('a11y_fontFamily') || "'Inter', sans-serif"
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`)
    localStorage.setItem('a11y_fontSize', String(fontSize))
  }, [fontSize])

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-family', fontFamily)
    document.body.style.fontFamily = fontFamily
    localStorage.setItem('a11y_fontFamily', fontFamily)
  }, [fontFamily])

  return (
    <AccessibilityContext.Provider value={{ fontSize, setFontSize, fontFamily, setFontFamily, FONT_SIZES, FONT_FAMILIES }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  return useContext(AccessibilityContext)
}
