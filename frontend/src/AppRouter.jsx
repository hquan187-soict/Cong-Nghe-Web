import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import ContactsPage from './pages/ContactsPage'
import Demo from './components/ui/Demo'
import ProtectedRoute from './components/ProtectedRoute'

function AppRouter() {
return (
    <BrowserRouter>
    <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />
        <Route path="/forgot-password" element={<AuthPage />} />
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/chat/:conversationId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/demo" element={<Demo />} />
        {/* Redirect / về /login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
    </BrowserRouter>
)
}

export default AppRouter
