import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";
import { sendOtpToEmail } from "../lib/OTP.js";
import OTPLog from "../models/OTPLog.js";

const normalizeEmail = (email) => email.trim().toLowerCase();

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

    generateToken(savedUser._id, res);

    return res.status(201).json({
      _id: savedUser._id,
      fullName: savedUser.fullName,
      email: savedUser.email,
      avatar: savedUser.avatar,
    });
  } catch (error) {
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    let { email, password } = req.body;

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
    if (password.length > 64) {
      const error = new Error("Email hoặc mật khẩu không đúng!");
      error.statusCode = 400;
      throw error;
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      const error = new Error("Email hoặc mật khẩu không đúng!");
      error.statusCode = 400;
      throw error;
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
    });
  } catch (error) {
    return next(error);
  }
};

// Xóa cookie với options giống trong util.js :D
export const logout = (_, res) => {
  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "development" ? false : true,
  });

  res.status(200).json({ message: "Đăng xuất thành công!" });
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
    OTPLog.deleteMany({ email: normalizedEmail }).catch((err) => {
      console.error("Lỗi khi xóa OTP cũ:", err);
    });
    const otpLog = new OTPLog({
      email: normalizedEmail,
      otp,
    });
    await otpLog.save();
    res.status(200).json({ message: "OTP đã được gửi đến email!" });
  } catch (error) {
    return next(error);
  }
};

const verifyOTP = async (email, otp, type) => {
  try {
    if (typeof email !== "string" || typeof otp !== "string") {
      return false;
    }
    const normalizedEmail = normalizeEmail(email);
    let user;
    if (type === "reset-password") {
      user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return false;
      }
    }
    const otpLog = await OTPLog.findOne({ email: normalizedEmail, otp });
    if (!otpLog) {
      return false;
    }
    // Xóa OTP đã sử dụng
    await OTPLog.deleteOne({ email: normalizedEmail, otp });
    return true;
  } catch (error) {
    return false;
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword, otp } = req.body;
    console.log("Received reset password request:", { email, newPassword, otp });
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
    await user.save();
    res.status(200).json({ message: "Mật khẩu đã được cập nhật!" });
  } catch (error) {
    return next(error);
  }
};