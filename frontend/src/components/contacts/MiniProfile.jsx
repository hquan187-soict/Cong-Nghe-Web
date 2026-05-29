import React, { useState } from 'react';
import { MessageSquare, UserMinus, UserPlus, Clock, ShieldBan, ShieldCheck } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { userService } from '../../services/user.service';
import { formatLastActive } from '../../utils/timeUtils';

export default function MiniProfile({ contact, isOnline, onSendMessage, onUnfriend, onAddFriend, onAcceptRequest, isLoading = false, lastSeen }) {
  const { t, lang } = useLang();
  const { user: currentUser, updateUser } = useAuth();
  const toast = useToast();
  const [blockLoading, setBlockLoading] = useState(false);

  if (!contact) return null;

  const isBlocked = currentUser?.blockedUsers?.some(
    id => (id?._id || id)?.toString() === contact._id
  );

  const handleBlock = async () => {
    if (!window.confirm(t('userProfile.blockConfirm'))) return;
    setBlockLoading(true);
    try {
      const updatedMe = await userService.blockUser(contact._id);
      if (updatedMe) updateUser(updatedMe);
      toast.success(t('userProfile.blockSuccess'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('chat.blockUser'));
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!window.confirm(t('userProfile.unblockConfirm'))) return;
    setBlockLoading(true);
    try {
      const updatedMe = await userService.unblockUser(contact._id);
      if (updatedMe) updateUser(updatedMe);
      toast.success(t('userProfile.unblockSuccess'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('chat.unblockUser'));
    } finally {
      setBlockLoading(false);
    }
  };

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
          {t('userProfile.requestSent')}
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
          {isLoading ? 'Đang xử lý...' : t('userProfile.acceptRequest')}
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
        <p style={{ fontSize: '12px', color: isOnline ? '#27ae60' : 'var(--color-text-muted)', marginTop: '4px' }}>
          {isOnline
            ? t('userProfile.online')
            : lastSeen
              ? formatLastActive(lastSeen, lang)
              : t('userProfile.offline')}
        </p>

        <div className="mini-profile__actions">
          <button
            className="mini-profile__btn mini-profile__btn--primary"
            onClick={onSendMessage}
          >
            <MessageSquare size={18} />
            {t('contacts.sendMessage')}
          </button>

          {renderFriendAction()}

          {isBlocked ? (
            <button
              className="mini-profile__btn mini-profile__btn--secondary"
              onClick={handleUnblock}
              disabled={blockLoading}
              style={{ opacity: blockLoading ? 0.6 : 1, cursor: blockLoading ? 'not-allowed' : 'pointer' }}
            >
              <ShieldCheck size={18} />
              {blockLoading ? 'Đang xử lý...' : t('userProfile.unblock')}
            </button>
          ) : (
            <button
              className="mini-profile__btn mini-profile__btn--secondary mini-profile__btn--danger"
              onClick={handleBlock}
              disabled={blockLoading}
              style={{ opacity: blockLoading ? 0.6 : 1, cursor: blockLoading ? 'not-allowed' : 'pointer' }}
            >
              <ShieldBan size={18} />
              {blockLoading ? 'Đang xử lý...' : t('userProfile.block')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
