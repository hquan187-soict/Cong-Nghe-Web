import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  searchUsers,
  getUserById,
  updateProfile,
  toggleActiveStatus,
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriend,
  blockUser,
  unblockUser,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/search", protect, searchUsers);
router.get("/friends", protect, getFriends);
router.get("/friend-requests", protect, getFriendRequests);
router.put("/profile", protect, updateProfile);
router.put("/active-status", protect, toggleActiveStatus);

router.post("/friend-requests/:userId", protect, sendFriendRequest);
router.put("/friend-requests/:userId", protect, acceptFriendRequest);
router.delete("/friend-requests/:userId", protect, rejectFriendRequest);
router.delete("/friends/:userId", protect, unfriend);
router.post("/blocks/:userId", protect, blockUser);
router.delete("/blocks/:userId", protect, unblockUser);

router.get("/:id", protect, getUserById);

export default router;