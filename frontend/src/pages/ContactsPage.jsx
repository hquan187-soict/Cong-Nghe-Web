import React, { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, ArrowLeft, MessageSquare, Phone, ChevronsLeft, ChevronsRight, Settings, Sun, Moon, Languages, Bell, Eye, Accessibility, ChevronRight, ChevronLeft, Type, ALargeSmall, Volume2, Play, UsersRound } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { userService } from '../services/user.service';
import { conversationService } from '../services/conversation.service';
import ContactItem from '../components/contacts/ContactItem';
import MiniProfile from '../components/contacts/MiniProfile';
import FriendRequestItem from '../components/contacts/FriendRequestItem';
import '../styles/contacts.css';
import '../styles/sidebar.css';

export default function ContactsPage() {
  const { t, lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const toast = useToast();
  const { onlineUsers, socket } = useSocket();
  const { fontSize, setFontSize, fontFamily, setFontFamily, FONT_SIZES, FONT_FAMILIES } = useAccessibility();
  const { user, updateUser } = useAuth();
  const { soundEnabled, setSoundEnabled, selectedSound, setSelectedSound, previewSound, SOUND_OPTIONS } = useNotification();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [groups, setGroups] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const isInSearchMode = debouncedSearchQuery.trim().length > 0;

  const SIDEBAR_MIN = 72;
  const SIDEBAR_COLLAPSE_THRESHOLD = 180;
  const SIDEBAR_DEFAULT = 320;
  const SIDEBAR_MAX_RATIO = 0.5;

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar_width');
    return saved ? Number(saved) : SIDEBAR_DEFAULT;
  });
  const sidebarCollapsed = sidebarWidth <= SIDEBAR_MIN;

  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const maxWidth = window.innerWidth * SIDEBAR_MAX_RATIO;
      let newWidth = moveEvent.clientX;
      if (newWidth < SIDEBAR_COLLAPSE_THRESHOLD) {
        newWidth = SIDEBAR_MIN;
      } else if (newWidth < SIDEBAR_DEFAULT) {
        newWidth = Math.max(newWidth, 240);
      }
      newWidth = Math.min(newWidth, maxWidth);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setSidebarWidth((w) => {
        localStorage.setItem('sidebar_width', String(w));
        return w;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleSidebarDoubleClick = useCallback(() => {
    const newWidth = sidebarCollapsed ? SIDEBAR_DEFAULT : SIDEBAR_MIN;
    setSidebarWidth(newWidth);
    localStorage.setItem('sidebar_width', String(newWidth));
  }, [sidebarCollapsed]);

  const handleToggleCollapse = useCallback(() => {
    const newWidth = sidebarCollapsed ? SIDEBAR_DEFAULT : SIDEBAR_MIN;
    setSidebarWidth(newWidth);
    localStorage.setItem('sidebar_width', String(newWidth));
  }, [sidebarCollapsed]);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showActiveStatus, setShowActiveStatus] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeStatusEnabled, setActiveStatusEnabled] = useState(() => {
    const saved = localStorage.getItem('active_status_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const settingsRef = useRef(null);
  const settingsBtnRef = useRef(null);
  const dropdownRef = useRef(null);
  const a11yPanelRef = useRef(null);
  const activeStatusPanelRef = useRef(null);
  const activeStatusBtnRef = useRef(null);
  const notifPanelRef = useRef(null);
  const notifBtnRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const [a11yPanelStyle, setA11yPanelStyle] = useState({});
  const [activeStatusPanelStyle, setActiveStatusPanelStyle] = useState({});
  const [notifPanelStyle, setNotifPanelStyle] = useState({});

  useEffect(() => {
    if (user?.showActiveStatus !== undefined) {
      setActiveStatusEnabled(user.showActiveStatus);
      localStorage.setItem('active_status_enabled', String(user.showActiveStatus));
    }
  }, [user?.showActiveStatus]);

  const handleToggleActiveStatus = useCallback(async (enabled) => {
    setActiveStatusEnabled(enabled);
    localStorage.setItem('active_status_enabled', String(enabled));
    try {
      const updatedUser = await userService.toggleActiveStatus(enabled);
      if (updatedUser) updateUser(updatedUser);
      if (socket?.connected) socket.emit('toggleActiveStatus', enabled);
    } catch (err) {
      console.error('Toggle active status error:', err);
    }
  }, [socket, updateUser]);

  useEffect(() => {
    function handleClickOutside(e) {
      const clickedInSettings = settingsRef.current?.contains(e.target);
      const clickedInDropdown = dropdownRef.current?.contains(e.target);
      const clickedInA11y = a11yPanelRef.current?.contains(e.target);
      const clickedInActiveStatus = activeStatusPanelRef.current?.contains(e.target);
      const clickedInNotif = notifPanelRef.current?.contains(e.target);
      if (!clickedInSettings && !clickedInDropdown && !clickedInA11y && !clickedInActiveStatus && !clickedInNotif) {
        setShowSettings(false);
        setShowAccessibility(false);
        setShowActiveStatus(false);
        setShowNotifications(false);
      }
    }
    if (showSettings || showAccessibility || showActiveStatus || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettings, showAccessibility, showActiveStatus, showNotifications]);

  useLayoutEffect(() => {
    if (!showSettings || !settingsBtnRef.current) return;
    const rect = settingsBtnRef.current.getBoundingClientRect();
    if (sidebarCollapsed) {
      setDropdownStyle({ left: rect.right + 8, bottom: window.innerHeight - rect.bottom });
    } else {
      setDropdownStyle({ left: rect.left, bottom: window.innerHeight - rect.top + 8 });
    }
  }, [showSettings, sidebarCollapsed]);

  useLayoutEffect(() => {
    if (!showAccessibility || !dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    setA11yPanelStyle({ left: rect.right + 8, bottom: window.innerHeight - rect.bottom });
  }, [showAccessibility]);

  useLayoutEffect(() => {
    if (!showActiveStatus || !dropdownRef.current) return;
    const dropdownRect = dropdownRef.current.getBoundingClientRect();
    setActiveStatusPanelStyle({ left: dropdownRect.right + 8, bottom: window.innerHeight - dropdownRect.bottom });
  }, [showActiveStatus]);

  useLayoutEffect(() => {
    if (!showNotifications || !dropdownRef.current) return;
    const dropdownRect = dropdownRef.current.getBoundingClientRect();
    setNotifPanelStyle({ left: dropdownRect.right + 8, bottom: window.innerHeight - dropdownRect.bottom });
  }, [showNotifications]);

  // Fetch friends list on mount
  const fetchFriendsAndRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const [friendsData, requestsData, convsData] = await Promise.all([
        userService.getFriends(),
        userService.getFriendRequests(),
        conversationService.getConversations(),
      ]);
      setFriends(Array.isArray(friendsData) ? friendsData : []);
      setFriendRequests(Array.isArray(requestsData) ? requestsData : []);
      const groupConvs = (Array.isArray(convsData) ? convsData : []).filter(c => c.isGroup && !c.removedMembers?.includes(user?._id));
      setGroups(groupConvs);
    } catch (err) {
      console.error("Fetch friends error:", err);
      toast.error("Không thể tải danh sách bạn bè");
    } finally {
      setIsLoading(false);
    }
  }, [toast, user?._id]);

  useEffect(() => {
    fetchFriendsAndRequests();
  }, [fetchFriendsAndRequests]);

  // Search users when query changes
  useEffect(() => {
    if (!isInSearchMode) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    async function doSearch() {
      setIsSearching(true);
      try {
        const data = await userService.searchUsers(debouncedSearchQuery);
        if (!cancelled) {
          setSearchResults(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Search users error:", err);
        if (!cancelled) {
          toast.error("Không thể tìm kiếm người dùng");
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }
    doSearch();
    return () => { cancelled = true; };
  }, [debouncedSearchQuery, isInSearchMode, toast]);

  const handleMessage = async (contact) => {
    try {
      const response = await conversationService.createConversation(contact._id);
      if (response && response._id) {
        localStorage.setItem('last_conversation', JSON.stringify(response));
        navigate(`/chat/${response._id}`);
      } else {
        navigate('/chat');
      }
    } catch (err) {
      console.error("Error creating/fetching conversation:", err);
      toast.error("Không thể mở cuộc trò chuyện");
      navigate('/chat');
    }
  };

  const [friendActionLoading, setFriendActionLoading] = useState(false);

  const handleAddFriend = async (contact) => {
    if (friendActionLoading) return;
    setFriendActionLoading(true);
    try {
      const response = await userService.sendFriendRequest(contact._id);
      if (response?.autoAccepted) {
        toast.success('Đã tự động kết bạn thành công!');
        fetchFriendsAndRequests();
        setSearchResults(prev => prev.map(u => u._id === contact._id ? { ...u, isFriend: true, requestSent: false, hasReceivedRequest: false } : u));
        if (selectedContact?._id === contact._id) {
          setSelectedContact(prev => ({ ...prev, isFriend: true, requestSent: false, hasReceivedRequest: false }));
        }
      } else {
        toast.success('Đã gửi lời mời kết bạn!');
        setSearchResults(prev => prev.map(u => u._id === contact._id ? { ...u, requestSent: true } : u));
        if (selectedContact?._id === contact._id) {
          setSelectedContact(prev => ({ ...prev, requestSent: true }));
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể gửi lời mời kết bạn';
      toast.error(msg);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleUnfriend = async (contact) => {
    if (friendActionLoading) return;
    setFriendActionLoading(true);
    try {
      await userService.unfriend(contact._id);
      toast.success('Đã hủy kết bạn!');
      setFriends(prev => prev.filter(u => u._id !== contact._id));
      setSearchResults(prev => prev.map(u => u._id === contact._id ? { ...u, isFriend: false } : u));
      if (selectedContact?._id === contact._id) {
        setSelectedContact(prev => ({ ...prev, isFriend: false }));
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể hủy kết bạn';
      toast.error(msg);
    } finally {
      setFriendActionLoading(false);
    }
  };
  
  const handleAcceptRequest = async (userId) => {
    try {
      await userService.acceptFriendRequest(userId);
      toast.success(t('contacts.acceptSuccess') || 'Đã chấp nhận kết bạn!');
      setFriendRequests(prev => prev.filter(u => u._id !== userId));
      fetchFriendsAndRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleRejectRequest = async (userId) => {
    try {
      await userService.rejectFriendRequest(userId);
      toast.success(t('contacts.rejectSuccess') || 'Đã từ chối lời mời!');
      setFriendRequests(prev => prev.filter(u => u._id !== userId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const isUserOnline = (userId) => {
    return onlineUsers.some(id => id.toString() === userId.toString());
  };

  return (
    <div className="contacts-layout">
      {/* Sidebar Wrapper - matches Chat layout resizing logic */}
      <div 
        className={`sidebar-wrapper ${isDragging ? 'sidebar-wrapper--dragging' : ''}`} 
        style={{ width: sidebarWidth, minWidth: sidebarWidth }}
      >
        <aside className={`contacts-sidebar ${sidebarCollapsed ? 'contacts-sidebar--collapsed' : ''}`} style={{ width: '100%' }}>
          
          {/* Navigation Tabs - matches Chat page Sidebar */}
          {sidebarCollapsed ? (
            <div className="sidebar-nav-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 'calc(12px + var(--safe-area-top)) 0 12px', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface)', width: '100%', alignItems: 'center' }}>
              <button
                className="sidebar-nav__tab-vertical"
                style={{ width: '40px', height: '40px', background: 'transparent', border: 'none', borderRadius: '50%', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => navigate('/chat')}
                title={t('chat.title')}
              >
                <MessageSquare size={20} />
              </button>
              <button
                className="sidebar-nav__tab-vertical"
                style={{ width: '40px', height: '40px', background: 'transparent', border: 'none', borderRadius: '50%', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => navigate('/chat?tab=calls')}
                title={t('call.history')}
              >
                <Phone size={20} />
              </button>
              <button
                className="sidebar-nav__tab-vertical sidebar-nav__tab-vertical--active"
                style={{ width: '40px', height: '40px', background: 'var(--color-primary-light)', border: 'none', borderRadius: '50%', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title={t('contacts.title')}
              >
                <Users size={20} />
              </button>
            </div>
          ) : (
            <div className="sidebar-nav" style={{ display: 'flex', paddingTop: 'var(--safe-area-top)', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface)' }}>
              <button
                className="sidebar-nav__tab"
                style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}
                onClick={() => navigate('/chat')}
              >
                <MessageSquare size={18} /> {t('chat.title')}
              </button>
              <button
                className="sidebar-nav__tab"
                style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}
                onClick={() => navigate('/chat?tab=calls')}
              >
                <Phone size={18} /> {t('call.history')}
              </button>
              <button
                className="sidebar-nav__tab sidebar-nav__tab--active"
                style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: '2px solid var(--color-primary)', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}
              >
                <Users size={18} /> {t('contacts.title')}
              </button>
            </div>
          )}

          {/* Sidebar Header */}
          {!sidebarCollapsed && (
            <div className="contacts-sidebar__header">
              <h2 className="contacts-sidebar__title">{t('contacts.title')}</h2>
              
              <div className="contacts-search">
                <Search size={18} className="contacts-search__icon" />
                <input 
                  type="text" 
                  className="contacts-search__input"
                  placeholder={t('contacts.searchPlaceholder')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Contacts List */}
          <div className="contacts-list" style={sidebarCollapsed ? { padding: '8px 0' } : {}}>
            {isInSearchMode ? (
              <>
                {!sidebarCollapsed && (
                  <div className="contacts-list__title">
                    {t('contacts.searchResults') || 'Kết quả tìm kiếm'} ({searchResults.length})
                  </div>
                )}
                {isSearching ? (
                  <div className="sidebar__loading">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="sidebar__skeleton">
                        <div className="sidebar__skeleton-avatar" style={{ margin: sidebarCollapsed ? '0 auto' : '0' }}></div>
                        {!sidebarCollapsed && (
                          <div className="sidebar__skeleton-content">
                            <div className="sidebar__skeleton-line sidebar__skeleton-line--short"></div>
                            <div className="sidebar__skeleton-line sidebar__skeleton-line--long"></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map(contact => (
                    <ContactItem
                      key={contact._id}
                      contact={contact}
                      isActive={selectedContact?._id === contact._id}
                      isOnline={isUserOnline(contact._id)}
                      onClick={setSelectedContact}
                      onMessage={handleMessage}
                      collapsed={sidebarCollapsed}
                    />
                  ))
                ) : (
                  <div className="contacts-empty-state">
                    <Users size={sidebarCollapsed ? 24 : 48} />
                    {!sidebarCollapsed && <p>{t('contacts.noResults') || 'Không tìm thấy kết quả'}</p>}
                  </div>
                )}
              </>
            ) : (
              <>
                {!sidebarCollapsed && friendRequests.length > 0 && (
                  <>
                    <div className="contacts-list__title" style={{ marginTop: '0', color: 'var(--color-primary)' }}>
                      {t('contacts.friendRequests') || 'Lời mời kết bạn'} ({friendRequests.length})
                    </div>
                    {friendRequests.map(reqUser => (
                      <FriendRequestItem
                        key={reqUser._id}
                        type="received"
                        request={{ _id: reqUser._id, from: reqUser, createdAt: new Date().toISOString() }}
                        onAccept={() => handleAcceptRequest(reqUser._id)}
                        onDecline={() => handleRejectRequest(reqUser._id)}
                      />
                    ))}
                    <div className="sidebar__divider" style={{ margin: '8px 16px' }} />
                  </>
                )}

                {!sidebarCollapsed && (
                  <div className="contacts-list__title">
                    {t('contacts.friends')} ({friends.length})
                  </div>
                )}

                {isLoading ? (
                  <div className="sidebar__loading">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="sidebar__skeleton">
                        <div className="sidebar__skeleton-avatar" style={{ margin: sidebarCollapsed ? '0 auto' : '0' }}></div>
                        {!sidebarCollapsed && (
                          <div className="sidebar__skeleton-content">
                            <div className="sidebar__skeleton-line sidebar__skeleton-line--short"></div>
                            <div className="sidebar__skeleton-line sidebar__skeleton-line--long"></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : friends.length > 0 ? (
                  friends.map(contact => (
                    <ContactItem
                      key={contact._id}
                      contact={{ ...contact, isFriend: true }}
                      isActive={selectedContact?._id === contact._id && !selectedGroup}
                      isOnline={isUserOnline(contact._id)}
                      onClick={(c) => { setSelectedContact({ ...c, isFriend: true }); setSelectedGroup(null); }}
                      onMessage={handleMessage}
                      collapsed={sidebarCollapsed}
                    />
                  ))
                ) : (
                  <div className="contacts-empty-state">
                    <Users size={sidebarCollapsed ? 24 : 48} />
                    {!sidebarCollapsed && <p>{t('contacts.noFriends')}</p>}
                  </div>
                )}

                {/* Groups section */}
                {!isLoading && (
                  <>
                    {!sidebarCollapsed && (
                      <>
                        <div className="sidebar__divider" style={{ margin: '8px 16px' }} />
                        <div className="contacts-list__title">
                          {t('contacts.groups')} ({groups.length})
                        </div>
                      </>
                    )}
                    {groups.length > 0 ? (
                      groups.map(group => (
                        <div
                          key={group._id}
                          className={`contact-item ${selectedGroup?._id === group._id ? 'contact-item--active' : ''}`}
                          onClick={() => { setSelectedGroup(group); setSelectedContact(null); }}
                          style={sidebarCollapsed ? { justifyContent: 'center', padding: '10px 0' } : {}}
                        >
                          <div className="contact-item__avatar" style={{ position: 'relative' }}>
                            {group.avatar ? (
                              <img src={group.avatar} alt={group.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                                <UsersRound size={20} />
                              </div>
                            )}
                          </div>
                          {!sidebarCollapsed && (
                            <div className="contact-item__info">
                              <span className="contact-item__name">{group.name || t('chat.createGroup')}</span>
                              <span className="contact-item__mutual">{group.members?.length || 0} {t('chat.members')}</span>
                            </div>
                          )}
                        </div>
                      ))
                    ) : !sidebarCollapsed ? (
                      <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                        {t('contacts.noGroups')}
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer — Settings + Toggle */}
          <div className="sidebar__footer">
            {sidebarCollapsed ? (
              <>
                <div className="sidebar__footer-col" ref={settingsRef}>
                  <button
                    ref={settingsBtnRef}
                    className={`sidebar__footer-btn tooltip-wrapper ${showSettings ? 'sidebar__footer-btn--active' : ''}`}
                    onClick={() => { setShowSettings(v => !v); setShowAccessibility(false); }}
                  >
                    <Settings size={20} />
                    {!showSettings && <span className="tooltip tooltip--right">{t('settings.title')}</span>}
                  </button>
                </div>
                <button
                  className="sidebar__footer-btn tooltip-wrapper"
                  onClick={handleToggleCollapse}
                >
                  <ChevronsRight size={20} />
                  <span className="tooltip tooltip--right">{t('chat.expandSidebar')}</span>
                </button>
              </>
            ) : (
              <div className="sidebar__footer-row" ref={settingsRef}>
                <div className="sidebar__footer-settings-wrapper">
                  <button
                    ref={settingsBtnRef}
                    className={`sidebar__footer-btn tooltip-wrapper ${showSettings ? 'sidebar__footer-btn--active' : ''}`}
                    onClick={() => { setShowSettings(v => !v); setShowAccessibility(false); }}
                  >
                    <Settings size={20} />
                    {!showSettings && <span className="tooltip tooltip--top">{t('settings.title')}</span>}
                  </button>
                </div>
                <button
                  className="sidebar__footer-btn tooltip-wrapper"
                  onClick={handleToggleCollapse}
                >
                  <ChevronsLeft size={20} />
                  <span className="tooltip tooltip--top">{t('chat.collapseSidebar')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Settings dropdown */}
          {showSettings && (
            <div className="sidebar__settings-dropdown" ref={dropdownRef} style={dropdownStyle}>
              <div className="sidebar__settings-header">
                <Settings size={16} />
                <span>{t('settings.title')}</span>
              </div>
              <div className="sidebar__settings-divider" />
              <button className="sidebar__settings-item" onClick={toggleTheme}>
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                <div className="sidebar__settings-item-text">
                  <span>{t('settings.theme')}</span>
                </div>
                <span className="sidebar__settings-value">
                  {theme === 'light' ? t('settings.lightMode') : t('settings.darkMode')}
                </span>
              </button>
              <button className="sidebar__settings-item" onClick={toggleLang}>
                <Languages size={16} />
                <div className="sidebar__settings-item-text">
                  <span>{t('settings.language')}</span>
                </div>
                <span className="sidebar__settings-value">{lang === 'vi' ? 'Tiếng Việt' : 'English'}</span>
              </button>
              <div className="sidebar__settings-divider" />
              <button ref={notifBtnRef} className="sidebar__settings-item" onClick={() => { setShowNotifications(true); setShowAccessibility(false); setShowActiveStatus(false); }}>
                <Bell size={16} />
                <div className="sidebar__settings-item-text">
                  <span>{t('settings.notifications')}</span>
                  <span className="sidebar__settings-desc">{t('settings.notificationsDesc')}</span>
                </div>
                <ChevronRight size={14} className="sidebar__settings-arrow" />
              </button>
              <button ref={activeStatusBtnRef} className="sidebar__settings-item" onClick={() => { setShowActiveStatus(true); setShowAccessibility(false); setShowNotifications(false); }}>
                <Eye size={16} />
                <div className="sidebar__settings-item-text">
                  <span>{t('settings.activeStatus')}</span>
                  <span className="sidebar__settings-desc">{t('settings.activeStatusDesc')}</span>
                </div>
                <ChevronRight size={14} className="sidebar__settings-arrow" />
              </button>
              <button className="sidebar__settings-item" onClick={() => { setShowAccessibility(true); setShowActiveStatus(false); setShowNotifications(false); }}>
                <Accessibility size={16} />
                <div className="sidebar__settings-item-text">
                  <span>{t('settings.accessibility')}</span>
                  <span className="sidebar__settings-desc">{t('settings.accessibilityDesc')}</span>
                </div>
                <ChevronRight size={14} className="sidebar__settings-arrow" />
              </button>
            </div>
          )}

          {/* Accessibility sub-panel */}
          {showAccessibility && showSettings && (
            <div className="sidebar__a11y-panel" ref={a11yPanelRef} style={a11yPanelStyle}>
              <div className="sidebar__settings-header">
                <button className="sidebar__a11y-back" onClick={() => setShowAccessibility(false)}>
                  <ChevronLeft size={16} />
                </button>
                <span>{t('settings.accessibility')}</span>
              </div>
              <div className="sidebar__settings-divider" />
              <div className="sidebar__a11y-section">
                <div className="sidebar__a11y-label">
                  <ALargeSmall size={15} />
                  <span>{t('settings.fontSize')}</span>
                </div>
                <div className="sidebar__a11y-options">
                  {FONT_SIZES.map((s) => (
                    <button key={s.value} className={`sidebar__a11y-option ${fontSize === s.value ? 'sidebar__a11y-option--active' : ''}`} onClick={() => setFontSize(s.value)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sidebar__settings-divider" />
              <div className="sidebar__a11y-section">
                <div className="sidebar__a11y-label">
                  <Type size={15} />
                  <span>{t('settings.fontFamily')}</span>
                </div>
                <div className="sidebar__a11y-font-list">
                  {FONT_FAMILIES.map((f) => (
                    <button key={f.value} className={`sidebar__a11y-font-item ${fontFamily === f.value ? 'sidebar__a11y-font-item--active' : ''}`} onClick={() => setFontFamily(f.value)} style={{ fontFamily: f.value }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active Status sub-panel */}
          {showActiveStatus && showSettings && (
            <div className="sidebar__active-status-panel" ref={activeStatusPanelRef} style={activeStatusPanelStyle}>
              <div className="sidebar__settings-header">
                <button className="sidebar__a11y-back" onClick={() => setShowActiveStatus(false)}>
                  <ChevronLeft size={16} />
                </button>
                <span>{t('settings.activeStatus')}</span>
              </div>
              <div className="sidebar__settings-divider" />
              <div className="sidebar__a11y-section">
                <div className="sidebar__active-status-toggle">
                  <span className="sidebar__active-status-label">{t('settings.activeStatusToggle')}</span>
                  <button
                    className={`sidebar__toggle-switch ${activeStatusEnabled ? 'sidebar__toggle-switch--on' : ''}`}
                    onClick={() => handleToggleActiveStatus(!activeStatusEnabled)}
                  >
                    <span className="sidebar__toggle-knob" />
                  </button>
                </div>
                <p className="sidebar__active-status-info">{t('settings.activeStatusInfo')}</p>
              </div>
            </div>
          )}

          {/* Notifications sub-panel */}
          {showNotifications && showSettings && (
            <div className="sidebar__a11y-panel" ref={notifPanelRef} style={notifPanelStyle}>
              <div className="sidebar__settings-header">
                <button className="sidebar__a11y-back" onClick={() => setShowNotifications(false)}>
                  <ChevronLeft size={16} />
                </button>
                <span>{t('settings.notifSoundTitle')}</span>
              </div>
              <div className="sidebar__settings-divider" />

              <div className="sidebar__a11y-section">
                <div className="sidebar__active-status-toggle">
                  <span className="sidebar__active-status-label">{t('settings.notifSoundEnable')}</span>
                  <button
                    className={`sidebar__toggle-switch ${soundEnabled ? 'sidebar__toggle-switch--on' : ''}`}
                    onClick={() => setSoundEnabled(!soundEnabled)}
                  >
                    <span className="sidebar__toggle-knob" />
                  </button>
                </div>
              </div>

              <div className="sidebar__settings-divider" />

              <div className="sidebar__a11y-section">
                <div className="sidebar__a11y-label">
                  <Volume2 size={15} />
                  <span>{t('settings.notifSoundSelect')}</span>
                </div>
                <div className="sidebar__a11y-font-list">
                  {SOUND_OPTIONS.map((opt) => {
                    const labelKey = {
                      none: 'settings.notifSoundNone',
                      pop1: 'settings.notifSoundPop1',
                      pop2: 'settings.notifSoundPop2',
                      pop3: 'settings.notifSoundPop3',
                    }[opt.value];
                    return (
                      <div key={opt.value} className="sidebar__notif-sound-row">
                        <button
                          className={`sidebar__a11y-font-item ${selectedSound === opt.value ? 'sidebar__a11y-font-item--active' : ''}`}
                          onClick={() => setSelectedSound(opt.value)}
                          style={{ flex: 1 }}
                        >
                          {t(labelKey)}
                        </button>
                        {opt.value !== 'none' && (
                          <button
                            className="sidebar__notif-preview-btn"
                            onClick={() => previewSound(opt.value)}
                            title={t('settings.notifSoundPreview')}
                          >
                            <Play size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Resize handle */}
        <div
          className="sidebar-resize-handle"
          onMouseDown={handleResizeStart}
          onDoubleClick={handleSidebarDoubleClick}
        />
      </div>

      {/* Main Panel */}
      <main className={`contacts-main ${selectedContact ? 'contacts-main--active' : ''}`}>
        <div className="contacts-main__mobile-header" style={{ display: 'none' }}>
          <button className="contacts-main__back-btn" onClick={() => setSelectedContact(null)}>
            <ArrowLeft size={20} />
          </button>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>{t('profile.title')}</span>
        </div>

        {selectedGroup ? (
          <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: 'var(--color-bg)' }}>
            {/* Group banner */}
            <div style={{ height: 180, background: 'linear-gradient(135deg, var(--color-primary), #7c3aed)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 30px,rgba(255,255,255,0.1) 30px,rgba(255,255,255,0.1) 60px)' }} />
            </div>
            <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
              {/* Group header */}
              <div style={{ display: 'flex', gap: 20, marginTop: -48, position: 'relative', zIndex: 5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flexShrink: 0 }}>
                  {selectedGroup.avatar ? (
                    <img src={selectedGroup.avatar} alt={selectedGroup.name} style={{ width: 112, height: 112, borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--color-bg)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
                  ) : (
                    <div style={{ width: 112, height: 112, borderRadius: '50%', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', border: '4px solid var(--color-bg)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                      <UsersRound size={48} />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 54 }}>
                  <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedGroup.name || t('chat.createGroup')}
                    {(() => {
                      const groupLabel = selectedGroup.labels ? (selectedGroup.labels instanceof Map ? selectedGroup.labels.get(user?._id?.toString()) : selectedGroup.labels[user?._id?.toString()]) : null;
                      if (!groupLabel) return null;
                      return (
                        <span style={{ fontSize: '14px', padding: '2px 10px', borderRadius: '12px', backgroundColor: (() => {
                          switch(groupLabel) {
                            case 'Khách hàng': return '#ef4444';
                            case 'Gia đình': return '#22c55e';
                            case 'Công việc': return '#f97316';
                            case 'Bạn bè': return '#a855f7';
                            case 'Khác': return '#eab308';
                            default: return 'transparent';
                          }
                        })(), color: '#fff', fontWeight: '500' }}>
                          {groupLabel}
                        </span>
                      );
                    })()}
                  </h1>
                  <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--color-text-muted)' }}>
                    {selectedGroup.members?.length || 0} {t('chat.members')}
                  </p>
                </div>
              </div>

              {/* Open chat button */}
              <div style={{ marginTop: 20 }}>
                <button onClick={() => { localStorage.setItem('last_conversation', JSON.stringify(selectedGroup)); navigate(`/chat/${selectedGroup._id}`); }}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 24px', borderRadius: 999, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  <MessageSquare size={16} /> {t('contacts.openChat')}
                </button>
              </div>

              <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '24px 0' }} />

              {/* Members list */}
              <div>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>
                  {t('contacts.groupMembers')} ({selectedGroup.members?.length || 0})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {(selectedGroup.members || []).map(member => (
                    <div key={member._id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)',
                    }}>
                      {member.avatar ? (
                        <img src={member.avatar} alt={member.fullName} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                          {(member.fullName || '?').charAt(0)}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.fullName || t('chat.unknownUser')}
                          {member._id === user?._id && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 4 }}>({t('call.you')})</span>}
                        </div>
                        {selectedGroup.admins?.some(a => (a?._id || a)?.toString() === member._id) && (
                          <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>{t('chat.admin')}</span>
                        )}
                      </div>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: isUserOnline(member._id) ? '#22c55e' : 'var(--color-text-muted)', flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ height: 40 }} />
            </div>
          </div>
        ) : selectedContact ? (
          <MiniProfile
            contact={selectedContact}
            isOnline={isUserOnline(selectedContact._id)}
            onSendMessage={() => handleMessage(selectedContact)}
            onUnfriend={() => handleUnfriend(selectedContact)}
            onAddFriend={() => handleAddFriend(selectedContact)}
            onAcceptRequest={() => handleAcceptRequest(selectedContact._id)}
            isLoading={friendActionLoading}
            lastSeen={selectedContact.lastSeen}
          />
        ) : (
          <div className="contacts-empty-state" style={{ background: 'var(--color-bg)' }}>
            <div style={{ padding: '24px', background: 'var(--color-surface)', borderRadius: '50%', marginBottom: '24px', boxShadow: 'var(--shadow-sm)' }}>
              <Users size={64} style={{ opacity: 1, color: 'var(--color-primary)', margin: 0 }} />
            </div>
            <h3 style={{ fontSize: '20px', color: 'var(--color-text)', marginBottom: '8px' }}>
              {t('contacts.selectContact')}
            </h3>
            <p style={{ maxWidth: '300px', margin: 0 }}>
              {t('contacts.noFriendsDesc')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
