import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";
import { sendOtpToEmail } from "../lib/OTP.js";
import OTPLog from "../models/OTPLog.js";
import TokenBlacklist from "../models/TokenBlacklist.js";

const normalizeEmail = (email) => email.trim().toLowerCase();

const checkBanStatus = async (user) => {
  if (user.banStatus === "banned") {
    if (user.banExpiresAt && new Date() >= user.banExpiresAt) {
      user.banStatus = "none";
      user.banExpiresAt = null;
      await user.save();
      return { allowed: true, hasWarning: false };
    }
    let message;
    if (user.banExpiresAt) {
      const formatted = user.banExpiresAt.toLocaleDateString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
      });
      message = `Bạn đã vi phạm tiêu chuẩn cộng đồng của chúng tôi. Thời hạn bị cấm của bạn đến ngày ${formatted}.`;
    } else {
      message = "Bạn đã vi phạm tiêu chuẩn cộng đồng của chúng tôi. Tài khoản của bạn đã bị cấm vĩnh viễn. Nếu có khiếu nại, vui lòng liên hệ đến địa chỉ email: truonghoangquan18072005@gmail.com";
    }
    const error = new Error(message);
    error.statusCode = 403;
    throw error;
  }
  if (user.banStatus === "warning") {
    if (user.warningExpiresAt && new Date() >= user.warningExpiresAt) {
      user.banStatus = "none";
      user.warningExpiresAt = null;
      await user.save();
      return { allowed: true, hasWarning: false };
    }
    return { allowed: true, hasWarning: true, warningExpiresAt: user.warningExpiresAt };
  }
  return { allowed: true, hasWarning: false };
};

export const signup = async (req, res, next) => {
  try {
    let { fullName, email, password, otp } = req.body;

    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof otp !== "string"
    ) {
      const error = new Error("fullName, email, password và otp phải là chuỗi!");
      error.statusCode = 400;
      throw error;
    }

    fullName = fullName.trim();
    email = normalizeEmail(email);

    if (!fullName || !email || !password || !otp) {
      const error = new Error("Các trường không được bỏ trống!");
      error.statusCode = 400;
      throw error;
    }
    if (password.length < 6) {
      const error = new Error("Mật khẩu phải có ít nhất 6 ký tự!");
      error.statusCode = 400;
      throw error;
    }
    if (password.length > 64) {
      const error = new Error("Mật khẩu không được vượt quá 64 ký tự!");
      error.statusCode = 400;
      throw error;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      const error = new Error("Địa chỉ email không hợp lệ!");
      error.statusCode = 400;
      throw error;
    }

    if (!await verifyOTP(email, otp, "verify")) {
      const error = new Error("OTP không hợp lệ hoặc đã hết hạn!");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({ email });

    if (user) {
      const error = new Error("Email đã được sử dụng!");
      error.statusCode = 409;
      throw error;
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });
    const savedUser = await newUser.save();

    const token = generateToken(savedUser._id, res);

    return res.status(201).json({
      _id: savedUser._id,
      fullName: savedUser.fullName,
      email: savedUser.email,
      avatar: savedUser.avatar,
      role: savedUser.role,
      token,
    });
  } catch (error) {
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    let { email, password, captchaToken } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      const error = new Error("Email và password phải là chuỗi!");
      error.statusCode = 400;
      throw error;
    }

    email = normalizeEmail(email);
    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error("Email hoặc mật khẩu không đúng!");
      error.statusCode = 400;
      throw error;
    }

    if (user.status === "deleted") {
      const error = new Error("Tài khoản này đã bị xóa và không thể đăng nhập.");
      error.statusCode = 403;
      throw error;
    }

    if (user.failedLoginAttempts >= 3) {
      if (!captchaToken) {
        return res.status(403).json({ success: false, message: "Vui lòng xác minh bạn không phải là robot", requiresCaptcha: true });
      }
      
      const secretKey = process.env.RECAPTCHA_SECRET_KEY;
      const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`;
      
      const captchaResponse = await fetch(verifyUrl, { method: 'POST' });
      const captchaData = await captchaResponse.json();
      
      console.log("CAPTCHA VERIFY RESULT:", captchaData);
      
      if (!captchaData.success) {
        return res.status(400).json({ 
          success: false, 
          message: "Xác minh CAPTCHA thất bại: " + (captchaData['error-codes'] ? captchaData['error-codes'].join(', ') : 'Unknown'), 
          requiresCaptcha: true 
        });
      }
    }

    if (!user.password) {
      const error = new Error("Tài khoản này được đăng ký bằng Google. Vui lòng đăng nhập bằng Google!");
      error.statusCode = 400;
      throw error;
    }
    if (password.length > 64) {
      const error = new Error("Email hoặc mật khẩu không đúng!");
      error.statusCode = 400;
      throw error;
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      await user.save();
      
      const requiresCaptcha = user.failedLoginAttempts >= 3;
      return res.status(400).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng!",
        requiresCaptcha
      });
    }

    user.failedLoginAttempts = 0;
    await user.save();

    const { hasWarning, warningExpiresAt } = await checkBanStatus(user);

    const token = generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      token,
      hasWarning,
      warningExpiresAt: warningExpiresAt || null,
    });
  } catch (error) {
    return next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;
    const token = req.cookies?.jwt || bearerToken;

    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.userId && decoded.exp) {
          await TokenBlacklist.create({
            token,
            userId: decoded.userId,
            expiresAt: new Date(decoded.exp * 1000),
          });
        }
      } catch (blacklistError) {
        console.error("Failed to blacklist token:", blacklistError.message);
      }
    }

    res.clearCookie("jwt", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "development" ? false : true,
    });

    res.status(200).json({ message: "Đăng xuất thành công!" });
  } catch (error) {
    return next(error);
  }
};

export const sendOTP = async (req, res, next) => {
  try {
    const { email, type } = req.body;

    if (typeof email !== "string") {
      const error = new Error("Email phải là chuỗi!");
      error.statusCode = 400;
      throw error;
    }
    if (type !== "reset" && type !== "verify") {
      const error = new Error("Type không hợp lệ!");
      error.statusCode = 400;
      throw error;
    }
    const normalizedEmail = normalizeEmail(email);
    if (type === "reset") {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        const error = new Error("Email không tồn tại!");
        error.statusCode = 404;
        throw error;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        const error = new Error("Địa chỉ email không hợp lệ!");
        error.statusCode = 400;
        throw error;
      } else {
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
          const error = new Error("Email đã được sử dụng!");
          error.statusCode = 409;
          throw error;
        }
      }
    }
    // Tạo OTP và lưu vào user
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Gửi OTP qua email
    await sendOtpToEmail(normalizedEmail, otp);
    // Lưu OTP vào cơ sở dữ liệu
    await OTPLog.deleteMany({ email: normalizedEmail });
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);
    const otpLog = new OTPLog({
      email: normalizedEmail,
      otp: hashedOtp,
    });
    await otpLog.save();
    res.status(200).json({ message: "OTP đã được gửi đến email!" });
  } catch (error) {
    return next(error);
  }
};

const otpAttempts = new Map();
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCKOUT_MS = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of otpAttempts) {
    if (now - entry.firstAttemptAt > OTP_LOCKOUT_MS) {
      otpAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

const verifyOTP = async (email, otp, type) => {
  try {
    if (typeof email !== "string" || typeof otp !== "string") {
      return false;
    }
    const normalizedEmail = normalizeEmail(email);

    const attempt = otpAttempts.get(normalizedEmail);
    if (attempt && attempt.count >= OTP_MAX_ATTEMPTS && Date.now() - attempt.firstAttemptAt < OTP_LOCKOUT_MS) {
      return false;
    }

    let user;
    if (type === "reset-password") {
      user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return false;
      }
    }
    const otpLogs = await OTPLog.find({ email: normalizedEmail });
    let matchedLog = null;
    for (const log of otpLogs) {
      if (await bcrypt.compare(otp, log.otp)) {
        matchedLog = log;
        break;
      }
    }
    if (!matchedLog) {
      const existing = otpAttempts.get(normalizedEmail);
      if (!existing || Date.now() - existing.firstAttemptAt > OTP_LOCKOUT_MS) {
        otpAttempts.set(normalizedEmail, { count: 1, firstAttemptAt: Date.now() });
      } else {
        existing.count += 1;
        if (existing.count >= OTP_MAX_ATTEMPTS) {
          await OTPLog.deleteMany({ email: normalizedEmail });
        }
      }
      return false;
    }
    otpAttempts.delete(normalizedEmail);
    await OTPLog.deleteOne({ _id: matchedLog._id });
    return true;
  } catch (error) {
    return false;
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword, otp } = req.body;
    if (typeof email !== "string" || typeof newPassword !== "string") {
      const error = new Error("Email và mật khẩu mới phải là chuỗi!");
      error.statusCode = 400;
      throw error;
    }
    if (newPassword.length < 6) {
      const error = new Error("Mật khẩu mới phải có ít nhất 6 ký tự!");
      error.statusCode = 400;
      throw error;
    }
    if (newPassword.length > 64) {
      const error = new Error("Mật khẩu mới không được vượt quá 64 ký tự!");
      error.statusCode = 400;
      throw error;
    }
    if (!await verifyOTP(email, otp, "reset-password")) {
      const error = new Error("OTP không hợp lệ hoặc đã hết hạn!");
      error.statusCode = 400;
      throw error;
    }
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const error = new Error("Email không tồn tại!");
      error.statusCode = 404;
      throw error;
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    await user.save();
    res.status(200).json({ message: "Mật khẩu đã được cập nhật!" });
  } catch (error) {
    return next(error);
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      const error = new Error("Không tìm thấy Google Token!");
      error.statusCode = 400;
      throw error;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const { email: rawEmail, name: fullName, picture: avatar, sub: googleId } = payload;
    const email = rawEmail.toLowerCase();

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ fullName, email, avatar, googleId, authProvider: 'google' });
      await user.save();
    } else {
      if (user.status === "deleted") {
        const error = new Error("Tài khoản này đã bị xóa và không thể đăng nhập.");
        error.statusCode = 403;
        throw error;
      }
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    }

    const { hasWarning, warningExpiresAt } = await checkBanStatus(user);

    const token = generateToken(user._id, res);
    res.status(200).json({ _id: user._id, fullName: user.fullName, email: user.email, avatar: user.avatar, role: user.role, token, hasWarning, warningExpiresAt: warningExpiresAt || null });

  } catch (error) {
    console.error("Lỗi Google Login Backend:", error);
    return next(error);
  }
};