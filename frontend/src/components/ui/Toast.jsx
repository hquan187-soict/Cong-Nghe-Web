import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useToast } from '../../context/ToastContext'

// Icon map theo loại toast
const icons = {
  success: <CheckCircle size={20} />,
  error:   <XCircle size={20} />,
  info:    <Info size={20} />,
}

// Toast component — render stack toasts ở góc trên phải
// Được render một lần trong App.jsx, tự động hiển thị khi có toast mới
const Toast = () => {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast-item toast-${toast.type} ${toast.removing ? 'removing' : ''}`}
          role="alert"
          aria-live="assertive"
        >
          {/* Icon */}
          <span className="toast-icon">
            {icons[toast.type] || icons.info}
          </span>

          {/* Message */}
          <span className="toast-message">{toast.message}</span>

          {/* Close button */}
          <button
            className="toast-close"
            onClick={() => removeToast(toast.id)}
            aria-label="Đóng thông báo"
          >
            <X size={14} />
          </button>

          {/* Progress bar — visual countdown 3s */}
          <div className="toast-progress" />
        </div>
      ))}
    </div>
  )
}

export default Toast
