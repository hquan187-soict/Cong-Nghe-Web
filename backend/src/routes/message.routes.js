import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getMessages,
  sendMessage,
  markMessagesAsRead,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/:conversationId", protect, getMessages);
router.post("/", protect, sendMessage);
router.post("/:conversationId/read", protect, markMessagesAsRead);

export default router;