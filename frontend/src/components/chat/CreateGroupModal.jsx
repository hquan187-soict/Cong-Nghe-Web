import React, { useState, useEffect } from 'react';
import { X, Search, Check, Users, Loader2 } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { useLang } from '../../context/LangContext';
import { userService } from '../../services/user.service';
import { conversationService } from '../../services/conversation.service';
import { useToast } from '../../context/ToastContext';
import { useDebounce } from '../../hooks/useDebounce';

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
  const { t } = useLang();
  const toast = useToast();
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]); // array of contact objects
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGroupName('');
      setSearchQuery('');
      setSelectedMembers([]);
      setContacts([]);
    }
  }, [isOpen]);

  // Fetch contacts dynamically from backend
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function fetchContacts() {
      setIsSearching(true);
      try {
        const data = await userService.searchUsers(debouncedSearchQuery.trim());
        if (!cancelled) {
          setContacts(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Fetch search users error:', err);
          setContacts([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }

    fetchContacts();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, isOpen]);

  const toggleMember = (contact) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m._id === contact._id);
      if (exists) {
        return prev.filter(m => m._id !== contact._id);
      }
      return [...prev, contact];
    });
  };

  const handleCreate = async () => {
    if (selectedMembers.length < 2 || isCreating) return;
    setIsCreating(true);
    
    try {
      const memberIds = selectedMembers.map(m => m._id);
      const newGroup = await conversationService.createGroup(groupName.trim() || undefined, memberIds);
      toast.success(t('chat.groupCreated') || 'Đã tạo nhóm thành công!');
      onGroupCreated(newGroup);
      onClose();
    } catch (err) {
      console.error('Create group error:', err);
      const message = err.response?.data?.message || t('chat.createError') || 'Có lỗi xảy ra khi tạo nhóm.';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="search-modal__overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="search-modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="search-modal__header">
          <h2 className="search-modal__title">
            <Users size={20} />
            {t('chat.createGroup')}
          </h2>
          <button className="search-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>
              {t('chat.groupName')}
            </label>
            <input 
              type="text" 
              className="search-modal__input" 
              style={{ paddingLeft: '12px' }}
              placeholder={t('chat.groupNamePlaceholder')}
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>
              {t('chat.selectMembers')}
            </label>
            <div className="search-modal__input-wrapper" style={{ padding: 0 }}>
              <Search size={18} className="search-modal__input-icon" style={{ left: '12px' }} />
              <input 
                type="text" 
                className="search-modal__input"
                placeholder={t('contacts.searchPlaceholder') || 'Tìm kiếm bạn bè...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Selected Chips */}
          {selectedMembers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
              {selectedMembers.map(m => (
                <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '4px 8px 4px 4px', borderRadius: '16px', fontSize: '12px', fontWeight: 500 }}>
                  <Avatar src={m.avatar} alt={m.fullName} size="sm" style={{ width: '20px', height: '20px' }} />
                  <span>{m.fullName.split(' ').pop()}</span>
                  <button onClick={() => toggleMember(m)} style={{ background: 'none', border: 'none', color: 'inherit', padding: 0, cursor: 'pointer', display: 'flex' }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact List */}
        <div className="search-modal__results app-scrollbar" style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {isSearching ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--color-text-muted)' }}>
              <Loader2 className="animate-spin" size={24} style={{ marginBottom: '8px' }} />
              <span>{t('chat.searching') || 'Đang tìm kiếm...'}</span>
            </div>
          ) : contacts.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--color-text-muted)' }}>
              <span>{t('chat.noResults') || 'Không tìm thấy người dùng nào.'}</span>
            </div>
          ) : (
            contacts.map(contact => {
              const isSelected = selectedMembers.some(m => m._id === contact._id);
              return (
                <div 
                  key={contact._id} 
                  className="search-modal__user" 
                  onClick={() => toggleMember(contact)}
                  style={{ background: isSelected ? 'var(--color-hover-bg)' : 'transparent', cursor: 'pointer' }}
                >
                  <div style={{ 
                    width: '20px', height: '20px', borderRadius: '4px', 
                    border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: isSelected ? 'var(--color-primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginRight: '8px'
                  }}>
                    {isSelected && <Check size={14} color="white" />}
                  </div>
                  <Avatar src={contact.avatar} alt={contact.fullName} size="md" />
                  <div className="search-modal__user-info">
                    <span className="search-modal__user-name">{contact.fullName}</span>
                    <span className="search-modal__user-email">{contact.email}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {t('chat.selectedCount')?.replace('{count}', selectedMembers.length) || `Đã chọn ${selectedMembers.length} thành viên`}
          </span>
          <button 
            style={{ 
              padding: '8px 16px', background: 'var(--color-primary)', color: 'white', 
              border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
              opacity: (selectedMembers.length < 2 || isCreating) ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
            disabled={selectedMembers.length < 2 || isCreating}
            onClick={handleCreate}
          >
            {isCreating && <Loader2 className="animate-spin" size={16} />}
            {t('chat.createGroupBtn') || 'Tạo nhóm'}
          </button>
        </div>

      </div>
    </div>
  );
}
