import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  toggleReaction,
  editMessage,
  deleteMessage,
  togglePinMessage,
  getPinnedMessages,
  forwardMessage,
  getMediaAndFiles,
  searchMessages,
  createPoll,
  votePoll,
  getPollDetail,
  getMessagesAround,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/:conversationId/around/:messageId", protect, getMessagesAround);
router.get("/:conversationId", protect, getMessages);
router.get("/:conversationId/pinned", protect, getPinnedMessages);
router.get("/:conversationId/media-files", protect, getMediaAndFiles);
router.get("/:conversationId/search", protect, searchMessages);
router.post("/poll", protect, createPoll);
router.post("/", protect, sendMessage);
router.post("/:conversationId/read", protect, markMessagesAsRead);
router.post("/:messageId/reaction", protect, toggleReaction);
router.post("/:messageId/vote", protect, votePoll);
router.get("/:messageId/poll", protect, getPollDetail);
router.put("/:messageId/pin", protect, togglePinMessage);
router.post("/:messageId/forward", protect, forwardMessage);
router.put("/:messageId/edit", protect, editMessage);
router.put("/:messageId/delete", protect, deleteMessage);

export default router;
