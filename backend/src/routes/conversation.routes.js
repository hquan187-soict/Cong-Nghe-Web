import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createConversation,
  getConversations,
} from "../controllers/conversation.controller.js";

const router = express.Router();

router.post("/", protect, createConversation);
router.get("/", protect, getConversations);

export default router;