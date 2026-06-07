import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  searchUsers,
  getUserById,
  updateProfile,
  changePassword,
  toggleActiveStatus,
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriend,
  blockUser,
  unblockUser,
  deleteMyAccount,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/search", protect, searchUsers);
router.get("/friends", protect, getFriends);
router.get("/friend-requests", protect, getFriendRequests);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.put("/active-status", protect, toggleActiveStatus);
router.delete("/account", protect, deleteMyAccount);

router.post("/friend-requests/:userId", protect, sendFriendRequest);
router.put("/friend-requests/:userId", protect, acceptFriendRequest);
router.delete("/friend-requests/:userId", protect, rejectFriendRequest);
router.delete("/friends/:userId", protect, unfriend);
router.post("/blocks/:userId", protect, blockUser);
router.delete("/blocks/:userId", protect, unblockUser);

router.get("/:id", protect, getUserById);

export default router;