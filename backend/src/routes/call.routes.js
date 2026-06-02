import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getCallHistory } from "../controllers/call.controller.js";

const router = express.Router();

router.get("/history", protect, getCallHistory);

export default router;
