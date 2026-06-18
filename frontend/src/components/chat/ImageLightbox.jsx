import { useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { useLang } from '../../context/LangContext';

function ImageLightbox({ src, alt, onClose }) {
  const { t } = useLang()
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleDownload = (e) => {
    e.stopPropagation()
    const link = document.createElement('a')
    link.href = src
    link.download = alt || 'image'
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.click()
  }

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} title={t('lightbox.close') || 'Đóng'}>
        <X size={24} />
      </button>
      <button className="lightbox-download" onClick={handleDownload} title={t('lightbox.download') || 'Tải xuống'}>
        <Download size={24} />
      </button>
      <img
        className="lightbox-image"
        src={src}
        alt={alt || 'preview'}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

export default ImageLightbox
