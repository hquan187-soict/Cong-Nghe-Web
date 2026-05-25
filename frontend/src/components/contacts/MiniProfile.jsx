import React from 'react';
import { MessageSquare, UserMinus, UserPlus, Clock } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { useLang } from '../../context/LangContext';

export default function MiniProfile({ contact, isOnline, onSendMessage, onUnfriend, onAddFriend, onAcceptRequest, isLoading = false }) {
  const { t } = useLang();

  if (!contact) return null;

  const renderFriendAction = () => {
    if (contact.isFriend) {
      return (
        <button
          className="mini-profile__btn mini-profile__btn--secondary mini-profile__btn--danger"
          onClick={onUnfriend}
          disabled={isLoading}
          style={{ opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          <UserMinus size={18} />
          {isLoading ? 'Đang xử lý...' : t('contacts.unfriend')}
        </button>
      );
    }

    if (contact.requestSent) {
      return (
        <button
          className="mini-profile__btn mini-profile__btn--secondary"
          disabled
          style={{ opacity: 0.6, cursor: 'not-allowed' }}
        >
          <Clock size={18} />
          Đã gửi lời mời
        </button>
      );
    }

    if (contact.hasReceivedRequest) {
      return (
        <button
          className="mini-profile__btn mini-profile__btn--secondary mini-profile__btn--success"
          onClick={onAcceptRequest}
          disabled={isLoading}
          style={{ opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          <UserPlus size={18} />
          {isLoading ? 'Đang xử lý...' : 'Chấp nhận kết bạn'}
        </button>
      );
    }

    return (
      <button
        className="mini-profile__btn mini-profile__btn--secondary"
        onClick={onAddFriend}
        disabled={isLoading}
        style={{ opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
      >
        <UserPlus size={18} />
        {isLoading ? 'Đang xử lý...' : t('contacts.addFriend')}
      </button>
    );
  };

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

        <div className="mini-profile__actions">
          <button
            className="mini-profile__btn mini-profile__btn--primary"
            onClick={onSendMessage}
          >
            <MessageSquare size={18} />
            {t('contacts.sendMessage')}
          </button>

          {renderFriendAction()}
        </div>
      </div>
    </div>
  );
}
