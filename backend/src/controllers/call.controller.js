import Call from "../models/Call.js";

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
