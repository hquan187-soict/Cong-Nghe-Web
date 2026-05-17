import { Server } from "socket.io";
import http from "http";
import express from "express";
import { socketAuthMiddleware } from "../middleware/socketAuthMiddleware.js";
import User from "../models/User.js";
import { getContactSocketIds } from "./socketHelper.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [process.env.CLIENT_URL],
    credentials: true,
  },
});

io.use(socketAuthMiddleware);

export function getReceiverSocketId(userId) {
  return userSocketsMap[userId];
}

const userSocketsMap = {};

async function getVisibleOnlineUsers() {
  const onlineIds = Object.keys(userSocketsMap);
  if (onlineIds.length === 0) return [];
  const users = await User.find({ _id: { $in: onlineIds }, showActiveStatus: { $ne: false } }).select("_id");
  return users.map((u) => u._id.toString());
}

io.on("connection", async (socket) => {
  console.log(
    `Kêt nối socket được thiết lập cho người dùng ${socket.user.fullName} `,
  );
  const userId = socket.userId;
  userSocketsMap[userId] = socket.id;

  await User.findByIdAndUpdate(userId, { isOnline: true });

  const visibleOnline = await getVisibleOnlineUsers();
  io.emit("getOnlineUsers", visibleOnline);

  const contactSocketIds = await getContactSocketIds(userId, userSocketsMap);
  contactSocketIds.forEach((socketId) => {
    io.to(socketId).emit("user_status", { userId, isOnline: true });
  });

  // Quản lý phòng chat
  socket.on("join_conversation", (conversationId) => {
    if (conversationId) socket.join(conversationId);
  });

  socket.on("leave_conversation", (conversationId) => {
    if (conversationId) socket.leave(conversationId);
  });

  // Proxy tính năng Typing
  socket.on("typing_start", ({ conversationId }) => {
    if (conversationId)
      socket.to(conversationId).emit("typing_start", { conversationId, userId });
  });

  socket.on("typing_stop", ({ conversationId }) => {
    if (conversationId)
      socket.to(conversationId).emit("typing_stop", { conversationId, userId });
  });

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
    delete userSocketsMap[userId];

    const lastSeen = new Date();

    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });

    const visibleOnline = await getVisibleOnlineUsers();
    io.emit("getOnlineUsers", visibleOnline);
    io.emit("userLastSeen", { userId, lastSeen });

    const contactSocketIds = await getContactSocketIds(userId, userSocketsMap);
    contactSocketIds.forEach((socketId) => {
      io.to(socketId).emit("user_status", { userId, isOnline: false, lastSeen });
    });
  });
});

export { io, server, app };
