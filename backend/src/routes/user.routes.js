import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  searchUsers,
  getUserById,
  updateProfile,
  toggleActiveStatus,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/search", protect, searchUsers);
router.put("/profile", protect, updateProfile);
router.put("/active-status", protect, toggleActiveStatus);
router.get("/:id", protect, getUserById);

export default router;