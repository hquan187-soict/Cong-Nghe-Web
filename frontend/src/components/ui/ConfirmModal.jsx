import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import '../../styles/confirm-modal.css';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'OK', cancelText = 'Hủy', danger = false }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Focus modal when opened for accessibility and keyboard events
      if (modalRef.current) {
        modalRef.current.focus();
      }
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      onConfirm();
    }
  };

  return (
    <div className="confirm-modal-overlay" onMouseDown={onCancel}>
      <div 
        className="confirm-modal-content" 
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        ref={modalRef}
      >
        <div className="confirm-modal-header">
          <h3>{title}</h3>
          <button className="confirm-modal-close" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
        </div>
        <div className="confirm-modal-footer">
          <button className="confirm-modal-btn confirm-modal-btn--cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button 
            className={`confirm-modal-btn ${danger ? 'confirm-modal-btn--danger' : 'confirm-modal-btn--confirm'}`} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
