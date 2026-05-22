import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  toggleReaction,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/:conversationId", protect, getMessages);
router.post("/", protect, sendMessage);
router.post("/:conversationId/read", protect, markMessagesAsRead);
router.post("/:messageId/reaction", protect, toggleReaction);

export default router;