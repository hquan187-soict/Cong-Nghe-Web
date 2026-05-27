import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createCall,
  endCall,
  getCallHistory,
} from "../controllers/call.controller.js";

const router = express.Router();

router.post("/", protect, createCall);
router.patch("/:id/end", protect, endCall);
router.get("/history", protect, getCallHistory);

export default router;