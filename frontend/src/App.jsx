import { ThemeProvider } from './context/ThemeContext'
import { LangProvider } from './context/LangContext'
import AppRouter from './AppRouter'

function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AppRouter />
      </LangProvider>
    </ThemeProvider>
  )
}

export default App
