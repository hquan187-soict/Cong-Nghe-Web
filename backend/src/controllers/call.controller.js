import mongoose from "mongoose";
import Call from "../models/Call.js";
import Conversation from "../models/Conversation.js";

const mapCallResponse = (call) => {
  const caller = call.callerId;
  const callee = call.calleeId;

  return {
    _id: call._id,
    conversationId: call.conversationId,
    caller: caller
      ? {
          _id: caller._id,
          username: caller.fullName,
          fullName: caller.fullName,
          avatar: caller.avatar,
        }
      : null,
    callee: callee
      ? {
          _id: callee._id,
          username: callee.fullName,
          fullName: callee.fullName,
          avatar: callee.avatar,
        }
      : null,
    callType: call.callType,
    status: call.status,
    duration:
      call.startedAt && call.endedAt
        ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
        : 0,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    createdAt: call.createdAt,
  };
};

const mapCallHistoryResponse = (call, currentUserId) => {
  const caller = call.callerId;
  const currentIdStr = currentUserId.toString();
  const isCaller = caller?._id?.toString() === currentIdStr;

  let otherUser = null;
  let myParticipantStatus = null;

  if (isCaller) {
    const firstParticipant = call.participants[0]?.userId;
    otherUser = firstParticipant || null;
  } else {
    otherUser = caller;
    const myParticipant = call.participants.find(
      (p) => p.userId?._id?.toString() === currentIdStr
    );
    myParticipantStatus = myParticipant?.status || null;
  }

  return {
    _id: call._id,
    conversationId: call.conversationId,
    caller: caller
      ? { _id: caller._id, fullName: caller.fullName, avatar: caller.avatar }
      : null,
    callee: otherUser
      ? { _id: otherUser._id, fullName: otherUser.fullName, avatar: otherUser.avatar }
      : null,
    isCaller,
    callType: call.callType,
    status: call.status,
    endReason: call.endReason,
    participantStatus: myParticipantStatus,
    duration:
      call.startedAt && call.endedAt
        ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
        : 0,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    createdAt: call.createdAt,
  };
};

const checkConversationAccess = async (conversationId, currentUserId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    const error = new Error("conversationId không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const conversation = await Conversation.findById(conversationId).select("members");

  if (!conversation) {
    const error = new Error("Cuộc trò chuyện không tồn tại.");
    error.statusCode = 404;
    throw error;
  }

  const isMember = conversation.members.some(
    (memberId) => memberId.toString() === currentUserId.toString()
  );

  if (!isMember) {
    const error = new Error("Bạn không có quyền truy cập cuộc trò chuyện này.");
    error.statusCode = 403;
    throw error;
  }

  return conversation;
};

export const createCall = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { conversationId, calleeId } = req.body;

    if (!conversationId || !calleeId) {
      const error = new Error("conversationId và calleeId là bắt buộc.");
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(calleeId)) {
      const error = new Error("calleeId không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await checkConversationAccess(conversationId, currentUserId);

    const isCalleeInConversation = conversation.members.some(
      (memberId) => memberId.toString() === calleeId.toString()
    );

    if (!isCalleeInConversation) {
      const error = new Error("Người nhận cuộc gọi không thuộc cuộc trò chuyện này.");
      error.statusCode = 400;
      throw error;
    }

    const call = await Call.create({
      conversationId,
      callerId: currentUserId,
      calleeId,
      status: "missed",
      startedAt: new Date(),
    });

    return res.status(201).json(call);
  } catch (error) {
    return next(error);
  }
};

export const endCall = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { id } = req.params;
    const { status = "completed" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("call id không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const allowedStatuses = ["missed", "rejected", "completed", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      const error = new Error("status không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const call = await Call.findOne({
      _id: id,
      $or: [{ callerId: currentUserId }, { calleeId: currentUserId }],
    });

    if (!call) {
      const error = new Error("Không tìm thấy cuộc gọi.");
      error.statusCode = 404;
      throw error;
    }

    const endedAt = new Date();
    const duration = Math.max(
      Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000),
      0
    );

    call.status = status;
    call.endedAt = endedAt;
    call.duration = duration;

    await call.save();

    return res.status(200).json(call);
  } catch (error) {
    return next(error);
  }
};

export const getCallHistory = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const skip = (page - 1) * limit;

    const calls = await Call.find({
      $or: [
        { callerId: currentUserId },
        { "participants.userId": currentUserId },
      ],
    })
      .populate("callerId", "fullName avatar")
      .populate("participants.userId", "fullName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasMore = calls.length > limit;
    const items = hasMore ? calls.slice(0, limit) : calls;

    return res.status(200).json({
      calls: items.map((call) => mapCallHistoryResponse(call, currentUserId)),
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