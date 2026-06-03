import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
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

    if (!q) {
      return res.status(200).json([]);
    }

    const currentUser = await User.findById(currentUserId);
    const blockedByMe = currentUser.blockedUsers.map((id) => id.toString());
    const blockedMe = await User.find({ blockedUsers: currentUserId }).select("_id");
    const blockedMeIds = blockedMe.map((u) => u._id.toString());
    const excludeIds = [...new Set([currentUserId.toString(), ...blockedByMe, ...blockedMeIds])];

    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = {
      _id: { $nin: excludeIds },
      $or: [
        { fullName: { $regex: escapedQ, $options: "i" } },
        { email: { $regex: escapedQ, $options: "i" } },
      ],
    };

    const users = await User.find(filter)
      .select("fullName email avatar isOnline lastSeen friendRequests")
      .limit(20);

    const myFriends = currentUser.friends.map((id) => id.toString());
    const myFriendRequests = currentUser.friendRequests.map((id) => id.toString());

    const results = users.map((u) => {
      const uid = u._id.toString();
      return {
        _id: u._id,
        fullName: u.fullName,
        email: u.email,
        avatar: u.avatar,
        isOnline: u.isOnline,
        lastSeen: u.lastSeen,
        isFriend: myFriends.includes(uid),
        requestSent: u.friendRequests.some((id) => id.toString() === currentUserId.toString()),
        hasReceivedRequest: myFriendRequests.includes(uid),
      };
    });

    return res.status(200).json(results);
  } catch (error) {
    return next(error);
  }
};

export const getFriends = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    const currentUser = await User.findById(currentUserId)
      .populate("friends", "fullName email avatar isOnline lastSeen");

    const friends = (currentUser.friends || []).filter(Boolean);

    return res.status(200).json(friends);
  } catch (error) {
    return next(error);
  }
};

export const getFriendRequests = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    const currentUser = await User.findById(currentUserId)
      .populate("friendRequests", "fullName email avatar isOnline lastSeen");

    const requests = (currentUser.friendRequests || []).filter(Boolean);

    return res.status(200).json(requests);
  } catch (error) {
    return next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("ID người dùng không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(id).select(
      "fullName email avatar coverColor isOnline lastSeen showActiveStatus birthday gender phone address hometown hobbies occupation education bio profileVisibility friends friendRequests"
    );

    if (!user) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    let relationshipStatus = "none";
    if (currentUserId && currentUserId.toString() !== id) {
      const currentUser = await User.findById(currentUserId).select("friends friendRequests");
      const isFriend = currentUser.friends.some((fId) => fId.toString() === id);
      if (isFriend) {
        relationshipStatus = "friends";
      } else {
        const sentRequest = user.friendRequests.some(
          (fId) => fId.toString() === currentUserId.toString()
        );
        if (sentRequest) {
          relationshipStatus = "request_sent";
        } else {
          const receivedRequest = currentUser.friendRequests.some(
            (fId) => fId.toString() === id
          );
          if (receivedRequest) {
            relationshipStatus = "request_received";
          }
        }
      }

      const isFriendForVisibility = relationshipStatus === "friends";
      const visibilityFields = [
        "birthday", "gender", "phone", "address",
        "hometown", "hobbies", "occupation", "education", "bio",
      ];
      const profileData = user.toObject();
      const visibility = profileData.profileVisibility || {};

      for (const field of visibilityFields) {
        const vis = visibility[field] || "friends";
        if (vis === "private") {
          profileData[field] = undefined;
        } else if (vis === "friends" && !isFriendForVisibility) {
          profileData[field] = undefined;
        }
      }

      delete profileData.friends;
      delete profileData.friendRequests;

      return res.status(200).json({ ...profileData, relationshipStatus });
    }

    const profileData = user.toObject();
    delete profileData.friends;
    delete profileData.friendRequests;

    return res.status(200).json(profileData);
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

    if ("email" in req.body) {
      const error = new Error("Không thể thay đổi email tại endpoint này.");
      error.statusCode = 400;
      throw error;
    }

    const allowedFields = [
      "fullName", "avatar", "coverColor", "birthday", "gender", "phone",
      "address", "hometown", "hobbies", "occupation", "education", "bio",
    ];
    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (req.body.profileVisibility !== undefined) {
      const validVisibilities = ["private", "friends", "public"];
      const visFields = [
        "birthday", "gender", "phone", "address",
        "hometown", "hobbies", "occupation", "education", "bio",
      ];
      const vis = {};
      for (const f of visFields) {
        if (req.body.profileVisibility[f] !== undefined) {
          if (!validVisibilities.includes(req.body.profileVisibility[f])) {
            const error = new Error(`Giá trị visibility không hợp lệ cho ${f}.`);
            error.statusCode = 400;
            throw error;
          }
          vis[`profileVisibility.${f}`] = req.body.profileVisibility[f];
        }
      }
      Object.assign(updateData, vis);
    }

    if (updateData.fullName !== undefined && typeof updateData.fullName !== "string") {
      const error = new Error("fullName phải là chuỗi.");
      error.statusCode = 400;
      throw error;
    }

    if (updateData.bio !== undefined && typeof updateData.bio === "string" && updateData.bio.length > 500) {
      const error = new Error("Tiểu sử không được vượt quá 500 ký tự.");
      error.statusCode = 400;
      throw error;
    }

    if (updateData.birthday !== undefined) {
      if (updateData.birthday === "" || updateData.birthday === null) {
        updateData.birthday = null;
      } else {
        const bday = new Date(updateData.birthday);
        if (isNaN(bday.getTime()) || bday > new Date()) {
          const error = new Error("Ngày sinh không hợp lệ.");
          error.statusCode = 400;
          throw error;
        }
        updateData.birthday = bday;
      }
    }

    if (updateData.avatar !== undefined) {
      if (updateData.avatar === "" || updateData.avatar === null) {
        updateData.avatar = "";
      } else if (updateData.avatar.startsWith("data:")) {
        const avatarUrl = await cloudinary.uploader.upload(updateData.avatar, {
          folder: "avatars",
          public_id: `avatar_${currentUserId}`,
        });
        updateData.avatar = avatarUrl.secure_url;
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

export const changePassword = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      const error = new Error("Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.");
      error.statusCode = 400;
      throw error;
    }

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      const error = new Error("Mật khẩu phải là chuỗi.");
      error.statusCode = 400;
      throw error;
    }

    if (newPassword.length < 6) {
      const error = new Error("Mật khẩu mới phải có ít nhất 6 ký tự.");
      error.statusCode = 400;
      throw error;
    }

    if (newPassword.length > 64) {
      const error = new Error("Mật khẩu mới không được vượt quá 64 ký tự.");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      const error = new Error("Mật khẩu hiện tại không đúng.");
      error.statusCode = 400;
      throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    return res.status(200).json({ message: "Đổi mật khẩu thành công." });
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

    if (currentUser.friends.some((id) => id.toString() === userId.toString())) {
      const error = new Error("Hai người đã là bạn bè.");
      error.statusCode = 400;
      throw error;
    }

    if (targetUser.friendRequests.some((id) => id.toString() === currentUserId.toString())) {
      const error = new Error("Lời mời kết bạn đã được gửi trước đó.");
      error.statusCode = 400;
      throw error;
    }

    if (currentUser.friendRequests.some((id) => id.toString() === userId.toString())) {
      await User.findByIdAndUpdate(currentUserId, {
        $pull: { friendRequests: userId },
        $addToSet: { friends: userId },
      });
      await User.findByIdAndUpdate(userId, {
        $addToSet: { friends: currentUserId },
      });
      return res.status(200).json({ message: "Đã tự động kết bạn thành công.", autoAccepted: true });
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

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser.friends.some((id) => id.toString() === userId.toString())) {
      const error = new Error("Bạn không còn kết bạn với người này.");
      error.statusCode = 400;
      throw error;
    }

    await User.findByIdAndUpdate(currentUserId, {
      $pull: { friends: userId },
    });

    await User.findByIdAndUpdate(userId, {
      $pull: { friends: currentUserId },
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

    const updatedUser = await User.findByIdAndUpdate(currentUserId, {
      $addToSet: {
        blockedUsers: userId,
      },
      $pull: {
        friends: userId,
        friendRequests: userId,
      },
    }, { new: true }).select("-password");

    await User.findByIdAndUpdate(userId, {
      $pull: {
        friends: currentUserId,
        friendRequests: currentUserId,
      },
    });

    await Conversation.findOneAndUpdate(
      {
        isGroup: false,
        members: { $all: [currentUserId, userId] }
      },
      {
        $addToSet: { archivedBy: currentUserId }
      }
    );

    return res.status(200).json(updatedUser);
  } catch (error) {
    return next(error);
  }
};

export const unblockUser = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { userId } = req.params;
    validateUserId(userId);
    
    const updatedUser = await User.findByIdAndUpdate(currentUserId, {
      $pull: {
        blockedUsers: userId,
      },
    }, { new: true }).select("-password");

    await Conversation.findOneAndUpdate(
      {
        isGroup: false,
        members: { $all: [currentUserId, userId] }
      },
      {
        $pull: { archivedBy: currentUserId }
      }
    );

    return res.status(200).json(updatedUser);
  } catch (error) {
    return next(error);
  }
};