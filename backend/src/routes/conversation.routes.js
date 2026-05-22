import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createConversation,
  getConversations,
  updateConversation,
  addMember,
  leaveGroup,
} from "../controllers/conversation.controller.js";

const router = express.Router();

router.post("/", protect, createConversation);
router.get("/", protect, getConversations);
router.put("/:id", protect, updateConversation);
router.post("/:id/members", protect, addMember);
router.post("/:id/leave", protect, leaveGroup);

export default router;