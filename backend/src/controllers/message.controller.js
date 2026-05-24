import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

const checkConversationAccess = async (conversationId, currentUserId, allowRemoved = false) => {
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
    (memberId) => memberId.toString() === currentUserId.toString()
  );

  const isRemovedMember = allowRemoved && (conversation.removedMembers || []).some(
    (memberId) => memberId.toString() === currentUserId.toString()
  );

  if (!isMember && !isRemovedMember) {
    const error = new Error("Bạn không có quyền truy cập conversation này.");
    error.statusCode = 403;
    throw error;
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

    await checkConversationAccess(conversationId, currentUserId, true);

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    // Lọc các message mà user đã xoá (chỉ mình tôi)
    const messages = await Message.find({
      conversationId,
      isDeletedBy: { $ne: currentUserId },
    })
      .populate("senderId", "-password")
      .populate("reactions.userId", "fullName avatar")
      .populate({
        path: "replyTo",
        select: "text senderId image file messageType",
        populate: { path: "senderId", select: "fullName avatar" },
      })
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
    const { conversationId, text, image, file, replyTo, messageType: reqMsgType } = req.body;

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

    const conversation = await checkConversationAccess(
      conversationId,
      currentUserId
    );

    if (reqMsgType === "like") {
      const likeIcon = typeof text === "string" && text.trim() ? text.trim() : "ThumbsUp";
      const message = await Message.create({
        conversationId,
        senderId: currentUserId,
        text: likeIcon,
        messageType: "like",
        readBy: [currentUserId],
      });

      conversation.lastMessage = message._id;
      conversation.updatedAt = new Date();
      if (conversation.archivedBy && conversation.archivedBy.length > 0) {
        conversation.archivedBy = conversation.archivedBy.filter(
          (id) => id.toString() !== currentUserId.toString()
        );
      }
      await conversation.save();

      const populatedMessage = await Message.findById(message._id)
        .populate("senderId", "-password")
        .populate("readBy", "-password");

      conversation.members.forEach((memberId) => {
        if (memberId.toString() === currentUserId.toString()) return;
        const receiverSocketId = getReceiverSocketId(memberId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("sendMessage", {
            conversationId: conversation._id.toString(),
            message: populatedMessage,
            lastMessage: conversation.lastMessage,
            updatedAt: conversation.updatedAt,
          });
        }
      });

      return res.status(201).json(populatedMessage);
    }

    if (
      text !== undefined &&
      typeof text !== "string"
    ) {
      const error = new Error("text phải là chuỗi.");
      error.statusCode = 400;
      throw error;
    }

    if (
      image !== undefined &&
      typeof image !== "string"
    ) {
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

    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        const error = new Error("replyTo không hợp lệ.");
        error.statusCode = 400;
        throw error;
      }
    }

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

    const message = await Message.create({
      conversationId,
      senderId: currentUserId,
      text: cleanText,
      image: imageUrl,
      file: fileData,
      replyTo: replyTo || null,
      readBy: [currentUserId],
    });

    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();

    if (conversation.archivedBy && conversation.archivedBy.length > 0) {
      conversation.archivedBy = conversation.archivedBy.filter(
        (id) => id.toString() !== currentUserId.toString()
      );
    }

    await conversation.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "-password")
      .populate("readBy", "-password")
      .populate({
        path: "replyTo",
        select: "text senderId image file messageType",
        populate: { path: "senderId", select: "fullName avatar" },
      });

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

export const toggleReaction = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!emoji) {
      const error = new Error("Emoji là bắt buộc.");
      error.statusCode = 400;
      throw error;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      const error = new Error("Tin nhắn không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    await checkConversationAccess(message.conversationId, currentUserId);

    const existingIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === currentUserId.toString() && r.emoji === emoji
    );

    if (existingIndex >= 0) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions = message.reactions.filter(
        (r) => r.userId.toString() !== currentUserId.toString()
      );
      message.reactions.push({ emoji, userId: currentUserId });
    }

    await message.save();

    const populatedMessage = await Message.findById(messageId)
      .populate("senderId", "-password")
      .populate("reactions.userId", "fullName avatar");

    const conversation = await Conversation.findById(message.conversationId);
    conversation.members.forEach((memberId) => {
      const receiverSocketId = getReceiverSocketId(memberId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageReaction", {
          conversationId: message.conversationId.toString(),
          messageId: messageId,
          reactions: populatedMessage.reactions,
        });
      }
    });

    return res.status(200).json(populatedMessage);
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
      }
    );

    const messages = await Message.find({ conversationId })
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
        console.log(`Thông báo đã đọc đã được gửi đến socketId: ${receiverSocketId}`);
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

export const togglePinMessage = async (req, res, next) => {
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
      const error = new Error("Tin nhắn không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const conversation = await checkConversationAccess(message.conversationId, currentUserId);

    message.isPinned = !message.isPinned;
    await message.save();

    conversation.members.forEach((memberId) => {
      const receiverSocketId = getReceiverSocketId(memberId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messagePinned", {
          conversationId: message.conversationId.toString(),
          messageId: messageId,
          isPinned: message.isPinned,
        });
      }
    });

    return res.status(200).json(message);

  } catch (error) {
    return next(error);
  }
};

export const getPinnedMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { conversationId } = req.params;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    await checkConversationAccess(conversationId, currentUserId, true);

    const messages = await Message.find({
      conversationId,
      isPinned: true,
      isDeletedBy: { $ne: currentUserId },
    })
      .populate("senderId", "fullName avatar")
      .sort({ createdAt: -1 });

    return res.status(200).json(messages);
  } catch (error) {
    return next(error);
  }
};

export const forwardMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { messageId } = req.params;
    const { conversationIds } = req.body;

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

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      const error = new Error("conversationIds là bắt buộc.");
      error.statusCode = 400;
      throw error;
    }

    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      const error = new Error("Tin nhắn không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    await checkConversationAccess(originalMessage.conversationId, currentUserId);

    const results = [];

    for (const convId of conversationIds) {
      const conversation = await checkConversationAccess(convId, currentUserId);

      const forwarded = await Message.create({
        conversationId: convId,
        senderId: currentUserId,
        text: originalMessage.text || "",
        image: originalMessage.image || null,
        file: originalMessage.file || null,
        isForwarded: true,
        readBy: [currentUserId],
      });

      conversation.lastMessage = forwarded._id;
      conversation.updatedAt = new Date();
      await conversation.save();

      const populatedMessage = await Message.findById(forwarded._id)
        .populate("senderId", "-password")
        .populate("readBy", "-password");

      conversation.members.forEach((memberId) => {
        if (memberId.toString() === currentUserId.toString()) return;
        const receiverSocketId = getReceiverSocketId(memberId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("sendMessage", {
            conversationId: convId,
            message: populatedMessage,
            lastMessage: conversation.lastMessage,
            updatedAt: conversation.updatedAt,
          });
        }
      });

      results.push(populatedMessage);
    }

    return res.status(201).json(results);
  } catch (error) {
    return next(error);
  }
};

export const editMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { messageId } = req.params;
    const { text } = req.body;
    console.log(`[editMessage] messageId: ${messageId}, newText: ${text}, currentUserId: ${currentUserId}`);
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      const error = new Error("Text là bắt buộc và phải là chuỗi không rỗng.");
      error.statusCode = 400;
      throw error;
    }
    const message = await Message.findById(messageId);
    if (!message) {
      const error = new Error("Tin nhắn không tồn tại.");
      error.statusCode = 404;
      throw error;
    }
    if (message.text === "" || message.messageType === "like") {
      const error = new Error("Không thể chỉnh sửa tin nhắn đã bị thu hồi hoặc không có nội dung.");
      error.statusCode = 400;
      throw error;
    }

    if (message.senderId.toString() !== currentUserId.toString()) {
      const error = new Error("Bạn chỉ có thể chỉnh sửa tin nhắn của chính mình.");
      error.statusCode = 403;
      throw error;
    }

    message.text = text;
    message.isEdited = true;
    await message.save();

    const conversation = await checkConversationAccess(message.conversationId, currentUserId);
    conversation.members.forEach((memberId) => {
      const receiverSocketId = getReceiverSocketId(memberId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageEdited", {
          conversationId: message.conversationId.toString(),
          messageId: messageId,
          newText: text,
        });
      }
    });

    return res.status(200).json(message);
  } catch (error) {
    return next(error);
  }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { messageId } = req.params;
    const { type } = req.body;
    console.log(`[deleteMessage] messageId: ${messageId}, type: ${type}, currentUserId: ${currentUserId}`);
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
      const error = new Error("Tin nhắn không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    if (type === "all") {
      // Xóa vĩnh viễn tin nhắn cho tất cả mọi người
      if (message.senderId.toString() !== currentUserId.toString()) {
        const error = new Error("Bạn chỉ có thể xóa tin nhắn của chính mình với loại 'all'.");
        error.statusCode = 403;
        throw error;
      }
      message.text = "";
      message.image = null;
      message.file = null;
      message.isRecalled = true;
      await message.save();

      const conversation = await checkConversationAccess(message.conversationId, currentUserId);
      conversation.members.forEach((memberId) => {
        const receiverSocketId = getReceiverSocketId(memberId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messageRecalled", {
            conversationId: message.conversationId.toString(),
            messageId: messageId,
          });
        }
      });
    } else if (type === "me") {
      // Chỉ xóa cho chính mình (ẩn với user này, người khác vẫn thấy) hoặc trường hợp người khác xoá tin nhắn của mình (chỉ xoá với người đó)
      if (!message.isDeletedBy) message.isDeletedBy = [];
      if (!message.isDeletedBy.map(id => id.toString()).includes(currentUserId.toString())) {
        message.isDeletedBy.push(currentUserId);
        await message.save();
      }
    } else {
      // Trường hợp không xác định, trả về lỗi
      const error = new Error("Loại xoá không hợp lệ. Chỉ hỗ trợ 'all' hoặc 'me'.");
      error.statusCode = 400;
      throw error;
    }
    return res.status(200).json({ message: "Tin nhắn đã được xóa." });
  } catch (error) {
    return next(error);
  }
};