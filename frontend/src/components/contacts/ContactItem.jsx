import React from 'react';
import { MessageSquare, UserMinus, UserPlus, Clock } from 'lucide-react';
import Avatar from '../ui/Avatar';

export default function ContactItem({ contact, isActive, onClick, isOnline, onMessage, onUnfriend, collapsed }) {
  if (collapsed) {
    return (
      <div
        className={`contact-item contact-item--collapsed ${isActive ? 'contact-item--active' : ''}`}
        onClick={() => onClick(contact)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(contact);
          }
        }}
        style={{ display: 'flex', justifyContent: 'center', padding: '8px', margin: '4px 0' }}
        title={contact.fullName}
      >
        <Avatar src={contact.avatar} alt={contact.fullName || '?'} size="md" isOnline={isOnline} />
      </div>
    );
  }

  const renderRelationshipBadge = () => {
    if (contact.isFriend) return null;
    if (contact.requestSent) {
      return <span className="contact-item__badge contact-item__badge--pending"><Clock size={12} /> Đã gửi</span>;
    }
    if (contact.hasReceivedRequest) {
      return <span className="contact-item__badge contact-item__badge--received"><UserPlus size={12} /> Đã nhận lời mời</span>;
    }
    return null;
  };

  return (
    <div
      className={`contact-item ${isActive ? 'contact-item--active' : ''}`}
      onClick={() => onClick(contact)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(contact);
        }
      }}
    >
      <div className="contact-item__avatar">
        <Avatar src={contact.avatar} alt={contact.fullName || '?'} size="sm" isOnline={isOnline} />
      </div>
      <div className="contact-item__info">
        <span className="contact-item__name">{contact.fullName}</span>
        {renderRelationshipBadge()}
      </div>
      <div className="contact-item__actions">
        {contact.isFriend && (
          <>
            <button
              className="contact-item__btn"
              title="Nhắn tin"
              onClick={(e) => {
                e.stopPropagation();
                if (onMessage) onMessage(contact);
              }}
            >
              <MessageSquare size={16} />
            </button>
            <button
              className="contact-item__btn"
              title="Hủy kết bạn"
              onClick={(e) => {
                e.stopPropagation();
                if (onUnfriend) onUnfriend(contact);
              }}
            >
              <UserMinus size={16} />
            </button>
          </>
        )}
        {!contact.isFriend && !contact.requestSent && !contact.hasReceivedRequest && (
          <button
            className="contact-item__btn"
            title="Nhắn tin"
            onClick={(e) => {
              e.stopPropagation();
              if (onMessage) onMessage(contact);
            }}
          >
            <MessageSquare size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
