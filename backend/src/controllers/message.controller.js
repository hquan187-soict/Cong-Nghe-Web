import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

const hasBlockBetweenUsers = async (userAId, userBId) => {
  const users = await User.find({
    _id: { $in: [userAId, userBId] },
  }).select("blockedUsers");

  const userA = users.find(
    (user) => user._id.toString() === userAId.toString(),
  );
  const userB = users.find(
    (user) => user._id.toString() === userBId.toString(),
  );

  if (!userA || !userB) return false;

  const aBlockedB = userA.blockedUsers.some(
    (id) => id.toString() === userBId.toString(),
  );

  const bBlockedA = userB.blockedUsers.some(
    (id) => id.toString() === userAId.toString(),
  );

  return aBlockedB || bBlockedA;
};

const checkConversationAccess = async (conversationId, currentUserId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    const error = new Error("conversationId không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    const error = new Error("Conversation không tồn tại.");
    error.statusCode = 404;
    throw error;
  }

  const isMember = conversation.members.some(
    (memberId) => memberId.toString() === currentUserId.toString(),
  );

  if (!isMember) {
    const error = new Error("Bạn không có quyền truy cập conversation này.");
    error.statusCode = 403;
    throw error;
  }

  if (!conversation.isGroup) {
    const otherMemberId = conversation.members.find(
      (memberId) => memberId.toString() !== currentUserId.toString(),
    );

    if (
      otherMemberId &&
      (await hasBlockBetweenUsers(currentUserId, otherMemberId))
    ) {
      const error = new Error(
        "Không thể truy cập conversation do một trong hai người đã chặn người còn lại.",
      );
      error.statusCode = 403;
      throw error;
    }
  }

  return conversation;
};

export const getMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { conversationId } = req.params;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    await checkConversationAccess(conversationId, currentUserId);

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    // Lấy thêm 1 để biết còn trang tiếp theo không (pattern kiểm tra hasMore)
    const messages = await Message.find({
      conversationId,
      isDeletedBy: { $ne: currentUserId },
    })
      .populate("senderId", "-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const pageMessages = hasMore ? messages.slice(0, limit) : messages;

    return res.status(200).json({
      messages: pageMessages,
      pagination: {
        page,
        limit,
        hasMore,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { conversationId, text, image, file } = req.body;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!conversationId) {
      const error = new Error("conversationId là bắt buộc.");
      error.statusCode = 400;
      throw error;
    }

    if (text !== undefined && typeof text !== "string") {
      const error = new Error("text phải là chuỗi.");
      error.statusCode = 400;
      throw error;
    }

    if (image !== undefined && typeof image !== "string") {
      const error = new Error("image phải là chuỗi.");
      error.statusCode = 400;
      throw error;
    }

    const cleanText = typeof text === "string" ? text.trim() : "";

    if (!cleanText && !image && !file) {
      const error = new Error("Message phải có text, image hoặc file.");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await checkConversationAccess(
      conversationId,
      currentUserId,
    );

    let imageUrl = image || null;
    if (image && image.startsWith("data:")) {
      const uploaded = await cloudinary.uploader.upload(image, {
        folder: "chat_images",
      });
      imageUrl = uploaded.secure_url;
    }

    let fileData = null;
    if (file && file.data) {
      const uploaded = await cloudinary.uploader.upload(file.data, {
        folder: "chat_files",
        resource_type: "auto",
      });
      fileData = {
        url: uploaded.secure_url,
        name: file.name || "file",
        size: file.size || 0,
        type: file.type || "",
      };
    }

    const messageType = fileData ? "file" : imageUrl ? "image" : "text";

    const message = await Message.create({
      conversationId,
      senderId: currentUserId,
      text: cleanText,
      image: imageUrl,
      file: fileData,
      readBy: [currentUserId],
      messageType,
    });

    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "-password")
      .populate("readBy", "-password");

    conversation.members.forEach((memberId) => {
      // Không gửi lại cho người vừa gửi tin (dùng currentUserId, không phải senderId)
      if (memberId.toString() === currentUserId.toString()) return;
      const receiverSocketId = getReceiverSocketId(memberId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("sendMessage", {
          conversationId: conversation._id.toString(),
          message: populatedMessage,
          lastMessage: conversation.lastMessage,
          updatedAt: conversation.updatedAt,
        });
        console.log(`Tin nhắn đã được gửi đến socketId: ${receiverSocketId}`);
      }
    });

    return res.status(201).json(populatedMessage);
  } catch (error) {
    return next(error);
  }
};

export const editMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { messageId } = req.params;
    const { text } = req.body;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      const error = new Error("messageId không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    if (typeof text !== "string" || !text.trim()) {
      const error = new Error("text phải là chuỗi không rỗng.");
      error.statusCode = 400;
      throw error;
    }

    const message = await Message.findById(messageId);

    if (!message) {
      const error = new Error("Message không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    await checkConversationAccess(message.conversationId, currentUserId);

    if (message.senderId.toString() !== currentUserId.toString()) {
      const error = new Error("Bạn chỉ có thể sửa tin nhắn của mình.");
      error.statusCode = 403;
      throw error;
    }

    if (message.isRecalled) {
      const error = new Error("Không thể sửa tin nhắn đã thu hồi.");
      error.statusCode = 400;
      throw error;
    }

    if (message.messageType === "system") {
      const error = new Error("Không thể sửa tin nhắn hệ thống.");
      error.statusCode = 400;
      throw error;
    }

    const editLimitMs = 15 * 60 * 1000;
    const isExpired = Date.now() - message.createdAt.getTime() > editLimitMs;

    if (isExpired) {
      const error = new Error("Chỉ có thể sửa tin nhắn trong vòng 15 phút.");
      error.statusCode = 400;
      throw error;
    }

    message.text = text.trim();
    message.editedAt = new Date();

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "-password")
      .populate("readBy", "-password");

    return res.status(200).json(populatedMessage);
  } catch (error) {
    return next(error);
  }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { messageId } = req.params;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      const error = new Error("messageId không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const message = await Message.findById(messageId);

    if (!message) {
      const error = new Error("Message không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    await checkConversationAccess(message.conversationId, currentUserId);

    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      {
        $addToSet: {
          isDeletedBy: currentUserId,
        },
      },
      { new: true },
    )
      .populate("senderId", "-password")
      .populate("readBy", "-password");

    return res.status(200).json(updatedMessage);
  } catch (error) {
    return next(error);
  }
};

export const markMessagesAsRead = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { conversationId } = req.params;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    await checkConversationAccess(conversationId, currentUserId);

    const result = await Message.updateMany(
      { conversationId },
      {
        $addToSet: {
          readBy: currentUserId,
        },
      },
    );

    const messages = await Message.find({
      conversationId,
      isDeletedBy: { $ne: currentUserId },
    })
      .populate("senderId", "-password")
      .populate("readBy", "-password")
      .sort({ createdAt: -1 });

    const conversation = await Conversation.findById(conversationId);
    conversation.members.forEach((memberId) => {
      if (memberId.toString() === currentUserId.toString()) return;
      const receiverSocketId = getReceiverSocketId(memberId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messagesRead", {
          conversationId: conversation._id.toString(),
          messages,
        });
        console.log(
          `Thông báo đã đọc đã được gửi đến socketId: ${receiverSocketId}`,
        );
      }
    });

    return res.status(200).json({
      message: "Đã đánh dấu messages là đã đọc.",
      modifiedCount: result.modifiedCount,
      messages,
    });
  } catch (error) {
    return next(error);
  }
};
