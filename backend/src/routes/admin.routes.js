import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import {
  getUsers,
  updateUserBan,
  getReports,
  updateReportStatus,
  getReportContext,
  purgeUserAccount,
} from "../controllers/admin.controller.js";

const router = express.Router();

router.use(protect, requireAdmin);

router.get("/users", getUsers);
router.put("/users/:id/ban", updateUserBan);
router.delete("/users/:id/purge", purgeUserAccount);
router.get("/reports", getReports);
router.put("/reports/:id/status", updateReportStatus);
router.get("/reports/:id/context", getReportContext);

export default router;
