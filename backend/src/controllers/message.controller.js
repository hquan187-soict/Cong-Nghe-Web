import mongoose from "mongoose";
import xss from "xss";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketIds } from "../lib/socket.js";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip", "application/x-rar-compressed",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4",
];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const getBase64Size = (base64String) => {
  const match = base64String.match(/^data:[^;]+;base64,/);
  const base64Data = match ? base64String.slice(match[0].length) : base64String;
  return Math.ceil((base64Data.length * 3) / 4);
};

const getMimeFromBase64 = (base64String) => {
  const match = base64String.match(/^data:([^;]+);base64,/);
  return match ? match[1] : null;
};

const sanitizeFileName = (name) => {
  if (!name || typeof name !== "string") return "file";
  let sanitized = name.replace(/\\/g, "/");
  sanitized = sanitized.split("/").pop() || "file";
  sanitized = sanitized.replace(/\.\./g, "");
  return sanitized.slice(0, 255) || "file";
};

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

    const query = {
      conversationId,
      isDeletedBy: { $ne: currentUserId },
    };

    if (conversation.deletedAt && conversation.deletedAt.get(currentUserId.toString())) {
      query.createdAt = { $gt: conversation.deletedAt.get(currentUserId.toString()) };
    }

    const messages = await Message.find(query)
      .populate("senderId", "fullName avatar email status")
      .populate("reactions.userId", "fullName avatar")
      .populate({
        path: "replyTo",
        select: "text senderId image file messageType",
        populate: { path: "senderId", select: "fullName avatar" },
      })
      .populate("mentions", "fullName avatar")
      .populate("poll.options.voters", "fullName avatar")
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
        .populate("senderId", "fullName avatar email")
        .populate("readBy", "fullName avatar");

      conversation.members.forEach((memberId) => {
        if (memberId.toString() === currentUserId.toString()) return;
        getReceiverSocketIds(memberId.toString()).forEach((sid) => {
          io.to(sid).emit("sendMessage", {
            conversationId: conversation._id.toString(),
            message: populatedMessage,
            lastMessage: conversation.lastMessage,
            updatedAt: conversation.updatedAt,
          });
        });
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
      const imageMime = getMimeFromBase64(image);
      if (imageMime && !ALLOWED_IMAGE_TYPES.includes(imageMime)) {
        const error = new Error("Định dạng ảnh không được hỗ trợ.");
        error.statusCode = 400;
        throw error;
      }
      if (getBase64Size(image) > MAX_IMAGE_SIZE) {
        const error = new Error("Kích thước ảnh vượt quá 5MB.");
        error.statusCode = 400;
        throw error;
      }
      const uploaded = await cloudinary.uploader.upload(image, {
        folder: "chat_images",
      });
      imageUrl = uploaded.secure_url;
    }

    let fileData = null;
    const isAudio = file && file.type && file.type.startsWith("audio/");
    if (file && file.data) {
      if (!file.type || !ALLOWED_FILE_TYPES.includes(file.type)) {
        const error = new Error("Định dạng file không được hỗ trợ.");
        error.statusCode = 400;
        throw error;
      }
      if (typeof file.data === "string") {
        const fileMime = getMimeFromBase64(file.data);
        if (fileMime && !ALLOWED_FILE_TYPES.includes(fileMime)) {
          const error = new Error("Định dạng file không được hỗ trợ.");
          error.statusCode = 400;
          throw error;
        }
        if (getBase64Size(file.data) > MAX_FILE_SIZE) {
          const error = new Error("Kích thước file vượt quá 10MB.");
          error.statusCode = 400;
          throw error;
        }
      }

      let uploadData = file.data;
      if (isAudio && uploadData.startsWith("data:audio/")) {
        uploadData = uploadData.replace(/^data:audio\/[^;]*(?:;[^;]*)*;base64,/, "data:video/webm;base64,");
      }
      const uploaded = await cloudinary.uploader.upload(uploadData, {
        folder: isAudio ? "chat_audio" : "chat_files",
        resource_type: isAudio ? "video" : "auto",
      });
      const sanitizedName = sanitizeFileName(file.name);
      fileData = {
        url: uploaded.secure_url,
        name: sanitizedName,
        size: file.size || 0,
        type: file.type || "",
      };
      if (isAudio && file.duration) {
        const dur = Number(file.duration);
        if (dur > 0 && dur < 3600) {
          fileData.duration = dur;
        }
      }
    }

    const messageType = reqMsgType === "sticker"
      ? "sticker"
      : isAudio && fileData
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
      .populate("senderId", "fullName avatar email")
      .populate("readBy", "fullName avatar")
      .populate("mentions", "fullName avatar")
      .populate({
        path: "replyTo",
        select: "text senderId image file messageType",
        populate: { path: "senderId", select: "fullName avatar" },
      });

    conversation.members.forEach((memberId) => {
      if (memberId.toString() === currentUserId.toString()) return;
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: conversation._id.toString(),
          message: populatedMessage,
          lastMessage: conversation.lastMessage,
          updatedAt: conversation.updatedAt,
        });
      });
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
        getReceiverSocketIds(notif.recipient.toString()).forEach((sid) => {
          io.to(sid).emit("new_notification", notif);
        });
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
      .populate("senderId", "fullName avatar email")
      .populate("reactions.userId", "fullName avatar")
      .populate("mentions", "fullName avatar");

    const conversation = await Conversation.findById(message.conversationId);
    conversation.members.forEach((memberId) => {
      const mId = memberId.toString();
      if (conversation.deletedAt && conversation.deletedAt.get(mId)) {
        if (new Date(message.createdAt) <= new Date(conversation.deletedAt.get(mId))) {
          return;
        }
      }

      getReceiverSocketIds(mId).forEach((sid) => {
        io.to(sid).emit("messageReaction", {
          conversationId: message.conversationId.toString(),
          messageId: messageId,
          reactions: populatedMessage.reactions,
        });
      });
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

    const conversation = await checkConversationAccess(conversationId, currentUserId, { checkBlock: false });

    const result = await Message.updateMany(
      {
        conversationId,
        senderId: { $ne: currentUserId },
        readBy: { $ne: currentUserId },
      },
      {
        $addToSet: {
          readBy: currentUserId,
        },
      },
    );

    conversation.members.forEach((memberId) => {
      if (memberId.toString() === currentUserId.toString()) return;
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("messagesRead", {
          conversationId: conversation._id.toString(),
          readByUserId: currentUserId.toString(),
          modifiedCount: result.modifiedCount,
        });
      });
    });

    return res.status(200).json({
      message: "Đã đánh dấu messages là đã đọc.",
      modifiedCount: result.modifiedCount,
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
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("messagePinned", {
          conversationId: message.conversationId.toString(),
          messageId: messageId,
          isPinned: message.isPinned,
        });
      });
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
      .populate("poll.options.voters", "fullName avatar")
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

    if (conversationIds.length > 10) {
      const error = new Error("Chỉ có thể chuyển tiếp tối đa 10 cuộc trò chuyện cùng lúc.");
      error.statusCode = 400;
      throw error;
    }

    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      const error = new Error("Tin nhắn không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    if (originalMessage.isRecalled) {
      const error = new Error("Không thể chuyển tiếp tin nhắn đã thu hồi.");
      error.statusCode = 400;
      throw error;
    }

    if (originalMessage.messageType === "poll") {
      const error = new Error("Không thể chuyển tiếp tin nhắn bình chọn.");
      error.statusCode = 400;
      throw error;
    }

    await checkConversationAccess(originalMessage.conversationId, currentUserId);

    const results = [];

    for (const convId of conversationIds) {
      const conversation = await checkConversationAccess(convId, currentUserId);

      const forwardedType = originalMessage.messageType === "system" || originalMessage.messageType === "call"
        ? "text"
        : originalMessage.messageType || "text";

      const forwarded = await Message.create({
        conversationId: convId,
        senderId: currentUserId,
        text: originalMessage.text || "",
        image: originalMessage.image || null,
        file: originalMessage.file || null,
        messageType: forwardedType,
        isForwarded: true,
        readBy: [currentUserId],
      });

      conversation.lastMessage = forwarded._id;
      conversation.updatedAt = new Date();
      await conversation.save();

      const populatedMessage = await Message.findById(forwarded._id)
        .populate("senderId", "fullName avatar email")
        .populate("readBy", "fullName avatar")
        .populate("mentions", "fullName avatar");

      conversation.members.forEach((memberId) => {
        if (memberId.toString() === currentUserId.toString()) return;
        getReceiverSocketIds(memberId.toString()).forEach((sid) => {
          io.to(sid).emit("sendMessage", {
            conversationId: convId,
            message: populatedMessage,
            lastMessage: conversation.lastMessage,
            updatedAt: conversation.updatedAt,
          });
        });
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

    if (message.messageType === "system" || message.messageType === "like" || message.messageType === "poll") {
      const error = new Error("Không thể sửa tin nhắn hệ thống, tin nhắn like hoặc bình chọn.");
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
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("messageEdited", {
          conversationId: message.conversationId.toString(),
          messageId: messageId,
          newText: message.text,
        });
      });
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
      if (message.messageType === "poll") {
        message.poll = undefined;
      }
      message.isRecalled = true;
      await message.save();

      conversation.members.forEach((memberId) => {
        const mId = memberId.toString();
        if (conversation.deletedAt && conversation.deletedAt.get(mId)) {
          if (new Date(message.createdAt) <= new Date(conversation.deletedAt.get(mId))) {
            return;
          }
        }

        getReceiverSocketIds(mId).forEach((sid) => {
          io.to(sid).emit("messageRecalled", {
            conversationId: message.conversationId.toString(),
            messageId: messageId,
          });
        });
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

export const createPoll = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { conversationId, question, options, allowMultiple, allowChange, deadline } = req.body;

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

    const conversation = await checkConversationAccess(conversationId, currentUserId);

    if (!conversation.isGroup) {
      const error = new Error("Bình chọn chỉ hỗ trợ trong nhóm.");
      error.statusCode = 400;
      throw error;
    }

    if (!question || typeof question !== "string" || !question.trim()) {
      const error = new Error("Tiêu đề bình chọn là bắt buộc.");
      error.statusCode = 400;
      throw error;
    }

    if (!Array.isArray(options) || options.length < 2) {
      const error = new Error("Cần ít nhất 2 lựa chọn.");
      error.statusCode = 400;
      throw error;
    }

    const cleanOptions = options
      .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
      .filter((opt) => opt.length > 0);

    if (cleanOptions.length < 2) {
      const error = new Error("Cần ít nhất 2 lựa chọn có nội dung.");
      error.statusCode = 400;
      throw error;
    }

    if (cleanOptions.some((opt) => opt.length > 200)) {
      const error = new Error("Mỗi lựa chọn tối đa 200 ký tự.");
      error.statusCode = 400;
      throw error;
    }

    let parsedDeadline = null;
    if (deadline) {
      parsedDeadline = new Date(deadline);
      if (isNaN(parsedDeadline.getTime())) {
        const error = new Error("Hạn cuối không hợp lệ.");
        error.statusCode = 400;
        throw error;
      }
      if (parsedDeadline <= new Date()) {
        const error = new Error("Hạn cuối phải ở tương lai.");
        error.statusCode = 400;
        throw error;
      }
    }

    const cleanQuestion = xss(question.trim()).slice(0, 500);

    const message = await Message.create({
      conversationId,
      senderId: currentUserId,
      text: cleanQuestion,
      messageType: "poll",
      readBy: [currentUserId],
      poll: {
        question: cleanQuestion,
        options: cleanOptions.map((text) => ({ text: xss(text), voters: [] })),
        allowMultiple: !!allowMultiple,
        allowChange: allowChange !== false,
        deadline: parsedDeadline,
        isClosed: false,
      },
    });

    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    if (conversation.archivedBy && conversation.archivedBy.length > 0) {
      conversation.archivedBy = conversation.archivedBy.filter(
        (id) => id.toString() !== currentUserId.toString(),
      );
    }
    await conversation.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "fullName avatar email")
      .populate("readBy", "fullName avatar")
      .populate("poll.options.voters", "fullName avatar");

    const currentUser = await User.findById(currentUserId).select("fullName");
    const nickname = conversation.nicknames?.get(currentUserId.toString()) || currentUser?.fullName || "Người dùng";
    const systemMsg = await Message.create({
      conversationId,
      senderId: currentUserId,
      text: `${nickname} đã tạo một cuộc thăm dò ý kiến`,
      messageType: "system",
      readBy: conversation.members,
    });
    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate("senderId", "fullName avatar");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: conversation._id.toString(),
          message: populatedSystemMsg,
        });
      });
    });

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: conversation._id.toString(),
          message: populatedMessage,
          lastMessage: conversation.lastMessage,
          updatedAt: conversation.updatedAt,
        });
      });
    });

    return res.status(201).json(populatedMessage);
  } catch (error) {
    return next(error);
  }
};

const truncateOptionText = (text, max = 30) => {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + "...";
};

const buildVoteSystemText = (nickname, oldVotedIds, newVotedIds, optionMap, allowMultiple) => {
  const added = [...newVotedIds].filter((id) => !oldVotedIds.has(id));
  const removed = [...oldVotedIds].filter((id) => !newVotedIds.has(id));

  if (added.length === 0 && removed.length === 0) return null;

  const fmtList = (ids) => ids.map((id) => `"${truncateOptionText(optionMap.get(id))}"`).join(", ");

  if (oldVotedIds.size === 0 && added.length > 0) {
    return `${nickname} đã bình chọn cho ${fmtList(added)} trong cuộc thăm dò ý kiến`;
  }
  if (newVotedIds.size === 0 && removed.length > 0) {
    return `${nickname} đã gỡ bình chọn cho ${fmtList(removed)} trong cuộc thăm dò ý kiến`;
  }
  if (removed.length === 0 && added.length > 0) {
    return `${nickname} đã bình chọn thêm cho ${fmtList(added)} trong cuộc thăm dò ý kiến`;
  }
  if (added.length === 0 && removed.length > 0) {
    return `${nickname} đã gỡ bình chọn cho ${fmtList(removed)} trong cuộc thăm dò ý kiến`;
  }
  if (!allowMultiple && added.length === 1 && removed.length === 1) {
    return `${nickname} đã thay đổi bình chọn từ ${fmtList(removed)} sang ${fmtList(added)} trong cuộc thăm dò ý kiến`;
  }
  return `${nickname} đã thay đổi bình chọn trong cuộc thăm dò ý kiến`;
};

export const votePoll = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { messageId } = req.params;
    const { optionIds } = req.body;

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

    if (!Array.isArray(optionIds)) {
      const error = new Error("optionIds phải là mảng.");
      error.statusCode = 400;
      throw error;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      const error = new Error("Tin nhắn không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    if (message.messageType !== "poll" || !message.poll) {
      const error = new Error("Tin nhắn này không phải bình chọn.");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await checkConversationAccess(message.conversationId, currentUserId);

    if (message.poll.isClosed) {
      const error = new Error("Cuộc bình chọn đã kết thúc.");
      error.statusCode = 400;
      throw error;
    }

    if (message.poll.deadline && new Date(message.poll.deadline) <= new Date()) {
      message.poll.isClosed = true;
      await message.save();
      const error = new Error("Cuộc bình chọn đã hết hạn.");
      error.statusCode = 400;
      throw error;
    }

    if (!message.poll.allowMultiple && optionIds.length > 1) {
      const error = new Error("Cuộc bình chọn này chỉ cho phép chọn 1 lựa chọn.");
      error.statusCode = 400;
      throw error;
    }

    const validOptionIds = new Set(message.poll.options.map((opt) => opt._id.toString()));
    for (const oid of optionIds) {
      if (!validOptionIds.has(oid)) {
        const error = new Error("Lựa chọn không hợp lệ.");
        error.statusCode = 400;
        throw error;
      }
    }

    const oldVotedIds = new Set();
    const optionMap = new Map();
    message.poll.options.forEach((opt) => {
      optionMap.set(opt._id.toString(), opt.text);
      if (opt.voters.some((v) => v.toString() === currentUserId.toString())) {
        oldVotedIds.add(opt._id.toString());
      }
    });

    const userAlreadyVoted = oldVotedIds.size > 0;

    if (userAlreadyVoted && !message.poll.allowChange) {
      const error = new Error("Không thể thay đổi lựa chọn trong cuộc bình chọn này.");
      error.statusCode = 400;
      throw error;
    }

    if (optionIds.length === 0 && !userAlreadyVoted) {
      const error = new Error("Cần chọn ít nhất 1 lựa chọn.");
      error.statusCode = 400;
      throw error;
    }

    const newVotedIds = new Set(optionIds);

    const isSame = oldVotedIds.size === newVotedIds.size && [...oldVotedIds].every((id) => newVotedIds.has(id));
    if (isSame) {
      return res.status(200).json({ message: "Không có thay đổi." });
    }

    message.poll.options.forEach((opt) => {
      opt.voters = opt.voters.filter((v) => v.toString() !== currentUserId.toString());
    });

    message.poll.options.forEach((opt) => {
      if (newVotedIds.has(opt._id.toString())) {
        opt.voters.push(currentUserId);
      }
    });

    await message.save();
    await Message.collection.updateOne(
      { _id: message._id },
      { $set: { createdAt: new Date() } }
    );

    const populatedMessage = await Message.findById(messageId)
      .populate("senderId", "fullName avatar email")
      .populate("readBy", "fullName avatar")
      .populate("poll.options.voters", "fullName avatar");

    const currentUser = await User.findById(currentUserId).select("fullName");
    const nickname = conversation.nicknames?.get(currentUserId.toString()) || currentUser?.fullName || "Người dùng";
    const systemText = buildVoteSystemText(nickname, oldVotedIds, newVotedIds, optionMap, message.poll.allowMultiple);

    if (systemText) {
      const systemMsg = await Message.create({
        conversationId: message.conversationId,
        senderId: currentUserId,
        text: systemText,
        messageType: "system",
        readBy: conversation.members,
      });
      const populatedSystemMsg = await Message.findById(systemMsg._id)
        .populate("senderId", "fullName avatar");

      conversation.members.forEach((memberId) => {
        getReceiverSocketIds(memberId.toString()).forEach((sid) => {
          io.to(sid).emit("sendMessage", {
            conversationId: message.conversationId.toString(),
            message: populatedSystemMsg,
          });
        });
      });
    }

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("pollVoteUpdated", {
          conversationId: message.conversationId.toString(),
          messageId: messageId,
          poll: populatedMessage.poll,
        });
      });
    });

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("pollResurface", {
          conversationId: message.conversationId.toString(),
          messageId: messageId,
          message: populatedMessage,
        });
      });
    });

    return res.status(200).json(populatedMessage);
  } catch (error) {
    return next(error);
  }
};

export const addPollOption = async (req, res, next) => {
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
      const error = new Error("Nội dung lựa chọn là bắt buộc.");
      error.statusCode = 400;
      throw error;
    }

    if (text.trim().length > 200) {
      const error = new Error("Lựa chọn tối đa 200 ký tự.");
      error.statusCode = 400;
      throw error;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      const error = new Error("Tin nhắn không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    if (message.messageType !== "poll" || !message.poll) {
      const error = new Error("Tin nhắn này không phải bình chọn.");
      error.statusCode = 400;
      throw error;
    }

    if (message.senderId.toString() !== currentUserId.toString()) {
      const error = new Error("Chỉ người tạo cuộc bình chọn mới có thể thêm lựa chọn.");
      error.statusCode = 403;
      throw error;
    }

    const conversation = await checkConversationAccess(message.conversationId, currentUserId);

    if (message.poll.isClosed) {
      const error = new Error("Cuộc bình chọn đã kết thúc.");
      error.statusCode = 400;
      throw error;
    }

    if (message.poll.deadline && new Date(message.poll.deadline) <= new Date()) {
      message.poll.isClosed = true;
      await message.save();
      const error = new Error("Cuộc bình chọn đã hết hạn.");
      error.statusCode = 400;
      throw error;
    }

    const cleanText = xss(text.trim());
    message.poll.options.push({ text: cleanText, voters: [] });
    await message.save();
    await Message.collection.updateOne(
      { _id: message._id },
      { $set: { createdAt: new Date() } }
    );

    const populatedMessage = await Message.findById(messageId)
      .populate("senderId", "fullName avatar email")
      .populate("readBy", "fullName avatar")
      .populate("poll.options.voters", "fullName avatar");

    const currentUser = await User.findById(currentUserId).select("fullName");
    const nickname = conversation.nicknames?.get(currentUserId.toString()) || currentUser?.fullName || "Người dùng";

    const systemMsg = await Message.create({
      conversationId: message.conversationId,
      senderId: currentUserId,
      text: `${nickname} đã thêm lựa chọn mới vào cuộc thăm dò ý kiến`,
      messageType: "system",
      readBy: conversation.members,
    });
    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate("senderId", "fullName avatar");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: message.conversationId.toString(),
          message: populatedSystemMsg,
        });
      });
    });

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("pollVoteUpdated", {
          conversationId: message.conversationId.toString(),
          messageId: messageId,
          poll: populatedMessage.poll,
        });
      });
    });

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("pollResurface", {
          conversationId: message.conversationId.toString(),
          messageId: messageId,
          message: populatedMessage,
        });
      });
    });

    return res.status(200).json(populatedMessage);
  } catch (error) {
    return next(error);
  }
};

export const getPollDetail = async (req, res, next) => {
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

    const message = await Message.findById(messageId)
      .populate("senderId", "fullName avatar email")
      .populate("poll.options.voters", "fullName avatar");

    if (!message) {
      const error = new Error("Tin nhắn không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    if (message.messageType !== "poll" || !message.poll) {
      const error = new Error("Tin nhắn này không phải bình chọn.");
      error.statusCode = 400;
      throw error;
    }

    await checkConversationAccess(message.conversationId, currentUserId, { allowRemoved: true, checkBlock: false });

    if (message.poll.deadline && !message.poll.isClosed && new Date(message.poll.deadline) <= new Date()) {
      message.poll.isClosed = true;
      await message.save();
    }

    return res.status(200).json(message);
  } catch (error) {
    return next(error);
  }
};

export const getMessagesAround = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { conversationId, messageId } = req.params;

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

    const conversation = await checkConversationAccess(conversationId, currentUserId, { allowRemoved: true, checkBlock: false });

    const targetMessage = await Message.findOne({
      _id: messageId,
      conversationId,
    });

    if (!targetMessage) {
      const error = new Error("Tin nhắn không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const baseQuery = {
      conversationId,
      isDeletedBy: { $ne: currentUserId },
    };

    if (conversation.deletedAt && conversation.deletedAt.get(currentUserId.toString())) {
      baseQuery.createdAt = { $gt: conversation.deletedAt.get(currentUserId.toString()) };
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 5), 25);

    const [beforeMsgs, afterMsgs] = await Promise.all([
      Message.find({ ...baseQuery, createdAt: { ...baseQuery.createdAt, $lt: targetMessage.createdAt } })
        .populate("senderId", "fullName avatar email")
        .populate("reactions.userId", "fullName avatar")
        .populate({ path: "replyTo", select: "text senderId image file messageType", populate: { path: "senderId", select: "fullName avatar" } })
        .populate("mentions", "fullName avatar")
        .populate("poll.options.voters", "fullName avatar")
        .sort({ createdAt: -1 })
        .limit(limit),
      Message.find({ ...baseQuery, createdAt: { ...baseQuery.createdAt, $gt: targetMessage.createdAt } })
        .populate("senderId", "fullName avatar email")
        .populate("reactions.userId", "fullName avatar")
        .populate({ path: "replyTo", select: "text senderId image file messageType", populate: { path: "senderId", select: "fullName avatar" } })
        .populate("mentions", "fullName avatar")
        .populate("poll.options.voters", "fullName avatar")
        .sort({ createdAt: 1 })
        .limit(limit),
    ]);

    const targetPopulated = await Message.findById(messageId)
      .populate("senderId", "fullName avatar email")
      .populate("reactions.userId", "fullName avatar")
      .populate({ path: "replyTo", select: "text senderId image file messageType", populate: { path: "senderId", select: "fullName avatar" } })
      .populate("mentions", "fullName avatar")
      .populate("poll.options.voters", "fullName avatar");

    const messages = [...beforeMsgs.reverse(), targetPopulated, ...afterMsgs];

    return res.status(200).json({
      messages,
      targetMessageId: messageId,
    });
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
      $or: [
        { messageType: "text", text: { $regex: escapedQuery, $options: "i" } },
        { messageType: "poll", "poll.question": { $regex: escapedQuery, $options: "i" } },
      ],
    })
      .populate("senderId", "fullName avatar")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json(messages);
  } catch (error) {
    return next(error);
  }
};
