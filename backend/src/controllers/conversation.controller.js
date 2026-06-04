import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketIds } from "../lib/socket.js";

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

    if (conversation.addMemberPermission === "admin") {
      const isAdmin = conversation.admins.some(
        (aId) => aId.toString() === currentUserId.toString()
      );
      if (!isAdmin) {
        const error = new Error("Chỉ quản trị viên mới có quyền thêm thành viên. Hãy gửi yêu cầu thay thế.");
        error.statusCode = 403;
        throw error;
      }
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
    conversation.removedMembers = conversation.removedMembers.filter(
      (mId) => mId.toString() !== userId.toString()
    );
    await conversation.save();

    const systemMsg = await Message.create({
      conversationId: id,
      senderId: currentUserId,
      text: `${userToAdd.fullName} đã tham gia đoạn chat nhóm`,
      messageType: "system",
      readBy: conversation.members,
    });
    conversation.lastMessage = systemMsg._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate("senderId", "fullName avatar");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: id,
          message: populatedSystemMsg,
        });
      });
    });

    const updated = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");

    conversation.members.forEach((memberId) => {
      if (memberId.toString() === userId.toString()) return;
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("conversationUpdated", { conversation: updated });
      });
    });

    getReceiverSocketIds(userId.toString()).forEach((sid) => {
      io.to(sid).emit("newConversation", { conversation: updated });
    });

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

    const leavingUser = await User.findById(currentUserId);

    conversation.members = conversation.members.filter(
      (mId) => mId.toString() !== currentUserId.toString()
    );
    conversation.pinnedBy = (conversation.pinnedBy || []).filter(
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

    const systemMsg = await Message.create({
      conversationId: id,
      senderId: currentUserId,
      text: `${leavingUser?.fullName || "Người dùng"} đã rời khỏi đoạn chat nhóm`,
      messageType: "system",
      readBy: conversation.members,
    });
    conversation.lastMessage = systemMsg._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate("senderId", "fullName avatar");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: id,
          message: populatedSystemMsg,
        });
      });
    });

    const updated = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("conversationUpdated", { conversation: updated });
      });
    });

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

export const removeMember = async (req, res, next) => {
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

    const isAdmin = conversation.admins.some(
      (aId) => aId.toString() === currentUserId.toString()
    );
    if (!isAdmin) {
      const error = new Error("Chỉ quản trị viên mới có quyền xóa thành viên.");
      error.statusCode = 403;
      throw error;
    }

    if (userId.toString() === currentUserId.toString()) {
      const error = new Error("Không thể tự xóa chính mình.");
      error.statusCode = 400;
      throw error;
    }

    const targetIsMember = conversation.members.some(
      (mId) => mId.toString() === userId.toString()
    );
    if (!targetIsMember) {
      const error = new Error("Người dùng không phải thành viên nhóm.");
      error.statusCode = 400;
      throw error;
    }

    const removedUser = await User.findById(userId);

    conversation.members = conversation.members.filter(
      (mId) => mId.toString() !== userId.toString()
    );
    conversation.admins = conversation.admins.filter(
      (aId) => aId.toString() !== userId.toString()
    );
    conversation.pinnedBy = (conversation.pinnedBy || []).filter(
      (mId) => mId.toString() !== userId.toString()
    );
    if (!conversation.removedMembers) conversation.removedMembers = [];
    conversation.removedMembers.push(userId);
    await conversation.save();

    const systemMsg = await Message.create({
      conversationId: id,
      senderId: currentUserId,
      text: `${removedUser?.fullName || "Người dùng"} đã rời khỏi đoạn chat nhóm`,
      messageType: "system",
      readBy: [...conversation.members, userId],
    });
    conversation.lastMessage = systemMsg._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate("senderId", "fullName avatar");

    [...conversation.members, mongoose.Types.ObjectId.createFromHexString(userId)].forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: id,
          message: populatedSystemMsg,
        });
      });
    });

    getReceiverSocketIds(userId.toString()).forEach((sid) => {
      io.to(sid).emit("removedFromGroup", {
        conversationId: id,
        message: "Bạn đã bị buộc rời khỏi nhóm",
      });
    });

    const updated = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("conversationUpdated", { conversation: updated });
      });
    });

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

export const updateAddMemberPermission = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { permission } = req.body;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!["anyone", "admin"].includes(permission)) {
      const error = new Error("Giá trị permission không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.isGroup) {
      const error = new Error("Nhóm không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const isAdmin = conversation.admins.some(
      (aId) => aId.toString() === currentUserId.toString()
    );
    if (!isAdmin) {
      const error = new Error("Chỉ quản trị viên mới có quyền thay đổi.");
      error.statusCode = 403;
      throw error;
    }

    conversation.addMemberPermission = permission;
    await conversation.save();

    const updated = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

export const requestAddMember = async (req, res, next) => {
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

    const alreadyPending = conversation.pendingRequests?.some(
      (r) => r.userId.toString() === userId.toString()
    );
    if (alreadyPending) {
      const error = new Error("Yêu cầu đã tồn tại.");
      error.statusCode = 400;
      throw error;
    }

    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const requestingUser = await User.findById(currentUserId);

    conversation.pendingRequests.push({
      userId,
      requestedBy: currentUserId,
    });
    await conversation.save();

    const systemMsg = await Message.create({
      conversationId: id,
      senderId: currentUserId,
      text: `${requestingUser?.fullName || "Người dùng"} muốn thêm ${userToAdd.fullName} vào trong đoạn chat nhóm`,
      messageType: "system",
      readBy: conversation.members,
    });
    conversation.lastMessage = systemMsg._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate("senderId", "fullName avatar");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: id,
          message: populatedSystemMsg,
        });
      });
    });

    const updated = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage")
      .populate("pendingRequests.userId", "fullName avatar email")
      .populate("pendingRequests.requestedBy", "fullName avatar email");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("conversationUpdated", { conversation: updated });
      });
    });

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

export const approveRequest = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { userId } = req.body;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.isGroup) {
      const error = new Error("Nhóm không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const isAdmin = conversation.admins.some(
      (aId) => aId.toString() === currentUserId.toString()
    );
    if (!isAdmin) {
      const error = new Error("Chỉ quản trị viên mới có quyền duyệt yêu cầu.");
      error.statusCode = 403;
      throw error;
    }

    const pendingIdx = conversation.pendingRequests.findIndex(
      (r) => r.userId.toString() === userId.toString()
    );
    if (pendingIdx === -1) {
      const error = new Error("Không tìm thấy yêu cầu.");
      error.statusCode = 404;
      throw error;
    }

    conversation.pendingRequests.splice(pendingIdx, 1);

    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    conversation.members.push(userId);
    conversation.removedMembers = conversation.removedMembers.filter(
      (mId) => mId.toString() !== userId.toString()
    );
    await conversation.save();

    const systemMsg = await Message.create({
      conversationId: id,
      senderId: currentUserId,
      text: `${userToAdd.fullName} đã tham gia đoạn chat nhóm`,
      messageType: "system",
      readBy: conversation.members,
    });
    conversation.lastMessage = systemMsg._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate("senderId", "fullName avatar");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: id,
          message: populatedSystemMsg,
        });
      });
    });

    const updated = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage")
      .populate("pendingRequests.userId", "fullName avatar email")
      .populate("pendingRequests.requestedBy", "fullName avatar email");

    conversation.members.forEach((memberId) => {
      if (memberId.toString() === userId.toString()) return;
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("conversationUpdated", { conversation: updated });
      });
    });

    getReceiverSocketIds(userId.toString()).forEach((sid) => {
      io.to(sid).emit("newConversation", { conversation: updated });
    });

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

export const rejectRequest = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { userId } = req.body;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.isGroup) {
      const error = new Error("Nhóm không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const isAdmin = conversation.admins.some(
      (aId) => aId.toString() === currentUserId.toString()
    );
    if (!isAdmin) {
      const error = new Error("Chỉ quản trị viên mới có quyền từ chối yêu cầu.");
      error.statusCode = 403;
      throw error;
    }

    const pendingIdx = conversation.pendingRequests.findIndex(
      (r) => r.userId.toString() === userId.toString()
    );
    if (pendingIdx === -1) {
      const error = new Error("Không tìm thấy yêu cầu.");
      error.statusCode = 404;
      throw error;
    }

    conversation.pendingRequests.splice(pendingIdx, 1);
    await conversation.save();

    const systemMsg = await Message.create({
      conversationId: id,
      senderId: currentUserId,
      text: "Yêu cầu bị từ chối bởi quản trị viên",
      messageType: "system",
      readBy: conversation.members,
    });
    conversation.lastMessage = systemMsg._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate("senderId", "fullName avatar");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: id,
          message: populatedSystemMsg,
        });
      });
    });

    const updated = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage")
      .populate("pendingRequests.userId", "fullName avatar email")
      .populate("pendingRequests.requestedBy", "fullName avatar email");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("conversationUpdated", { conversation: updated });
      });
    });

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
        .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
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
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
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
      $or: [
        { members: currentUserId },
        { removedMembers: currentUserId },
      ],
    })
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage")
      .populate("pendingRequests.userId", "fullName avatar email")
      .populate("pendingRequests.requestedBy", "fullName avatar email")
      .sort({ updatedAt: -1 });

    // Filter conversations where deletedAt for currentUserId is > lastMessage.createdAt
    const filteredConversations = conversations.filter(conv => {
      const deletedAt = conv.deletedAt ? conv.deletedAt.get(currentUserId.toString()) : null;
      if (!deletedAt) return true;
      if (!conv.lastMessage) return false;
      return new Date(conv.lastMessage.createdAt) > new Date(deletedAt);
    });

    const matchConditions = filteredConversations.map(conv => {
      const deletedAt = conv.deletedAt ? conv.deletedAt.get(currentUserId.toString()) : null;
      const condition = {
        conversationId: conv._id,
        senderId: { $ne: currentUserId },
        readBy: { $ne: currentUserId },
      };
      if (deletedAt) {
        condition.createdAt = { $gt: new Date(deletedAt) };
      }
      return condition;
    });

    let unreadCountMap = {};
    if (matchConditions.length > 0) {
      const unreadCounts = await Message.aggregate([
        { $match: { $or: matchConditions } },
        { $group: { _id: "$conversationId", count: { $sum: 1 } } },
      ]);
      unreadCounts.forEach(({ _id, count }) => {
        unreadCountMap[_id.toString()] = count;
      });
    }

    const result = filteredConversations.map(conversation => {
      const obj = conversation.toJSON();
      const uid = currentUserId.toString();
      return {
        ...obj,
        unreadCount: unreadCountMap[conversation._id.toString()] || 0,
        isPinned: (conversation.pinnedBy || []).some(id => id.toString() === uid),
        isMuted: (conversation.mutedBy || []).some(id => id.toString() === uid),
      };
    });

    return res.status(200).json(result);
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
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");

    return res.status(200).json(updatedConversation);
  } catch (error) {
    return next(error);
  }
};

export const updateNickname = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { nickname, forUserId } = req.body;

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

    if (!forUserId) {
      const error = new Error("Vui lòng cung cấp ID người dùng để cập nhật biệt danh.");
      error.statusCode = 400;
      throw error;
    }

    const userIndex = conversation.members.findIndex(
      (mId) => mId.toString() === forUserId.toString()
    );
    if (userIndex === -1) {
      const error = new Error("Người dùng không tồn tại trong cuộc trò chuyện.");
      error.statusCode = 404;
      throw error;
    }


    if (!conversation.nicknames) conversation.nicknames = new Map();

    const changedUser = await User.findById(forUserId);
    const changingUser = await User.findById(currentUserId);
    const changedUserName = changedUser?.fullName || "Người dùng";
    const changingUserName = changingUser?.fullName || "Người dùng";

    let actionText = "";
    if (!nickname || !nickname.trim()) {
      conversation.nicknames.delete(forUserId);
      actionText = `${changingUserName} đã xóa biệt danh của ${changedUserName}`;
    } else {
      conversation.nicknames.set(forUserId, nickname.trim());
      actionText = `${changingUserName} đã đổi biệt danh của ${changedUserName} thành ${nickname.trim()}`;
    }
    await conversation.save();

    const systemMsg = await Message.create({
      conversationId: id,
      senderId: currentUserId,
      text: actionText,
      messageType: "system",
      readBy: conversation.members,
    });
    conversation.lastMessage = systemMsg._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate("senderId", "fullName avatar");

    const updatedConversation = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: id,
          message: populatedSystemMsg,
          lastMessage: conversation.lastMessage,
          updatedAt: conversation.updatedAt,
        });
        io.to(sid).emit("nicknameUpdated", { conversation: updatedConversation });
      });
    });

    return res.status(200).json(updatedConversation);
  } catch (error) {
    return next(error);
  }
};

export const toggleMuteConversation = async (req, res, next) => {
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
    const isMuted = conversation.mutedBy?.some(
      (mId) => mId.toString() === currentUserId.toString()
    );
    if (isMuted) {
      conversation.mutedBy = conversation.mutedBy.filter(
        (mId) => mId.toString() !== currentUserId.toString()
      );
    }
    else {
      if (!conversation.mutedBy) conversation.mutedBy = [];
      conversation.mutedBy.push(currentUserId);
    }
    await conversation.save();
    const updatedConversation = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");
    return res.status(200).json(updatedConversation);
  } catch (error) {
    return next(error);
  }
};

export const toggleArchiveConversation = async (req, res, next) => {
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
    if (!conversation.archivedBy) conversation.archivedBy = [];
    const isArchived = conversation.archivedBy.some(
      (mId) => mId.toString() === currentUserId.toString()
    );
    if (isArchived) {
      conversation.archivedBy = conversation.archivedBy.filter(
        (mId) => mId.toString() !== currentUserId.toString()
      );
    }
    else {
      if (!conversation.archivedBy) conversation.archivedBy = [];
      conversation.archivedBy.push(currentUserId);
      conversation.pinnedBy = (conversation.pinnedBy || []).filter(
        (mId) => mId.toString() !== currentUserId.toString()
      );
    }
    await conversation.save();

    const updatedConversation = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");
    return res.status(200).json(updatedConversation);
  } catch (error) {
    return next(error);
  }
};

const ALLOWED_EMOJIS = [
  "ThumbsUp", "Heart", "Smile", "Flame", "Star",
  "Coffee", "Zap", "Sun", "Moon", "Music", "Leaf",
];

export const updateEmoji = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { emoji } = req.body;

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

    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
      const error = new Error("Emoji không hợp lệ.");
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

    if (conversation.emoji === emoji) {
      const currentConversation = await Conversation.findById(id)
        .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
        .populate("admins", "fullName avatar email")
        .populate("lastMessage");
      return res.status(200).json(currentConversation);
    }

    conversation.emoji = emoji;
    await conversation.save();

    const changingUser = await User.findById(currentUserId);
    const changingUserName = changingUser?.fullName || "Người dùng";
    const actionText = `${changingUserName} đã đổi biểu tượng cảm xúc của đoạn chat`;

    const systemMsg = await Message.create({
      conversationId: id,
      senderId: currentUserId,
      text: actionText,
      messageType: "system",
      readBy: conversation.members,
    });
    conversation.lastMessage = systemMsg._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate("senderId", "fullName avatar");

    const updatedConversation = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: id,
          message: populatedSystemMsg,
          lastMessage: conversation.lastMessage,
          updatedAt: conversation.updatedAt,
        });
        io.to(sid).emit("conversationUpdated", { conversation: updatedConversation });
      });
    });

    return res.status(200).json(updatedConversation);
  } catch (error) {
    return next(error);
  }
};

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export const updateThemeColor = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { themeColor } = req.body;

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

    if (themeColor !== null && themeColor !== undefined) {
      if (typeof themeColor !== "string" || !HEX_COLOR_REGEX.test(themeColor)) {
        const error = new Error("Mã màu không hợp lệ. Vui lòng sử dụng định dạng hex (vd: #FF0000).");
        error.statusCode = 400;
        throw error;
      }
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

    conversation.themeColor = themeColor || null;
    await conversation.save();

    const changingUser = await User.findById(currentUserId);
    const changingUserName = changingUser?.fullName || "Người dùng";
    const actionText = themeColor 
      ? `${changingUserName} đã đổi màu chủ đề đoạn chat`
      : `${changingUserName} đã xóa màu chủ đề đoạn chat`;

    const systemMsg = await Message.create({
      conversationId: id,
      senderId: currentUserId,
      text: actionText,
      messageType: "system",
      readBy: conversation.members,
    });
    conversation.lastMessage = systemMsg._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate("senderId", "fullName avatar");

    const updatedConversation = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");

    conversation.members.forEach((memberId) => {
      getReceiverSocketIds(memberId.toString()).forEach((sid) => {
        io.to(sid).emit("sendMessage", {
          conversationId: id,
          message: populatedSystemMsg,
          lastMessage: conversation.lastMessage,
          updatedAt: conversation.updatedAt,
        });
        io.to(sid).emit("themeColorUpdated", { conversation: updatedConversation });
      });
    });

    return res.status(200).json(updatedConversation);
  } catch (error) {
    return next(error);
  }
};

export const deleteChat = async (req, res, next) => {
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
    if (!conversation) {
      const error = new Error("Cuộc trò chuyện không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    const isMember = conversation.members.some(
      (mId) => mId.toString() === currentUserId.toString()
    );
    const isRemovedMember = (conversation.removedMembers || []).some(
      (mId) => mId.toString() === currentUserId.toString()
    );

    if (!isMember && !isRemovedMember) {
      const error = new Error("Bạn không có quyền xóa cuộc trò chuyện này.");
      error.statusCode = 403;
      throw error;
    }

    if (!conversation.deletedAt) {
      conversation.deletedAt = new Map();
    }
    conversation.deletedAt.set(currentUserId.toString(), new Date());

    if (conversation.archivedBy && conversation.archivedBy.length > 0) {
      conversation.archivedBy = conversation.archivedBy.filter(
        (archivedId) => archivedId.toString() !== currentUserId.toString()
      );
    }
    if (conversation.pinnedBy && conversation.pinnedBy.length > 0) {
      conversation.pinnedBy = conversation.pinnedBy.filter(
        (pinnedId) => pinnedId.toString() !== currentUserId.toString()
      );
    }

    await conversation.save();

    return res.status(200).json({ message: "Đã xóa đoạn chat thành công.", conversation });
  } catch (error) {
    return next(error);
  }
};

export const markAsUnread = async (req, res, next) => {
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
    if (!conversation) {
      const error = new Error("Không tìm thấy đoạn chat");
      error.statusCode = 404;
      throw error;
    }

    if (!conversation.members.some((mid) => mid.toString() === currentUserId.toString())) {
      const error = new Error("Không có quyền thực hiện");
      error.statusCode = 403;
      throw error;
    }

    if (!conversation.markedUnreadBy) {
      conversation.markedUnreadBy = [];
    }

    if (!conversation.markedUnreadBy.some((mid) => mid.toString() === currentUserId.toString())) {
      conversation.markedUnreadBy.push(currentUserId);
      await conversation.save();
    }

    return res.status(200).json({ message: "Đã đánh dấu là chưa đọc", conversation });
  } catch (error) {
    return next(error);
  }
};

export const togglePinConversation = async (req, res, next) => {
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
    const isPinned = conversation.pinnedBy?.some(
      (mId) => mId.toString() === currentUserId.toString()
    );
    if (isPinned) {
      conversation.pinnedBy = conversation.pinnedBy.filter(
        (mId) => mId.toString() !== currentUserId.toString()
      );
    } else {
      if (!conversation.pinnedBy) conversation.pinnedBy = [];
      conversation.pinnedBy.push(currentUserId);
    }
    await conversation.save();
    const updatedConversation = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");
    return res.status(200).json(updatedConversation);
  } catch (error) {
    return next(error);
  }
};

export const updateLabel = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { id } = req.params;
    const { label } = req.body;

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

    if (!conversation.labels) conversation.labels = new Map();

    if (!label || !label.trim()) {
      conversation.labels.delete(currentUserId.toString());
    } else {
      conversation.labels.set(currentUserId.toString(), label.trim());
    }

    await conversation.save();

    const updatedConversation = await Conversation.findById(id)
      .populate("members", "fullName avatar email isOnline lastSeen showActiveStatus")
      .populate("admins", "fullName avatar email")
      .populate("lastMessage");

    return res.status(200).json(updatedConversation);
  } catch (error) {
    return next(error);
  }
};
