import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";

const normalizeEmail = (email) => email.trim().toLowerCase();

export const signup = async (req, res, next) => {
  try {
    let { fullName, email, password } = req.body;

    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      const error = new Error("fullName, email và password phải là chuỗi!");
      error.statusCode = 400;
      throw error;
    }

    fullName = fullName.trim();
    email = normalizeEmail(email);

    if (!fullName || !email || !password) {
      const error = new Error("Các trường không được bỏ trống!");
      error.statusCode = 400;
      throw error;
    }
    if (password.length < 6) {
      const error = new Error("Mật khẩu phải có ít nhất 6 ký tự!");
      error.statusCode = 400;
      throw error;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      const error = new Error("Địa chỉ email không hợp lệ!");
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
