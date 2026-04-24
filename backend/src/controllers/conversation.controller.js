import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

export const createConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { userId } = req.body;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!userId) {
      const error = new Error("userId là bắt buộc.");
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      const error = new Error("userId không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    if (currentUserId.toString() === userId) {
      const error = new Error("Không thể tạo conversation với chính mình.");
      error.statusCode = 400;
      throw error;
    }

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const existingConversation = await Conversation.findOne({
      members: { $all: [currentUserId, userId] },
    })
      .populate("members", "-password")
      .populate("lastMessage");

    if (existingConversation) {
      return res.status(200).json(existingConversation);
    }

    const newConversation = await Conversation.create({
      members: [currentUserId, userId],
    });

    const populatedConversation = await Conversation.findById(newConversation._id)
      .populate("members", "-password")
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
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    return res.status(200).json(conversations);
  } catch (error) {
    return next(error);
  }
};