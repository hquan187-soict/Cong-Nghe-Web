import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDB from './lib/db.js';
import authRoutes from './routes/auth.routes.js';
import { globalErrorHandler } from './middleware/globalErrorHandler.js';
import userRoutes from './routes/user.routes.js';
import cors from 'cors';
import conversationRoutes from "./routes/conversation.routes.js";
import rateLimiter from './middleware/rateLimiter.js';
import messageRoutes from "./routes/message.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import callRoutes from "./routes/call.routes.js";
import configRoutes from "./routes/config.routes.js";
import { app, server } from './lib/socket.js';

//test import
import "./models/User.js";
import "./models/Conversation.js";
import "./models/Message.js";
import "./models/Call.js";
import "./models/Notification.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));
app.use(cookieParser());

app.get('/', (req, res) => {
  res.send('API is running');
});

app.use(rateLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/config", configRoutes);


app.use(globalErrorHandler);

const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
