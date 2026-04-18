import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import axiosInstance from '../../utils/axios'

// ============================================================
// AuthDemo — Component test AuthContext & Axios Interceptor
// Mục đích: kiểm tra login, logout, persist localStorage, 
//           header Authorization, và mock 401 → auto logout
// ============================================================

function AuthDemo() {
  const { user, token, isLoading, login, logout } = useAuth()
  const [logMessages, setLogMessages] = useState([])

  // Thêm log message vào panel
  function addLog(msg) {
    const time = new Date().toLocaleTimeString('vi-VN')
    setLogMessages(prev => [`[${time}] ${msg}`, ...prev])
  }

  // ── Test 1: Login với mock user ──
  function handleLogin() {
    const mockUser = {
      id: 1,
      username: 'test',
      displayName: 'Test User',
      email: 'test@example.com',
      avatar: null,
    }
    login(mockUser)
    addLog('✅ login() đã gọi với user: ' + JSON.stringify(mockUser))
  }

  // ── Test 2: Logout ──
  function handleLogout() {
    logout()
    addLog('🚪 logout() đã gọi — user và token đã bị xoá')
  }

  // ── Test 3: Kiểm tra header Authorization trong request ──
  async function handleTestHeader() {
    try {
      addLog('📤 Gửi request... (kiểm tra header Authorization)')
      // Request sẽ thất bại vì server không chạy, nhưng ta kiểm tra header
      await axiosInstance.get('/test-auth')
    } catch (err) {
      if (err.config) {
        const authHeader = err.config.headers?.Authorization || '(không có)'
        addLog(`📋 Header Authorization: ${authHeader}`)
      } else {
        addLog('❌ Request lỗi: ' + err.message)
      }
    }
  }

  // ── Test 4: Mock response 401 → kiểm tra auto logout ──
  async function handleTest401() {
    addLog('🔴 Giả lập response 401...')
    try {
      // Tạo mock adapter tạm thời để giả lập 401
      const originalAdapter = axiosInstance.defaults.adapter
      axiosInstance.defaults.adapter = () => {
        return Promise.reject({
          response: { status: 401, data: { message: 'Token expired' } },
          config: { headers: {} },
          isAxiosError: true,
        })
      }

      await axiosInstance.get('/mock-401')
    } catch (err) {
      if (err.response && err.response.status === 401) {
        addLog('✅ 401 intercepted — logout() đã được gọi tự động!')
      } else {
        addLog('❌ Lỗi không mong đợi: ' + (err.message || JSON.stringify(err)))
      }
    } finally {
      // Khôi phục adapter mặc định
      delete axiosInstance.defaults.adapter
    }
  }

  // ── Test 5: Kiểm tra localStorage ──
  function handleCheckStorage() {
    const storedUser = localStorage.getItem('auth_user')
    const storedToken = localStorage.getItem('auth_token')
    addLog(`💾 localStorage — user: ${storedUser || '(trống)'}, token: ${storedToken || '(trống)'}`)
  }

  if (isLoading) {
    return <div style={styles.container}><p>⏳ Đang restore session...</p></div>
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🔐 Auth Demo — Test Context &amp; Axios</h2>

      {/* Trạng thái hiện tại */}
      <div style={styles.statusBox}>
        <h3 style={styles.subtitle}>Trạng thái hiện tại</h3>
        <div style={styles.statusRow}>
          <span style={styles.statusLabel}>User:</span>
          <span style={user ? styles.statusValueOk : styles.statusValueNone}>
            {user ? `${user.username} (${user.displayName})` : 'null — chưa đăng nhập'}
          </span>
        </div>
        <div style={styles.statusRow}>
          <span style={styles.statusLabel}>Token:</span>
          <span style={token ? styles.statusValueOk : styles.statusValueNone}>
            {token ? token.substring(0, 30) + '...' : 'null'}
          </span>
        </div>
      </div>

      {/* Các nút test */}
      <div style={styles.buttonGroup}>
        <button style={{ ...styles.btn, ...styles.btnLogin }} onClick={handleLogin}>
          🔑 Login (mock)
        </button>
        <button style={{ ...styles.btn, ...styles.btnLogout }} onClick={handleLogout}>
          🚪 Logout
        </button>
        <button style={{ ...styles.btn, ...styles.btnTest }} onClick={handleTestHeader}>
          📋 Test Header
        </button>
        <button style={{ ...styles.btn, ...styles.btn401 }} onClick={handleTest401}>
          🔴 Mock 401
        </button>
        <button style={{ ...styles.btn, ...styles.btnStorage }} onClick={handleCheckStorage}>
          💾 Check Storage
        </button>
      </div>

      <p style={styles.hint}>
        💡 Thử: Login → F5 (refresh) → user vẫn còn → Test Header → thấy Bearer token
      </p>

      {/* Log panel */}
      <div style={styles.logPanel}>
        <h3 style={styles.subtitle}>📜 Log</h3>
        {logMessages.length === 0 ? (
          <p style={styles.logEmpty}>Chưa có log — bấm các nút ở trên để test</p>
        ) : (
          logMessages.map((msg, i) => (
            <div key={i} style={styles.logEntry}>{msg}</div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Inline styles ──
const styles = {
  container: {
    margin: '20px auto',
    maxWidth: '600px',
    padding: '24px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
    color: '#e0e0e0',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '20px',
    fontWeight: '700',
    color: '#a78bfa',
  },
  subtitle: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statusBox: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
  },
  statusRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '4px',
    fontSize: '14px',
  },
  statusLabel: {
    fontWeight: '600',
    color: '#94a3b8',
    minWidth: '50px',
  },
  statusValueOk: {
    color: '#4ade80',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  statusValueNone: {
    color: '#f87171',
    fontStyle: 'italic',
  },
  buttonGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '12px',
  },
  btn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 0.2s ease',
  },
  btnLogin: {
    background: '#4ade80',
    color: '#000',
  },
  btnLogout: {
    background: '#f87171',
    color: '#fff',
  },
  btnTest: {
    background: '#60a5fa',
    color: '#000',
  },
  btn401: {
    background: '#fb923c',
    color: '#000',
  },
  btnStorage: {
    background: '#a78bfa',
    color: '#000',
  },
  hint: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '16px',
    fontStyle: 'italic',
  },
  logPanel: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  logEmpty: {
    color: '#64748b',
    fontSize: '13px',
    fontStyle: 'italic',
  },
  logEntry: {
    fontSize: '12px',
    fontFamily: 'monospace',
    padding: '4px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    color: '#cbd5e1',
    wordBreak: 'break-all',
  },
}

export default AuthDemo
