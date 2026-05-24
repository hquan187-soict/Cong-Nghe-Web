import React from 'react';
import { MessageSquare, UserMinus, UserPlus, Users } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { useLang } from '../../context/LangContext';

export default function MiniProfile({ contact, isOnline, onSendMessage, onUnfriend, onAddFriend }) {
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
            >
              <UserMinus size={18} />
              {t('contacts.unfriend')}
            </button>
          ) : (
            <button 
              className="mini-profile__btn mini-profile__btn--secondary"
              onClick={onAddFriend}
            >
              <UserPlus size={18} />
              {t('contacts.addFriend')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
