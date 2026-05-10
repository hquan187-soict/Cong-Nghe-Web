import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

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

    if (isGroup && !name?.trim()) {
      const error = new Error("Tên nhóm là bắt buộc.");
      error.statusCode = 400;
      throw error;
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
      name: isGroup ? name.trim() : undefined,
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
