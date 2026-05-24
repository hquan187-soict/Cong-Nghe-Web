import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/:conversationId", protect, getMessages);
router.post("/", protect, sendMessage);
router.put("/:messageId", protect, editMessage);
router.delete("/:messageId", protect, deleteMessage);
router.post("/:conversationId/read", protect, markMessagesAsRead);

export default router;