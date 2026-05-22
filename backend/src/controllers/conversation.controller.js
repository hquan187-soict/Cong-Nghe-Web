import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";

export const addMember = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { userId } = req.body;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      const error = new Error("ID không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.isGroup) {
      const error = new Error("Nhóm không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const isMember = conversation.members.some(
      (mId) => mId.toString() === currentUserId.toString()
    );
    if (!isMember) {
      const error = new Error("Bạn không phải thành viên nhóm.");
      error.statusCode = 403;
      throw error;
    }

    const alreadyMember = conversation.members.some(
      (mId) => mId.toString() === userId.toString()
    );
    if (alreadyMember) {
      const error = new Error("Người dùng đã là thành viên nhóm.");
      error.statusCode = 400;
      throw error;
    }

    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    conversation.members.push(userId);
    await conversation.save();

    const updated = await Conversation.findById(id)
      .populate("members", "-password")
      .populate("admins", "-password")
      .populate("lastMessage");

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

export const leaveGroup = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("ID cuộc trò chuyện không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.isGroup) {
      const error = new Error("Nhóm không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const isMember = conversation.members.some(
      (mId) => mId.toString() === currentUserId.toString()
    );
    if (!isMember) {
      const error = new Error("Bạn không phải thành viên nhóm.");
      error.statusCode = 403;
      throw error;
    }

    conversation.members = conversation.members.filter(
      (mId) => mId.toString() !== currentUserId.toString()
    );

    const wasAdmin = conversation.admins.some(
      (aId) => aId.toString() === currentUserId.toString()
    );
    if (wasAdmin) {
      conversation.admins = conversation.admins.filter(
        (aId) => aId.toString() !== currentUserId.toString()
      );
      if (conversation.admins.length === 0 && conversation.members.length > 0) {
        conversation.admins.push(conversation.members[0]);
      }
    }

    if (conversation.members.length < 2) {
      await Conversation.findByIdAndDelete(id);
      return res.status(200).json({ deleted: true, message: "Nhóm đã bị xóa vì không đủ thành viên." });
    }

    await conversation.save();

    const updated = await Conversation.findById(id)
      .populate("members", "-password")
      .populate("admins", "-password")
      .populate("lastMessage");

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

export const createConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { userId, memberIds, name, avatar } = req.body;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    const inputIds = Array.isArray(memberIds) ? memberIds : userId ? [userId] : [];
    const uniqueIds = [...new Set(inputIds.map((id) => id?.toString()).filter(Boolean))];

    if (uniqueIds.length === 0) {
      const error = new Error("userId hoặc memberIds là bắt buộc.");
      error.statusCode = 400;
      throw error;
    }

    if (uniqueIds.includes(currentUserId.toString())) {
      const error = new Error("Không truyền chính mình vào danh sách members.");
      error.statusCode = 400;
      throw error;
    }

    if (uniqueIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      const error = new Error("memberIds có userId không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const users = await User.find({ _id: { $in: uniqueIds } });
    if (users.length !== uniqueIds.length) {
      const error = new Error("Một hoặc nhiều người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const allMembers = [currentUserId, ...uniqueIds];
    const isGroup = allMembers.length > 2;

    let finalName = name?.trim();
    if (isGroup && !finalName) {
      const lastNames = [req.user, ...users].map(u => {
        const parts = u.fullName?.trim().split(/\s+/);
        return parts ? parts[parts.length - 1] : "";
      }).filter(Boolean);
      finalName = lastNames.join(", ");
    }

    if (!isGroup) {
      const existingConversation = await Conversation.findOne({
        members: { $all: allMembers },
        isGroup: false,
        $expr: { $eq: [{ $size: "$members" }, 2] },
      })
        .populate("members", "-password")
        .populate("lastMessage");

      if (existingConversation) {
        return res.status(200).json(existingConversation);
      }
    }

    const conversation = await Conversation.create({
      members: allMembers,
      isGroup,
      name: isGroup ? finalName : undefined,
      avatar: avatar || null,
      admins: isGroup ? [currentUserId] : [],
    });

    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("members", "-password")
      .populate("admins", "-password")
      .populate("lastMessage");

    return res.status(201).json(populatedConversation);
  } catch (error) {
    return next(error);
  }
};


export const getConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    const conversations = await Conversation.find({
      members: currentUserId,
    })
      .populate("members", "-password")
      .populate("admins", "-password")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    const conversationsWithUnreadCount = await Promise.all(
      conversations.map(async (conversation) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conversation._id,
          senderId: { $ne: currentUserId },
          readBy: { $ne: currentUserId },
        });

        return {
          ...conversation.toObject(),
          unreadCount,
        };
      })
    );

    return res.status(200).json(conversationsWithUnreadCount);
  } catch (error) {
    return next(error);
  }
};

export const updateConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { name, avatar } = req.body;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("ID cuộc trò chuyện không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      const error = new Error("Cuộc trò chuyện không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const isMember = conversation.members.some(
      (mId) => mId.toString() === currentUserId.toString()
    );
    if (!isMember) {
      const error = new Error("Bạn không có quyền chỉnh sửa cuộc trò chuyện này.");
      error.statusCode = 403;
      throw error;
    }

    if (!conversation.isGroup) {
      const error = new Error("Chỉ có thể cập nhật thông tin cho nhóm.");
      error.statusCode = 400;
      throw error;
    }

    const updateData = {};
    if (name !== undefined) {
      if (typeof name !== "string") {
        const error = new Error("Tên nhóm phải là chuỗi.");
        error.statusCode = 400;
        throw error;
      }
      updateData.name = name.trim();
    }

    if (avatar !== undefined) {
      if (avatar === null || avatar === "") {
        updateData.avatar = null;
      } else {
        const avatarUrl = await cloudinary.uploader.upload(avatar, {
          folder: "avatars",
          public_id: `group_avatar_${conversation._id}`,
        });
        updateData.avatar = avatarUrl.secure_url;
      }
    }

    if (Object.keys(updateData).length === 0) {
      const error = new Error("Không có dữ liệu hợp lệ để cập nhật.");
      error.statusCode = 400;
      throw error;
    }

    const updatedConversation = await Conversation.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    )
      .populate("members", "-password")
      .populate("admins", "-password")
      .populate("lastMessage");

    return res.status(200).json(updatedConversation);
  } catch (error) {
    return next(error);
  }
};
