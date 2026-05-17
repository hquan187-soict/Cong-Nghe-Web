import { Server } from "socket.io";
import http from "http";
import express from "express";
import { socketAuthMiddleware } from "../middleware/socketAuthMiddleware.js";
import User from "../models/User.js";
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
    console.log(`Kêt nối socket được thiết lập cho người dùng ${socket.user.fullName} `);
    const userId = socket.userId;
    userSocketsMap[userId] = socket.id;

    const visibleOnline = await getVisibleOnlineUsers();
    io.emit("getOnlineUsers", visibleOnline);

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
        const now = new Date();
        try {
            await User.findByIdAndUpdate(userId, { lastSeen: now });
        } catch (err) {
            console.error("Lỗi cập nhật lastSeen:", err);
        }
        const visibleOnline = await getVisibleOnlineUsers();
        io.emit("getOnlineUsers", visibleOnline);
        io.emit("userLastSeen", { userId, lastSeen: now });
    });
});

export { io, server, app };