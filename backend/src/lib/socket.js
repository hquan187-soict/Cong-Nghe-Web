import { Server } from "socket.io";
import http from "http";
import express from "express";
import { socketAuthMiddleware } from "../middleware/socketAuthMiddleware.js";
import dotenv from "dotenv";
import User from "../models/User.js";
import { getContactSocketIds } from "./socketHelper.js";

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

io.on("connection", async (socket) => {
  console.log(
    `Kêt nối socket được thiết lập cho người dùng ${socket.user.fullName} `,
  );
  const userId = socket.userId;
  userSocketsMap[userId] = socket.id;

  // Cập nhật danh sách online
  await User.findByIdAndUpdate(userId, {
    isOnline: true,
  });
  io.emit("getOnlineUsers", Object.keys(userSocketsMap));

  const contactSocketIds = await getContactSocketIds(userId, userSocketsMap);

  contactSocketIds.forEach((socketId) => {
    io.to(socketId).emit("user_status", {
      userId,
      isOnline: true,
    });
  });
  //socket.broadcast.emit("user_status", { userId, isOnline: true });

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
      socket
        .to(conversationId)
        .emit("typing_start", { conversationId, userId });
  });

  socket.on("typing_stop", ({ conversationId }) => {
    if (conversationId)
      socket.to(conversationId).emit("typing_stop", { conversationId, userId });
  });

  socket.on("disconnect", async () => {
    console.log(`Người dùng đã ngắt kết nối: ${socket.user.fullName}`);
    delete userSocketsMap[userId];

    const lastSeen = new Date();

    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen,
    });

    io.emit("getOnlineUsers", Object.keys(userSocketsMap));

    const contactSocketIds = await getContactSocketIds(userId, userSocketsMap);

    contactSocketIds.forEach((socketId) => {
      io.to(socketId).emit("user_status", {
        userId,
        isOnline: false,
        lastSeen,
      });
    });

    //socket.broadcast.emit("user_status", { userId, isOnline: false });
  });
});

export { io, server, app };
