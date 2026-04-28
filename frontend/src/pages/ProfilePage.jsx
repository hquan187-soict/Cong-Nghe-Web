import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Mail, User, Camera } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../context/LangContext'
import { authService } from '../services/auth.service'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'

function ProfilePage() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { t } = useLang()
  const [loggingOut, setLoggingOut] = useState(false)

  // Xử lý logout: gọi API thật → clear context → redirect /login
  // Dù API thành công hay thất bại, luôn logout phía client và redirect
  async function handleLogout() {
    setLoggingOut(true)
    try {
      // Gọi API POST /api/auth/logout (xoá cookie phía server — best effort)
      await authService.logout()
    } catch (error) {
      // API lỗi (server chưa chạy, mất mạng...) — không sao, vẫn tiếp tục logout
      console.warn('Logout API lỗi (bỏ qua):', error.message)
    }

    // Luôn clear state + localStorage phía client
    logout()
    toast.success(t('profile.logoutSuccess'))

    // Luôn redirect về trang login
    navigate('/login', { replace: true })
    setLoggingOut(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 sm:p-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '3s' }}></div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/5 w-full max-w-md relative z-10 overflow-hidden">
        {/* Header gradient banner */}
        <div className="h-32 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
        </div>

        {/* Avatar — positioned overlapping header */}
        <div className="flex justify-center -mt-14 relative z-10">
          <div className="relative group">
            <Avatar
              src={user?.avatar}
              alt={user?.fullName || 'User'}
              size="lg"
              isOnline={true}
            />
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center cursor-pointer">
              <Camera size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="px-8 pt-4 pb-8">
          {/* Name */}
          <h1 className="text-2xl font-bold text-center text-slate-800 tracking-tight">
            {user?.fullName || t('profile.defaultName')}
          </h1>
          <p className="text-sm text-slate-500 text-center mt-1">
            {t('profile.title')}
          </p>

          {/* Info cards */}
          <div className="mt-6 space-y-3">
            {/* Username / Full Name */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50/30">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                <User size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {t('profile.fullName')}
                </p>
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {user?.fullName || '—'}
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50/30">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0">
                <Mail size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {t('profile.email')}
                </p>
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {user?.email || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Logout button */}
          <div className="mt-8">
            <Button
              variant="danger"
              className="w-full"
              onClick={handleLogout}
              isLoading={loggingOut}
            >
              <LogOut size={18} />
              {t('profile.logout')}
            </Button>
          </div>

          {/* Back to chat link */}
          <p className="text-center text-sm text-slate-500 mt-4">
            <a
              href="/chat"
              onClick={(e) => { e.preventDefault(); navigate('/chat') }}
              className="text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1"
            >
              ← {t('profile.backToChat')}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
