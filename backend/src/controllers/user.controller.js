import User from "../models/User.js";
import mongoose from "mongoose";

export const searchUsers = async (req, res, next) => {
  try {
    const q = req.query.q?.trim();
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!q) {
      return res.status(200).json([]);
    }

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { fullName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    }).select("-password");

    return res.status(200).json(users);
  } catch (error) {
    return next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("ID người dùng không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(id).select("-password");

    if (!user) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if ("password" in req.body) {
      const error = new Error("Không thể cập nhật password tại endpoint này.");
      error.statusCode = 400;
      throw error;
    }

    const allowedFields = ["fullName", "email", "avatar"];
    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (updateData.fullName !== undefined && typeof updateData.fullName !== "string") {
      const error = new Error("fullName phải là chuỗi.");
      error.statusCode = 400;
      throw error;
    }

    if (updateData.avatar !== undefined && typeof updateData.avatar !== "string") {
      const error = new Error("avatar phải là chuỗi.");
      error.statusCode = 400;
      throw error;
    }

    if (updateData.email !== undefined) {
      if (typeof updateData.email !== "string") {
        const error = new Error("Email phải là chuỗi.");
        error.statusCode = 400;
        throw error;
      }

      updateData.email = updateData.email.trim().toLowerCase();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        const error = new Error("Email không đúng định dạng.");
        error.statusCode = 400;
        throw error;
      }
    }

    if (Object.keys(updateData).length === 0) {
      const error = new Error("Không có dữ liệu hợp lệ để cập nhật.");
      error.statusCode = 400;
      throw error;
    }

    const updatedUser = await User.findByIdAndUpdate(
      currentUserId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!updatedUser) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json(updatedUser);
  } catch (error) {
    return next(error);
  }
};