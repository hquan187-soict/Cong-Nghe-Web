import React from 'react';
import { Check, X } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { formatRelativeTime } from '../../utils/timeUtils';
import { useLang } from '../../context/LangContext';

export default function FriendRequestItem({ request, type = 'received', onAccept, onDecline, onCancel }) {
  const { lang, t } = useLang();
  
  const user = type === 'received' ? request.from : request.to;
  const timeStr = formatRelativeTime(request.createdAt, lang);

  return (
    <div className="friend-request-item">
      <div className="friend-request-item__header">
        <Avatar src={user.avatar} alt={user.fullName || '?'} size="md" />
        <div className="friend-request-item__info">
          <div className="friend-request-item__name">{user.fullName}</div>
          <div className="friend-request-item__time">{timeStr}</div>
        </div>
      </div>
      
      {type === 'received' && request.message && (
        <div className="friend-request-item__message">
          "{request.message}"
        </div>
      )}

      <div className="friend-request-item__actions">
        {type === 'received' ? (
          <>
            <button 
              className="friend-request-item__btn friend-request-item__btn--accept"
              onClick={() => onAccept && onAccept(request._id)}
            >
              <Check size={16} /> {t('contacts.accept')}
            </button>
            <button 
              className="friend-request-item__btn friend-request-item__btn--decline"
              onClick={() => onDecline && onDecline(request._id)}
            >
              <X size={16} /> {t('contacts.decline')}
            </button>
          </>
        ) : (
          <button 
            className="friend-request-item__btn friend-request-item__btn--cancel"
            onClick={() => onCancel && onCancel(request._id)}
          >
            <X size={16} /> {t('contacts.cancelRequest')}
          </button>
        )}
      </div>
    </div>
  );
}
