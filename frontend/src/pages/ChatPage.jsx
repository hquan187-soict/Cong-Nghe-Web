import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WarningPopup from '../components/WarningPopup'
import {
  User, MessageSquare, Phone, Video, Info, X,
  BellOff, Bell, Search, ChevronDown, Sparkles,
  Palette, AtSign, SmilePlus, Image, FileText,
  ShieldBan, ChevronRight, Users, LogOut,
  Camera, Loader2, UserPlus, Plus, MoreVertical,
  MessageCircle, UserMinus, Shield, Check, Archive, Pin,
  ThumbsUp, Heart, Smile, Flame, Star, Coffee, Zap, Sun, Moon, Music, Leaf, ShieldCheck,
  ChevronsDown
} from 'lucide-react'

const THEME_COLOR_PRESETS = [
  { name: 'Mặc định', color: null },
  { name: 'Tím', color: '#7c3aed' },
  { name: 'Xanh lá', color: '#16a34a' },
  { name: 'Đỏ', color: '#dc2626' },
  { name: 'Hồng', color: '#db2777' },
  { name: 'Cam', color: '#ea580c' },
  { name: 'Vàng', color: '#ca8a04' },
  { name: 'Xanh dương đậm', color: '#2563eb' },
]

const EMOJI_OPTIONS = [
  { name: 'ThumbsUp', icon: ThumbsUp, label: 'Thích' },
  { name: 'Heart', icon: Heart, label: 'Yêu thích' },
  { name: 'Smile', icon: Smile, label: 'Cười' },
  { name: 'Flame', icon: Flame, label: 'Lửa' },
  { name: 'Star', icon: Star, label: 'Ngôi sao' },
  { name: 'Coffee', icon: Coffee, label: 'Cà phê' },
  { name: 'Zap', icon: Zap, label: 'Sấm sét' },
  { name: 'Sun', icon: Sun, label: 'Mặt trời' },
  { name: 'Moon', icon: Moon, label: 'Mặt trăng' },
  { name: 'Music', icon: Music, label: 'Âm nhạc' },
  { name: 'Leaf', icon: Leaf, label: 'Lá' },
]
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { formatLastActive } from '../utils/timeUtils'
import { userService } from '../services/user.service'
import { conversationService } from '../services/conversation.service'
import { messageService } from '../services/message.service'
import { useToast } from '../context/ToastContext'
import { useNotification } from '../context/NotificationContext'

import Sidebar from '../components/chat/Sidebar'
import ChatWindow from '../components/ChatWindow'
import Avatar from '../components/ui/Avatar'
import ProfileModal from '../components/ProfileModal'
import UserProfileModal from '../components/UserProfileModal'
import ConfirmModal from '../components/ui/ConfirmModal'
import ImageLightbox from '../components/chat/ImageLightbox'
import PinnedPollBar from '../components/chat/PinnedPollBar'
import { useMentionNotification } from '../context/MentionNotificationContext'
import { useCall } from '../context/CallContext'
import { Play } from 'lucide-react'

function ChatPage() {
  const { t, lang } = useLang()
  const { user, updateUser } = useAuth()
  const { socket, isConnected, onlineUsers } = useSocket()
  const { conversationId: urlConversationId } = useParams()
  const navigate = useNavigate()

  const toast = useToast()
  const { playSound } = useNotification()
  const { initiateCall, activeCall } = useCall()
  const { setNavigateToMessage } = useMentionNotification()
  const currentUserId = user?._id?.toString()
  const avatarInputRef = useRef(null)

  useEffect(() => {
    document.body.classList.add('chat-viewport-locked')
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    return () => {
      document.body.classList.remove('chat-viewport-locked')
    }
  }, [])

  const [isEditingName, setIsEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false)

  const [selectedConversation, setSelectedConversation] = useState(() => {
    try {
      const saved = localStorage.getItem('last_conversation')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  // Sync edit name state when selected conversation changes
  useEffect(() => {
    if (selectedConversation) {
      setEditNameValue(selectedConversation.name || selectedConversation.groupName || '')
      setIsEditingName(false)
    }
  }, [selectedConversation])

  const handleSaveName = async () => {
    if (!editNameValue.trim() || isUpdatingName) return
    setIsUpdatingName(true)
    try {
      const updatedConv = await conversationService.updateGroup(selectedConversation._id, {
        name: editNameValue.trim()
      })
      setSelectedConversation(updatedConv)
      localStorage.setItem('last_conversation', JSON.stringify(updatedConv))

      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      toast.success(t('chat.groupNameUpdated') || 'Cập nhật tên nhóm thành công!')
      setIsEditingName(false)
    } catch (err) {
      console.error('Update group name error:', err)
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật tên nhóm.'
      toast.error(msg)
    } finally {
      setIsUpdatingName(false)
    }
  }

  const handleTriggerAvatarUpload = () => {
    avatarInputRef.current?.click()
  }

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit file size to 5MB (similar to user avatar updates)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 5MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const base64Image = reader.result
      setIsUpdatingAvatar(true)
      try {
        const updatedConv = await conversationService.updateGroup(selectedConversation._id, {
          avatar: base64Image
        })
        setSelectedConversation(updatedConv)
        localStorage.setItem('last_conversation', JSON.stringify(updatedConv))

        if (sidebarRef.current?.updateConversationDetails) {
          sidebarRef.current.updateConversationDetails(updatedConv)
        }
        toast.success(t('chat.groupAvatarUpdated') || 'Cập nhật ảnh nhóm thành công!')
      } catch (err) {
        console.error('Update group avatar error:', err)
        const msg = err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật ảnh nhóm.'
        toast.error(msg)
      } finally {
        setIsUpdatingAvatar(false)
      }
    }
    reader.onerror = () => {
      toast.error('Có lỗi xảy ra khi đọc tệp ảnh.')
    }
    reader.readAsDataURL(file)
  }

  const handleLeaveGroup = async () => {
    if (!window.confirm(t('chat.leaveGroupConfirm') || 'Bạn có chắc chắn muốn rời nhóm?')) return
    try {
      await conversationService.leaveGroup(selectedConversation._id)
      if (sidebarRef.current?.removeConversation) {
        sidebarRef.current.removeConversation(selectedConversation._id)
      }
      setSelectedConversation(null)
      localStorage.removeItem('last_conversation')
      navigate('/chat', { replace: true })
      toast.success(t('chat.leftGroup') || 'Đã rời nhóm thành công!')
    } catch (err) {
      console.error('Leave group error:', err)
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi rời nhóm.')
    }
  }

  // Mute / Archive state
  const isMuted = selectedConversation?.mutedBy?.some(
    id => (id._id || id).toString() === currentUserId
  )
  const isArchived = selectedConversation?.archivedBy?.some(
    id => (id._id || id).toString() === currentUserId
  )

  const handleToggleMute = async () => {
    if (sidebarRef.current?.handleMute) {
      const updatedConv = await sidebarRef.current.handleMute(selectedConversation._id)
      if (updatedConv) {
        setSelectedConversation(updatedConv)
        localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      }
    }
  }

  const handleToggleArchive = async () => {
    try {
      const updatedConv = await conversationService.toggleArchiveConversation(selectedConversation._id)
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      const nowArchived = updatedConv.archivedBy?.some(id => (id._id || id).toString() === currentUserId)
      toast.success(nowArchived ? 'Đã lưu trữ cuộc trò chuyện' : 'Đã bỏ lưu trữ cuộc trò chuyện')
      if (nowArchived) {
        setSelectedConversation(null)
        localStorage.removeItem('last_conversation')
        navigate('/chat', { replace: true })
      } else {
        setSelectedConversation(updatedConv)
        localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isUpdatingEmoji, setIsUpdatingEmoji] = useState(false)

  const handleUpdateEmoji = async (emojiName) => {
    setIsUpdatingEmoji(true)
    try {
      const updatedConv = await conversationService.updateEmoji(selectedConversation._id, emojiName)
      setSelectedConversation(updatedConv)
      localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      toast.success('Đã cập nhật biểu tượng!')
      setShowEmojiPicker(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setIsUpdatingEmoji(false)
    }
  }

  // Theme color picker state
  const [showThemeColorPicker, setShowThemeColorPicker] = useState(false)
  const [isUpdatingThemeColor, setIsUpdatingThemeColor] = useState(false)

  const handleUpdateThemeColor = async (color) => {
    setIsUpdatingThemeColor(true)
    try {
      const updatedConv = await conversationService.updateThemeColor(selectedConversation._id, color)
      setSelectedConversation(updatedConv)
      localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      toast.success('Đã cập nhật màu chủ đề!')
      setShowThemeColorPicker(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setIsUpdatingThemeColor(false)
    }
  }

  // Nickname modal
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [nicknameTarget, setNicknameTarget] = useState(null)
  const [nicknameValue, setNicknameValue] = useState('')
  const [isUpdatingNickname, setIsUpdatingNickname] = useState(false)

  const handleOpenNicknameModal = (member) => {
    setNicknameTarget(member)
    const existingNickname = selectedConversation?.nicknames?.[member._id] || ''
    setNicknameValue(existingNickname)
    setShowNicknameModal(true)
  }

  const handleSaveNickname = async () => {
    if (!nicknameTarget) return
    setIsUpdatingNickname(true)
    try {
      const updatedConv = await conversationService.updateNickname(
        selectedConversation._id,
        nicknameTarget._id,
        nicknameValue.trim()
      )
      setSelectedConversation(updatedConv)
      localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      toast.success('Đã cập nhật biệt danh!')
      setShowNicknameModal(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setIsUpdatingNickname(false)
    }
  }

  const [showAddMemberSearch, setShowAddMemberSearch] = useState(false)
  const [addMemberQuery, setAddMemberQuery] = useState('')
  const [addMemberResults, setAddMemberResults] = useState([])
  const [isSearchingMember, setIsSearchingMember] = useState(false)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const addMemberTimerRef = useRef(null)

  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearchingMessage, setIsSearchingMessage] = useState(false)
  const searchMessageTimerRef = useRef(null)

  useEffect(() => {
    // Reset search and jump state when conversation changes
    setShowSearchPanel(false)
    setSearchQuery('')
    setSearchResults([])
    setIsSearchingMessage(false)
    setJumpedToMessage(false)
  }, [selectedConversation?._id])

  const handleMessageSearch = (query) => {
    setSearchQuery(query)
    if (searchMessageTimerRef.current) clearTimeout(searchMessageTimerRef.current)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    searchMessageTimerRef.current = setTimeout(async () => {
      setIsSearchingMessage(true)
      try {
        const results = await messageService.searchMessages(selectedConversation._id, query.trim())
        setSearchResults(Array.isArray(results) ? results : (results?.data || []))
      } catch (err) {
        console.error('Search message error:', err)
      } finally {
        setIsSearchingMessage(false)
      }
    }, 300)
  }

  const handleSearchResultClick = async (messageId) => {
    const isMobile = window.innerWidth < 768
    if (isMobile) {
      setShowSearchPanel(false)
      setShowInfoPanel(false)
    }
    const delay = isMobile ? 350 : 0
    await new Promise(r => setTimeout(r, delay))

    const el = document.getElementById(`msg-${messageId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('mention-flash')
      setTimeout(() => el.classList.remove('mention-flash'), 2500)
      return
    }

    try {
      const res = await messageService.getMessagesAround(selectedConversation._id, messageId)
      const msgs = res?.messages || res?.data?.messages || []
      if (msgs.length > 0 && chatWindowRef.current?.jumpToMessages) {
        chatWindowRef.current.jumpToMessages(msgs, messageId)
        setJumpedToMessage(true)
      } else {
        toast.info('Không thể tải tin nhắn.')
      }
    } catch {
      toast.info('Không thể tải tin nhắn.')
    }
  }

  const handleAddMemberSearch = (query) => {
    setAddMemberQuery(query)
    if (addMemberTimerRef.current) clearTimeout(addMemberTimerRef.current)
    if (!query.trim() || query.trim().length < 2) {
      setAddMemberResults([])
      return
    }
    addMemberTimerRef.current = setTimeout(async () => {
      setIsSearchingMember(true)
      try {
        const users = await userService.searchUsers(query.trim())
        const memberIds = selectedConversation.members.map(m => m._id?.toString())
        const pendingIds = (selectedConversation.pendingRequests || []).map(r => {
          const uid = r.userId
          return typeof uid === 'object' ? uid._id?.toString() : uid?.toString()
        })
        const filtered = (Array.isArray(users) ? users : []).filter(u =>
          !memberIds.includes(u._id?.toString()) && !pendingIds.includes(u._id?.toString())
        )
        setAddMemberResults(filtered)
      } catch (err) {
        console.error('Search users error:', err)
      } finally {
        setIsSearchingMember(false)
      }
    }, 300)
  }

  const handleAddMember = async (userId) => {
    setIsAddingMember(true)
    try {
      const adminIds = (selectedConversation.admins || []).map(a => typeof a === 'object' ? a._id?.toString() : a?.toString())
      const currentIsAdmin = adminIds.includes(currentUserId)
      const needsApproval = selectedConversation.addMemberPermission === 'admin' && !currentIsAdmin

      if (needsApproval) {
        const updatedConv = await conversationService.requestAddMember(selectedConversation._id, userId)
        setSelectedConversation(updatedConv)
        localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
        if (sidebarRef.current?.updateConversationDetails) {
          sidebarRef.current.updateConversationDetails(updatedConv)
        }
        toast.success(t('chat.requestSent') || 'Đã gửi yêu cầu thêm thành viên!')
      } else {
        const updatedConv = await conversationService.addMember(selectedConversation._id, userId)
        setSelectedConversation(updatedConv)
        localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
        if (sidebarRef.current?.updateConversationDetails) {
          sidebarRef.current.updateConversationDetails(updatedConv)
        }
        toast.success(t('chat.memberAdded') || 'Đã thêm thành viên!')
      }
      setAddMemberQuery('')
      setAddMemberResults([])
    } catch (err) {
      console.error('Add member error:', err)
      toast.error(err.response?.data?.message || err.message || 'Có lỗi xảy ra khi thêm thành viên.')
    } finally {
      setIsAddingMember(false)
    }
  }

  const handleApproveRequest = async (userId) => {
    try {
      const updatedConv = await conversationService.approveRequest(selectedConversation._id, userId)
      setSelectedConversation(updatedConv)
      localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      toast.success(t('chat.requestApproved') || 'Đã duyệt yêu cầu!')
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Có lỗi xảy ra')
    }
  }

  const handleRejectRequest = async (userId) => {
    try {
      const updatedConv = await conversationService.rejectRequest(selectedConversation._id, userId)
      setSelectedConversation(updatedConv)
      localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      toast.success(t('chat.requestRejected') || 'Đã từ chối yêu cầu!')
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Có lỗi xảy ra')
    }
  }

  const isGroup = selectedConversation?.isGroup

  const [isKicked, setIsKicked] = useState(false)
  const [memberMenuId, setMemberMenuId] = useState(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(null)
  const [isRemovingMember, setIsRemovingMember] = useState(false)
  const memberMenuRef = useRef(null)

  useEffect(() => {
    if (!selectedConversation || !isGroup || !currentUserId) {
      setIsKicked(false)
      return
    }
    const isMember = selectedConversation.members?.some(
      m => (m._id || m).toString() === currentUserId
    )
    const isRemoved = selectedConversation.removedMembers?.some(
      id => (id._id || id).toString() === currentUserId
    )
    setIsKicked(!isMember && isRemoved)
  }, [selectedConversation, isGroup, currentUserId])

  useEffect(() => {
    function handleClickOutside(e) {
      if (memberMenuRef.current && !memberMenuRef.current.contains(e.target)) {
        setMemberMenuId(null)
      }
    }
    if (memberMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [memberMenuId])

  const handleRemoveMember = async (userId) => {
    setIsRemovingMember(true)
    try {
      const updatedConv = await conversationService.removeMember(selectedConversation._id, userId)
      setSelectedConversation(updatedConv)
      localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      toast.success(t('chat.memberRemoved') || 'Đã xóa thành viên!')
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Có lỗi xảy ra')
    } finally {
      setIsRemovingMember(false)
      setShowRemoveConfirm(null)
      setMemberMenuId(null)
    }
  }

  const [isBlockingUser, setIsBlockingUser] = useState(false)
  const [confirmModalData, setConfirmModalData] = useState({ isOpen: false, type: null })

  const handleConfirmAction = async () => {
    if (!otherMember?._id) return
    const { type } = confirmModalData;
    setConfirmModalData(prev => ({ ...prev, isOpen: false }))
    setIsBlockingUser(true)

    if (type === 'block') {
      try {
        const updatedUser = await userService.blockUser(otherMember._id)
        if (updatedUser) updateUser(updatedUser)
        const archivedBy = selectedConversation.archivedBy || []
        const alreadyArchived = archivedBy.some(id => (id._id || id).toString() === currentUserId)
        const updatedConv = {
          ...selectedConversation,
          archivedBy: alreadyArchived ? archivedBy : [...archivedBy, currentUserId]
        }
        setSelectedConversation(updatedConv)
        localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
        if (sidebarRef.current?.updateConversationDetails) {
          sidebarRef.current.updateConversationDetails(updatedConv)
        }
        toast.success(t('chat.blockSuccess') || 'Đã chặn người dùng')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Có lỗi xảy ra')
      } finally {
        setIsBlockingUser(false)
      }
    } else if (type === 'unblock') {
      try {
        const updatedUser = await userService.unblockUser(otherMember._id)
        if (updatedUser) updateUser(updatedUser)
        const filtered = (selectedConversation.archivedBy || []).filter(
          id => (id._id || id).toString() !== currentUserId
        )
        const updatedConv = {
          ...selectedConversation,
          archivedBy: filtered
        }
        setSelectedConversation(updatedConv)
        localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
        if (sidebarRef.current?.updateConversationDetails) {
          sidebarRef.current.updateConversationDetails(updatedConv)
        }
        toast.success(t('chat.unblockSuccess') || 'Đã bỏ chặn người dùng')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Có lỗi xảy ra')
      } finally {
        setIsBlockingUser(false)
      }
    }
  }

  const handleBlockUser = () => {
    setConfirmModalData({ isOpen: true, type: 'block' })
  }

  const handleUnblockUser = () => {
    setConfirmModalData({ isOpen: true, type: 'unblock' })
  }

  const handleToggleAddMemberPermission = async () => {
    if (!selectedConversation) return
    const newPerm = selectedConversation.addMemberPermission === 'admin' ? 'anyone' : 'admin'
    try {
      const updatedConv = await conversationService.updateAddMemberPermission(selectedConversation._id, newPerm)
      setSelectedConversation(updatedConv)
      localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      toast.success(newPerm === 'admin'
        ? (t('chat.permissionAdminOnly') || 'Chỉ quản trị viên mới có thể thêm thành viên')
        : (t('chat.permissionAnyone') || 'Ai cũng có thể thêm thành viên'))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const handleMessageMember = (member) => {
    setMemberMenuId(null)
    const createAndNavigate = async () => {
      try {
        const conv = await conversationService.createConversation(member._id)
        handleSelectConversation(conv)
        setShowInfoPanel(false)
      } catch (err) {
        toast.error(t('chat.createError') || 'Không thể tạo cuộc trò chuyện', err)
      }
    }
    createAndNavigate()
  }

  // Listen for real-time conversation updates and kicked events
  useEffect(() => {
    if (!socket?.connected) return

    const handleConversationUpdated = ({ conversation: updatedConv }) => {
      if (!updatedConv) return
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      if (selectedConvIdRef.current === updatedConv._id) {
        setSelectedConversation(updatedConv)
        localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      }
    }

    const handleRemovedFromGroup = ({ conversationId: convId }) => {
      if (selectedConvIdRef.current === convId) {
        setIsKicked(true)
      }
    }

    const handleNewConversation = ({ conversation: newConv }) => {
      if (!newConv) return
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(newConv)
      }
    }

    const handleNicknameUpdated = ({ conversation: updatedConv }) => {
      if (!updatedConv) return
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      if (selectedConvIdRef.current === updatedConv._id) {
        setSelectedConversation(updatedConv)
        localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      }
    }

    const handleThemeColorUpdated = ({ conversation: updatedConv }) => {
      if (!updatedConv) return
      if (sidebarRef.current?.updateConversationDetails) {
        sidebarRef.current.updateConversationDetails(updatedConv)
      }
      if (selectedConvIdRef.current === updatedConv._id) {
        setSelectedConversation(updatedConv)
        localStorage.setItem('last_conversation', JSON.stringify(updatedConv))
      }
    }

    socket.on('conversationUpdated', handleConversationUpdated)
    socket.on('removedFromGroup', handleRemovedFromGroup)
    socket.on('newConversation', handleNewConversation)
    socket.on('nicknameUpdated', handleNicknameUpdated)
    socket.on('themeColorUpdated', handleThemeColorUpdated)

    return () => {
      socket.off('conversationUpdated', handleConversationUpdated)
      socket.off('removedFromGroup', handleRemovedFromGroup)
      socket.off('newConversation', handleNewConversation)
      socket.off('nicknameUpdated', handleNicknameUpdated)
      socket.off('themeColorUpdated', handleThemeColorUpdated)
    }
  }, [socket, isConnected])

  const [showInfoPanel, setShowInfoPanel] = useState(() => {
    try {
      const saved = localStorage.getItem('show_info_panel')
      return saved !== null ? saved === 'true' : true
    } catch {
      return true
    }
  })
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [userProfileUserId, setUserProfileUserId] = useState(null)

  const SIDEBAR_MIN = 72
  const SIDEBAR_COLLAPSE_THRESHOLD = 180
  const SIDEBAR_DEFAULT = 320
  const SIDEBAR_MAX_RATIO = 0.5

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar_width')
    return saved ? Number(saved) : SIDEBAR_DEFAULT
  })
  const [isMobileSidebarLayout, setIsMobileSidebarLayout] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  ))
  const sidebarCollapsed = !isMobileSidebarLayout && sidebarWidth <= SIDEBAR_MIN

  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsMobileSidebarLayout(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    isDraggingRef.current = true
    setIsDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return
      const maxWidth = window.innerWidth * SIDEBAR_MAX_RATIO
      let newWidth = moveEvent.clientX
      if (newWidth < SIDEBAR_COLLAPSE_THRESHOLD) {
        newWidth = SIDEBAR_MIN
      } else if (newWidth < SIDEBAR_DEFAULT) {
        newWidth = Math.max(newWidth, 240)
      }
      newWidth = Math.min(newWidth, maxWidth)
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setSidebarWidth((w) => {
        localStorage.setItem('sidebar_width', String(w))
        return w
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handleSidebarDoubleClick = useCallback(() => {
    if (isMobileSidebarLayout) return
    const newWidth = sidebarCollapsed ? SIDEBAR_DEFAULT : SIDEBAR_MIN
    setSidebarWidth(newWidth)
    localStorage.setItem('sidebar_width', String(newWidth))
  }, [isMobileSidebarLayout, sidebarCollapsed])

  const handleToggleCollapse = useCallback(() => {
    if (isMobileSidebarLayout) return
    const newWidth = sidebarCollapsed ? SIDEBAR_DEFAULT : SIDEBAR_MIN
    setSidebarWidth(newWidth)
    localStorage.setItem('sidebar_width', String(newWidth))
  }, [isMobileSidebarLayout, sidebarCollapsed])

  useEffect(() => {
    if (urlConversationId && (!selectedConversation || selectedConversation._id !== urlConversationId)) {
      const saved = localStorage.getItem('last_conversation')
      if (saved && saved !== 'null') {
        try {
          const parsed = JSON.parse(saved)
          if (parsed && parsed._id === urlConversationId) {
            setSelectedConversation(parsed)
            return
          }
        } catch { /* ignore */ }
      }
      conversationService.getConversations().then(convs => {
        const match = (Array.isArray(convs) ? convs : []).find(c => c._id === urlConversationId)
        if (match) {
          setSelectedConversation(match)
          localStorage.setItem('last_conversation', JSON.stringify(match))
        } else {
          navigate('/chat', { replace: true })
        }
      }).catch(() => {
        navigate('/chat', { replace: true })
      })
    }
    if (!urlConversationId && selectedConversation?._id) {
      navigate(`/chat/${selectedConversation._id}`, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedConvIdRef = useRef(selectedConversation?._id)
  useEffect(() => {
    selectedConvIdRef.current = selectedConversation?._id
  }, [selectedConversation])

  const handleSelectConversation = useCallback((conv) => {
    setSelectedConversation(conv)
    if (conv) {
      localStorage.setItem('last_conversation', JSON.stringify(conv))
      navigate(`/chat/${conv._id}`, { replace: true })
    } else {
      localStorage.removeItem('last_conversation')
      navigate('/chat', { replace: true })
    }
  }, [navigate])

  const chatWindowRef = useRef(null)

  const handleNotificationClick = useCallback(async (conversationId, messageId) => {
    if (!conversationId) return
    let convMatch = null
    if (selectedConvIdRef.current !== conversationId) {
      try {
        const convs = await conversationService.getConversations()
        convMatch = (Array.isArray(convs) ? convs : []).find(c => c._id === conversationId)
        if (convMatch) {
          handleSelectConversation(convMatch)
        }
      } catch {}
    }
    if (messageId) {
      await new Promise(r => setTimeout(r, 500))

      const el = document.getElementById(`msg-${messageId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('mention-flash')
        setTimeout(() => el.classList.remove('mention-flash'), 2500)
        return
      }

      const convId = convMatch?._id || conversationId
      try {
        const res = await messageService.getMessagesAround(convId, messageId)
        const msgs = res?.messages || res?.data?.messages || []
        if (msgs.length > 0 && chatWindowRef.current?.jumpToMessages) {
          chatWindowRef.current.jumpToMessages(msgs, messageId)
          setJumpedToMessage(true)
        } else {
          toast.info(t('chat.loadMessagesError') || 'Không thể tải tin nhắn.')
        }
      } catch {
        toast.info(t('chat.loadMessagesError') || 'Không thể tải tin nhắn.')
      }
    }
  }, [handleSelectConversation, toast])

  useEffect(() => {
    setNavigateToMessage(() => handleNotificationClick)
  }, [setNavigateToMessage, handleNotificationClick])

  const sidebarRef = useRef(null)

  const otherMember = selectedConversation?.members?.find(
    (m) => m._id?.toString() !== currentUserId
  )

  const otherMemberId = otherMember?._id?.toString()
  const isOtherDeleted = !isGroup && otherMember?.status === 'deleted'
  const isOtherOnline = otherMemberId && !isOtherDeleted ? onlineUsers.some((id) => id.toString() === otherMemberId) : false
  const [lastSeen, setLastSeen] = useState(null)

  // Group calculations
  const groupMembersOnline = useMemo(() => {
    if (!isGroup || !selectedConversation.members) return 0;
    return selectedConversation.members.filter(m => onlineUsers.some(id => id.toString() === m._id.toString())).length;
  }, [isGroup, selectedConversation, onlineUsers]);

  useEffect(() => {
    if (!otherMemberId || isGroup) return
    if (isOtherOnline) {
      setLastSeen(null)
      return
    }
    let cancelled = false
    userService.getUserById(otherMemberId)
      .then((userData) => {
        if (!cancelled && userData?.lastSeen) {
          setLastSeen(userData.lastSeen)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [otherMemberId, isOtherOnline, isGroup])

  useEffect(() => {
    if (!socket?.connected) return
    const handleUserLastSeen = ({ userId, lastSeen: ls }) => {
      if (userId?.toString() === otherMemberId) {
        setLastSeen(ls)
      }
    }
    socket.on('userLastSeen', handleUserLastSeen)
    return () => socket.off('userLastSeen', handleUserLastSeen)
  }, [socket, otherMemberId])

  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (isOtherOnline || !lastSeen || isGroup) return
    const interval = setInterval(() => forceUpdate((n) => n + 1), 60000)
    return () => clearInterval(interval)
  }, [isOtherOnline, lastSeen, isGroup])

  useEffect(() => {
    if (!socket?.connected) return

    const handleGlobalMessage = ({ conversationId, message }) => {
      if (sidebarRef.current?.updateLastMessage) {
        sidebarRef.current.updateLastMessage(conversationId, message)
      }
      if (conversationId !== selectedConvIdRef.current) {
        if (sidebarRef.current?.incrementUnread) {
          sidebarRef.current.incrementUnread(conversationId)
        }
      } else {
        setMediaItems(prev => {
          if (!message || (message.messageType !== 'image' && message.messageType !== 'file')) return prev;
          if (message.messageType === 'file' && message.file?.type?.startsWith('audio/')) return prev;
          if (prev.some(m => m._id === message._id)) return prev;
          return [message, ...prev];
        });
      }
      const senderId = message?.senderId?._id || message?.senderId || message?.sender?._id || message?.sender
      const isOwnMessage = senderId?.toString() === currentUserId
      const isMutedConv = sidebarRef.current?.isConversationMuted?.(conversationId)
      const hasMentionForMe = message?.mentionAll || (message?.mentions || []).some(m => {
        const id = typeof m === 'object' ? m._id : m
        return id?.toString() === currentUserId
      })
      if (!isOwnMessage && !isMutedConv && !hasMentionForMe) {
        playSound()
      }
    }

    const handleMessageRecalled = ({ conversationId, messageId }) => {
      if (conversationId === selectedConvIdRef.current) {
        setMediaItems(prev => prev.filter(m => m._id !== messageId));
      }
    }

    socket.on('sendMessage', handleGlobalMessage)
    socket.on('messageRecalled', handleMessageRecalled)
    return () => {
      socket.off('sendMessage', handleGlobalMessage)
      socket.off('messageRecalled', handleMessageRecalled)
    }
  }, [socket, isConnected, currentUserId, playSound])

  const handleMessageSent = useCallback(({ conversationId: convId, lastMessage }) => {
    if (sidebarRef.current?.updateLastMessage) {
      sidebarRef.current.updateLastMessage(convId, lastMessage)
    }
    if (sidebarRef.current?.unarchiveConversation) {
      sidebarRef.current.unarchiveConversation(convId)
    }
    setMediaItems(prev => {
      if (!lastMessage || (lastMessage.messageType !== 'image' && lastMessage.messageType !== 'file')) return prev;
      if (lastMessage.messageType === 'file' && lastMessage.file?.type?.startsWith('audio/')) return prev;
      if (prev.some(m => m._id === lastMessage._id)) return prev;
      return [lastMessage, ...prev];
    });
  }, [])

  const callConvInfo = selectedConversation ? {
    conversationName: selectedConversation.name || selectedConversation.groupName || null,
    conversationAvatar: selectedConversation.isGroup ? (selectedConversation.avatar || selectedConversation.groupAvatar) : (otherMember?.avatar || null),
    isGroup: !!selectedConversation.isGroup,
  } : {}

  const handleVoiceCall = async () => {
    if (!selectedConversation || activeCall) return
    const result = await initiateCall(selectedConversation._id, 'voice', callConvInfo)
    if (result && !result.success) {
      const reasonMap = {
        already_in_call: t('call.busy'),
        blocked: t('call.blocked') || 'Không thể gọi',
        all_offline: t('call.offline'),
        media_denied: t('call.mediaError'),
      }
      toast.error(reasonMap[result.reason] || t('call.callError') || 'Lỗi cuộc gọi')
    }
  }

  const handleVideoCall = async () => {
    if (!selectedConversation || activeCall) return
    const result = await initiateCall(selectedConversation._id, 'video', callConvInfo)
    if (result && !result.success) {
      const reasonMap = {
        already_in_call: t('call.busy'),
        blocked: t('call.blocked') || 'Không thể gọi',
        all_offline: t('call.offline'),
        media_denied: t('call.mediaError'),
      }
      toast.error(reasonMap[result.reason] || t('call.callError') || 'Lỗi cuộc gọi')
    }
  }

  const handleToggleInfoPanel = () => {
    setShowInfoPanel((v) => {
      localStorage.setItem('show_info_panel', String(!v))
      return !v
    })
  }

  const handleOpenUserProfile = useCallback((userId) => {
    if (userId === currentUserId) return
    setUserProfileUserId(userId)
  }, [currentUserId])

  const handleUserProfileSendMessage = useCallback(async (userId) => {
    try {
      const conv = await conversationService.createConversation(userId)
      handleSelectConversation(conv)
      setShowInfoPanel(false)
    } catch (err) {
      toast.error(t('chat.createError'))
    }
  }, [handleSelectConversation, toast, t])

  const [infoPinnedOpen, setInfoPinnedOpen] = useState(false)
  const [pinnedMessages, setPinnedMessages] = useState([])
  const [loadingPinned, setLoadingPinned] = useState(false)

  useEffect(() => {
    if (!infoPinnedOpen || !selectedConversation?._id) return
    setLoadingPinned(true)
    messageService.getPinnedMessages(selectedConversation._id)
      .then(msgs => setPinnedMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => setPinnedMessages([]))
      .finally(() => setLoadingPinned(false))
  }, [infoPinnedOpen, selectedConversation?._id])

  const [pinnedPolls, setPinnedPolls] = useState([])
  const [jumpedToMessage, setJumpedToMessage] = useState(false)

  useEffect(() => {
    if (!selectedConversation?._id || !selectedConversation?.isGroup) {
      setPinnedPolls([])
      return
    }
    messageService.getPinnedMessages(selectedConversation._id)
      .then(msgs => {
        const arr = Array.isArray(msgs) ? msgs : []
        setPinnedPolls(arr.filter(m => m.messageType === 'poll'))
      })
      .catch(() => setPinnedPolls([]))
  }, [selectedConversation?._id, selectedConversation?.isGroup])

  useEffect(() => {
    if (!socket?.connected) return
    const handlePollPinUpdate = ({ conversationId: cId, messageId, isPinned }) => {
      if (cId !== selectedConvIdRef.current) return
      if (isPinned) {
        messageService.getPinnedMessages(cId)
          .then(msgs => {
            const arr = Array.isArray(msgs) ? msgs : []
            setPinnedPolls(arr.filter(m => m.messageType === 'poll'))
          })
          .catch(() => {})
      } else {
        setPinnedPolls(prev => prev.filter(m => m._id !== messageId))
      }
    }
    socket.on('messagePinned', handlePollPinUpdate)
    return () => socket.off('messagePinned', handlePollPinUpdate)
  }, [socket, isConnected])

  const handlePinnedPollClick = async (messageId) => {
    const el = document.getElementById(`msg-${messageId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('mention-flash')
      setTimeout(() => el.classList.remove('mention-flash'), 2500)
      return
    }
    try {
      const res = await messageService.getMessagesAround(selectedConversation._id, messageId)
      const msgs = res?.messages || res?.data?.messages || []
      if (msgs.length > 0 && chatWindowRef.current?.jumpToMessages) {
        chatWindowRef.current.jumpToMessages(msgs, messageId)
        setJumpedToMessage(true)
      } else {
        toast.info(t('chat.loadMessagesError') || 'Không thể tải tin nhắn.')
      }
    } catch {
      toast.info(t('chat.loadPollMessagesError') || 'Không thể tải tin nhắn bình chọn.')
    }
  }

  const handleReturnToLatest = () => {
    if (chatWindowRef.current?.returnToLatest) {
      chatWindowRef.current.returnToLatest()
    }
    setJumpedToMessage(false)
  }

  const handleUnpinPoll = async (messageId) => {
    try {
      await messageService.togglePinMessage(messageId)
      setPinnedPolls(prev => prev.filter(m => m._id !== messageId))
    } catch {
      toast.error(t('chat.unpinError') || 'Không thể bỏ ghim.')
    }
  }

  const [infoChatOpen, setInfoChatOpen] = useState(false)
  const [infoMembersOpen, setInfoMembersOpen] = useState(true) // For groups
  const [infoCustomizeOpen, setInfoCustomizeOpen] = useState(false)
  const [infoMediaOpen, setInfoMediaOpen] = useState(false)
  const [infoPrivacyOpen, setInfoPrivacyOpen] = useState(false)

  // Media & Files state
  const [activeMediaTab, setActiveMediaTab] = useState('photos')
  const [mediaItems, setMediaItems] = useState([])
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [videoLightboxSrc, setVideoLightboxSrc] = useState(null)

  useEffect(() => {
    if (infoMediaOpen && selectedConversation?._id) {
      setLoadingMedia(true)
      messageService.getMediaAndFiles(selectedConversation._id)
        .then(res => {
          const items = res?.data || res || []
          setMediaItems(Array.isArray(items) ? items : [])
        })
        .catch(err => console.error("Lỗi lấy danh sách phương tiện:", err))
        .finally(() => setLoadingMedia(false))
    }
  }, [infoMediaOpen, selectedConversation?._id])

  useEffect(() => {
    const handleLocalDelete = (e) => {
      const msgId = e.detail;
      setMediaItems(prev => prev.filter(m => m._id !== msgId));
    };
    window.addEventListener('localMessageDeleted', handleLocalDelete);
    return () => window.removeEventListener('localMessageDeleted', handleLocalDelete);
  }, []);

  const renderHeaderAvatar = () => {
    const hasCustomAvatar = isGroup && !!(selectedConversation.avatar || selectedConversation.groupAvatar);
    if (isGroup && !hasCustomAvatar) {
      const membersToAvatar = selectedConversation.members.filter(m => m._id !== currentUserId).slice(0, 2);
      if (membersToAvatar.length >= 2) {
        return (
          <div style={{ position: 'relative', width: '36px', height: '36px', marginRight: '8px' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 1, border: '2px solid var(--color-surface)', borderRadius: '50%' }}>
              <Avatar src={membersToAvatar[0].avatar} alt={membersToAvatar[0].fullName} size="sm" style={{ width: '24px', height: '24px' }} />
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, zIndex: 2, border: '2px solid var(--color-surface)', borderRadius: '50%' }}>
              <Avatar src={membersToAvatar[1].avatar} alt={membersToAvatar[1].fullName} size="sm" style={{ width: '24px', height: '24px' }} />
            </div>
          </div>
        );
      }
    }
    return (
      <div
        className="chat-header__avatar"
        onClick={() => {
          if (!isGroup && otherMember?._id) handleOpenUserProfile(otherMember._id.toString())
        }}
        style={!isGroup ? { cursor: 'pointer' } : undefined}
      >
        <Avatar
          src={isGroup ? (selectedConversation.avatar || selectedConversation.groupAvatar) : otherMember?.avatar}
          alt={isGroup ? (selectedConversation.name || selectedConversation.groupName) : (otherMember?.fullName || '?')}
          size="sm"
          isOnline={!isGroup && isOtherOnline}
        />
      </div>
    );
  }

  return (
    <div className={`chat-layout ${urlConversationId ? 'chat-layout--mobile-chat' : 'chat-layout--mobile-sidebar'}`}>
      <div className={`sidebar-wrapper ${isDragging ? 'sidebar-wrapper--dragging' : ''}`} style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
        <Sidebar
          ref={sidebarRef}
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
          collapsed={sidebarCollapsed}
          collapseDisabled={isMobileSidebarLayout}
          onToggleCollapse={handleToggleCollapse}
          onlineUsers={onlineUsers}
          onNotificationClick={handleNotificationClick}
        />
        <div
          className="sidebar-resize-handle"
          onMouseDown={handleResizeStart}
          onDoubleClick={handleSidebarDoubleClick}
        />
      </div>

      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-header__left">
            <button className="chat-header__back-btn" onClick={() => navigate('/chat')} aria-label="Back">
              <ChevronRight size={24} style={{ transform: 'rotate(180deg)' }} />
            </button>
            {selectedConversation && renderHeaderAvatar()}
            <div className="chat-header__user-info">
              <h2 style={isOtherDeleted ? { color: 'var(--color-text-muted)', fontStyle: 'italic' } : undefined}>
                {selectedConversation
                  ? (isGroup
                    ? (selectedConversation.name || selectedConversation.groupName)
                    : isOtherDeleted
                      ? (t('chat.deletedUser') || 'Người dùng đã xóa tài khoản')
                      : (selectedConversation.nicknames?.[otherMember?._id] || otherMember?.fullName || t('chat.title')))
                  : t('chat.title')}
              </h2>
              {selectedConversation && !isGroup && !isOtherDeleted && (
                <span className="chat-header__status">
                  {isOtherOnline
                    ? t('chat.activeNow')
                    : lastSeen
                      ? formatLastActive(lastSeen, lang)
                      : ''}
                </span>
              )}
            </div>
          </div>
          {selectedConversation && (
            <div className="chat-header__right">
              {!isOtherDeleted && (
                <>
                  <button
                    type="button"
                    className="chat-header__icon-btn tooltip-wrapper"
                    onClick={handleVoiceCall}
                    disabled={!!activeCall}
                    title={t('call.voiceCall')}
                  >
                    <Phone size={20} />
                    <span className="tooltip">{t('call.voiceCall')}</span>
                  </button>
                  <button
                    type="button"
                    className="chat-header__icon-btn tooltip-wrapper"
                    onClick={handleVideoCall}
                    disabled={!!activeCall}
                    title={t('call.videoCall')}
                  >
                    <Video size={20} />
                    <span className="tooltip">{t('call.videoCall')}</span>
                  </button>
                </>
              )}
              <button
                type="button"
                className={`chat-header__icon-btn tooltip-wrapper ${showSearchPanel ? 'chat-header__icon-btn--active' : ''}`}
                onClick={() => {
                  setShowSearchPanel(v => !v);
                  if (!showSearchPanel && !showInfoPanel) setShowInfoPanel(true);
                }}
                title={t('chat.search')}
              >
                <Search size={20} />
                <span className="tooltip">{t('chat.search')}</span>
              </button>
              <button
                type="button"
                className={`chat-header__icon-btn tooltip-wrapper ${(showInfoPanel && !showSearchPanel) ? 'chat-header__icon-btn--active' : ''}`}
                onClick={() => {
                  if (showSearchPanel) setShowSearchPanel(false);
                  else handleToggleInfoPanel();
                }}
              >
                <Info size={20} />
                <span className="tooltip">{t('chat.moreInfo')}</span>
              </button>
            </div>
          )}
        </header>

        {isGroup && pinnedPolls.length > 0 && (
          <PinnedPollBar
            pinnedPolls={pinnedPolls}
            onClickPoll={handlePinnedPollClick}
            onUnpin={handleUnpinPoll}
          />
        )}

        <div className="chat-main__body" style={{ position: 'relative' }}>
          {selectedConversation ? (
            <>
              <ChatWindow
                ref={chatWindowRef}
                conversationId={selectedConversation._id}
                otherMember={otherMember}
                isGroup={isGroup}
                onMessageSent={handleMessageSent}
                isKicked={isKicked}
                conversation={selectedConversation}
                onAvatarClick={handleOpenUserProfile}
              />
              {jumpedToMessage && (
                <button
                  className="chat-main__return-btn"
                  onClick={handleReturnToLatest}
                  title={t('chat.backToLatest') || "Quay về tin nhắn mới nhất"}
                >
                  <ChevronsDown size={20} />
                </button>
              )}
            </>
          ) : (
            <div className="chat-empty-state">
              <div className="chat-empty-state__icon-wrapper">
                <Sparkles size={24} className="chat-empty-state__sparkle" />
                <MessageSquare size={56} className="chat-empty-state__icon" />
              </div>
              <h3 className="chat-empty-state__title">
                {t('chat.emptyStateGreeting')}
              </h3>
              <p className="chat-empty-state__subtitle">
                {t('chat.emptyStateSubtitle')}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Info Panel — separate full-height column */}
      {showInfoPanel && selectedConversation && (
        <aside className="info-panel">
          {showSearchPanel ? (
            <>
              <div className="info-panel__header" style={{ justifyContent: 'flex-start', gap: '12px' }}>
                <button className="info-panel__close" onClick={() => setShowSearchPanel(false)}>
                  <ChevronDown size={20} style={{ transform: 'rotate(90deg)' }} />
                </button>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{t('chat.searchMessagesTitle') || 'Tìm kiếm tin nhắn'}</h3>
              </div>
              <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input
                    type="text"
                    placeholder={t('chat.searchMessagesPlaceholder') || "Nhập từ khóa..."}
                    value={searchQuery}
                    onChange={(e) => handleMessageSearch(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
                      border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg)',
                      color: 'var(--color-text)', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
                {isSearchingMessage ? (
                  <div style={{ padding: '24px', textAlign: 'center' }}>
                    <Loader2 className="animate-spin" size={24} color="var(--color-primary)" />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map(msg => {
                    const sender = msg.senderId;
                    return (
                      <div key={msg._id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 8px',
                        borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer',
                        borderRadius: '8px', transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-hover-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => handleSearchResultClick(msg._id)}>
                        <Avatar src={sender?.avatar} alt={sender?.fullName || '?'} size="sm" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                              {sender?.fullName || t('chat.unknownUser') || 'Người dùng'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {new Date(msg.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : searchQuery.trim() ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
                    {t('chat.noSearchResults') || 'Không tìm thấy kết quả nào.'}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="info-panel__header">
                <button className="info-panel__close" onClick={() => setShowInfoPanel(false)}>
                  <X size={20} />
                </button>
              </div>

          <div className="info-panel__profile">
            <div className="info-panel__avatar" style={{ display: 'flex', justifyContent: 'center' }}>
              {isUpdatingAvatar ? (
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 className="animate-spin" size={28} color="var(--color-primary)" />
                </div>
              ) : isGroup ? (
                (selectedConversation.avatar || selectedConversation.groupAvatar) ? (
                  <Avatar
                    src={selectedConversation.avatar || selectedConversation.groupAvatar}
                    alt={selectedConversation.name || selectedConversation.groupName || '?'}
                    size="lg"
                  />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={40} />
                  </div>
                )
              ) : (
                <Avatar
                  src={otherMember?.avatar}
                  alt={otherMember?.fullName || '?'}
                  size="lg"
                  isOnline={isOtherOnline}
                />
              )}
            </div>
            {isEditingName ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '0 16px' }}>
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-primary)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  autoFocus
                  placeholder={t('chat.groupNamePlaceholder') || "Nhập tên nhóm..."}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleSaveName}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    disabled={isUpdatingName}
                  >
                    {isUpdatingName && <Loader2 className="animate-spin" size={12} />}
                    {t('chat.save') || 'Lưu'}
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--color-hover-bg)',
                      color: 'var(--color-text)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {t('chat.cancel') || 'Hủy'}
                  </button>
                </div>
              </div>
            ) : (
              <h3 className="info-panel__name">
                {isGroup
                  ? (selectedConversation.name || selectedConversation.groupName)
                  : (selectedConversation.nicknames?.[otherMember?._id] || otherMember?.fullName || t('chat.unknownUser'))}
              </h3>
            )}
            {isGroup && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
                <button
                  className="info-panel__edit-btn"
                  onClick={() => setIsEditingName(true)}
                  title={t('chat.changeGroupName') || "Đổi tên nhóm"}
                >
                  <Palette size={14} />
                  <span>{t('chat.changeGroupName') || 'Đổi tên nhóm'}</span>
                </button>
                <button
                  className="info-panel__edit-btn"
                  onClick={handleTriggerAvatarUpload}
                  title={t('chat.changeGroupAvatar') || "Đổi avatar nhóm"}
                >
                  <Camera size={14} />
                  <span>{t('chat.changeGroupAvatar') || 'Đổi avatar nhóm'}</span>
                </button>
                <input
                  type="file"
                  ref={avatarInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                />
              </div>
            )}
          </div>

          <div className="info-panel__quick-actions">
            <button
              className="info-panel__quick-btn"
              onClick={handleToggleMute}
            >
              <div className="info-panel__quick-icon">
                {isMuted ? <Bell size={20} /> : <BellOff size={20} />}
              </div>
              <span>{isMuted ? (t('chat.unmuteNotifications') || 'Bật thông báo') : t('chat.muteNotifications')}</span>
            </button>
            <button
              className="info-panel__quick-btn"
              onClick={handleToggleArchive}
            >
              <div className="info-panel__quick-icon"><Archive size={20} /></div>
              <span>{isArchived ? (t('chat.unarchive') || 'Bỏ lưu trữ') : (t('chat.archive') || 'Lưu trữ')}</span>
            </button>
          </div>

          <div className="info-panel__sections">
            <button
              className="info-panel__section-toggle"
              onClick={() => setInfoPinnedOpen((v) => !v)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Pin size={14} />
                <span>{t('chat.pinnedMessages') || 'Tin nhắn đã ghim'}</span>
              </div>
              <ChevronDown size={16} className={infoPinnedOpen ? 'info-panel__chevron--open' : ''} />
            </button>
            {infoPinnedOpen && (
              <div className="info-panel__section-content" style={{ padding: '0 8px 16px' }}>
                {loadingPinned ? (
                  <div style={{ padding: '16px', textAlign: 'center' }}>
                    <Loader2 className="animate-spin" size={20} color="var(--color-primary)" />
                  </div>
                ) : pinnedMessages.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', padding: '12px 8px', textAlign: 'center' }}>
                    {t('chat.noPinnedMessages') || 'Chưa có tin nhắn nào được ghim'}
                  </p>
                ) : (
                  pinnedMessages.map((msg) => {
                    const sender = typeof msg.senderId === 'object' ? msg.senderId : null
                    return (
                      <div key={msg._id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 8px',
                        borderRadius: '8px', borderBottom: '1px solid var(--color-border-subtle)',
                        cursor: 'pointer'
                      }}
                        onClick={async () => {
                          const isMobile = window.innerWidth < 768
                          setInfoPinnedOpen(false)
                          if (isMobile) {
                            setShowInfoPanel(false)
                          }
                          const delay = isMobile ? 350 : 100
                          await new Promise(r => setTimeout(r, delay))

                          const el = document.getElementById(`msg-${msg._id}`)
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            el.style.transition = 'background 0.3s'
                            el.style.background = 'var(--color-primary-light)'
                            setTimeout(() => { el.style.background = '' }, 1500)
                            return
                          }

                          try {
                            const res = await messageService.getMessagesAround(selectedConversation._id, msg._id)
                            const msgs = res?.messages || res?.data?.messages || []
                            if (msgs.length > 0 && chatWindowRef.current?.jumpToMessages) {
                              chatWindowRef.current.jumpToMessages(msgs, msg._id)
                              setJumpedToMessage(true)
                            } else {
                              toast.info(t('chat.loadMessagesError') || 'Không thể tải tin nhắn.')
                            }
                          } catch {
                            toast.info(t('chat.loadMessagesError') || 'Không thể tải tin nhắn.')
                          }
                        }}
                      >
                        <Avatar src={sender?.avatar} alt={sender?.fullName || '?'} size="sm" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                            {sender?.fullName || t('chat.unknownUser') || 'Người dùng'}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {msg.text || (msg.image ? (t('chat.sentImage') || 'Đã gửi một ảnh') : msg.file ? (t('chat.sentFile') || 'Đã gửi một tệp') : '')}
                          </div>
                        </div>
                        <Pin size={12} style={{ flexShrink: 0, color: 'var(--color-primary)', marginTop: '2px' }} />
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {isGroup && (
              <>
                <button
                  className="info-panel__section-toggle"
                  onClick={() => setInfoMembersOpen((v) => !v)}
                >
                  <span>{t('chat.groupMembers')} ({selectedConversation.members?.length || 0})</span>
                  <ChevronDown size={16} className={infoMembersOpen ? 'info-panel__chevron--open' : ''} />
                </button>
                {infoMembersOpen && (
                  <div className="info-panel__section-content" style={{ padding: '0 8px 16px' }}>
                    {/* Add member button */}
                    <button
                      onClick={() => setShowAddMemberSearch(v => !v)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
                        borderRadius: '8px', cursor: 'pointer', border: 'none',
                        background: 'transparent', width: '100%', transition: 'background 0.15s',
                        color: 'var(--color-primary)'
                      }}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: 'var(--color-primary-light)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
                      }}>
                        <UserPlus size={16} />
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>
                        {t('chat.addMember') || 'Thêm thành viên'}
                      </span>
                    </button>

                    {showAddMemberSearch && (
                      <div style={{ padding: '4px 8px 8px' }}>
                        <input
                          type="text"
                          value={addMemberQuery}
                          onChange={(e) => handleAddMemberSearch(e.target.value)}
                          placeholder={t('chat.searchUser') || 'Tìm kiếm người dùng...'}
                          autoFocus
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: '8px',
                            border: '1px solid var(--color-border-subtle)',
                            background: 'var(--color-bg)', color: 'var(--color-text)',
                            fontSize: '13px', outline: 'none'
                          }}
                        />
                        {isSearchingMember && (
                          <div style={{ padding: '8px', textAlign: 'center' }}>
                            <Loader2 className="animate-spin" size={16} color="var(--color-primary)" />
                          </div>
                        )}
                        {addMemberResults.map(u => (
                          <div key={u._id} style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 4px',
                            borderRadius: '6px', cursor: 'pointer'
                          }}>
                            <Avatar src={u.avatar} alt={u.fullName} size="sm" />
                            <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.fullName}
                            </span>
                            <button
                              onClick={() => handleAddMember(u._id)}
                              disabled={isAddingMember}
                              style={{
                                padding: '4px 10px', borderRadius: '6px', border: 'none',
                                background: 'var(--color-primary)', color: 'white',
                                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              {isAddingMember ? <Loader2 className="animate-spin" size={12} /> : <Plus size={12} />}
                              {(() => {
                                const aIds = (selectedConversation.admins || []).map(a => typeof a === 'object' ? a._id?.toString() : a?.toString());
                                const isAdm = aIds.includes(currentUserId);
                                return (selectedConversation.addMemberPermission === 'admin' && !isAdm)
                                  ? 'Yêu cầu'
                                  : (t('chat.addBtn') || 'Thêm');
                              })()}
                            </button>
                          </div>
                        ))}
                        {addMemberQuery.trim().length >= 2 && !isSearchingMember && addMemberResults.length === 0 && (
                          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '8px', textAlign: 'center' }}>
                            {t('chat.noResults')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Admin permission toggle */}
                    {(() => {
                      const adminIds = (selectedConversation.admins || []).map(a => typeof a === 'object' ? a._id?.toString() : a?.toString());
                      const currentIsAdmin = adminIds.includes(currentUserId);
                      if (!currentIsAdmin) return null;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: '8px', background: 'var(--color-hover-bg)', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={14} color="var(--color-primary)" />
                            <span style={{ fontSize: '12px', color: 'var(--color-text)' }}>
                              {selectedConversation.addMemberPermission === 'admin'
                                ? (t('chat.onlyAdminCanAdd') || 'Chỉ QTV thêm thành viên')
                                : (t('chat.anyoneCanAdd') || 'Ai cũng có thể thêm')}
                            </span>
                          </div>
                          <button
                            onClick={handleToggleAddMemberPermission}
                            style={{
                              padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                              background: 'var(--color-primary)', color: 'white', fontSize: '11px', fontWeight: 600
                            }}
                          >
                            {t('chat.toggle') || 'Đổi'}
                          </button>
                        </div>
                      );
                    })()}

                    {/* Pending requests (visible to admins) */}
                    {(() => {
                      const adminIds = (selectedConversation.admins || []).map(a => typeof a === 'object' ? a._id?.toString() : a?.toString());
                      const currentIsAdmin = adminIds.includes(currentUserId);
                      const pending = selectedConversation.pendingRequests || [];
                      if (!currentIsAdmin || pending.length === 0) return null;
                      return (
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', padding: '4px 8px', marginBottom: '4px' }}>
                            {t('chat.pendingRequests') || 'Yêu cầu chờ duyệt'} ({pending.length})
                          </div>
                          {pending.map((req) => {
                            const pendingUser = req.userId;
                            const requester = req.requestedBy;
                            const pendingName = typeof pendingUser === 'object' ? pendingUser.fullName : '';
                            const pendingAvatar = typeof pendingUser === 'object' ? pendingUser.avatar : null;
                            const pendingId = typeof pendingUser === 'object' ? pendingUser._id : pendingUser;
                            const requesterName = typeof requester === 'object' ? requester.fullName : '';
                            return (
                              <div key={pendingId} style={{
                                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px',
                                borderRadius: '8px', background: 'var(--color-hover-bg)', marginBottom: '4px'
                              }}>
                                <Avatar src={pendingAvatar} alt={pendingName} size="sm" />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {pendingName}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                    {t('chat.requestedBy') || 'Được yêu cầu thêm bởi'} {requesterName}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleApproveRequest(pendingId)}
                                  title={t('chat.approveRequest') || 'Đồng ý'}
                                  style={{
                                    width: '28px', height: '28px', borderRadius: '50%', border: 'none',
                                    background: '#27ae60', color: 'white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(pendingId)}
                                  title={t('chat.rejectRequest') || 'Từ chối'}
                                  style={{
                                    width: '28px', height: '28px', borderRadius: '50%', border: 'none',
                                    background: '#e74c3c', color: 'white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Member list */}
                    {selectedConversation.members?.map((m) => {
                      const isOnline = onlineUsers.some(id => id.toString() === m._id.toString());
                      const adminIds = (selectedConversation.admins || []).map(a => typeof a === 'object' ? a._id?.toString() : a?.toString());
                      const isMemberAdmin = adminIds.includes(m._id?.toString());
                      const currentIsAdmin = adminIds.includes(currentUserId);
                      const isSelf = m._id?.toString() === currentUserId;
                      return (
                        <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s', position: 'relative' }}>
                          <div onClick={() => !isSelf && handleOpenUserProfile(m._id.toString())} style={!isSelf ? { cursor: 'pointer' } : undefined}>
                            <Avatar src={m.avatar} alt={m.fullName} size="sm" isOnline={isOnline} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.fullName}
                            </span>
                            {isMemberAdmin && (
                              <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>{t('chat.admin')}</span>
                            )}
                          </div>
                          {!isSelf && (
                            <div style={{ position: 'relative' }} ref={memberMenuId === m._id ? memberMenuRef : null}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setMemberMenuId(memberMenuId === m._id ? null : m._id) }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: 'var(--color-text-muted)' }}
                              >
                                <MoreVertical size={16} />
                              </button>
                              {memberMenuId === m._id && (
                                <div style={{
                                  position: 'absolute', right: 0, top: '100%', zIndex: 100,
                                  background: 'var(--color-surface)', borderRadius: '8px',
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: '180px',
                                  border: '1px solid var(--color-border-subtle)', overflow: 'hidden'
                                }}>
                                  <button
                                    onClick={() => handleMessageMember(m)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text)' }}
                                  >
                                    <MessageCircle size={14} />
                                    <span>{t('contacts.sendMessage') || 'Nhắn tin'}</span>
                                  </button>
                                  <button
                                    onClick={() => { setMemberMenuId(null); handleOpenUserProfile(m._id.toString()) }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text)' }}
                                  >
                                    <User size={14} />
                                    <span>{t('chat.viewProfile') || 'Xem thông tin'}</span>
                                  </button>
                                  {currentIsAdmin && !isMemberAdmin && (
                                    <button
                                      onClick={() => { setMemberMenuId(null); setShowRemoveConfirm(m) }}
                                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: '#e74c3c' }}
                                    >
                                      <UserMinus size={14} />
                                      <span>{t('chat.removeMember') || 'Xóa thành viên'}</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {!isGroup && (
              <>
                <button
                  className="info-panel__section-toggle"
                  onClick={() => setInfoChatOpen((v) => !v)}
                >
                  <span>{t('chat.chatInfo')}</span>
                  <ChevronDown size={16} className={infoChatOpen ? 'info-panel__chevron--open' : ''} />
                </button>
                {infoChatOpen && (
                  <div className="info-panel__section-content">
                    <div className="info-panel__detail-row">
                      <span className="info-panel__detail-label">{t('profile.email')}</span>
                      <span className="info-panel__detail-value">{otherMember?.email || '—'}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              className="info-panel__section-toggle"
              onClick={() => setInfoCustomizeOpen((v) => !v)}
            >
              <span>{t('chat.customizeChat')}</span>
              <ChevronDown size={16} className={infoCustomizeOpen ? 'info-panel__chevron--open' : ''} />
            </button>
            {infoCustomizeOpen && (
              <div className="info-panel__section-content">
                <button
                  className="info-panel__action-row"
                  onClick={() => setShowThemeColorPicker(v => !v)}
                >
                  <Palette size={16} />
                  <span>{t('chat.themeColor')}</span>
                  {selectedConversation?.themeColor && (
                    <span style={{
                      width: '14px', height: '14px', borderRadius: '50%',
                      background: selectedConversation.themeColor,
                      border: '1px solid var(--color-border)', flexShrink: 0
                    }} />
                  )}
                  <ChevronDown size={14} className={`info-panel__action-arrow ${showThemeColorPicker ? 'info-panel__chevron--open' : ''}`} />
                </button>
                {showThemeColorPicker && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px',
                    padding: '8px', background: 'var(--color-hover-bg)', borderRadius: '8px', marginBottom: '4px'
                  }}>
                    {THEME_COLOR_PRESETS.map(({ name, color }) => {
                      const isActive = (selectedConversation?.themeColor || null) === color
                      return (
                        <button
                          key={name}
                          onClick={() => handleUpdateThemeColor(color)}
                          disabled={isUpdatingThemeColor}
                          title={name}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                            padding: '8px 4px', borderRadius: '8px', border: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                            cursor: 'pointer',
                            background: isActive ? 'var(--color-primary-light)' : 'transparent',
                            transition: 'background 0.15s, border-color 0.15s'
                          }}
                        >
                          <span style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: color || 'var(--color-primary)',
                            border: '2px solid var(--color-border-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {isActive && <Check size={14} color="#fff" />}
                          </span>
                          <span style={{ fontSize: '10px', lineHeight: 1, color: 'var(--color-text-muted)' }}>{name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                <>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', padding: '8px 0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AtSign size={14} />
                    {t('chat.changeNickname')}
                  </div>
                  {selectedConversation.members?.map((m) => {
                    const nickname = selectedConversation.nicknames?.[m._id] || ''
                    return (
                      <button
                        key={m._id}
                        className="info-panel__action-row"
                        onClick={() => handleOpenNicknameModal(m)}
                        style={{ paddingLeft: '8px' }}
                      >
                        <Avatar src={m.avatar} alt={m.fullName} size="sm" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{nickname || m.fullName}</div>
                          {nickname && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{m.fullName}</div>
                          )}
                        </div>
                        <ChevronRight size={14} className="info-panel__action-arrow" />
                      </button>
                    )
                  })}
                </>
                <button
                  className="info-panel__action-row"
                  onClick={() => setShowEmojiPicker(v => !v)}
                >
                  {(() => {
                    const current = EMOJI_OPTIONS.find(e => e.name === (selectedConversation?.emoji || 'ThumbsUp'))
                    const Icon = current?.icon || ThumbsUp
                    return <Icon size={16} />
                  })()}
                  <span>{t('chat.changeEmoji')}</span>
                  <ChevronDown size={14} className={`info-panel__action-arrow ${showEmojiPicker ? 'info-panel__chevron--open' : ''}`} />
                </button>
                {showEmojiPicker && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px',
                    padding: '8px', background: 'var(--color-hover-bg)', borderRadius: '8px', marginBottom: '4px'
                  }}>
                    {EMOJI_OPTIONS.map(({ name, icon: Icon, label }) => {
                      const isActive = (selectedConversation?.emoji || 'ThumbsUp') === name
                      return (
                        <button
                          key={name}
                          onClick={() => handleUpdateEmoji(name)}
                          disabled={isUpdatingEmoji}
                          title={label}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                            padding: '8px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            background: isActive ? 'var(--color-primary-light)' : 'transparent',
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            transition: 'background 0.15s'
                          }}
                        >
                          <Icon size={22} />
                          <span style={{ fontSize: '10px', lineHeight: 1 }}>{label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              className="info-panel__section-toggle"
              onClick={() => setInfoMediaOpen((v) => !v)}
            >
              <span>{t('chat.mediaAndFiles')}</span>
              <ChevronDown size={16} className={infoMediaOpen ? 'info-panel__chevron--open' : ''} />
            </button>
            {infoMediaOpen && (
              <div className="info-panel__section-content">
                <div className="info-panel__media-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: '12px' }}>
                  <button 
                    className={`info-panel__media-tab ${activeMediaTab === 'photos' ? 'info-panel__media-tab--active' : ''}`}
                    onClick={() => setActiveMediaTab('photos')}
                    style={{ flex: 1, padding: '8px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: activeMediaTab === 'photos' ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: activeMediaTab === 'photos' ? '2px solid var(--color-primary)' : '2px solid transparent', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s' }}
                  >
                    <Image size={14} /> {t('chat.photos') || 'Ảnh'}
                  </button>
                  <button 
                    className={`info-panel__media-tab ${activeMediaTab === 'files' ? 'info-panel__media-tab--active' : ''}`}
                    onClick={() => setActiveMediaTab('files')}
                    style={{ flex: 1, padding: '8px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: activeMediaTab === 'files' ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: activeMediaTab === 'files' ? '2px solid var(--color-primary)' : '2px solid transparent', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s' }}
                  >
                    <FileText size={14} /> {t('chat.files') || 'Tệp'}
                  </button>
                </div>
                
                {loadingMedia ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                    <Loader2 className="animate-spin" size={24} color="var(--color-primary)" />
                  </div>
                ) : (
                  <div className="info-panel__media-content">
                    {(() => {
                      if (activeMediaTab === 'photos') {
                        const photos = mediaItems.filter(m => m.messageType === 'image' || (m.messageType === 'file' && m.file?.type?.startsWith('video/')));
                        if (photos.length === 0) {
                          return (
                            <div className="info-panel__media-empty" style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--color-text-muted)' }}>
                              <Image size={32} style={{ opacity: 0.5, margin: '0 auto 8px' }} />
                              <p style={{ fontSize: '13px' }}>{t('chat.noMediaFound') || 'Chưa có phương tiện'}</p>
                            </div>
                          );
                        }
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', padding: '0 8px 16px' }}>
                            {photos.map(p => {
                              const isVideo = p.messageType === 'file' && p.file?.type?.startsWith('video/');
                              const src = isVideo ? p.file?.url : p.image;
                              return (
                                <div 
                                  key={p._id} 
                                  className="info-panel__media-grid-item"
                                  onClick={() => {
                                    if (isVideo) setVideoLightboxSrc(src);
                                    else setLightboxSrc(src);
                                  }}
                                  style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', background: 'var(--color-hover-bg)' }}
                                >
                                  {isVideo ? (
                                    <>
                                      <video src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Play size={20} color="white" fill="white" />
                                      </div>
                                    </>
                                  ) : (
                                    <img src={src} alt="media" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        const files = mediaItems.filter(m => m.messageType === 'file' && !m.file?.type?.startsWith('video/'));
                        if (files.length === 0) {
                          return (
                            <div className="info-panel__media-empty" style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--color-text-muted)' }}>
                              <FileText size={32} style={{ opacity: 0.5, margin: '0 auto 8px' }} />
                              <p style={{ fontSize: '13px' }}>{t('chat.noFilesFound') || 'Chưa có tệp nào'}</p>
                            </div>
                          );
                        }
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 8px 16px' }}>
                            {files.map(f => {
                              const sizeStr = f.file?.size ? (f.file.size < 1024 * 1024 ? (f.file.size / 1024).toFixed(1) + ' KB' : (f.file.size / (1024 * 1024)).toFixed(1) + ' MB') : '';
                              const isPreviewable = f.file?.name?.toLowerCase().endsWith('.pdf') || f.file?.name?.toLowerCase().endsWith('.md');
                              return (
                                <a 
                                  key={f._id}
                                  href={f.file?.url}
                                  target={isPreviewable ? '_blank' : '_self'}
                                  rel={isPreviewable ? 'noopener noreferrer' : ''}
                                  download={!isPreviewable ? f.file?.name : undefined}
                                  className="info-panel__file-list-item"
                                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '8px', background: 'var(--color-hover-bg)', textDecoration: 'none', color: 'var(--color-text)', transition: 'background 0.2s' }}
                                >
                                  <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <FileText size={20} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {f.file?.name || t('chat.document') || 'Tài liệu'}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                      {sizeStr}
                                    </div>
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>
            )}

            <button
              className="info-panel__section-toggle"
              onClick={() => setInfoPrivacyOpen((v) => !v)}
            >
              <span>{t('chat.privacyAndSupport')}</span>
              <ChevronDown size={16} className={infoPrivacyOpen ? 'info-panel__chevron--open' : ''} />
            </button>
            {infoPrivacyOpen && (
              <div className="info-panel__section-content">
                {isGroup ? (
                  <button className="info-panel__action-row info-panel__action-row--danger" onClick={handleLeaveGroup}>
                    <LogOut size={16} />
                    <span>{t('chat.leaveGroup')}</span>
                  </button>
                ) : user?.blockedUsers?.some(id => id?.toString() === otherMember?._id?.toString()) ? (
                  <button 
                    className="info-panel__action-row info-panel__action-row--danger"
                    onClick={handleUnblockUser}
                    disabled={isBlockingUser}
                    style={{ opacity: isBlockingUser ? 0.6 : 1 }}
                  >
                    <ShieldCheck size={16} />
                    <span>{isBlockingUser ? (t('chat.processing') || 'Đang xử lý...') : (t('chat.unblockUser') || 'Bỏ chặn người dùng')}</span>
                  </button>
                ) : (
                  <button 
                    className="info-panel__action-row info-panel__action-row--danger"
                    onClick={handleBlockUser}
                    disabled={isBlockingUser}
                    style={{ opacity: isBlockingUser ? 0.6 : 1 }}
                  >
                    <ShieldBan size={16} />
                    <span>{isBlockingUser ? (t('chat.processing') || 'Đang xử lý...') : t('chat.blockUser')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
          </>
          )}
        </aside>
      )}

      {/* Remove member confirm modal */}
      {showRemoveConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowRemoveConfirm(null)}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: '12px', padding: '24px',
            maxWidth: '400px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: 'var(--color-text)' }}>
              {t('chat.confirmRemoveMember') || 'Xóa thành viên'}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              {t('chat.confirmRemoveDesc') || `Bạn có chắc chắn muốn xóa ${showRemoveConfirm.fullName} khỏi nhóm?`}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRemoveConfirm(null)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: 'var(--color-hover-bg)', color: 'var(--color-text)', fontSize: '14px', fontWeight: 600
                }}
              >
                {t('profile.cancel') || 'Không'}
              </button>
              <button
                onClick={() => handleRemoveMember(showRemoveConfirm._id)}
                disabled={isRemovingMember}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: '#e74c3c', color: 'white', fontSize: '14px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {isRemovingMember && <Loader2 className="animate-spin" size={14} />}
                {t('chat.confirmYes') || 'Có'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      <UserProfileModal
        isOpen={!!userProfileUserId}
        onClose={() => setUserProfileUserId(null)}
        userId={userProfileUserId}
        onSendMessage={handleUserProfileSendMessage}
      />

      {/* Nickname modal */}
      {showNicknameModal && nicknameTarget && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowNicknameModal(false)}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: '12px', padding: '24px',
            maxWidth: '400px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: 'var(--color-text)' }}>
              {t('chat.setNickname') || 'Đặt biệt danh'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {nicknameTarget.fullName}
            </p>
            <input
              type="text"
              value={nicknameValue}
              onChange={(e) => setNicknameValue(e.target.value)}
              placeholder={t('chat.nicknamePlaceholder') || "Nhập biệt danh..."}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNickname() }}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-bg)', color: 'var(--color-text)',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setShowNicknameModal(false)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: 'var(--color-hover-bg)', color: 'var(--color-text)', fontSize: '14px', fontWeight: 600
                }}
              >
                {t('chat.cancel') || 'Hủy'}
              </button>
              <button
                onClick={handleSaveNickname}
                disabled={isUpdatingNickname}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: 'var(--color-primary)', color: 'white', fontSize: '14px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {isUpdatingNickname && <Loader2 className="animate-spin" size={14} />}
                {t('chat.save') || 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightboxes */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="attachment"
          onClose={() => setLightboxSrc(null)}
        />
      )}
      {videoLightboxSrc && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setVideoLightboxSrc(null)}>
          <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', padding: '8px', borderRadius: '50%', cursor: 'pointer' }} onClick={() => setVideoLightboxSrc(null)}>
            <X size={24} />
          </button>
          <video src={videoLightboxSrc} controls autoPlay style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px' }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModalData.isOpen}
        title={confirmModalData.type === 'block' ? (t('chat.blockUser') || 'Chặn người dùng') : (t('chat.unblockUser') || 'Bỏ chặn người dùng')}
        message={confirmModalData.type === 'block' ? (t('chat.blockUserConfirm') || 'Bạn có chắc chắn muốn chặn người dùng này?') : (t('chat.unblockUserConfirm') || 'Bạn có chắc chắn muốn bỏ chặn người dùng này?')}
        danger={confirmModalData.type === 'block'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModalData(prev => ({ ...prev, isOpen: false }))}
      />

      <WarningPopup />
    </div>
  )
}

export default ChatPage
