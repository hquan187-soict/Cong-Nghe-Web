import express from "express";
import { signup, login, logout, sendOTP, resetPassword} from "../controllers/auth.controller.js";
import { protect } from "../middleware/authMiddleware.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
const router = express.Router();

const loginLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 5,
  message: 'Quá nhiều yêu cầu đăng nhập, vui lòng thử lại sau.',
});

const sendOtpEmailLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 3,
  keyGenerator: (req) => (req.body && req.body.email) || req.ip || req.connection.remoteAddress || "unknown",
  message: 'Quá nhiều yêu cầu gửi OTP, vui lòng thử lại sau.',
});

const sendOtpIpLimiter = createRateLimiter({
  windowMs: 3600000,
  maxRequests: 10,
  message: 'Quá nhiều yêu cầu gửi OTP, vui lòng thử lại sau.',
});

const signupLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 5,
  message: 'Quá nhiều yêu cầu đăng ký, vui lòng thử lại sau.',
});

const resetPasswordLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 5,
  message: 'Quá nhiều yêu cầu đặt lại mật khẩu, vui lòng thử lại sau.',
});

router.post("/signup", signupLimiter, signup);

router.post("/login", loginLimiter, login);

router.post("/logout", logout);

router.get("/me", protect, (req, res) => {
    res.status(200).json( req.user );
});

router.post("/send-otp", sendOtpIpLimiter, sendOtpEmailLimiter, sendOTP);

router.post("/reset-password", resetPasswordLimiter, resetPassword);

export default router;
