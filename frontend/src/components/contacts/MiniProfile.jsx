import React from 'react';
import { MessageSquare, UserMinus, UserPlus, Users } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { useLang } from '../../context/LangContext';

export default function MiniProfile({ contact, isOnline, onSendMessage, onUnfriend, onAddFriend, isLoading = false }) {
  const { t } = useLang();

  if (!contact) return null;

  return (
    <div className="mini-profile">
      <div className="mini-profile__header">
        <div className="mini-profile__avatar-wrapper">
          <Avatar src={contact.avatar} alt={contact.fullName || '?'} size="lg" />
          <div className={`mini-profile__status ${isOnline ? 'mini-profile__status--online' : ''}`} />
        </div>
      </div>
      <div className="mini-profile__body">
        <h2 className="mini-profile__name">{contact.fullName}</h2>
        <p className="mini-profile__email">{contact.email}</p>
        
        <div className="mini-profile__meta">
          <div className="mini-profile__meta-item">
            <span className="mini-profile__meta-value">{contact.mutualFriends || 0}</span>
            <span className="mini-profile__meta-label">{t('contacts.mutualFriends')}</span>
          </div>
        </div>

        <div className="mini-profile__actions">
          <button 
            className="mini-profile__btn mini-profile__btn--primary"
            onClick={onSendMessage}
          >
            <MessageSquare size={18} />
            {t('contacts.sendMessage')}
          </button>
          
          {contact.isFriend ? (
            <button 
              className="mini-profile__btn mini-profile__btn--secondary mini-profile__btn--danger"
              onClick={onUnfriend}
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              <UserMinus size={18} />
              {isLoading ? 'Đang xử lý...' : t('contacts.unfriend')}
            </button>
          ) : (
            <button 
              className="mini-profile__btn mini-profile__btn--secondary"
              onClick={onAddFriend}
              disabled={isLoading || contact.requestSent}
              style={{ opacity: (isLoading || contact.requestSent) ? 0.6 : 1, cursor: (isLoading || contact.requestSent) ? 'not-allowed' : 'pointer' }}
            >
              <UserPlus size={18} />
              {isLoading ? 'Đang xử lý...' : contact.requestSent ? 'Đã gửi lời mời' : t('contacts.addFriend')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
