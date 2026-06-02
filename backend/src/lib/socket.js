import { Server } from "socket.io";
import http from "http";
import express from "express";
import mongoose from "mongoose";
import { socketAuthMiddleware } from "../middleware/socketAuthMiddleware.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Call from "../models/Call.js";
import Message from "../models/Message.js";
import { getContactSocketIds } from "./socketHelper.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : [],
    credentials: true,
  },
});

io.use(socketAuthMiddleware);

export function getReceiverSocketIds(userId) {
  const sockets = userSocketsMap.get(userId);
  return sockets ? [...sockets] : [];
}

const userSocketsMap = new Map();
const callTimeouts = new Map();
const activeUserCalls = new Map();

let visibleOnlineCache = null;
let visibleOnlineCacheTime = 0;
const VISIBLE_ONLINE_CACHE_TTL = 5000;

async function getVisibleOnlineUsers() {
  const now = Date.now();
  if (visibleOnlineCache && now - visibleOnlineCacheTime < VISIBLE_ONLINE_CACHE_TTL) {
    return visibleOnlineCache;
  }
  const onlineIds = [...userSocketsMap.keys()];
  if (onlineIds.length === 0) {
    visibleOnlineCache = [];
    visibleOnlineCacheTime = now;
    return [];
  }
  const users = await User.find({
    _id: { $in: onlineIds },
    showActiveStatus: { $ne: false },
  }).select("_id");
  visibleOnlineCache = users.map((u) => u._id.toString());
  visibleOnlineCacheTime = now;
  return visibleOnlineCache;
}

function invalidateVisibleOnlineCache() {
  visibleOnlineCache = null;
  visibleOnlineCacheTime = 0;
}

async function emitTypingToConversation(conversationId, senderId, eventName) {
  const conversation = await Conversation.findById(conversationId).select("members");
  if (!conversation) return;

  const isMember = conversation.members.some(
    (memberId) => memberId.toString() === senderId.toString(),
  );
  if (!isMember) return;

  conversation.members.forEach((memberId) => {
    const memberIdStr = memberId.toString();
    if (memberIdStr === senderId.toString()) return;

    const receiverSocketIds = userSocketsMap.get(memberIdStr);
    if (receiverSocketIds) {
      receiverSocketIds.forEach((sid) => {
        io.to(sid).emit(eventName, { conversationId, userId: senderId });
      });
    }
  });
}

async function createCallMessage(call) {
  try {
    const duration = call.startedAt && call.endedAt
      ? Math.round((call.endedAt - call.startedAt) / 1000)
      : 0;

    let status = "ended";
    if (call.endReason === "no_answer") status = "no_answer";
    else if (call.endReason === "all_rejected") status = "rejected";
    else if (call.endReason === "caller_ended" && !call.startedAt) status = "missed";

    const message = await Message.create({
      conversationId: call.conversationId,
      senderId: call.callerId,
      messageType: "call",
      readBy: [call.callerId],
      callInfo: {
        callId: call._id,
        callType: call.callType,
        duration,
        status,
      },
    });

    await Conversation.findByIdAndUpdate(call.conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    const populated = await message.populate("senderId", "fullName avatar");

    const conversation = await Conversation.findById(call.conversationId).select("members");
    if (conversation) {
      conversation.members.forEach((memberId) => {
        const sids = userSocketsMap.get(memberId.toString());
        if (sids) {
          sids.forEach((sid) => {
            io.to(sid).emit("sendMessage", {
              conversationId: call.conversationId.toString(),
              message: populated,
              lastMessage: populated,
              updatedAt: new Date(),
            });
          });
        }
      });
    }
  } catch (err) {
    console.error("createCallMessage error:", err);
  }
}

async function handleCallDisconnect(userId) {
  const callId = activeUserCalls.get(userId);
  if (!callId) return;

  try {
    const call = await Call.findById(callId);
    if (!call || call.status === "ended") {
      activeUserCalls.delete(userId);
      return;
    }

    const isCaller = call.callerId.toString() === userId;

    if (call.status === "ringing") {
      if (isCaller) {
        call.status = "ended";
        call.endedAt = new Date();
        call.endReason = "caller_ended";
        call.participants.forEach((p) => {
          if (p.status === "ringing") p.status = "missed";
          activeUserCalls.delete(p.userId.toString());
          const sids = userSocketsMap.get(p.userId.toString());
          if (sids) sids.forEach((sid) => io.to(sid).emit("call_ended", { callId, endReason: "caller_ended", duration: 0 }));
        });
      } else {
        const participant = call.participants.find(
          (p) => p.userId.toString() === userId
        );
        if (participant) participant.status = "missed";
      }
    } else if (call.status === "ongoing") {
      const participant = call.participants.find(
        (p) => p.userId.toString() === userId && p.status === "joined"
      );
      if (participant) {
        participant.status = "left";
        participant.leftAt = new Date();
      }

      call.participants.forEach((p) => {
        if (p.status === "joined" && p.userId.toString() !== userId) {
          const sids = userSocketsMap.get(p.userId.toString());
          if (sids) sids.forEach((sid) => io.to(sid).emit("call_user_left", { callId, userId, fullName: "" }));
        }
      });

      if (isCaller) {
        call.participants.filter((p) => p.status === "ringing").forEach((p) => {
          p.status = "missed";
          const sids = userSocketsMap.get(p.userId.toString());
          if (sids) sids.forEach((sid) => io.to(sid).emit("call_ended", { callId, endReason: "caller_ended", duration: 0 }));
        });
      }

      const remainingJoined = call.participants.filter((p) => p.status === "joined");
      if (remainingJoined.length < 2) {
        call.status = "ended";
        call.endedAt = new Date();
        call.endReason = "normal";
        remainingJoined.forEach((p) => {
          p.status = "left";
          p.leftAt = new Date();
          activeUserCalls.delete(p.userId.toString());
          const sids = userSocketsMap.get(p.userId.toString());
          if (sids) {
            sids.forEach((sid) => {
              io.to(sid).emit("call_ended", {
                callId,
                endReason: "normal",
                duration: call.startedAt ? Math.round((call.endedAt - call.startedAt) / 1000) : 0,
              });
            });
          }
        });
      }
    }

    activeUserCalls.delete(userId);

    if (callTimeouts.has(callId) && call.status === "ended") {
      clearTimeout(callTimeouts.get(callId));
      callTimeouts.delete(callId);
    }

    await call.save();
    if (call.status === "ended") {
      await createCallMessage(call);
    }
  } catch (err) {
    console.error("handleCallDisconnect error:", err);
    activeUserCalls.delete(userId);
  }
}

io.on("connection", async (socket) => {
  console.log(
    `Kêt nối socket được thiết lập cho người dùng ${socket.user.fullName} `,
  );
  const userId = socket.userId;
  if (!userSocketsMap.has(userId)) {
    userSocketsMap.set(userId, new Set());
  }
  userSocketsMap.get(userId).add(socket.id);

  const isFirstConnection = userSocketsMap.get(userId).size === 1;
  if (isFirstConnection) {
    await User.findByIdAndUpdate(userId, { isOnline: true });
    invalidateVisibleOnlineCache();

    const visibleOnline = await getVisibleOnlineUsers();
    io.emit("getOnlineUsers", visibleOnline);

    if (socket.user.showActiveStatus !== false) {
      const contactSocketIds = await getContactSocketIds(userId, userSocketsMap);
      contactSocketIds.forEach((socketId) => {
        io.to(socketId).emit("user_status", { userId, isOnline: true });
      });
    }
  }

  // Quản lý phòng chat
  socket.on("join_conversation", async (conversationId) => {
    if (!conversationId) return;
    try {
      const conversation = await Conversation.findById(conversationId).select("members");
      if (!conversation) {
        socket.emit("error", { message: "Conversation not found" });
        return;
      }
      const isMember = conversation.members.some(
        (id) => id.toString() === userId
      );
      if (!isMember) {
        socket.emit("error", { message: "You are not a member of this conversation" });
        return;
      }
      socket.join(conversationId);
    } catch (err) {
      socket.emit("error", { message: "Failed to join conversation" });
    }
  });

  socket.on("leave_conversation", (conversationId) => {
    if (conversationId) socket.leave(conversationId);
  });

  // Proxy tính năng Typing
  socket.on("typing_start", async ({ conversationId }) => {
    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;
    await emitTypingToConversation(conversationId, userId, "typing_start");
  });

  socket.on("typing_stop", async ({ conversationId }) => {
    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;
    await emitTypingToConversation(conversationId, userId, "typing_stop");
  });

  // ============ CALL EVENTS ============

  socket.on("call_initiate", async ({ conversationId, callType }, callback) => {
    console.log(`[CALL] call_initiate from ${socket.user.fullName}, type=${callType}, conv=${conversationId}`);
    try {
      if (!["voice", "video"].includes(callType)) {
        return callback?.({ success: false, reason: "invalid_type" });
      }

      const conversation = await Conversation.findById(conversationId).select("members isGroup name avatar");
      if (!conversation) {
        return callback?.({ success: false, reason: "conversation_not_found" });
      }

      const isMember = conversation.members.some((m) => m.toString() === userId);
      if (!isMember) {
        return callback?.({ success: false, reason: "not_member" });
      }

      if (activeUserCalls.has(userId)) {
        return callback?.({ success: false, reason: "already_in_call" });
      }

      const receiverIds = conversation.members
        .map((m) => m.toString())
        .filter((m) => m !== userId);

      if (!conversation.isGroup && receiverIds.length === 1) {
        const users = await User.find({ _id: { $in: [userId, receiverIds[0]] } }).select("blockedUsers");
        const caller = users.find((u) => u._id.toString() === userId);
        const receiver = users.find((u) => u._id.toString() === receiverIds[0]);
        if (caller && receiver) {
          const blocked =
            caller.blockedUsers.some((id) => id.toString() === receiverIds[0]) ||
            receiver.blockedUsers.some((id) => id.toString() === userId);
          if (blocked) {
            return callback?.({ success: false, reason: "blocked" });
          }
        }
      }

      const participants = [
        { userId, joinedAt: new Date(), status: "joined" },
        ...receiverIds.map((rid) => ({ userId: rid, status: "ringing" })),
      ];

      const call = await Call.create({
        conversationId,
        callerId: userId,
        participants,
        callType,
        status: "ringing",
      });

      activeUserCalls.set(userId, call._id.toString());

      const callerUser = socket.user;
      let onlineReceiverCount = 0;

      for (const rid of receiverIds) {
        if (activeUserCalls.has(rid)) {
          const p = call.participants.find((pp) => pp.userId.toString() === rid);
          if (p) p.status = "missed";
          continue;
        }

        const receiverSids = userSocketsMap.get(rid);
        if (receiverSids && receiverSids.size > 0) {
          onlineReceiverCount++;
          receiverSids.forEach((sid) => {
            io.to(sid).emit("call_incoming", {
              callId: call._id.toString(),
              callerId: userId,
              callerName: callerUser.fullName,
              callerAvatar: callerUser.avatar,
              callType,
              conversationId: conversationId.toString(),
              isGroup: conversation.isGroup,
              conversationName: conversation.name || null,
              conversationAvatar: conversation.avatar || null,
            });
          });
        } else {
          const p = call.participants.find((pp) => pp.userId.toString() === rid);
          if (p) p.status = "missed";
        }
      }

      if (onlineReceiverCount === 0) {
        call.status = "ended";
        call.endedAt = new Date();
        call.endReason = "no_answer";
        await call.save();
        activeUserCalls.delete(userId);
        await createCallMessage(call);
        return callback?.({ success: false, reason: "all_offline" });
      }

      await call.save();

      const timeoutId = setTimeout(async () => {
        callTimeouts.delete(call._id.toString());
        try {
          const c = await Call.findOneAndUpdate(
            { _id: call._id, status: "ringing" },
            {
              $set: {
                status: "ended",
                endedAt: new Date(),
                endReason: "no_answer",
              },
            },
            { new: true }
          );

          if (!c) return;

          c.participants.forEach((p) => {
            if (p.status === "ringing") p.status = "missed";
          });
          await c.save();

          const allParticipantIds = c.participants.map((p) => p.userId.toString());
          allParticipantIds.push(c.callerId.toString());
          const uniqueIds = [...new Set(allParticipantIds)];
          uniqueIds.forEach((uid) => {
            activeUserCalls.delete(uid);
            const sids = userSocketsMap.get(uid);
            if (sids) sids.forEach((sid) => io.to(sid).emit("call_no_answer", { callId: c._id.toString() }));
          });

          await createCallMessage(c);
        } catch (err) {
          console.error("Call timeout error:", err);
        }
      }, 30000);

      callTimeouts.set(call._id.toString(), timeoutId);
      callback?.({ success: true, callId: call._id.toString() });
    } catch (err) {
      console.error("call_initiate error:", err);
      callback?.({ success: false, reason: "error" });
    }
  });

  socket.on("call_accept", async ({ callId }, callback) => {
    console.log(`[CALL] call_accept from ${socket.user.fullName}, callId=${callId}`);
    try {
      const call = await Call.findById(callId);
      if (!call || call.status === "ended") {
        return callback?.({ success: false, reason: "call_not_found" });
      }

      const participant = call.participants.find(
        (p) => p.userId.toString() === userId && p.status === "ringing"
      );
      if (!participant) {
        return callback?.({ success: false, reason: "not_participant" });
      }

      participant.status = "joined";
      participant.joinedAt = new Date();

      if (call.status === "ringing") {
        call.status = "ongoing";
        call.startedAt = new Date();
      }

      await call.save();
      activeUserCalls.set(userId, callId);

      const joinedIds = call.participants
        .filter((p) => p.status === "joined" && p.userId.toString() !== userId)
        .map((p) => p.userId.toString());

      if (call.callerId.toString() !== userId) {
        joinedIds.push(call.callerId.toString());
      }

      const uniqueJoined = [...new Set(joinedIds)];
      uniqueJoined.forEach((uid) => {
        const sids = userSocketsMap.get(uid);
        if (sids) {
          sids.forEach((sid) => {
            io.to(sid).emit("call_user_joined", {
              callId,
              userId,
              fullName: socket.user.fullName,
              avatar: socket.user.avatar,
            });
          });
        }
      });

      const stillRinging = call.participants.some((p) => p.status === "ringing");
      if (!stillRinging && callTimeouts.has(callId)) {
        clearTimeout(callTimeouts.get(callId));
        callTimeouts.delete(callId);
      }

      callback?.({ success: true, participants: uniqueJoined });
    } catch (err) {
      console.error("call_accept error:", err);
      callback?.({ success: false, reason: "error" });
    }
  });

  socket.on("call_reject", async ({ callId }, callback) => {
    try {
      const call = await Call.findById(callId);
      if (!call || call.status === "ended") {
        return callback?.({ success: false, reason: "call_not_found" });
      }

      const participant = call.participants.find(
        (p) => p.userId.toString() === userId && p.status === "ringing"
      );
      if (!participant) {
        return callback?.({ success: false, reason: "not_participant" });
      }

      participant.status = "rejected";

      const callerSids = userSocketsMap.get(call.callerId.toString());
      if (callerSids) {
        callerSids.forEach((sid) => {
          io.to(sid).emit("call_user_rejected", {
            callId,
            userId,
            fullName: socket.user.fullName,
          });
        });
      }

      const allHandled = call.participants.every((p) => p.status !== "ringing");
      const anyJoined = call.participants.some((p) => p.status === "joined") ||
        call.callerId.toString() === userId;

      if (allHandled && !anyJoined) {
        call.status = "ended";
        call.endedAt = new Date();
        call.endReason = "all_rejected";

        if (callTimeouts.has(callId)) {
          clearTimeout(callTimeouts.get(callId));
          callTimeouts.delete(callId);
        }

        call.participants.forEach((p) => activeUserCalls.delete(p.userId.toString()));
        activeUserCalls.delete(call.callerId.toString());

        const callerSids2 = userSocketsMap.get(call.callerId.toString());
        if (callerSids2) {
          callerSids2.forEach((sid) => {
            io.to(sid).emit("call_ended", {
              callId,
              endReason: "all_rejected",
              duration: 0,
            });
          });
        }

        await call.save();
        await createCallMessage(call);
        return callback?.({ success: true });
      }

      await call.save();
      callback?.({ success: true });
    } catch (err) {
      console.error("call_reject error:", err);
      callback?.({ success: false, reason: "error" });
    }
  });

  socket.on("call_signal", ({ callId, targetUserId, signal }) => {
    const senderCallId = activeUserCalls.get(userId);
    const targetCallId = activeUserCalls.get(targetUserId);
    if (!senderCallId || !targetCallId || senderCallId !== targetCallId) {
      return;
    }

    const targetSids = userSocketsMap.get(targetUserId);
    if (targetSids) {
      targetSids.forEach((sid) => {
        io.to(sid).emit("call_signal", {
          callId,
          fromUserId: userId,
          signal,
        });
      });
    }
  });

  socket.on("call_end", async ({ callId }, callback) => {
    try {
      const call = await Call.findById(callId);
      if (!call || call.status === "ended") {
        return callback?.({ success: false, reason: "call_not_found" });
      }

      const isCaller = call.callerId.toString() === userId;
      const isParticipant = call.participants.some(
        (p) => p.userId.toString() === userId
      );
      if (!isCaller && !isParticipant) {
        return callback?.({ success: false, reason: "not_in_call" });
      }

      if (call.status === "ringing" && isCaller) {
        call.status = "ended";
        call.endedAt = new Date();
        call.endReason = "caller_ended";
        call.participants.forEach((p) => {
          if (p.status === "ringing") p.status = "missed";
        });

        if (callTimeouts.has(callId)) {
          clearTimeout(callTimeouts.get(callId));
          callTimeouts.delete(callId);
        }

        call.participants.forEach((p) => {
          activeUserCalls.delete(p.userId.toString());
          const sids = userSocketsMap.get(p.userId.toString());
          if (sids) {
            sids.forEach((sid) => io.to(sid).emit("call_ended", {
              callId,
              endReason: "caller_ended",
              duration: 0,
            }));
          }
        });
        activeUserCalls.delete(userId);

        await call.save();
        await createCallMessage(call);
        return callback?.({ success: true });
      }

      if (call.status === "ongoing") {
        const participant = call.participants.find(
          (p) => p.userId.toString() === userId && p.status === "joined"
        );
        if (participant) {
          participant.status = "left";
          participant.leftAt = new Date();
        }
        if (isCaller) {
          activeUserCalls.delete(userId);
        }
        activeUserCalls.delete(userId);

        const remainingJoined = call.participants.filter(
          (p) => p.status === "joined"
        );

        const totalActive = remainingJoined.length;

        call.participants.forEach((p) => {
          if (p.status === "joined" && p.userId.toString() !== userId) {
            const sids = userSocketsMap.get(p.userId.toString());
            if (sids) {
              sids.forEach((sid) => io.to(sid).emit("call_user_left", {
                callId,
                userId,
                fullName: socket.user.fullName,
              }));
            }
          }
        });

        if (isCaller) {
          call.participants
            .filter((p) => p.status === "ringing")
            .forEach((p) => {
              p.status = "missed";
              const sids = userSocketsMap.get(p.userId.toString());
              if (sids) sids.forEach((sid) => io.to(sid).emit("call_ended", { callId, endReason: "caller_ended", duration: 0 }));
            });
        }

        if (totalActive < 2) {
          call.status = "ended";
          call.endedAt = new Date();
          call.endReason = "normal";

          if (callTimeouts.has(callId)) {
            clearTimeout(callTimeouts.get(callId));
            callTimeouts.delete(callId);
          }

          remainingJoined.forEach((p) => {
            p.status = "left";
            p.leftAt = new Date();
            activeUserCalls.delete(p.userId.toString());
            const sids = userSocketsMap.get(p.userId.toString());
            if (sids) {
              sids.forEach((sid) => io.to(sid).emit("call_ended", {
                callId,
                endReason: "normal",
                duration: call.startedAt
                  ? Math.round((call.endedAt - call.startedAt) / 1000)
                  : 0,
              }));
            }
          });
          activeUserCalls.delete(call.callerId.toString());

          await call.save();
          await createCallMessage(call);
          return callback?.({ success: true });
        }

        await call.save();
        return callback?.({ success: true });
      }

      callback?.({ success: true });
    } catch (err) {
      console.error("call_end error:", err);
      callback?.({ success: false, reason: "error" });
    }
  });

  socket.on("call_toggle_media", ({ callId, mediaType, enabled }) => {
    const call = activeUserCalls.get(userId);
    if (!call) return;

    for (const [uid, cid] of activeUserCalls.entries()) {
      if (cid === callId && uid !== userId) {
        const sids = userSocketsMap.get(uid);
        if (sids) {
          sids.forEach((sid) => io.to(sid).emit("call_media_toggled", {
            callId,
            userId,
            mediaType,
            enabled,
          }));
        }
      }
    }
  });

  // ============ END CALL EVENTS ============

  socket.on("getUserLastSeen", async (targetUserId, callback) => {
    try {
      const targetUser = await User.findById(targetUserId).select("lastSeen");
      callback({ lastSeen: targetUser?.lastSeen || null });
    } catch {
      callback({ lastSeen: null });
    }
  });

  socket.on("toggleActiveStatus", async (enabled, callback) => {
    try {
      const update = { showActiveStatus: enabled };
      if (!enabled) {
        update.lastSeen = new Date();
      }
      await User.findByIdAndUpdate(userId, update);
      invalidateVisibleOnlineCache();
      const visibleOnline = await getVisibleOnlineUsers();
      io.emit("getOnlineUsers", visibleOnline);
      if (!enabled) {
        io.emit("userLastSeen", { userId, lastSeen: update.lastSeen });
      }
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false });
    }
  });

  socket.on("disconnect", async () => {
    console.log(`Người dùng đã ngắt kết nối: ${socket.user.fullName}`);

    await handleCallDisconnect(userId);

    const sockets = userSocketsMap.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSocketsMap.delete(userId);

        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
        invalidateVisibleOnlineCache();

        const visibleOnline = await getVisibleOnlineUsers();
        io.emit("getOnlineUsers", visibleOnline);
        io.emit("userLastSeen", { userId, lastSeen });

        const contactSocketIds = await getContactSocketIds(userId, userSocketsMap);
        contactSocketIds.forEach((socketId) => {
          io.to(socketId).emit("user_status", { userId, isOnline: false, lastSeen });
        });
      }
    }
  });
});

export { io, server, app };
