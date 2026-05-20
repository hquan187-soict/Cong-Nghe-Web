import express from "express";
import { signup, login, logout, sendOTP, resetPassword} from "../controllers/auth.controller.js";
import { protect } from "../middleware/authMiddleware.js";
const router = express.Router();

router.post("/signup", signup);

router.post("/login", login);

router.post("/logout", logout);

router.get("/me", protect, (req, res) => {
    res.status(200).json( req.user );
});

router.post("/send-otp", sendOTP);

router.post("/reset-password", resetPassword);

export default router;