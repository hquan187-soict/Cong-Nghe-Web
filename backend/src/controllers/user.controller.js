import User from "../models/User.js";
import mongoose from "mongoose";
import cloudinary from "../lib/cloudinary.js";

const validateUserId = (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error = new Error("ID người dùng không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }
};

export const searchUsers = async (req, res, next) => {
  try {
    const q = req.query.q?.trim();
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    const filter = { _id: { $ne: currentUserId } };
    if (q) {
      filter.$or = [
        { fullName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const users = await User.find(filter).select("-password");

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

export const toggleActiveStatus = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    const { enabled } = req.body;
    const update = { showActiveStatus: !!enabled };
    if (!enabled) {
      update.lastSeen = new Date();
    }

    const updatedUser = await User.findByIdAndUpdate(currentUserId, update, { new: true }).select("-password");
    return res.status(200).json(updatedUser);
  } catch (error) {
    return next(error);
  }
};

export const  updateProfile = async (req, res, next) => {
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

    if (updateData.avatar !== undefined) {
      const avatarUrl = await cloudinary.uploader.upload(updateData.avatar, {
        folder: "avatars",
        public_id: `avatar_${currentUserId}`,
      });
      updateData.avatar = avatarUrl.secure_url;
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

export const sendFriendRequest = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { userId } = req.params;

    validateUserId(userId);

    if (currentUserId.toString() === userId.toString()) {
      const error = new Error("Không thể gửi lời mời kết bạn cho chính mình.");
      error.statusCode = 400;
      throw error;
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const isBlocked =
      currentUser.blockedUsers.some((id) => id.toString() === userId.toString()) ||
      targetUser.blockedUsers.some((id) => id.toString() === currentUserId.toString());

    if (isBlocked) {
      const error = new Error("Không thể gửi lời mời kết bạn.");
      error.statusCode = 403;
      throw error;
    }

    await User.findByIdAndUpdate(userId, {
      $addToSet: {
        friendRequests: currentUserId,
      },
    });

    return res.status(200).json({ message: "Đã gửi lời mời kết bạn." });
  } catch (error) {
    return next(error);
  }
};

export const acceptFriendRequest = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { userId } = req.params;
    validateUserId(userId);

    const currentUser = await User.findById(currentUserId);

    const hasRequest = currentUser.friendRequests.some(
      (id) => id.toString() === userId.toString()
    );

    if (!hasRequest) {
      const error = new Error("Không tìm thấy lời mời kết bạn.");
      error.statusCode = 404;
      throw error;
    }

    await User.findByIdAndUpdate(currentUserId, {
      $pull: { friendRequests: userId },
      $addToSet: { friends: userId },
    });

    await User.findByIdAndUpdate(userId, {
      $addToSet: { friends: currentUserId },
    });

    return res.status(200).json({ message: "Đã chấp nhận lời mời kết bạn." });
  } catch (error) {
    return next(error);
  }
};

export const rejectFriendRequest = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { userId } = req.params;
    validateUserId(userId);

    await User.findByIdAndUpdate(currentUserId, {
      $pull: {
        friendRequests: userId,
      },
    });

    return res.status(200).json({ message: "Đã từ chối lời mời kết bạn." });
  } catch (error) {
    return next(error);
  }
};

export const unfriend = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { userId } = req.params;
    validateUserId(userId);

    await User.findByIdAndUpdate(currentUserId, {
      $pull: {
        friends: userId,
      },
    });

    await User.findByIdAndUpdate(userId, {
      $pull: {
        friends: currentUserId,
      },
    });

    return res.status(200).json({ message: "Đã hủy kết bạn." });
  } catch (error) {
    return next(error);
  }
};

export const blockUser = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { userId } = req.params;
    validateUserId(userId);

    if (currentUserId.toString() === userId.toString()) {
      const error = new Error("Không thể chặn chính mình.");
      error.statusCode = 400;
      throw error;
    }

    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: {
        blockedUsers: userId,
      },
      $pull: {
        friends: userId,
        friendRequests: userId,
      },
    });

    await User.findByIdAndUpdate(userId, {
      $pull: {
        friends: currentUserId,
        friendRequests: currentUserId,
      },
    });

    return res.status(200).json({ message: "Đã chặn người dùng." });
  } catch (error) {
    return next(error);
  }
};

export const unblockUser = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { userId } = req.params;
    validateUserId(userId);
    
    await User.findByIdAndUpdate(currentUserId, {
      $pull: {
        blockedUsers: userId,
      },
    });

    return res.status(200).json({ message: "Đã bỏ chặn người dùng." });
  } catch (error) {
    return next(error);
  }
};