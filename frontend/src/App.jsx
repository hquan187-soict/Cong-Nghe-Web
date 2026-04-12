import { ThemeProvider } from './context/ThemeContext'
import { LangProvider } from './context/LangContext'
import AppRouter from './AppRouter'
import Demo from "./components/ui/Demo";
import AppLayout from "./components/layout/AppLayout";
function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AppRouter />
        <Demo /> 
      </LangProvider>
    </ThemeProvider>
  )
}

export default App
