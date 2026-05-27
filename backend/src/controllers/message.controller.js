import mongoose from "mongoose";
import xss from "xss";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
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

const checkConversationAccess = async (conversationId, currentUserId, { allowRemoved = false, checkBlock = true } = {}) => {
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

  const isRemovedMember = allowRemoved && (conversation.removedMembers || []).some(
    (memberId) => memberId.toString() === currentUserId.toString()
  );

  if (!isMember && !isRemovedMember) {
    const error = new Error("Bạn không có quyền truy cập conversation này.");
    error.statusCode = 403;
    throw error;
  }

  if (checkBlock && !conversation.isGroup) {
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

    const conversation = await checkConversationAccess(conversationId, currentUserId, { allowRemoved: true, checkBlock: false });

    let blocked = false;
    if (!conversation.isGroup) {
      const otherMemberId = conversation.members.find(
        (memberId) => memberId.toString() !== currentUserId.toString(),
      );
      if (otherMemberId) {
        blocked = await hasBlockBetweenUsers(currentUserId, otherMemberId);
      }
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

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
      .populate("mentions", "fullName avatar")
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
      blocked,
    });
  } catch (error) {
    return next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { conversationId, text, image, file, replyTo, messageType: reqMsgType, mentions } = req.body;

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
      currentUserId,
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

    const cleanText = typeof text === "string" ? xss(text.trim()) : "";

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

    let validMentions = [];
    let mentionAll = false;
    if (mentions && Array.isArray(mentions)) {
      if (mentions.includes('all')) {
        mentionAll = true;
      }
      validMentions = mentions.filter(id => mongoose.Types.ObjectId.isValid(id));
    }

    let imageUrl = image || null;
    if (image && image.startsWith("data:")) {
      const uploaded = await cloudinary.uploader.upload(image, {
        folder: "chat_images",
      });
      imageUrl = uploaded.secure_url;
    }

    let fileData = null;
    const isAudio = file && file.type && file.type.startsWith("audio/");
    if (file && file.data) {
      let uploadData = file.data;
      if (isAudio && uploadData.startsWith("data:audio/")) {
        uploadData = uploadData.replace(/^data:audio\/[^;]*(?:;[^;]*)*;base64,/, "data:video/webm;base64,");
      }
      const uploaded = await cloudinary.uploader.upload(uploadData, {
        folder: isAudio ? "chat_audio" : "chat_files",
        resource_type: isAudio ? "video" : "auto",
      });
      fileData = {
        url: uploaded.secure_url,
        name: file.name || "file",
        size: file.size || 0,
        type: file.type || "",
      };
      if (isAudio && file.duration) {
        fileData.duration = Number(file.duration);
      }
    }

    const messageType = isAudio && fileData
      ? "audio"
      : fileData
        ? "file"
        : imageUrl
          ? "image"
          : "text";

    const message = await Message.create({
      conversationId,
      senderId: currentUserId,
      text: cleanText,
      image: imageUrl,
      file: fileData,
      replyTo: replyTo || null,
      readBy: [currentUserId],
      messageType,
      mentions: validMentions,
      mentionAll,
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
      .populate("mentions", "fullName avatar")
      .populate({
        path: "replyTo",
        select: "text senderId image file messageType",
        populate: { path: "senderId", select: "fullName avatar" },
      });

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

    // Create mention notifications
    if (validMentions.length > 0 || mentionAll) {
      let recipientIds = [];
      if (mentionAll) {
        recipientIds = conversation.members
          .map((id) => id.toString())
          .filter((id) => id !== currentUserId.toString());
      } else {
        const memberSet = new Set(conversation.members.map((id) => id.toString()));
        recipientIds = validMentions
          .map((id) => id.toString())
          .filter((id) => id !== currentUserId.toString() && memberSet.has(id));
      }

      const notifications = await Notification.insertMany(
        recipientIds.map((rid) => ({
          recipient: rid,
          sender: currentUserId,
          message: message._id,
          conversation: conversation._id,
          type: mentionAll ? "mention_all" : "mention",
        })),
      );

      const populatedNotifications = await Notification.find({
        _id: { $in: notifications.map((n) => n._id) },
      })
        .populate("sender", "fullName avatar")
        .populate("conversation", "name isGroup avatar")
        .populate("message", "text messageType isRecalled createdAt");

      for (const notif of populatedNotifications) {
        const receiverSocketId = getReceiverSocketId(notif.recipient.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("new_notification", notif);
        }
      }
    }

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
      .populate("reactions.userId", "fullName avatar")
      .populate("mentions", "fullName avatar");

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

    await checkConversationAccess(conversationId, currentUserId, { checkBlock: false });

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
      .populate("mentions", "fullName avatar")
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

    await checkConversationAccess(conversationId, currentUserId, { allowRemoved: true, checkBlock: false });

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

export const getMediaAndFiles = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { conversationId } = req.params;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    await checkConversationAccess(conversationId, currentUserId, { allowRemoved: true, checkBlock: false });

    const messages = await Message.find({
      conversationId,
      isDeletedBy: { $ne: currentUserId },
      isRecalled: { $ne: true },
      messageType: { $in: ["image", "file"] },
    })
      .populate("senderId", "fullName avatar")
      .sort({ createdAt: -1 });

    // Lọc bỏ file audio nếu có lọt vào type "file" (dù thực tế audio upload bằng file sẽ thành messageType "audio")
    const filteredMessages = messages.filter(msg => {
      if (msg.messageType === "file" && msg.file?.type?.startsWith("audio/")) {
        return false;
      }
      return true;
    });

    return res.status(200).json(filteredMessages);
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
        .populate("readBy", "-password")
        .populate("mentions", "fullName avatar");

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

    await checkConversationAccess(message.conversationId, currentUserId);

    if (message.senderId.toString() !== currentUserId.toString()) {
      const error = new Error("Bạn chỉ có thể chỉnh sửa tin nhắn của chính mình.");
      error.statusCode = 403;
      throw error;
    }

    if (message.isRecalled) {
      const error = new Error("Không thể sửa tin nhắn đã thu hồi.");
      error.statusCode = 400;
      throw error;
    }

    if (message.messageType === "system" || message.messageType === "like") {
      const error = new Error("Không thể sửa tin nhắn hệ thống hoặc tin nhắn like.");
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

    message.text = xss(text.trim());
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const conversation = await Conversation.findById(message.conversationId);
    conversation.members.forEach((memberId) => {
      const receiverSocketId = getReceiverSocketId(memberId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageEdited", {
          conversationId: message.conversationId.toString(),
          messageId: messageId,
          newText: text.trim(),
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

    const conversation = await checkConversationAccess(message.conversationId, currentUserId, { checkBlock: type === "all" });

    if (type === "all") {
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
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { isDeletedBy: currentUserId },
      });
    } else {
      const error = new Error("Loại xoá không hợp lệ. Chỉ hỗ trợ 'all' hoặc 'me'.");
      error.statusCode = 400;
      throw error;
    }
    return res.status(200).json({ message: "Tin nhắn đã được xóa." });
  } catch (error) {
    return next(error);
  }
};

export const searchMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { conversationId } = req.params;
    const { q } = req.query;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(200).json([]);
    }

    await checkConversationAccess(conversationId, currentUserId, { allowRemoved: true, checkBlock: false });

    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const messages = await Message.find({
      conversationId,
      isDeletedBy: { $ne: currentUserId },
      isRecalled: { $ne: true },
      messageType: "text",
      text: { $regex: escapedQuery, $options: "i" }
    })
      .populate("senderId", "fullName avatar")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json(messages);
  } catch (error) {
    return next(error);
  }
};
