import { createContext, useContext, useState } from 'react'
import vi from '../locales/vi.json'
import en from '../locales/en.json'

// Gom tất cả bản dịch vào một object
const translations = { vi, en }

const LangContext = createContext()

export function LangProvider({ children }) {
  // Lấy ngôn ngữ đã lưu, mặc định tiếng Việt
  const [lang, setLang] = useState(
    () => localStorage.getItem('lang') || 'vi'
  )

  function toggleLang() {
    const next = lang === 'vi' ? 'en' : 'vi'
    setLang(next)
    localStorage.setItem('lang', next)
  }

  // Hàm t(key) nhận key dạng "login.title"
  // Tách theo dấu "." rồi đi sâu vào object dịch
  // Hàm t(key, vars) nhận key dạng "login.title" và biến nội suy
  // Tách theo dấu "." rồi đi sâu vào object dịch
  function t(key, vars = {}) {
    const keys = key.split('.')
    let value = translations[lang]
    for (const k of keys) {
      value = value?.[k]
    }
    // Nội suy biến nếu value là string và có truyền vars
    if (typeof value === 'string' && vars) {
      value = value.replace(/\{\{(\w+)\}\}/g, (match, p1) => {
        return vars[p1] !== undefined ? vars[p1] : match
      })
    }
    // Nếu không tìm thấy key → trả về key gốc để dễ debug
    return value ?? key
  }

  return (
    <LangContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

// Hook tiện ích — dùng trong component: const { t, lang, toggleLang } = useLang()
export function useLang() {
  return useContext(LangContext)
}
