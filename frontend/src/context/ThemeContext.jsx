import { createContext, useContext, useState, useEffect } from 'react'

// Tạo context để chia sẻ theme cho toàn app
const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  // Lấy theme đã lưu từ localStorage, mặc định là 'light'
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'light'
  )

  // Mỗi khi theme thay đổi → cập nhật attribute trên <html> và lưu localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Hook tiện ích — dùng trong component: const { theme, toggleTheme } = useTheme()
export function useTheme() {
  return useContext(ThemeContext)
}
