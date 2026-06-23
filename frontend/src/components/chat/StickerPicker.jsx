import React, { useState, useEffect, useRef } from 'react';
import { STICKER_CATEGORIES } from '../../utils/stickers';

const StickerPicker = ({ onSelectSticker, onClose }) => {
  const [activeTab, setActiveTab] = useState(STICKER_CATEGORIES[0]?.id);
  const pickerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const activeCategory = STICKER_CATEGORIES.find(c => c.id === activeTab);

  return (
    <div
      ref={pickerRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '0',
        marginBottom: '10px',
        width: '320px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: '12px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-subtle)'
      }}>
        {STICKER_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: activeTab === cat.id ? 'var(--color-surface)' : 'transparent',
              borderBottom: activeTab === cat.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              transition: 'all 0.2s'
            }}
            title={cat.name}
          >
            <img src={cat.icon} alt={cat.name} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          </button>
        ))}
      </div>
      <div className="app-scrollbar" style={{
        padding: '12px',
        height: '250px',
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px'
      }}>
        {activeCategory?.stickers.map((url, idx) => (
          <div
            key={idx}
            onClick={() => onSelectSticker(url)}
            style={{
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <img src={url} alt="sticker" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default StickerPicker;
