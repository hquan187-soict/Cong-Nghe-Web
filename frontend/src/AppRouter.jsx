import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import Demo from './components/ui/Demo'

function AppRouter() {
return (
    <BrowserRouter>
    <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/demo" element={<Demo />} />
        {/* Redirect / về /login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
    </BrowserRouter>
)
}

export default AppRouter

