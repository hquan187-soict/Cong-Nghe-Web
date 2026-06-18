import React, { useState, useEffect } from 'react';
import { MessageSquare, UserMinus, UserPlus, Clock, ShieldBan, ShieldCheck, Cake, MapPin, Heart, Briefcase, GraduationCap, Phone, Mail, User } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { userService } from '../../services/user.service';
import { formatLastActive } from '../../utils/timeUtils';

const COVER_COLORS = {
  '': 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  blue: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
  cyan: 'linear-gradient(135deg, #0891b2, #06b6d4)',
  teal: 'linear-gradient(135deg, #0d9488, #14b8a6)',
  green: 'linear-gradient(135deg, #16a34a, #22c55e)',
  orange: 'linear-gradient(135deg, #ea580c, #f97316)',
  red: 'linear-gradient(135deg, #dc2626, #ef4444)',
  pink: 'linear-gradient(135deg, #db2777, #ec4899)',
  purple: 'linear-gradient(135deg, #7c3aed, #a855f7)',
  slate: 'linear-gradient(135deg, #475569, #64748b)',
  rose: 'linear-gradient(135deg, #e11d48, #f43f5e)',
  amber: 'linear-gradient(135deg, #d97706, #f59e0b)',
};

const ICON_STYLES = {
  indigo: { bg: 'var(--color-primary-light)', color: 'var(--color-primary)' },
  purple: { bg: 'rgba(124,58,237,0.1)', color: '#7c3aed' },
  emerald: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
  blue: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
};

export default function MiniProfile({ contact, isOnline, onSendMessage, onUnfriend, onAddFriend, onAcceptRequest, isLoading = false, lastSeen }) {
  const { t, lang } = useLang();
  const { user: currentUser, updateUser } = useAuth();
  const toast = useToast();
  const [blockLoading, setBlockLoading] = useState(false);
  const [fullProfile, setFullProfile] = useState(null);

  useEffect(() => {
    if (!contact?._id) { setFullProfile(null); return; }
    let cancelled = false;
    userService.getUserById(contact._id).then(data => {
      if (!cancelled) setFullProfile(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [contact?._id]);

  if (!contact) return null;

  const isBlocked = currentUser?.blockedUsers?.some(id => (id?._id || id)?.toString() === contact._id);
  const profile = fullProfile || contact;
  const coverGradient = COVER_COLORS[fullProfile?.coverColor] || COVER_COLORS[''];

  const handleBlock = async () => {
    if (!window.confirm(t('userProfile.blockConfirm'))) return;
    setBlockLoading(true);
    try {
      const updatedMe = await userService.blockUser(contact._id);
      if (updatedMe) updateUser(updatedMe);
      toast.success(t('userProfile.blockSuccess'));
    } catch (err) { toast.error(err.response?.data?.message || t('chat.blockUser')); }
    finally { setBlockLoading(false); }
  };

  const handleUnblock = async () => {
    if (!window.confirm(t('userProfile.unblockConfirm'))) return;
    setBlockLoading(true);
    try {
      const updatedMe = await userService.unblockUser(contact._id);
      if (updatedMe) updateUser(updatedMe);
      toast.success(t('userProfile.unblockSuccess'));
    } catch (err) { toast.error(err.response?.data?.message || t('chat.unblockUser')); }
    finally { setBlockLoading(false); }
  };

  function fmtBday(d) {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function genderLabel(g) {
    return g === 'male' ? t('profile.genderMale') : g === 'female' ? t('profile.genderFemale') : g === 'other' ? t('profile.genderOther') : null;
  }

  const renderInfoCard = (icon, label, value, cls = 'indigo') => {
    if (!value) return null;
    const ic = ICON_STYLES[cls] || ICON_STYLES.indigo;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)',
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: ic.bg, color: ic.color }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-word' }}>{value}</span>
        </div>
      </div>
    );
  };

  const renderFriendAction = () => {
    const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'opacity 0.15s', minWidth: 140 };
    if (contact.isFriend) {
      return (<button style={{ ...base, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }} onClick={onUnfriend} disabled={isLoading}>
        <UserMinus size={16} /> {isLoading ? '...' : t('contacts.unfriend')}
      </button>);
    }
    if (contact.requestSent) {
      return (<button style={{ ...base, background: 'var(--color-hover-bg)', color: 'var(--color-text-muted)', opacity: 0.6, cursor: 'not-allowed' }} disabled>
        <Clock size={16} /> {t('userProfile.requestSent')}
      </button>);
    }
    if (contact.hasReceivedRequest) {
      return (<button style={{ ...base, background: '#22c55e', color: '#fff' }} onClick={onAcceptRequest} disabled={isLoading}>
        <UserPlus size={16} /> {isLoading ? '...' : t('userProfile.acceptRequest')}
      </button>);
    }
    return (<button style={{ ...base, background: 'var(--color-hover-bg)', color: 'var(--color-text)' }} onClick={onAddFriend} disabled={isLoading}>
      <UserPlus size={16} /> {isLoading ? '...' : t('contacts.addFriend')}
    </button>);
  };

  const getLabelColor = (label) => {
    switch(label) {
      case 'Khách hàng': return '#ef4444';
      case 'Gia đình': return '#22c55e';
      case 'Công việc': return '#f97316';
      case 'Bạn bè': return '#a855f7';
      case 'Khác': return '#eab308';
      default: return 'transparent';
    }
  };

  const getTranslatedLabel = (label) => {
    switch(label) {
      case 'Khách hàng': return t('chat2.labelCustomer') || 'Khách hàng';
      case 'Gia đình': return t('chat2.labelFamily') || 'Gia đình';
      case 'Công việc': return t('chat2.labelWork') || 'Công việc';
      case 'Bạn bè': return t('chat2.labelFriends') || 'Bạn bè';
      case 'Khác': return t('chat2.labelOther') || 'Khác';
      default: return label;
    }
  };

  const gl = genderLabel(profile.gender);
  const hasExtended = profile.birthday || gl || profile.phone || profile.address || profile.hometown || profile.occupation || profile.education || profile.hobbies;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: 'var(--color-bg)' }}>
      {/* Banner */}
      <div style={{ height: 180, background: coverGradient, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 30px,rgba(255,255,255,0.1) 30px,rgba(255,255,255,0.1) 60px)' }} />
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
        {/* Header: avatar + name */}
        <div style={{ display: 'flex', gap: 20, marginTop: -48, position: 'relative', zIndex: 5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0 }}>
            <Avatar src={contact.avatar} alt={contact.fullName || '?'} size="xl" isOnline={isOnline} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 54 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              {contact.fullName}
              {fullProfile?.chatLabel && (
                <span style={{ fontSize: '14px', padding: '2px 10px', borderRadius: '12px', backgroundColor: getLabelColor(fullProfile.chatLabel), color: '#fff', fontWeight: '500' }}>
                  {getTranslatedLabel(fullProfile.chatLabel)}
                </span>
              )}
            </h1>
            {profile.bio && (
              <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--color-text-muted)', wordBreak: 'break-word' }}>{profile.bio}</p>
            )}
            <p style={{ margin: '4px 0 0', fontSize: 13, color: isOnline ? '#22c55e' : 'var(--color-text-muted)' }}>
              {isOnline ? t('userProfile.online') : lastSeen ? formatLastActive(lastSeen, lang) : t('userProfile.offline')}
            </p>
          </div>
        </div>

        {/* Action buttons row */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <button onClick={onSendMessage} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 999, border: 'none', background: 'var(--color-primary)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', minWidth: 140,
          }}>
            <MessageSquare size={16} /> {t('contacts.sendMessage')}
          </button>
          {renderFriendAction()}
          {isBlocked ? (
            <button onClick={handleUnblock} disabled={blockLoading} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 999, border: 'none', background: 'rgba(239,68,68,0.1)',
              color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer', minWidth: 120,
              opacity: blockLoading ? 0.6 : 1,
            }}>
              <ShieldCheck size={16} /> {blockLoading ? '...' : t('userProfile.unblock')}
            </button>
          ) : (
            <button onClick={handleBlock} disabled={blockLoading} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 999, border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text-muted)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', minWidth: 120, opacity: blockLoading ? 0.6 : 1,
            }}>
              <ShieldBan size={16} /> {blockLoading ? '...' : t('userProfile.block')}
            </button>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '24px 0' }} />

        {/* Basic info - 2 col grid */}
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>
            {t('profile.personalInfo')}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {renderInfoCard(<User size={18} />, t('profile.fullName'), contact.fullName, 'indigo')}
            {renderInfoCard(<Mail size={18} />, t('profile.email'), contact.email, 'purple')}
          </div>
        </div>

        {/* Extended info - 2 col grid */}
        {hasExtended && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>
              {t('profile.aboutMe')}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {renderInfoCard(<Cake size={18} />, t('profile.birthday'), fmtBday(profile.birthday), 'purple')}
              {renderInfoCard(<User size={18} />, t('profile.gender'), gl, 'indigo')}
              {renderInfoCard(<Phone size={18} />, t('profile.phone'), profile.phone, 'emerald')}
              {renderInfoCard(<MapPin size={18} />, t('profile.address'), profile.address, 'blue')}
              {renderInfoCard(<MapPin size={18} />, t('profile.hometown'), profile.hometown, 'purple')}
              {renderInfoCard(<Briefcase size={18} />, t('profile.occupation'), profile.occupation, 'emerald')}
              {renderInfoCard(<GraduationCap size={18} />, t('profile.education'), profile.education, 'purple')}
              {renderInfoCard(<Heart size={18} />, t('profile.hobbies'), profile.hobbies, 'indigo')}
            </div>
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>

      <style>{`
        @media (max-width: 640px) {
          [style*="grid-template-columns: repeat(2"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
