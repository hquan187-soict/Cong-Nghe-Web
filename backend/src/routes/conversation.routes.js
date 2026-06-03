import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createConversation,
  getConversations,
  updateConversation,
  addMember,
  leaveGroup,
  removeMember,
  updateAddMemberPermission,
  requestAddMember,
  approveRequest,
  rejectRequest,
  updateNickname,
  updateEmoji,
  updateThemeColor,
  togglePinConversation,
  toggleMuteConversation,
  toggleArchiveConversation,
  deleteChat,
  markAsUnread,
} from "../controllers/conversation.controller.js";

const router = express.Router();

router.post("/", protect, createConversation);
router.get("/", protect, getConversations);
router.put("/:id", protect, updateConversation);
router.post("/:id/members", protect, addMember);
router.post("/:id/leave", protect, leaveGroup);
router.post("/:id/remove-member", protect, removeMember);
router.put("/:id/add-member-permission", protect, updateAddMemberPermission);
router.put("/:id/nickname", protect, updateNickname);
router.put("/:id/emoji", protect, updateEmoji);
router.put("/:id/theme-color", protect, updateThemeColor);
router.post("/:id/toggle-pin", protect, togglePinConversation);
router.post("/:id/toggle-mute", protect, toggleMuteConversation);
router.post("/:id/toggle-archive", protect, toggleArchiveConversation);
router.post("/:id/request-add-member", protect, requestAddMember);
router.post("/:id/approve-request", protect, approveRequest);
router.post("/:id/reject-request", protect, rejectRequest);
router.delete("/:id/deleteChat", protect, deleteChat);
router.post("/:id/mark-unread", protect, markAsUnread);

export default router;