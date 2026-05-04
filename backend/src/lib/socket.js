import { Server } from "socket.io";
import http from "http";
import express from "express";
import { socketAuthMiddleware } from "../middleware/socketAuthMiddleware.js";
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

io.on("connection", (socket) => {
    console.log(`Kêt nối socket được thiết lập cho người dùng ${socket.user.fullName} `);
    const userId = socket.userId;
    userSocketsMap[userId] = socket.id;

    io.emit("getOnlineUsers", Object.keys(userSocketsMap));

    socket.on("disconnect", () => {
        console.log(`Người dùng đã ngắt kết nối: ${socket.user.fullName}`);
        delete userSocketsMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketsMap));
    });
});

export { io, server, app };